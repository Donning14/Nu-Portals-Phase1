import {neon} from '@neondatabase/serverless';
if(!process.env.DATABASE_URL)throw Error('DATABASE_URL required');
const sql=neon(process.env.DATABASE_URL);
for(const code of ['customer','employee','manager','organization_admin'])await sql`INSERT INTO roles(code,name) VALUES(${code},${code.replaceAll('_',' ')}) ON CONFLICT(code) DO NOTHING`;
for(const [resource,action] of [['profile','read'],['orders','read_own'],['projects','read_assigned'],['projects','read_team'],['invitations','create'],['users','manage']]){const code=`${resource}.${action}`;await sql`INSERT INTO permissions(code,resource,action) VALUES(${code},${resource},${action}) ON CONFLICT(code) DO NOTHING`}
for(const [role,perm] of [['customer','profile.read'],['customer','orders.read_own'],['employee','profile.read'],['employee','projects.read_assigned'],['manager','projects.read_team'],['organization_admin','invitations.create'],['organization_admin','users.manage']])await sql`INSERT INTO role_permissions(role_id,permission_id) SELECT r.id,p.id FROM roles r,permissions p WHERE r.code=${role} AND p.code=${perm} ON CONFLICT DO NOTHING`;
// Synthetic records only; no real identities or privileged accounts are seeded.
await sql`INSERT INTO organizations(name,slug,industry,city,country) VALUES('Demo Customer Alpha','demo-alpha','Professional Services','Charlotte','US'),('Demo Customer Beta','demo-beta','Construction','Raleigh','US') ON CONFLICT(slug) DO NOTHING`;
console.log('Seeded roles, permissions, and two synthetic organizations. No Clerk users were created.');
