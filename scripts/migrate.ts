import {readFileSync} from 'node:fs';import {neon} from '@neondatabase/serverless';
if(!process.env.DATABASE_URL)throw Error('DATABASE_URL required');
const sql=neon(process.env.DATABASE_URL);const file=readFileSync('server/database/migrations/0000_init.sql','utf8');
// Run this only against an EMPTY development database. For later revisions, use Drizzle migrations.
for(const statement of file.split(';').map(s=>s.trim()).filter(Boolean)){await sql.query(statement)}
console.log('Initial schema applied. Do not rerun on an existing database.');
