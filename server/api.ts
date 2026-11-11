import { z } from 'zod';
import { Hono } from 'hono';
import { neon } from '@neondatabase/serverless';
import { verifyToken, createClerkClient } from '@clerk/backend';
import { authorize, type Resource } from '../shared/access';
import { onboardingSchema, inviteSchema, canInvite, profilePatchSchema, inquirySchema, quoteRequestCreateSchema, quoteRequestPatchSchema, quoteCreateSchema, projectCreateSchema, projectPatchSchema, projectUpdateSchema, agreementCreateSchema, customerListSchema } from '../shared/validation';

type Env = {
  DATABASE_URL: string;
  CLERK_SECRET_KEY: string;
  CLERK_PUBLISHABLE_KEY: string;
  CLERK_WEBHOOK_SECRET: string;
  APP_ORIGIN: string;
};

type Vars = { clerkId: string };

export const api = new Hono<{ Bindings: Env; Variables: Vars }>().basePath('/api');

const sqlFor = (env: Env) => {
  const sql = neon(env.DATABASE_URL);
  return async (...args: Parameters<typeof sql>) => {
    try {
      return await sql(...args);
    } catch (err) {
      console.error("DATABASE ERROR:", err?.message || err);
      throw err;
    }
  };
};

api.onError((err, c) => {
  console.error('API error', err.message);
  return c.json({ error: 'Internal server error' }, 500);
});

api.get('/health', c => c.json({ status: 'ok' }));

// ─── Clerk webhook: auto-assign default role on signup ──────────────────────
api.post('/clerk-webhook', async (c) => {
  const svixId = c.req.header('svix-id');
  const svixTimestamp = c.req.header('svix-timestamp');
  const svixSignature = c.req.header('svix-signature');
  if (!svixId || !svixTimestamp || !svixSignature) {
    return c.json({ error: 'Missing Svix headers' }, 400);
  }

  const body = await c.req.text();
  const signedPayload = `${svixId}.${svixTimestamp}.${body}`;
  const encoder = new TextEncoder();

  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(c.env.CLERK_WEBHOOK_SECRET),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['verify']
  );

  const sigs = svixSignature.split(' ').map((s) => s.replace('v1,', ''));
  let payload = null;
  for (const sig of sigs) {
    const signatureBytes = Uint8Array.from(atob(sig), (ch) => ch.charCodeAt(0));
    const valid = await crypto.subtle.verify(
      'HMAC',
      key,
      signatureBytes,
      encoder.encode(signedPayload)
    );
    if (valid) {
      payload = JSON.parse(body);
      break;
    }
  }
  if (!payload) return c.json({ error: 'Invalid webhook signature' }, 401);

    if (payload.type === 'user.created') {
    const userId = payload.data.id;
    try {
      const clerk = createClerkClient({ secretKey: c.env.CLERK_SECRET_KEY });
      const user = await clerk.users.getUser(userId);
      if (!user.privateMetadata?.role) {
        await clerk.users.updateUser(userId, {
          privateMetadata: { role: 'user' },
        });
        console.log(`Assigned default role "user" to user ${userId}`);
      }
    } catch (err) {
      console.error(`Failed to process user ${userId}:`, err?.message || err);
      // Still return 200 to acknowledge receipt — Clerk will not retry
    }
  }

  return c.json({ ok: true }, 200);
});

// ─── Auth middleware ──────────────────────────────────────────────────────────
function isPublicApi(method: string, path: string) {
  const normalized = path.replace(/\/$/, '');
  if (normalized.endsWith('/health') || normalized.endsWith('/clerk-webhook')) return true;
  if (method === 'GET' && normalized.endsWith('/services')) return true;
  if (method === 'POST' && normalized.endsWith('/inquiries')) return true;
  return false;
}

api.use('*', async (c, next) => {
  if (isPublicApi(c.req.method, c.req.path)) {
    return next();
  }

  const bearer = c.req.header('authorization') || '';
  if (!bearer.startsWith('Bearer ')) return c.json({ error: 'Authentication required' }, 401);
  try {
    const token = bearer.slice(7);
    const payload = await verifyToken(token, {
      secretKey: c.env.CLERK_SECRET_KEY,
      authorizedParties: [c.env.APP_ORIGIN],
    });
    c.set('clerkId', payload.sub);
    await next();
  } catch {
    return c.json({ error: 'Invalid session' }, 401);
  }
});

async function currentUser(env: Env, clerkId: string) {
  const sql = sqlFor(env);
  const existing = await sql`SELECT id, clerk_user_id, email, display_name, first_name, last_name, mobile_phone, preferred_contact_method, is_platform_admin, status FROM users WHERE clerk_user_id=${clerkId}`;
  if (existing[0]) return existing[0];
  const identity = await createClerkClient({ secretKey: env.CLERK_SECRET_KEY }).users.getUser(clerkId);
  const primary = identity.emailAddresses.find(e => e.id === identity.primaryEmailAddressId);
  if (!primary?.verification?.status || primary.verification.status !== 'verified') throw new Error('Verified email required');
  return (await sql`INSERT INTO users(clerk_user_id, email, display_name, first_name, last_name) VALUES(${clerkId}, ${primary.emailAddress.toLowerCase()}, ${[identity.firstName, identity.lastName].filter(Boolean).join(' ') || null}, ${identity.firstName || null}, ${identity.lastName || null}) ON CONFLICT(clerk_user_id) DO UPDATE SET email=EXCLUDED.email, updated_at=now() RETURNING id, clerk_user_id, email, display_name, first_name, last_name, mobile_phone, preferred_contact_method, is_platform_admin, status`)[0];
}

type Actor = {
  user: Record<string, any>;
  subject: {
    isPlatformAdmin: boolean;
    isInternalAdmin: boolean;
    isInternalManager: boolean;
    isInternalEmployee: boolean;
    customerOrganizationIds: string[];
    permittedOrganizationIds: string[];
  };
};

async function requireActor(c: { get: (key: 'clerkId') => string; env: Env; json: (body: unknown, status?: number) => Response }): Promise<Actor | Response> {
  const clerkId = c.get('clerkId');
  if (!clerkId) return c.json({ error: 'Authentication required' }, 401);
  let user: Record<string, any>;
  try {
    user = await currentUser(c.env, clerkId);
  } catch (error) {
    if (error instanceof Error && error.message === 'Verified email required') return c.json({ error: 'Verified email required' }, 403);
    throw error;
  }
  if (user.status !== 'active') return c.json({ error: 'User is not active' }, 403);
  return { user, subject: await loadSubject(c.env, user) };
}

async function loadSubject(env: Env, user: Record<string, any>): Promise<Actor['subject']> {
  const memberships = await sqlFor(env)`SELECT o.id AS organization_id, o.is_internal, r.code FROM organization_members m JOIN organizations o ON o.id = m.organization_id LEFT JOIN user_roles ur ON ur.organization_member_id = m.id LEFT JOIN roles r ON r.id = ur.role_id WHERE m.user_id = ${user.id} AND m.status = 'active' AND o.status = 'active'`;
  const employed = await sqlFor(env)`SELECT o.is_internal FROM employees e JOIN organizations o ON o.id = e.organization_id WHERE e.user_id = ${user.id} AND e.status = 'active' AND o.status = 'active'`;
  return {
    isPlatformAdmin: Boolean(user.is_platform_admin),
    isInternalAdmin: Boolean(user.is_platform_admin) || memberships.some((row) => row.is_internal && row.code === 'organization_admin'),
    isInternalManager: memberships.some((row) => row.is_internal && row.code === 'manager'),
    isInternalEmployee: employed.some((row) => row.is_internal) || memberships.some((row) => row.is_internal && row.code === 'employee'),
    customerOrganizationIds: [...new Set(memberships.filter((row) => row.code === 'customer' && !row.is_internal).map((row) => row.organization_id))],
    permittedOrganizationIds: [...new Set(memberships.filter((row) => row.code === 'employee' || row.code === 'manager' || row.code === 'organization_admin').map((row) => row.organization_id))],
  };
}

function resourceFor(subject: Actor['subject'], org: Record<string, any>, extra: Partial<Resource> = {}): Resource {
  const organizationId = org.organization_id ?? org.id;
  return {
    organizationIsActive: org.status === 'active' || org.organization_status === 'active',
    organizationIsInternal: Boolean(org.is_internal),
    customerOfOrg: subject.customerOrganizationIds.includes(organizationId),
    permittedOnOrg: subject.permittedOrganizationIds.includes(organizationId),
    employeeAssigned: Boolean(extra.employeeAssigned),
    managerAuthorized: Boolean(extra.managerAuthorized),
  };
}

function isResponse(value: Actor | Response): value is Response {
  return value instanceof Response;
}

api.get('/me', async c => {
  const actor = await requireActor(c);
  if (isResponse(actor)) return actor;
  const { user } = actor;
  const sql = sqlFor(c.env);
  const memberships = await sql`SELECT m.organization_id AS "organizationId", o.name AS "organizationName", COALESCE(array_agg(r.code) FILTER(WHERE r.code IS NOT NULL), '{}') AS roles FROM organization_members m JOIN organizations o ON o.id=m.organization_id LEFT JOIN user_roles ur ON ur.organization_member_id=m.id LEFT JOIN roles r ON r.id=ur.role_id WHERE m.user_id=${user.id} GROUP BY m.organization_id, o.name`;
  return c.json({ user: { id: user.id, displayName: user.display_name, email: user.email, firstName: user.first_name, lastName: user.last_name, mobilePhone: user.mobile_phone, preferredContactMethod: user.preferred_contact_method }, memberships });
});

api.patch('/me', async c => {
  const parsed = profilePatchSchema.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) return c.json({ error: 'Invalid profile data', details: parsed.error.flatten() }, 400);
  const actor = await requireActor(c);
  if (isResponse(actor)) return actor;
  const { user } = actor;
  const d = parsed.data;
  const sql = sqlFor(c.env);
  const rows = await sql`UPDATE users SET
    first_name = CASE WHEN ${d.firstName !== undefined} THEN ${d.firstName ?? null} ELSE first_name END,
    last_name = CASE WHEN ${d.lastName !== undefined} THEN ${d.lastName ?? null} ELSE last_name END,
    display_name = CASE WHEN ${d.displayName !== undefined} THEN ${d.displayName ?? null} ELSE display_name END,
    mobile_phone = CASE WHEN ${d.mobilePhone !== undefined} THEN ${d.mobilePhone ?? null} ELSE mobile_phone END,
    preferred_contact_method = CASE WHEN ${d.preferredContactMethod !== undefined} THEN ${d.preferredContactMethod ?? null} ELSE preferred_contact_method END,
    updated_at = now()
    WHERE id = ${user.id}
    RETURNING id, email, display_name, first_name, last_name, mobile_phone, preferred_contact_method`;
  const saved = rows[0];
  return c.json({ user: { id: saved.id, email: saved.email, displayName: saved.display_name, firstName: saved.first_name, lastName: saved.last_name, mobilePhone: saved.mobile_phone, preferredContactMethod: saved.preferred_contact_method } });
});

api.post('/onboarding/customer', async c => {
  const parsed = onboardingSchema.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) return c.json({ error: 'Invalid onboarding data', details: parsed.error.flatten() }, 400);
  const actor = await requireActor(c);
  if (isResponse(actor)) return actor;
  const u = actor.user;
  const d = parsed.data;
  const sql = sqlFor(c.env);
  const existing = await sql`SELECT id FROM organization_members WHERE user_id=${u.id} LIMIT 1`;
  if (existing.length) return c.json({ error: 'Account already belongs to an organization. Contact support to add another.' }, 409);
  const slug = (d.organizationName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 45) || 'organization') + '-' + crypto.randomUUID().slice(0, 8);
  const phone = d.phone.trim() || null;
  const created = await sql`WITH org AS (
 INSERT INTO organizations(name, slug, address_line1, city, region, postal_code, country, industry, website, business_phone)
 VALUES(${d.organizationName}, ${slug}, ${d.addressLine1}, ${d.city}, ${d.region}, ${d.postalCode}, ${d.country}, ${d.industry}, ${d.website}, ${phone}) RETURNING id
), member AS (
 INSERT INTO organization_members(organization_id, user_id) SELECT org.id, ${u.id} FROM org RETURNING id, organization_id
), assigned AS (
 INSERT INTO user_roles(organization_member_id, role_id) SELECT member.id, roles.id FROM member CROSS JOIN roles WHERE roles.code='customer' RETURNING id
), customer AS (
 INSERT INTO customers(organization_id, user_id, name) SELECT org.id, ${u.id}, ${d.contactName} FROM org RETURNING id
), audit AS (
 INSERT INTO audit_logs(organization_id, actor_user_id, action, resource_type, resource_id)
 SELECT org.id, ${u.id}, 'organization.created', 'organization', org.id FROM org CROSS JOIN assigned CROSS JOIN customer RETURNING id
) SELECT org.id FROM org JOIN audit ON true`;
  if (!created[0]) return c.json({ error: 'Customer role is not configured; run the seed script' }, 503);
  const orgId = created[0].id;
  return c.json({ organizationId: orgId }, 201);
});

api.post('/invitations', async c => {
  const parsed = inviteSchema.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) return c.json({ error: 'Invalid invitation request' }, 400);
  const sql = sqlFor(c.env);
  const actor = await requireActor(c);
  if (isResponse(actor)) return actor;
  const u = actor.user;
  const d = parsed.data;
  const roleRows = await sql`SELECT r.code FROM organization_members m JOIN user_roles ur ON ur.organization_member_id=m.id JOIN roles r ON r.id=ur.role_id WHERE m.organization_id=${d.organizationId} AND m.user_id=${u.id} AND m.status='active'`;
  if (!canInvite(roleRows.map(x => x.code as string), Boolean(u.is_platform_admin))) return c.json({ error: 'Insufficient permissions' }, 403);
  const rows = await sql`INSERT INTO invitations(organization_id, email, invited_by, expires_at) VALUES(${d.organizationId}, ${d.email.toLowerCase()}, ${u.id}, now() + interval '7 days') RETURNING id, status`;
  await sql`INSERT INTO audit_logs(organization_id, actor_user_id, action, resource_type, resource_id) VALUES(${d.organizationId}, ${u.id}, 'invitation.created', 'invitation', ${rows[0].id})`;
  return c.json({ ...rows[0], delivery: 'not_configured' }, 201);
});

function clientIp(c: { req: { header: (name: string) => string | undefined } }) {
  return c.req.header('cf-connecting-ip') || c.req.header('x-forwarded-for')?.split(',')[0]?.trim() || null;
}

api.get('/services', async c => {
  const rows = await sqlFor(c.env)`SELECT id, code, name, description FROM service_types WHERE is_active = true ORDER BY name`;
  return c.json({ services: rows });
});

api.post('/inquiries', async c => {
  const parsed = inquirySchema.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) return c.json({ error: 'Invalid inquiry', details: parsed.error.flatten() }, 400);
  const d = parsed.data;
  const sql = sqlFor(c.env);
  const ip = clientIp(c);
  const recent = await sql`SELECT count(*)::int AS n FROM inquiries WHERE created_at > now() - interval '1 hour' AND (contact_email = ${d.contactEmail.toLowerCase()} OR (${ip}::text IS NOT NULL AND source_ip = ${ip}))`;
  if (Number(recent[0]?.n || 0) >= 5) return c.json({ error: 'Too many inquiries. Try again later.' }, 429);
  let userId: string | null = null;
  const bearer = c.req.header('authorization') || '';
  if (bearer.startsWith('Bearer ')) {
    try {
      const payload = await verifyToken(bearer.slice(7), { secretKey: c.env.CLERK_SECRET_KEY, authorizedParties: [c.env.APP_ORIGIN] });
      userId = (await currentUser(c.env, payload.sub)).id as string;
    } catch {
      userId = null;
    }
  }
  const rows = await sql`INSERT INTO inquiries(user_id, topic, service_name, message, contact_preference, contact_name, contact_email, source_ip) VALUES(${userId}, ${d.topic}, ${d.service || null}, ${d.message}, ${d.contactPreference}, ${d.contactName}, ${d.contactEmail.toLowerCase()}, ${ip}) RETURNING id, created_at`;
  return c.json({ id: rows[0].id, createdAt: rows[0].created_at }, 201);
});

api.post('/quote-requests', async c => {
  const parsed = quoteRequestCreateSchema.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) return c.json({ error: 'Invalid quote request', details: parsed.error.flatten() }, 400);
  const actor = await requireActor(c);
  if (isResponse(actor)) return actor;
  const d = parsed.data;
  const org = await sqlFor(c.env)`SELECT id, status, is_internal FROM organizations WHERE id = ${d.organizationId} LIMIT 1`;
  if (!org[0]) return c.json({ error: 'Organization not found' }, 404);
  if (!authorize('create_quote_request', actor.subject, resourceFor(actor.subject, org[0])).ok) return c.json({ error: 'Forbidden' }, 403);
  const user = actor.user;
  const requestNumber = `QR-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;
  const rows = await sqlFor(c.env)`INSERT INTO quote_requests(organization_id, request_number, requested_by_user_id, service_type_id, title, description, scope_of_work, requested_start_date, budget_range) VALUES(${d.organizationId}, ${requestNumber}, ${user.id}, ${d.serviceTypeId ?? null}, ${d.title}, ${d.description || null}, ${d.scopeOfWork}, ${d.requestedStartDate}, ${d.budgetRange}) RETURNING id, request_number, status`;
  return c.json({ id: rows[0].id, requestNumber: rows[0].request_number, status: rows[0].status }, 201);
});

api.get('/quote-requests', async c => {
  const actor = await requireActor(c);
  if (isResponse(actor)) return actor;
  const user = actor.user;
  const admin = actor.subject.isPlatformAdmin || actor.subject.isInternalAdmin;
  const organizationId = c.req.query('organizationId') || null;
  const status = c.req.query('status') || null;
  if (organizationId && !z.string().uuid().safeParse(organizationId).success) return c.json({ error: 'Invalid organization' }, 400);
  const customerIds = actor.subject.customerOrganizationIds.length ? actor.subject.customerOrganizationIds : ['00000000-0000-0000-0000-000000000000'];
  const rows = await sqlFor(c.env)`SELECT qr.id, qr.organization_id, qr.request_number, qr.title, qr.status, qr.service_type_id, qr.assigned_pm_user_id, qr.created_at
    FROM quote_requests qr JOIN organizations o ON o.id = qr.organization_id
    WHERE o.status = 'active' AND (${status}::text IS NULL OR qr.status = ${status})
    AND (${organizationId}::uuid IS NULL OR qr.organization_id = ${organizationId}::uuid)
    AND (
      (${admin}::boolean AND o.is_internal = false)
      OR (${actor.subject.customerOrganizationIds.length > 0}::boolean AND qr.organization_id = ANY(${customerIds}::uuid[]))
      OR (${actor.subject.isInternalEmployee}::boolean AND EXISTS (
        SELECT 1 FROM projects p JOIN project_assignments pa ON pa.project_id = p.id JOIN employees e ON e.id = pa.employee_id
        WHERE p.quote_request_id = qr.id AND e.user_id = ${user.id} AND e.status = 'active'
      ))
      OR qr.assigned_pm_user_id = ${user.id}
      OR EXISTS (SELECT 1 FROM projects p WHERE p.quote_request_id = qr.id AND p.project_manager_user_id = ${user.id})
    )
    ORDER BY qr.created_at DESC LIMIT 100`;
  return c.json({ quoteRequests: rows });
});

api.get('/quote-requests/:id', async c => {
  const actor = await requireActor(c);
  if (isResponse(actor)) return actor;
  const rows = await sqlFor(c.env)`SELECT qr.*, o.status AS organization_status, o.is_internal,
    (qr.assigned_pm_user_id = ${actor.user.id} OR EXISTS (SELECT 1 FROM projects p WHERE p.quote_request_id = qr.id AND p.project_manager_user_id = ${actor.user.id})) AS manager_authorized,
    EXISTS (SELECT 1 FROM projects p JOIN project_assignments pa ON pa.project_id = p.id JOIN employees e ON e.id = pa.employee_id WHERE p.quote_request_id = qr.id AND e.user_id = ${actor.user.id} AND e.status = 'active') AS employee_assigned
    FROM quote_requests qr JOIN organizations o ON o.id = qr.organization_id WHERE qr.id = ${c.req.param('id')} LIMIT 1`;
  if (!rows[0]) return c.json({ error: 'Not found' }, 404);
  const record = rows[0];
  if (!authorize('view_request', actor.subject, resourceFor(actor.subject, { id: record.organization_id, status: record.organization_status, is_internal: record.is_internal }, { employeeAssigned: record.employee_assigned, managerAuthorized: record.manager_authorized })).ok) {
    return c.json({ error: 'Forbidden' }, 403);
  }
  return c.json({ quoteRequest: record });
});

api.patch('/quote-requests/:id', async c => {
  const parsed = quoteRequestPatchSchema.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) return c.json({ error: 'Invalid quote request update', details: parsed.error.flatten() }, 400);
  const actor = await requireActor(c);
  if (isResponse(actor)) return actor;
  const rowsForAccess = await sqlFor(c.env)`SELECT qr.organization_id, o.status AS organization_status, o.is_internal,
    (qr.assigned_pm_user_id = ${actor.user.id} OR EXISTS (SELECT 1 FROM projects p WHERE p.quote_request_id = qr.id AND p.project_manager_user_id = ${actor.user.id})) AS manager_authorized
    FROM quote_requests qr JOIN organizations o ON o.id = qr.organization_id WHERE qr.id = ${c.req.param('id')} LIMIT 1`;
  if (!rowsForAccess[0]) return c.json({ error: 'Not found' }, 404);
  const d = parsed.data;
  const fields = Object.entries(d).filter(([, value]) => value !== undefined).map(([key]) => key);
  if (!authorize('update_request', actor.subject, resourceFor(actor.subject, { id: rowsForAccess[0].organization_id, status: rowsForAccess[0].organization_status, is_internal: rowsForAccess[0].is_internal }, { managerAuthorized: rowsForAccess[0].manager_authorized }), fields).ok) {
    return c.json({ error: 'Forbidden' }, 403);
  }
  if (d.assignedPmUserId && !Boolean((await sqlFor(c.env)`SELECT is_authorized_nu_portals_staff(${d.assignedPmUserId}) AS ok`)[0]?.ok)) {
    return c.json({ error: 'Project manager must be an authorized Nu-Portals staff identity' }, 400);
  }
  const rows = await sqlFor(c.env)`UPDATE quote_requests SET
    status = CASE WHEN ${d.status !== undefined} THEN ${d.status ?? null} ELSE status END,
    assigned_pm_user_id = CASE WHEN ${d.assignedPmUserId !== undefined} THEN ${d.assignedPmUserId ?? null}::uuid ELSE assigned_pm_user_id END,
    service_type_id = CASE WHEN ${d.serviceTypeId !== undefined} THEN ${d.serviceTypeId ?? null}::uuid ELSE service_type_id END,
    updated_at = now()
    WHERE id = ${c.req.param('id')}
    RETURNING id, status, assigned_pm_user_id, service_type_id`;
  if (!rows[0]) return c.json({ error: 'Not found' }, 404);
  return c.json({ quoteRequest: rows[0] });
});

api.post('/quotes', async c => {
  const parsed = quoteCreateSchema.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) return c.json({ error: 'Invalid quote', details: parsed.error.flatten() }, 400);
  const actor = await requireActor(c);
  if (isResponse(actor)) return actor;
  const d = parsed.data;
  const request = await sqlFor(c.env)`SELECT qr.id, o.id AS organization_id, o.status, o.is_internal, (qr.assigned_pm_user_id = ${actor.user.id}) AS manager_authorized FROM quote_requests qr JOIN organizations o ON o.id = qr.organization_id WHERE qr.id = ${d.quoteRequestId} AND qr.organization_id = ${d.organizationId} LIMIT 1`;
  if (!request[0]) return c.json({ error: 'Quote request not found for this organization' }, 404);
  if (!authorize('create_quote', actor.subject, resourceFor(actor.subject, request[0], { managerAuthorized: request[0].manager_authorized })).ok) return c.json({ error: 'Forbidden' }, 403);
  const versionRow = await sqlFor(c.env)`SELECT COALESCE(max(version), 0)::int AS version FROM quotes WHERE quote_request_id = ${d.quoteRequestId}`;
  const version = Number(versionRow[0]?.version || 0) + 1;
  const quoteNumber = `Q-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;
  const rows = await sqlFor(c.env)`INSERT INTO quotes(organization_id, quote_request_id, quote_number, version, amount, currency, scope_summary, status, expires_at) VALUES(${d.organizationId}, ${d.quoteRequestId}, ${quoteNumber}, ${version}, ${d.amount ?? null}, ${d.currency.toUpperCase()}, ${d.scopeSummary}, 'draft', ${d.expiresAt ?? null}) RETURNING id, quote_number, version, status`;
  return c.json({ id: rows[0].id, quoteNumber: rows[0].quote_number, version: rows[0].version, status: rows[0].status }, 201);
});

api.get('/quotes/:id', async c => {
  const actor = await requireActor(c);
  if (isResponse(actor)) return actor;
  const rows = await sqlFor(c.env)`SELECT q.*, o.status AS organization_status, o.is_internal,
    (qr.assigned_pm_user_id = ${actor.user.id} OR EXISTS (SELECT 1 FROM projects p WHERE p.quote_request_id = q.quote_request_id AND p.project_manager_user_id = ${actor.user.id})) AS manager_authorized,
    EXISTS (SELECT 1 FROM projects p JOIN project_assignments pa ON pa.project_id = p.id JOIN employees e ON e.id = pa.employee_id WHERE p.quote_request_id = q.quote_request_id AND e.user_id = ${actor.user.id} AND e.status = 'active') AS employee_assigned
    FROM quotes q JOIN quote_requests qr ON qr.id = q.quote_request_id JOIN organizations o ON o.id = q.organization_id WHERE q.id = ${c.req.param('id')} LIMIT 1`;
  if (!rows[0]) return c.json({ error: 'Not found' }, 404);
  const record = rows[0];
  if (!authorize('view_quote', actor.subject, resourceFor(actor.subject, { id: record.organization_id, status: record.organization_status, is_internal: record.is_internal }, { employeeAssigned: record.employee_assigned, managerAuthorized: record.manager_authorized })).ok) {
    return c.json({ error: 'Forbidden' }, 403);
  }
  return c.json({ quote: record });
});

api.post('/projects', async c => {
  const parsed = projectCreateSchema.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) return c.json({ error: 'Invalid project', details: parsed.error.flatten() }, 400);
  const actor = await requireActor(c);
  if (isResponse(actor)) return actor;
  const d = parsed.data;
  const request = await sqlFor(c.env)`SELECT o.id, o.status, o.is_internal, (qr.assigned_pm_user_id = ${actor.user.id}) AS manager_authorized FROM quote_requests qr JOIN organizations o ON o.id = qr.organization_id WHERE qr.id = ${d.quoteRequestId} AND qr.organization_id = ${d.organizationId} LIMIT 1`;
  if (!request[0]) return c.json({ error: 'Quote request not found for this organization' }, 404);
  if (!authorize('create_project', actor.subject, resourceFor(actor.subject, request[0], { managerAuthorized: request[0].manager_authorized })).ok) return c.json({ error: 'Forbidden' }, 403);
  const approved = await sqlFor(c.env)`SELECT id FROM quotes WHERE quote_request_id = ${d.quoteRequestId} AND organization_id = ${d.organizationId} AND (status = 'accepted' OR accepted_at IS NOT NULL) LIMIT 1`;
  if (!approved[0]) return c.json({ error: 'An accepted quote is required before a project can be opened' }, 409);
  const projectNumber = `P-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;
  const rows = await sqlFor(c.env)`INSERT INTO projects(organization_id, name, quote_request_id, service_type_id, description, scope_of_work, priority, start_date, target_end_date, project_number) VALUES(${d.organizationId}, ${d.name}, ${d.quoteRequestId}, ${d.serviceTypeId ?? null}, ${d.description || null}, ${d.scopeOfWork || null}, ${d.priority ?? null}, ${d.startDate ?? null}, ${d.targetEndDate ?? null}, ${projectNumber}) RETURNING id, project_number, status`;
  return c.json({ id: rows[0].id, projectNumber: rows[0].project_number, status: rows[0].status }, 201);
});

api.get('/projects', async c => {
  const actor = await requireActor(c);
  if (isResponse(actor)) return actor;
  const user = actor.user;
  const admin = actor.subject.isPlatformAdmin || actor.subject.isInternalAdmin;
  const customerIds = actor.subject.customerOrganizationIds.length ? actor.subject.customerOrganizationIds : ['00000000-0000-0000-0000-000000000000'];
  const rows = await sqlFor(c.env)`SELECT p.id, p.organization_id, p.name, p.status, p.project_number, p.service_type_id, p.project_manager_user_id, p.start_date, p.target_end_date
    FROM projects p JOIN organizations o ON o.id = p.organization_id
    WHERE o.status = 'active' AND (
      (${admin}::boolean AND o.is_internal = false)
      OR (${actor.subject.customerOrganizationIds.length > 0}::boolean AND p.organization_id = ANY(${customerIds}::uuid[]))
      OR (${actor.subject.isInternalEmployee}::boolean AND EXISTS (
        SELECT 1 FROM project_assignments pa JOIN employees e ON e.id = pa.employee_id WHERE pa.project_id = p.id AND e.user_id = ${user.id} AND e.status = 'active'
      ))
      OR p.project_manager_user_id = ${user.id}
    )
    ORDER BY p.created_at DESC LIMIT 100`;
  return c.json({ projects: rows });
});

api.get('/projects/:id', async c => {
  const actor = await requireActor(c);
  if (isResponse(actor)) return actor;
  const rows = await sqlFor(c.env)`SELECT p.*, o.status AS organization_status, o.is_internal,
    (p.project_manager_user_id = ${actor.user.id}) AS manager_authorized,
    EXISTS (SELECT 1 FROM project_assignments pa JOIN employees e ON e.id = pa.employee_id WHERE pa.project_id = p.id AND e.user_id = ${actor.user.id} AND e.status = 'active') AS employee_assigned
    FROM projects p JOIN organizations o ON o.id = p.organization_id WHERE p.id = ${c.req.param('id')} LIMIT 1`;
  if (!rows[0]) return c.json({ error: 'Not found' }, 404);
  const record = rows[0];
  if (!authorize('view_project', actor.subject, resourceFor(actor.subject, { id: record.organization_id, status: record.organization_status, is_internal: record.is_internal }, { employeeAssigned: record.employee_assigned, managerAuthorized: record.manager_authorized })).ok) {
    return c.json({ error: 'Forbidden' }, 403);
  }
  return c.json({ project: record });
});

api.patch('/projects/:id', async c => {
  const parsed = projectPatchSchema.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) return c.json({ error: 'Invalid project update', details: parsed.error.flatten() }, 400);
  const actor = await requireActor(c);
  if (isResponse(actor)) return actor;
  const existing = await sqlFor(c.env)`SELECT p.organization_id, o.status AS organization_status, o.is_internal,
    (p.project_manager_user_id = ${actor.user.id}) AS manager_authorized,
    EXISTS (SELECT 1 FROM project_assignments pa JOIN employees e ON e.id = pa.employee_id WHERE pa.project_id = p.id AND e.user_id = ${actor.user.id} AND e.status = 'active') AS employee_assigned
    FROM projects p JOIN organizations o ON o.id = p.organization_id WHERE p.id = ${c.req.param('id')} LIMIT 1`;
  if (!existing[0]) return c.json({ error: 'Not found' }, 404);
  const d = parsed.data;
  const fields = Object.entries(d).filter(([, value]) => value !== undefined).map(([key]) => key);
  if (!authorize('edit_project', actor.subject, resourceFor(actor.subject, { id: existing[0].organization_id, status: existing[0].organization_status, is_internal: existing[0].is_internal }, { employeeAssigned: existing[0].employee_assigned, managerAuthorized: existing[0].manager_authorized }), fields).ok) {
    return c.json({ error: 'Forbidden' }, 403);
  }
  if (d.projectManagerUserId && !Boolean((await sqlFor(c.env)`SELECT is_authorized_nu_portals_staff(${d.projectManagerUserId}) AS ok`)[0]?.ok)) {
    return c.json({ error: 'Project manager must be an authorized Nu-Portals staff identity' }, 400);
  }
  const rows = await sqlFor(c.env)`UPDATE projects SET
    status = CASE WHEN ${d.status !== undefined} THEN ${d.status ?? null} ELSE status END,
    description = CASE WHEN ${d.description !== undefined} THEN ${d.description ?? null} ELSE description END,
    scope_of_work = CASE WHEN ${d.scopeOfWork !== undefined} THEN ${d.scopeOfWork ?? null} ELSE scope_of_work END,
    priority = CASE WHEN ${d.priority !== undefined} THEN ${d.priority ?? null} ELSE priority END,
    start_date = CASE WHEN ${d.startDate !== undefined} THEN ${d.startDate ?? null}::date ELSE start_date END,
    target_end_date = CASE WHEN ${d.targetEndDate !== undefined} THEN ${d.targetEndDate ?? null}::date ELSE target_end_date END,
    completed_at = CASE WHEN ${d.completedAt !== undefined} THEN ${d.completedAt ?? null}::timestamptz ELSE completed_at END,
    project_manager_user_id = CASE WHEN ${d.projectManagerUserId !== undefined} THEN ${d.projectManagerUserId ?? null}::uuid ELSE project_manager_user_id END,
    updated_at = now()
    WHERE id = ${c.req.param('id')}
    RETURNING id, status, project_manager_user_id, updated_at`;
  return c.json({ project: rows[0] });
});

api.post('/projects/:id/updates', async c => {
  const parsed = projectUpdateSchema.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) return c.json({ error: 'Invalid project update', details: parsed.error.flatten() }, 400);
  const actor = await requireActor(c);
  if (isResponse(actor)) return actor;
  const allowed = await sqlFor(c.env)`SELECT p.organization_id, o.status AS organization_status, o.is_internal,
    (p.project_manager_user_id = ${actor.user.id}) AS manager_authorized,
    EXISTS (SELECT 1 FROM project_assignments pa JOIN employees e ON e.id = pa.employee_id WHERE pa.project_id = p.id AND e.user_id = ${actor.user.id} AND e.status = 'active') AS employee_assigned
    FROM projects p JOIN organizations o ON o.id = p.organization_id WHERE p.id = ${c.req.param('id')} LIMIT 1`;
  if (!allowed[0]) return c.json({ error: 'Not found' }, 404);
  if (!authorize('post_project_update', actor.subject, resourceFor(actor.subject, { id: allowed[0].organization_id, status: allowed[0].organization_status, is_internal: allowed[0].is_internal }, { employeeAssigned: allowed[0].employee_assigned, managerAuthorized: allowed[0].manager_authorized }), ['summary', 'details', 'visibility']).ok) {
    return c.json({ error: 'Forbidden' }, 403);
  }
  const user = actor.user;
  const d = parsed.data;
  const rows = await sqlFor(c.env)`INSERT INTO project_updates(organization_id, project_id, author_user_id, summary, details, visibility) VALUES(${allowed[0].organization_id}, ${c.req.param('id')}, ${user.id}, ${d.summary}, ${d.details || null}, ${d.visibility}) RETURNING id, visibility, created_at`;
  return c.json({ update: rows[0] }, 201);
});

api.post('/agreements', async c => {
  const parsed = agreementCreateSchema.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) return c.json({ error: 'Invalid agreement', details: parsed.error.flatten() }, 400);
  const actor = await requireActor(c);
  if (isResponse(actor)) return actor;
  const d = parsed.data;
  const org = await sqlFor(c.env)`SELECT id, status, is_internal FROM organizations WHERE id = ${d.organizationId} LIMIT 1`;
  if (!org[0]) return c.json({ error: 'Organization not found' }, 404);
  const managed = await sqlFor(c.env)`SELECT 1 FROM projects WHERE organization_id = ${d.organizationId} AND project_manager_user_id = ${actor.user.id} AND (${d.projectId ?? null}::uuid IS NULL OR id = ${d.projectId ?? null}::uuid) LIMIT 1`;
  if (!authorize('upload_agreement', actor.subject, resourceFor(actor.subject, org[0], { managerAuthorized: managed.length > 0 })).ok) return c.json({ error: 'Forbidden' }, 403);
  const rows = await sqlFor(c.env)`INSERT INTO agreements(organization_id, quote_id, project_id, agreement_number, document_key, document_version, signed_by_name, signed_at, effective_date) VALUES(${d.organizationId}, ${d.quoteId ?? null}, ${d.projectId ?? null}, ${d.agreementNumber}, ${d.documentKey}, ${d.documentVersion}, ${d.signedByName ?? null}, ${d.signedAt ?? null}, ${d.effectiveDate ?? null}) RETURNING id, status, document_key`;
  return c.json({ id: rows[0].id, status: rows[0].status, documentKey: rows[0].document_key }, 201);
});

api.post('/agreements/:id/verify', async c => {
  if (!z.string().uuid().safeParse(c.req.param('id')).success) return c.json({ error: 'Invalid agreement' }, 400);
  const actor = await requireActor(c);
  if (isResponse(actor)) return actor;
  const agreement = await sqlFor(c.env)`SELECT a.id, o.id AS organization_id, o.status, o.is_internal FROM agreements a JOIN organizations o ON o.id = a.organization_id WHERE a.id = ${c.req.param('id')} LIMIT 1`;
  if (!agreement[0]) return c.json({ error: 'Not found' }, 404);
  const resource = resourceFor(actor.subject, agreement[0]);
  if (!authorize('verify_agreement', actor.subject, resource).ok || !authorize('convert_customer', actor.subject, resource).ok) return c.json({ error: 'Administrator required' }, 403);
  const user = actor.user;
  const sql = neon(c.env.DATABASE_URL);
  const rows = await sql`WITH target AS (
    SELECT id, organization_id, status FROM agreements WHERE id = ${c.req.param('id')} FOR UPDATE
  ), updated AS (
    UPDATE agreements a SET status = 'verified', verified_by_user_id = ${user.id}, verified_at = COALESCE(a.verified_at, now()), updated_at = now()
    FROM target WHERE a.id = target.id AND target.status IS DISTINCT FROM 'verified'
    RETURNING a.id, a.organization_id
  ), converted AS (
    UPDATE customers c SET lifecycle_status = 'active', converted_at = COALESCE(c.converted_at, now()), updated_at = now()
    FROM updated WHERE c.organization_id = updated.organization_id AND c.lifecycle_status IN ('prospect', 'qualified')
    RETURNING c.id
  ), audit AS (
    INSERT INTO audit_logs(organization_id, actor_user_id, action, resource_type, resource_id)
    SELECT updated.organization_id, ${user.id}, 'agreement.verified', 'agreement', updated.id FROM updated
    RETURNING id
  )
  SELECT target.id, target.organization_id, (target.status = 'verified') AS already_verified,
    (SELECT count(*)::int FROM converted) AS customers_converted,
    (SELECT count(*)::int FROM audit) AS audits_written
  FROM target`;
  const result = rows[0];
  if (!result) return c.json({ error: 'Not found' }, 404);
  return c.json({
    agreementId: result.id,
    organizationId: result.organization_id,
    verified: true,
    idempotent: Boolean(result.already_verified),
    customersConverted: Number(result.customers_converted || 0),
  });
});

api.get('/customers', async c => {
  const parsed = customerListSchema.safeParse({ organizationId: c.req.query('organizationId') || undefined, lifecycleStatus: c.req.query('lifecycleStatus') || undefined });
  if (!parsed.success) return c.json({ error: 'Invalid customer query', details: parsed.error.flatten() }, 400);
  const actor = await requireActor(c);
  if (isResponse(actor)) return actor;
  const user = actor.user;
  const admin = actor.subject.isPlatformAdmin || actor.subject.isInternalAdmin;
  const d = parsed.data;
  const rows = await sqlFor(c.env)`SELECT c.id, c.organization_id, c.name, c.lifecycle_status, c.account_manager_user_id, c.converted_at
    FROM customers c JOIN organizations o ON o.id = c.organization_id
    WHERE o.status = 'active' AND o.is_internal = false
    AND (${d.lifecycleStatus ?? null}::text IS NULL OR c.lifecycle_status = ${d.lifecycleStatus ?? null})
    AND (${d.organizationId ?? null}::uuid IS NULL OR c.organization_id = ${d.organizationId ?? null}::uuid)
    AND (
      ${admin}::boolean
      OR c.account_manager_user_id = ${user.id}
      OR EXISTS (SELECT 1 FROM projects p WHERE p.organization_id = c.organization_id AND p.project_manager_user_id = ${user.id})
    )
    ORDER BY c.created_at DESC LIMIT 100`;
  return c.json({ customers: rows });
});

api.get('/customers/:id', async c => {
  const actor = await requireActor(c);
  if (isResponse(actor)) return actor;
  const rows = await sqlFor(c.env)`SELECT c.*, o.status AS organization_status, o.is_internal,
    (c.account_manager_user_id = ${actor.user.id} OR EXISTS (SELECT 1 FROM projects p WHERE p.organization_id = c.organization_id AND p.project_manager_user_id = ${actor.user.id})) AS manager_authorized
    FROM customers c JOIN organizations o ON o.id = c.organization_id WHERE c.id = ${c.req.param('id')} LIMIT 1`;
  if (!rows[0]) return c.json({ error: 'Not found' }, 404);
  const record = rows[0];
  if (!authorize('view_customer', actor.subject, resourceFor(actor.subject, { id: record.organization_id, status: record.organization_status, is_internal: record.is_internal }, { managerAuthorized: record.manager_authorized })).ok) {
    return c.json({ error: 'Forbidden' }, 403);
  }
  return c.json({ customer: record });
});
