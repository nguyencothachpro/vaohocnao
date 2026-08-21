require('dotenv').config();
const {Pool}=require('pg');
const connectionString=process.env.DATABASE_URL;
if(!connectionString) throw new Error('Thieu DATABASE_URL');
(async()=>{const pool=new Pool({connectionString,ssl:/localhost|127\.0\.0\.1/.test(connectionString)?false:{rejectUnauthorized:false}});try{await pool.query("ALTER TABLE classroom_students ADD COLUMN IF NOT EXISTS can_navigate BOOLEAN NOT NULL DEFAULT FALSE");console.log('>>> classroom_students.can_navigate ready');}finally{await pool.end()}})().catch(e=>{console.error('>>> PERMISSION MIGRATION FAILED:',e.stack||e);process.exit(1)});
