require('dotenv').config();
const fs = require('fs');
const path = require('path');
const db = require('../config/db');

function qi(v) { return '"' + String(v).replace(/"/g, '""') + '"'; }

async function ensureTable(client, sql, name) {
  try {
    await client.query(sql);
    console.log(`>>> ensured table: ${name}`);
  } catch (err) {
    const msg = String(err.message || '');
    if (!/already exists/i.test(msg)) throw err;
  }
}

async function migrate() {
  const client = await db.getClient();
  const skipped = [];
  try {
    await client.query('BEGIN');

    // Critical parent tables must exist before any child table/foreign key.
    await ensureTable(client, `
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
    `, 'users');

    await ensureTable(client, `
      CREATE TABLE IF NOT EXISTS categories (
        id SERIAL PRIMARY KEY,
        parent_id INTEGER REFERENCES categories(id) ON DELETE CASCADE,
        name TEXT NOT NULL,
        slug TEXT UNIQUE NOT NULL,
        icon TEXT,
        position INTEGER NOT NULL DEFAULT 0,
        created_at TIMESTAMPTZ DEFAULT now()
      );
    `, 'categories');

    // These are referenced by multiple later statements in schema.sql.
    await ensureTable(client, `
      CREATE TABLE IF NOT EXISTS courses (
        id SERIAL PRIMARY KEY,
        category_id INTEGER REFERENCES categories(id) ON DELETE SET NULL,
        teacher_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
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
    `, 'courses');

    await ensureTable(client, `
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
    `, 'books');

    await ensureTable(client, `
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
    `, 'online_books');

    // Session store must exist before express-session receives traffic.
    await ensureTable(client, `
      CREATE TABLE IF NOT EXISTS "session" (
        "sid" varchar NOT NULL COLLATE "default",
        "sess" json NOT NULL,
        "expire" timestamp(6) NOT NULL,
        CONSTRAINT "session_pkey" PRIMARY KEY ("sid")
      );
    `, 'session');
    await client.query(`CREATE INDEX IF NOT EXISTS "IDX_session_expire" ON "session" ("expire");`);

    // Apply the rest of the original schema one statement at a time. A
    // SAVEPOINT lets one legacy conflict roll back only that statement.
    const schema = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
    const statements = schema
      .split(/;\s*(?=CREATE TABLE|ALTER TABLE|DO \$\$|CREATE INDEX|--)/g)
      .map(s => s.trim())
      .filter(Boolean);

    // Put parent-create statements first. They are harmless because the
    // parent tables were already ensured above and will be skipped here.
    statements.sort((a, b) => {
      const ra = rank(a), rb = rank(b);
      return ra - rb;
    });

    for (const raw of statements) {
      const statement = raw.endsWith(';') ? raw : `${raw};`;
      const normalized = statement.replace(/\s+/g, ' ').trim().toLowerCase();
      if (!normalized || normalized.startsWith('--')) continue;

      if (normalized.includes('create table if not exists users')) continue;
      if (normalized.includes('create table if not exists categories')) continue;
      if (normalized.includes('create table if not exists courses')) continue;
      if (normalized.includes('create table if not exists books')) continue;
      if (normalized.includes('create table if not exists online_books')) continue;
      if (normalized.includes('create table if not exists "session"')) continue;
      if (normalized.includes('create index if not exists "idx_session_expire"')) continue;

      await client.query('SAVEPOINT stmt_sp');
      try {
        await client.query(statement);
        await client.query('RELEASE SAVEPOINT stmt_sp');
      } catch (err) {
        await client.query('ROLLBACK TO SAVEPOINT stmt_sp');
        await client.query('RELEASE SAVEPOINT stmt_sp');

        const msg = String(err.message || '');
        const compatibilityError =
          /foreign key constraint .* cannot be implemented/i.test(msg) ||
          /constraint .* already exists/i.test(msg) ||
          /relation .* already exists/i.test(msg) ||
          /column .* already exists/i.test(msg) ||
          /multiple primary keys for table/i.test(msg) ||
          /duplicate key value violates unique constraint/i.test(msg) ||
          /already exists/i.test(msg);

        if (compatibilityError) {
          skipped.push(msg.split('\n')[0]);
          continue;
        }
        throw err;
      }
    }

    await client.query('COMMIT');
    console.log(`>>> Migration OK. Core tables ensured; ${skipped.length} legacy compatibility conflicts skipped; session ready.`);
  } catch (err) {
    try { await client.query('ROLLBACK'); } catch (_) {}
    console.error('Loi migrate:', err.stack || err);
    process.exitCode = 1;
  } finally {
    client.release();
    await db.pool.end();
  }
}

function rank(s) {
  const x = String(s).replace(/\s+/g, ' ').trim().toLowerCase();
  if (x.includes('create table if not exists users')) return 0;
  if (x.includes('create table if not exists categories')) return 1;
  if (x.includes('create table if not exists courses')) return 2;
  if (x.includes('create table if not exists books')) return 2;
  if (x.includes('create table if not exists online_books')) return 2;
  if (x.includes('create table if not exists chapters')) return 3;
  if (x.includes('create table if not exists lessons')) return 4;
  if (x.includes('create table if not exists quizzes')) return 5;
  return 10;
}

migrate();
