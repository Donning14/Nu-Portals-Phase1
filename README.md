# Nu-Portals — Phase 1 TypeScript foundation

**Status: implementation scaffold; not deployed, not production-ready.** Reuses the Nu-Portals SVG logo and public website messaging from the prior static site. Includes React Router SSR routes, Tailwind, Hono API, Clerk authentication integration, Neon/PostgreSQL schema, SQL migration, synthetic seeds, and starter tests.

## Architecture

- React Router v7 framework-mode SSR on Cloudflare Workers, Tailwind v4
- Hono REST API at `/api/*` within the same Worker
- Clerk session JWT verified on the server; identity mapping stored in PostgreSQL
- Neon PostgreSQL accessed from Workers using the Neon serverless HTTP driver
- Organization-scoped membership and roles live in PostgreSQL; Clerk is **not** the business permissions database
- Customer organization is created by self-service onboarding; the customer receives a `customer` role, not administrator access
- Employee invitation creation is authorization-gated, but **delivery and acceptance are not implemented** (see below)

## Important limits and remaining work

1. **Not built or executed against real Cloudflare/Neon/Clerk** in this environment. Run dependency installation, TypeScript checking, unit tests, integration tests and a Cloudflare deployment smoke test before using it.
2. **Employee onboarding is partial**: authorized administrators can create an invitation record, but Clerk invitation sending, secure acceptance, identity matching, membership assignment and employee onboarding are not yet implemented. Do not advertise the invite form as sending an email.
3. **Dashboard is a foundation**: it displays authorized memberships and roles; orders/projects and administrative CRUD are schema placeholders for later phases.
4. **Communication preferences and contact forms are placeholders** and do not submit data. Existing policy documents are preserved as static public pages; they identify `AnuPortal.com`, not `Nu-Portals`. Confirm legal naming before publishing.
5. **Do not grant platform admin via self-service**. A vetted out-of-band process is required to set `is_platform_admin`. `organization_admin` must be assigned only by an already authorized administrator.
6. **Tenant isolation is incomplete in future business routes**. Do not expose projects, orders, customers or messages via generic CRUD until tenant-scoped queries and record-level authorization tests exist. Foreign keys alone do not prevent cross-tenant references; add composite tenant constraints/RLS in subsequent migrations.
7. **Security gaps to close before production**: complete auth-provider SSR integration, Clerk webhook signature verification, CSRF/origin policy where applicable, rate limiting, role revocation behavior, invitation abuse protection, privacy/consent history API, observability and database recovery testing.
8. `VITE_CLERK_PUBLISHABLE_KEY` is a public frontend key. Secret keys and database URLs must remain server-only. Check current React Router/Cloudflare Vite plugin compatibility and adjust the worker adapter if needed.
9. **Neon driver** is used directly for simplicity. Hyperdrive is not configured; decide whether to add it after measuring connection and latency needs. Avoid treating Neon serverless HTTP as a Hyperdrive PostgreSQL connection.

## Local setup

1. Install Node 22+, npm and Wrangler. In the repository run `npm install`.
2. Create a Neon **development** database. Copy `.env.example` to `.env` and set a valid `DATABASE_URL` and Clerk keys. Never commit `.env`.
3. In the Clerk development instance, configure allowed origins, redirect URLs (`/sign-in`, `/sign-up`, `/app/onboarding`), verified email registration and organization-safe invitation behavior.
4. Run `npm run db:migrate` **once on an empty development database**, then `npm run db:seed`. Initial SQL migration is intentionally a one-time bootstrap; use Drizzle migration tracking for later changes. No Clerk users are seeded.
5. Run `npm run dev`, then `npm run typecheck`, `npm test`, and `npm run test:e2e`. Correct any dependency or adapter changes identified by these checks before deploying.
6. Test onboarding with a real Clerk development identity. The first verified session triggers internal user creation; customer onboarding creates a customer organization, membership, customer role and audit event.

## Cloudflare staging and production

1. Create separate Neon staging and production databases and separate Clerk environment configurations.
2. Set Cloudflare Worker secrets `DATABASE_URL` and `CLERK_SECRET_KEY` with `wrangler secret put ...` for each environment; use environment-specific publishable keys and origins.
3. Update `wrangler.jsonc` route settings, Cloudflare custom domain, and staging domain. Validate Cloudflare Vite/React Router Worker bundling before enabling DNS cutover.
4. Apply migrations and seed role definitions separately in staging and production; synthetic demo organizations should be **development/staging only**.
5. Run integration tests for login, organization isolation, authorization failures and invite permissions. Enable WAF/rate limiting, alerting, backup/PITR and restore drills.
6. Deploy staging first, verify manually, then deploy production with approval. Keep the current public site live until the replacement passes smoke tests.

## GitHub

Repository: https://github.com/Donning14/Nu-Portals

```bash
git clone https://github.com/Donning14/Nu-Portals.git
cd Nu-Portals
# Back up current content on a feature branch before copying scaffold files
git checkout -b feature/phase1-typescript
# Copy the CONTENTS of this package into the repository root
git add .
git commit -m "Scaffold Nu-Portals Phase 1 TypeScript platform"
git push -u origin feature/phase1-typescript
```

Open a pull request; do not overwrite the existing production branch without review. GitHub Actions workflow included runs checks once dependencies and adapter compatibility are resolved.

## Route inventory

Public: `/`, `/about`, `/services`, `/contact`, `/communication-preferences`, `/sign-in`, `/sign-up`, `/policies/*`.

Authenticated: `/app`, `/app/onboarding`, `/app/employees`, `/app/profile`.

API: `/api/health`, `/api/me`, `/api/onboarding/customer`, `/api/invitations`.

## Architecture decisions still requiring validation

- Nu-Portals platform admin provisioning and organization administrator promotion workflow
- Verified customer self-registration and whether the registrant is the organization owner
- Clerk invitations versus custom email invitation workflow, acceptance/expiry/revocation semantics
- Which organization an employee belongs to when invited by a customer organization admin
- Support email and contact endpoint; domain ownership, DNS and deployment credentials
- Tenant-level and resource-level authorization policies for future projects and orders
