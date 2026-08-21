require('dotenv').config();
const {Pool}=require('pg');
const connectionString=process.env.DATABASE_URL;
if(!connectionString) throw new Error('Thieu DATABASE_URL');
(async()=>{
  const pool=new Pool({connectionString,ssl:/localhost|127\.0\.0\.1/.test(connectionString)?false:{rejectUnauthorized:false}});
  const schema=process.env.DB_SCHEMA||'lms_v2';
  if(!/^[A-Za-z_][A-Za-z0-9_]*$/.test(schema)) throw new Error('DB_SCHEMA khong hop le');
  try{
    await pool.query(`CREATE SCHEMA IF NOT EXISTS "${schema}"`);
    await pool.query(`SET search_path TO "${schema}", public`);
    await pool.query(`CREATE TABLE IF NOT EXISTS classrooms (id SERIAL PRIMARY KEY, room_code TEXT UNIQUE NOT NULL, title TEXT NOT NULL, teacher_id INTEGER, status TEXT NOT NULL DEFAULT 'live', live_url TEXT, pdf_url TEXT, created_at TIMESTAMPTZ DEFAULT now())`);
    await pool.query(`CREATE TABLE IF NOT EXISTS classroom_students (id SERIAL PRIMARY KEY, classroom_id INTEGER NOT NULL REFERENCES classrooms(id) ON DELETE CASCADE, user_id INTEGER, student_code TEXT NOT NULL UNIQUE, display_name TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'active', can_write BOOLEAN NOT NULL DEFAULT FALSE, ask_teacher BOOLEAN NOT NULL DEFAULT TRUE, last_seen TIMESTAMPTZ, created_at TIMESTAMPTZ DEFAULT now())`);
    await pool.query('ALTER TABLE classroom_students ADD COLUMN IF NOT EXISTS can_write BOOLEAN NOT NULL DEFAULT FALSE');
    await pool.query('ALTER TABLE classroom_students ADD COLUMN IF NOT EXISTS can_navigate BOOLEAN NOT NULL DEFAULT FALSE');
    await pool.query('ALTER TABLE classroom_students ADD COLUMN IF NOT EXISTS ask_teacher BOOLEAN NOT NULL DEFAULT TRUE');
    await pool.query('ALTER TABLE classroom_students ADD COLUMN IF NOT EXISTS last_seen TIMESTAMPTZ');
    console.log('>>> classroom_students permissions ready');
  }finally{await pool.end()}
})().catch(e=>{console.error('>>> PERMISSION MIGRATION FAILED:',e.stack||e);process.exit(1)});
