require('dotenv').config();
const fs = require('fs');
const path = require('path');
const db = require('../config/db');

const qi = (v) => '"' + String(v).replace(/"/g, '""') + '"';
const schemaName = process.env.PGSCHEMA || 'public';

async function ensureSession(client) {
  await client.query(`
    CREATE TABLE IF NOT EXISTS "session" (
      "sid" varchar NOT NULL,
      "sess" json NOT NULL,
      "expire" timestamp(6) NOT NULL,
      CONSTRAINT "session_pkey" PRIMARY KEY ("sid")
    );
  `);
  await client.query(`CREATE INDEX IF NOT EXISTS "IDX_session_expire" ON "session" ("expire");`);
}

async function ensureCoreTables(client) {
  // Create core tables WITHOUT foreign keys first. Legacy databases can have
  // incompatible ID types; startup must not fail on those legacy constraints.
  await client.query(`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'student'
        CHECK (role IN ('super_admin','admin','teacher','ta','student')),
      avatar_url TEXT,
      phone TEXT,
      points INTEGER NOT NULL DEFAULT 0,
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at TIMESTAMPTZ DEFAULT now()
    );
  `);

  await client.query(`
    CREATE TABLE IF NOT EXISTS categories (
      id SERIAL PRIMARY KEY,
      parent_id INTEGER,
      name TEXT NOT NULL,
      slug TEXT UNIQUE NOT NULL,
      icon TEXT,
      position INTEGER NOT NULL DEFAULT 0,
      created_at TIMESTAMPTZ DEFAULT now()
    );
  `);

  await client.query(`
    CREATE TABLE IF NOT EXISTS courses (
      id SERIAL PRIMARY KEY,
      category_id INTEGER,
      teacher_id INTEGER,
      title TEXT NOT NULL,
      slug TEXT UNIQUE NOT NULL,
      short_desc TEXT,
      description TEXT,
      thumbnail_url TEXT,
      price INTEGER NOT NULL DEFAULT 0,
      is_published INTEGER NOT NULL DEFAULT 1,
      position INTEGER NOT NULL DEFAULT 0,
      view_count INTEGER NOT NULL DEFAULT 0,
      created_at TIMESTAMPTZ DEFAULT now()
    );
  `);

  await client.query(`
    CREATE TABLE IF NOT EXISTS books (
      id SERIAL PRIMARY KEY,
      title TEXT NOT NULL,
      slug TEXT UNIQUE NOT NULL,
      author TEXT,
      short_desc TEXT,
      description TEXT,
      cover_url TEXT,
      price INTEGER NOT NULL DEFAULT 0,
      compare_at_price INTEGER,
      file_url TEXT,
      is_published INTEGER NOT NULL DEFAULT 1,
      created_at TIMESTAMPTZ DEFAULT now()
    );
  `);

  await client.query(`
    CREATE TABLE IF NOT EXISTS online_books (
      id SERIAL PRIMARY KEY,
      title TEXT NOT NULL,
      slug TEXT UNIQUE NOT NULL,
      author TEXT,
      short_desc TEXT,
      description TEXT,
      cover_url TEXT,
      price INTEGER NOT NULL DEFAULT 0,
      compare_at_price INTEGER,
      is_published INTEGER NOT NULL DEFAULT 1,
      created_at TIMESTAMPTZ DEFAULT now()
    );
  `);

  await client.query(`
    CREATE TABLE IF NOT EXISTS chapters (
      id SERIAL PRIMARY KEY,
      course_id INTEGER,
      title TEXT NOT NULL,
      position INTEGER NOT NULL DEFAULT 0,
      created_at TIMESTAMPTZ DEFAULT now()
    );
  `);

  await client.query(`
    CREATE TABLE IF NOT EXISTS lessons (
      id SERIAL PRIMARY KEY,
      chapter_id INTEGER,
      title TEXT NOT NULL,
      content TEXT,
      is_preview INTEGER NOT NULL DEFAULT 0,
      position INTEGER NOT NULL DEFAULT 0,
      created_at TIMESTAMPTZ DEFAULT now()
    );
  `);

  await client.query(`
    CREATE TABLE IF NOT EXISTS quizzes (
      id SERIAL PRIMARY KEY,
      lesson_id INTEGER,
      title TEXT NOT NULL,
      pass_score NUMERIC(6,2) NOT NULL DEFAULT 5,
      created_at TIMESTAMPTZ DEFAULT now()
    );
  `);

  await ensureSession(client);
}

function isSafeLegacyConflict(err) {
  const msg = String(err?.message || '');
  return (
    /foreign key constraint .* cannot be implemented/i.test(msg) ||
    /constraint .* already exists/i.test(msg) ||
    /relation .* already exists/i.test(msg) ||
    /column .* already exists/i.test(msg) ||
    /multiple primary keys for table/i.test(msg) ||
    /duplicate key value violates unique constraint/i.test(msg) ||
    /already exists/i.test(msg) ||
    /constraint .* does not exist/i.test(msg) ||
    /column .* of relation .* does not exist/i.test(msg)
  );
}

async function applyRemainingSchema(client, schema, skipped) {
  // The legacy LMS schema contains a few multi-statement DO blocks and ALTERs.
  // Apply them one-by-one behind SAVEPOINTs so a single legacy incompatibility
  // cannot abort startup. Core tables were already ensured above.
  const statements = schema
    .split(/;\s*(?=CREATE TABLE|ALTER TABLE|DO \$\$|CREATE INDEX|--)/g)
    .map(s => s.trim())
    .filter(Boolean);

  for (const raw of statements) {
    const statement = raw.endsWith(';') ? raw : `${raw};`;
    const normalized = statement.replace(/\s+/g, ' ').trim().toLowerCase();
    if (!normalized || normalized.startsWith('--')) continue;

    // Core tables and session are already ensured explicitly.
    if (
      normalized.includes('create table if not exists users') ||
      normalized.includes('create table if not exists categories') ||
      normalized.includes('create table if not exists courses') ||
      normalized.includes('create table if not exists books') ||
      normalized.includes('create table if not exists online_books') ||
      normalized.includes('create table if not exists chapters') ||
      normalized.includes('create table if not exists lessons') ||
      normalized.includes('create table if not exists quizzes') ||
      normalized.includes('create table if not exists "session"') ||
      normalized.includes('create index if not exists "idx_session_expire"')
    ) continue;

    await client.query('SAVEPOINT stmt_sp');
    try {
      await client.query(statement);
      await client.query('RELEASE SAVEPOINT stmt_sp');
    } catch (err) {
      await client.query('ROLLBACK TO SAVEPOINT stmt_sp');
      await client.query('RELEASE SAVEPOINT stmt_sp');

      if (isSafeLegacyConflict(err)) {
        skipped.push(String(err.message || '').split('\n')[0]);
        continue;
      }
      throw err;
    }
  }
}

async function ensureAdmin(client) {
  const email = process.env.ADMIN_EMAIL;
  const password = process.env.ADMIN_PASSWORD;
  if (!email || !password) return;

  // Do not require a new dependency just for startup. bcryptjs is already in
  // package.json; use it only for the bootstrap account.
  const bcrypt = require('bcryptjs');
  const hash = await bcrypt.hash(password, 10);
  const existing = await client.query('SELECT id FROM users WHERE lower(email)=lower($1) LIMIT 1', [email]);
  if (existing.rows.length) {
    await client.query(`UPDATE users SET role='admin', password_hash=$2, is_active=1 WHERE id=$1`, [existing.rows[0].id, hash]);
  } else {
    await client.query(`INSERT INTO users(name,email,password_hash,role,is_active) VALUES($1,$2,$3,'admin',1)`, ['Quản trị viên', email, hash]);
  }
}

async function migrate() {
  const client = await db.getClient();
  const skipped = [];
  try {
    await client.query('BEGIN');

    // STEP 1: Guarantee the minimum runtime schema first.
    await ensureCoreTables(client);

    // STEP 2: Best-effort compatibility migration for the remaining legacy
    // tables/columns. Nothing here should prevent the server from starting.
    const schema = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
    await applyRemainingSchema(client, schema, skipped);

    // STEP 3: Make sure the session table exists after any schema changes.
    await ensureSession(client);

    // STEP 4: Ensure the admin account exists so the deployed site is usable
    // without a Render Shell command.
    await ensureAdmin(client);

    await client.query('COMMIT');
    console.log(`>>> Migration OK. Core runtime schema ready; ${skipped.length} legacy conflicts skipped.`);
  } catch (err) {
    try { await client.query('ROLLBACK'); } catch (_) {}
    console.error('Loi migrate:', err.stack || err);
    process.exitCode = 1;
  } finally {
    client.release();
    await db.pool.end();
  }
}

migrate();
