import {Hono} from 'hono';
import {neon} from '@neondatabase/serverless';
import {verifyToken,createClerkClient} from '@clerk/backend';
import {onboardingSchema,inviteSchema,canInvite} from '../shared/validation';
type Env={DATABASE_URL:string;CLERK_SECRET_KEY:string;CLERK_PUBLISHABLE_KEY:string;APP_ORIGIN:string};
type Vars={clerkId:string};
export const api=new Hono<{Bindings:Env,Variables:Vars}>().basePath('/api');
const sqlFor=(env:Env)=>neon(env.DATABASE_URL);
api.onError((err,c)=>{console.error('API error',err.message);return c.json({error:'Internal server error'},500)});
api.get('/health',c=>c.json({status:'ok'}));
api.use('*',async(c,next)=>{const bearer=c.req.header('authorization')||'';if(!bearer.startsWith('Bearer '))return c.json({error:'Authentication required'},401);try{const token=bearer.slice(7);const payload=await verifyToken(token,{secretKey:c.env.CLERK_SECRET_KEY,authorizedParties:[c.env.APP_ORIGIN]});c.set('clerkId',payload.sub);await next()}catch{return c.json({error:'Invalid session'},401)}});
async function currentUser(env:Env,clerkId:string){const sql=sqlFor(env);const existing=await sql`SELECT id,clerk_user_id,email,display_name,is_platform_admin FROM users WHERE clerk_user_id=${clerkId}`;if(existing[0])return existing[0];const clerk=createClerkClient({secretKey:env.CLERK_SECRET_KEY});const identity=await clerk.users.getUser(clerkId);const primary=identity.emailAddresses.find(e=>e.id===identity.primaryEmailAddressId);if(!primary?.verification?.status||primary.verification.status!=='verified')throw new Error('Verified email required');const email=primary.emailAddress.toLowerCase();const name=[identity.firstName,identity.lastName].filter(Boolean).join(' ')||null;const rows=await sql`INSERT INTO users(clerk_user_id,email,display_name) VALUES(${clerkId},${email},${name}) ON CONFLICT(clerk_user_id) DO UPDATE SET email=EXCLUDED.email,updated_at=now() RETURNING id,clerk_user_id,email,display_name,is_platform_admin`;return rows[0]}
api.get('/me',async c=>{const sql=sqlFor(c.env),user=await currentUser(c.env,c.get('clerkId'));const memberships=await sql`SELECT m.organization_id AS "organizationId",o.name AS "organizationName",COALESCE(array_agg(r.code) FILTER(WHERE r.code IS NOT NULL),'{}') AS roles FROM organization_members m JOIN organizations o ON o.id=m.organization_id LEFT JOIN user_roles ur ON ur.organization_member_id=m.id LEFT JOIN roles r ON r.id=ur.role_id WHERE m.user_id=${user.id} AND m.status='active' GROUP BY m.id,o.id`;return c.json({user:{id:user.id,displayName:user.display_name,email:user.email},memberships})});
api.post('/onboarding/customer',async c=>{const parsed=onboardingSchema.safeParse(await c.req.json().catch(()=>null));if(!parsed.success)return c.json({error:'Invalid onboarding data',details:parsed.error.flatten()},400);const u=await currentUser(c.env,c.get('clerkId'));const d=parsed.data;const sql=sqlFor(c.env);const existing=await sql`SELECT id FROM organization_members WHERE user_id=${u.id} LIMIT 1`;if(existing.length)return c.json({error:'Account already belongs to an organization. Contact support to add another.'},409);const slug=(d.organizationName.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,45)||'organization')+'-'+crypto.randomUUID().slice(0,8);const created=await sql`WITH org AS (
 INSERT INTO organizations(name,slug,address_line1,city,region,postal_code,country,industry,website)
 VALUES(${d.organizationName},${slug},${d.addressLine1},${d.city},${d.region},${d.postalCode},${d.country},${d.industry},${d.website}) RETURNING id
), member AS (
 INSERT INTO organization_members(organization_id,user_id) SELECT org.id,${u.id} FROM org RETURNING id,organization_id
), assigned AS (
 INSERT INTO user_roles(organization_member_id,role_id) SELECT member.id,roles.id FROM member CROSS JOIN roles WHERE roles.code='customer' RETURNING id
), customer AS (
 INSERT INTO customers(organization_id,user_id,name) SELECT org.id,${u.id},${d.contactName} FROM org RETURNING id
), audit AS (
 INSERT INTO audit_logs(organization_id,actor_user_id,action,resource_type,resource_id)
 SELECT org.id,${u.id},'organization.created','organization',org.id FROM org CROSS JOIN assigned CROSS JOIN customer RETURNING id
) SELECT org.id FROM org JOIN audit ON true`;
if(!created[0])return c.json({error:'Customer role is not configured; run the seed script'},503);
const orgId=created[0].id;
return c.json({organizationId:orgId},201)});
api.post('/invitations',async c=>{const parsed=inviteSchema.safeParse(await c.req.json().catch(()=>null));if(!parsed.success)return c.json({error:'Invalid invitation request'},400);const sql=sqlFor(c.env),u=await currentUser(c.env,c.get('clerkId')),d=parsed.data;const roleRows=await sql`SELECT r.code FROM organization_members m JOIN user_roles ur ON ur.organization_member_id=m.id JOIN roles r ON r.id=ur.role_id WHERE m.organization_id=${d.organizationId} AND m.user_id=${u.id} AND m.status='active'`;if(!canInvite(roleRows.map(x=>x.code as string),Boolean(u.is_platform_admin)))return c.json({error:'Insufficient permissions'},403);const rows=await sql`INSERT INTO invitations(organization_id,email,invited_by,expires_at) VALUES(${d.organizationId},${d.email.toLowerCase()},${u.id},now()+interval '7 days') RETURNING id,status`;await sql`INSERT INTO audit_logs(organization_id,actor_user_id,action,resource_type,resource_id) VALUES(${d.organizationId},${u.id},'invitation.created','invitation',${rows[0].id})`;return c.json({...rows[0],delivery:'not_configured'},201)});
var sqlFor = (env) => neon(env.DATABASE_URL);
// ... Hono API routes with Clerk auth middleware
