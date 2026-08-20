require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');

const schema = process.env.DB_SCHEMA || 'lms_v2';
if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(schema)) throw new Error('DB_SCHEMA khong hop le');

async function migrate() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error('Thieu DATABASE_URL');

  // Create the isolated schema using a root connection first.
  const rootPool = new Pool({
    connectionString,
    ssl: /localhost|127\.0\.0\.1/.test(connectionString) ? false : { rejectUnauthorized:false }
  });
  await rootPool.query(`CREATE SCHEMA IF NOT EXISTS "${schema}"`);
  await rootPool.end();

  // Only after the schema exists do we load the application DB module.
  const db = require('../config/db');
  const client = await db.getClient();
  try {
    await client.query('BEGIN');
    await client.query(`SET LOCAL search_path TO "${schema}", public`);
    const baseSchema = fs.readFileSync(path.join(__dirname,'schema.sql'),'utf8');
    await client.query(baseSchema);

    const extras = `
      ALTER TABLE users ADD COLUMN IF NOT EXISTS birth_date DATE;
      ALTER TABLE lesson_videos ADD COLUMN IF NOT EXISTS is_free INTEGER NOT NULL DEFAULT 0;
      ALTER TABLE lesson_files ADD COLUMN IF NOT EXISTS is_free INTEGER NOT NULL DEFAULT 0;
      ALTER TABLE enrollments ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ;
      ALTER TABLE activation_codes ALTER COLUMN course_id DROP NOT NULL;
      ALTER TABLE activation_codes ADD COLUMN IF NOT EXISTS book_id INTEGER REFERENCES books(id) ON DELETE CASCADE;
      ALTER TABLE activation_codes ADD COLUMN IF NOT EXISTS online_book_id INTEGER REFERENCES online_books(id) ON DELETE CASCADE;
      ALTER TABLE activation_codes ADD COLUMN IF NOT EXISTS product_type TEXT NOT NULL DEFAULT 'course';
      ALTER TABLE activation_codes ADD COLUMN IF NOT EXISTS duration_days INTEGER;
      CREATE TABLE IF NOT EXISTS book_lessons (
        id SERIAL PRIMARY KEY,
        book_id INTEGER NOT NULL REFERENCES books(id) ON DELETE CASCADE,
        title TEXT NOT NULL,
        content TEXT,
        is_preview INTEGER NOT NULL DEFAULT 0,
        position INTEGER NOT NULL DEFAULT 0,
        created_at TIMESTAMPTZ DEFAULT now()
      );
      ALTER TABLE book_lessons ADD COLUMN IF NOT EXISTS chapter_id INTEGER REFERENCES book_chapters(id) ON DELETE SET NULL;
      CREATE TABLE IF NOT EXISTS book_lesson_videos (
        id SERIAL PRIMARY KEY,
        lesson_id INTEGER NOT NULL REFERENCES book_lessons(id) ON DELETE CASCADE,
        title TEXT NOT NULL,
        source_type TEXT NOT NULL CHECK(source_type IN ('youtube','vimeo','drive','upload')),
        source_value TEXT NOT NULL,
        duration_seconds INTEGER,
        is_free INTEGER NOT NULL DEFAULT 0,
        position INTEGER NOT NULL DEFAULT 0
      );
      CREATE TABLE IF NOT EXISTS book_lesson_files (
        id SERIAL PRIMARY KEY,
        lesson_id INTEGER NOT NULL REFERENCES book_lessons(id) ON DELETE CASCADE,
        title TEXT NOT NULL,
        file_url TEXT NOT NULL,
        file_type TEXT NOT NULL DEFAULT 'pdf',
        is_free INTEGER NOT NULL DEFAULT 0,
        position INTEGER NOT NULL DEFAULT 0
      );
      CREATE TABLE IF NOT EXISTS book_quizzes (
        id SERIAL PRIMARY KEY,
        lesson_id INTEGER NOT NULL REFERENCES book_lessons(id) ON DELETE CASCADE,
        title TEXT NOT NULL,
        pass_score NUMERIC(6,2) NOT NULL DEFAULT 5
      );
      CREATE TABLE IF NOT EXISTS book_quiz_questions (
        id SERIAL PRIMARY KEY,
        quiz_id INTEGER NOT NULL REFERENCES book_quizzes(id) ON DELETE CASCADE,
        question TEXT NOT NULL,
        position INTEGER NOT NULL DEFAULT 0
      );
      CREATE TABLE IF NOT EXISTS book_quiz_options (
        id SERIAL PRIMARY KEY,
        question_id INTEGER NOT NULL REFERENCES book_quiz_questions(id) ON DELETE CASCADE,
        option_text TEXT NOT NULL,
        is_correct INTEGER NOT NULL DEFAULT 0
      );
      CREATE TABLE IF NOT EXISTS classrooms (
        id SERIAL PRIMARY KEY,
        room_code TEXT UNIQUE NOT NULL,
        title TEXT NOT NULL,
        teacher_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
        status TEXT NOT NULL DEFAULT 'live',
        live_url TEXT,
        pdf_url TEXT,
        created_at TIMESTAMPTZ DEFAULT now()
      );
      CREATE TABLE IF NOT EXISTS classroom_materials (
        id SERIAL PRIMARY KEY,
        classroom_id INTEGER NOT NULL REFERENCES classrooms(id) ON DELETE CASCADE,
        title TEXT NOT NULL,
        kind TEXT NOT NULL DEFAULT 'link',
        url TEXT,
        position INTEGER NOT NULL DEFAULT 0
      );
      CREATE INDEX IF NOT EXISTS idx_enrollments_expiry ON enrollments(user_id, course_id, expires_at);
      CREATE INDEX IF NOT EXISTS idx_activation_product ON activation_codes(product_type, book_id, online_book_id);
      CREATE TABLE IF NOT EXISTS "session" (
        "sid" varchar NOT NULL PRIMARY KEY,
        "sess" json NOT NULL,
        "expire" timestamp(6) NOT NULL
      );
      CREATE INDEX IF NOT EXISTS "IDX_session_expire" ON "session" ("expire");
    `;
    await client.query(extras);
    await client.query('COMMIT');
    console.log(`>>> LMS schema "${schema}" ready. Legacy public tables are untouched.`);
  } catch (err) {
    await client.query('ROLLBACK').catch(()=>{});
    console.error('>>> MIGRATION FAILED:', err.stack || err);
    throw err;
  } finally {
    client.release();
    await db.pool.end();
  }
}
migrate().catch(()=>process.exit(1));
