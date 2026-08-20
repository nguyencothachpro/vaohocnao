require('dotenv').config();
const fs = require('fs');
const path = require('path');
const db = require('../config/db');
const bcrypt = require('bcryptjs');

function isIgnorable(err) {
  const m = String(err && err.message || '');
  return /already exists|duplicate key|cannot be implemented|does not exist|multiple primary keys/i.test(m);
}

async function runStatement(client, sql, skipped) {
  try {
    await client.query(sql);
  } catch (err) {
    if (isIgnorable(err)) {
      skipped.push(String(err.message || '').split('\n')[0]);
      return;
    }
    throw err;
  }
}

async function bootstrap() {
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL chưa được cấu hình.');

  const client = await db.getClient();
  const skipped = [];
  try {
    // No transaction/SAVEPOINT here. A failed legacy statement must never
    // poison the whole bootstrap transaction or block the server from starting.
    const schema = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');

    // First guarantee the minimal runtime tables in FK-free form.
    const core = [
      `CREATE TABLE IF NOT EXISTS users (id SERIAL PRIMARY KEY, name TEXT NOT NULL DEFAULT 'Học viên', email TEXT UNIQUE NOT NULL, password_hash TEXT NOT NULL DEFAULT '', role TEXT NOT NULL DEFAULT 'student', phone TEXT, avatar_url TEXT, points INTEGER NOT NULL DEFAULT 0, is_active INTEGER NOT NULL DEFAULT 1, created_at TIMESTAMPTZ DEFAULT now())`,
      `CREATE TABLE IF NOT EXISTS categories (id SERIAL PRIMARY KEY, parent_id INTEGER, name TEXT NOT NULL DEFAULT 'Chưa phân loại', slug TEXT UNIQUE NOT NULL, icon TEXT, position INTEGER NOT NULL DEFAULT 0, created_at TIMESTAMPTZ DEFAULT now())`,
      `CREATE TABLE IF NOT EXISTS courses (id SERIAL PRIMARY KEY, category_id INTEGER, teacher_id INTEGER, title TEXT NOT NULL, slug TEXT UNIQUE NOT NULL, short_desc TEXT, description TEXT, thumbnail_url TEXT, price INTEGER NOT NULL DEFAULT 0, is_published INTEGER NOT NULL DEFAULT 1, position INTEGER NOT NULL DEFAULT 0, view_count INTEGER NOT NULL DEFAULT 0, created_at TIMESTAMPTZ DEFAULT now())`,
      `CREATE TABLE IF NOT EXISTS books (id SERIAL PRIMARY KEY, title TEXT NOT NULL, slug TEXT UNIQUE NOT NULL, author TEXT, short_desc TEXT, description TEXT, cover_url TEXT, price INTEGER NOT NULL DEFAULT 0, compare_at_price INTEGER, file_url TEXT, is_published INTEGER NOT NULL DEFAULT 1, created_at TIMESTAMPTZ DEFAULT now())`,
      `CREATE TABLE IF NOT EXISTS online_books (id SERIAL PRIMARY KEY, title TEXT NOT NULL, slug TEXT UNIQUE NOT NULL, author TEXT, short_desc TEXT, description TEXT, cover_url TEXT, price INTEGER NOT NULL DEFAULT 0, compare_at_price INTEGER, is_published INTEGER NOT NULL DEFAULT 1, created_at TIMESTAMPTZ DEFAULT now())`,
      `CREATE TABLE IF NOT EXISTS chapters (id SERIAL PRIMARY KEY, course_id INTEGER, title TEXT NOT NULL, position INTEGER NOT NULL DEFAULT 0, created_at TIMESTAMPTZ DEFAULT now())`,
      `CREATE TABLE IF NOT EXISTS lessons (id SERIAL PRIMARY KEY, chapter_id INTEGER, title TEXT NOT NULL, content TEXT, is_preview INTEGER NOT NULL DEFAULT 0, position INTEGER NOT NULL DEFAULT 0, created_at TIMESTAMPTZ DEFAULT now())`,
      `CREATE TABLE IF NOT EXISTS quizzes (id SERIAL PRIMARY KEY, lesson_id INTEGER, title TEXT NOT NULL, pass_score NUMERIC(6,2) NOT NULL DEFAULT 5, created_at TIMESTAMPTZ DEFAULT now())`,
      `CREATE TABLE IF NOT EXISTS "session" (sid varchar NOT NULL PRIMARY KEY, sess json NOT NULL, expire timestamp(6) NOT NULL)`,
    ];
    for (const sql of core) await runStatement(client, sql, skipped);
    await runStatement(client, `CREATE INDEX IF NOT EXISTS idx_session_expire ON "session" (expire)`, skipped);

    // Apply the original LMS schema one statement at a time. Core table CREATEs
    // are skipped because they were safely ensured above. A legacy incompatibility
    // is recorded and ignored so server.js can still start.
    const statements = schema
      .split(/;\s*(?=CREATE TABLE|ALTER TABLE|DO \$\$|CREATE INDEX|--)/g)
      .map(s => s.trim())
      .filter(Boolean);

    for (const raw of statements) {
      const sql = raw.endsWith(';') ? raw : `${raw};`;
      const n = sql.replace(/\s+/g, ' ').trim().toLowerCase();
      if (!n || n.startsWith('--')) continue;
      if (
        n.includes('create table if not exists users') ||
        n.includes('create table if not exists categories') ||
        n.includes('create table if not exists courses') ||
        n.includes('create table if not exists books') ||
        n.includes('create table if not exists online_books') ||
        n.includes('create table if not exists chapters') ||
        n.includes('create table if not exists lessons') ||
        n.includes('create table if not exists quizzes') ||
        n.includes('create table if not exists "session"') ||
        n.includes('create index if not exists "idx_session_expire"')
      ) continue;
      await runStatement(client, sql, skipped);
    }

    // Bootstrap admin last; this requires only the users table.
    if (process.env.ADMIN_EMAIL && process.env.ADMIN_PASSWORD) {
      const hash = await bcrypt.hash(process.env.ADMIN_PASSWORD, 10);
      const found = await client.query('SELECT id FROM users WHERE lower(email)=lower($1) LIMIT 1', [process.env.ADMIN_EMAIL]);
      if (found.rows.length) {
        await client.query(`UPDATE users SET role='admin', password_hash=$2, is_active=1 WHERE id=$1`, [found.rows[0].id, hash]);
      } else {
        await client.query(`INSERT INTO users(name,email,password_hash,role,is_active) VALUES($1,$2,$3,'admin',1)`, ['Quản trị viên', process.env.ADMIN_EMAIL, hash]);
      }
    }

    console.log(`>>> Bootstrap OK. Core runtime schema ready; ${skipped.length} legacy statements skipped.`);
  } finally {
    client.release();
    await db.pool.end();
  }
}

bootstrap().catch(err => {
  console.error('>>> Bootstrap database FAILED:', err.stack || err.message || err);
  process.exit(1);
});
