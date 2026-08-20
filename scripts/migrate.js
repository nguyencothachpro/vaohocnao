require('dotenv').config();
const fs = require('fs');
const path = require('path');
const db = require('../config/db');

async function migrate() {
  const client = await db.getClient();
  try {
    await client.query('BEGIN');

    // 1) Create the base tables in dependency order. This avoids failures on
    // existing databases when a foreign key references a table that does not
    // exist yet.
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
      CREATE TABLE IF NOT EXISTS login_logs (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        ip_address TEXT,
        user_agent TEXT,
        logged_in_at TIMESTAMPTZ DEFAULT now()
      );
    `);

    const schemaPath = path.join(__dirname, 'schema.sql');
    const schema = fs.readFileSync(schemaPath, 'utf8');

    // Remove the two DDL fragments that can conflict with our explicit
    // dependency ordering. Everything else in the original LMS schema is
    // safe to run with IF NOT EXISTS / IF NOT EXISTS ALTERs.
    const statements = schema
      .split(/;\s*(?=CREATE TABLE|ALTER TABLE|DO \$\$|CREATE INDEX|--)/g)
      .map(s => s.trim())
      .filter(Boolean);

    for (const raw of statements) {
      const statement = raw.endsWith(';') ? raw : `${raw};`;
      const normalized = statement.replace(/\s+/g, ' ').trim().toLowerCase();

      // users + login_logs were created above in dependency order.
      if (normalized.includes('create table if not exists users')) continue;
      if (normalized.includes('create table if not exists login_logs')) continue;

      await client.query(statement);
    }

    // Session table for connect-pg-simple.
    await client.query(`
      CREATE TABLE IF NOT EXISTS "session" (
        "sid" varchar NOT NULL COLLATE "default",
        "sess" json NOT NULL,
        "expire" timestamp(6) NOT NULL,
        CONSTRAINT "session_pkey" PRIMARY KEY ("sid")
      );
    `);
    await client.query(`CREATE INDEX IF NOT EXISTS "IDX_session_expire" ON "session" ("expire");`);

    await client.query('COMMIT');
    console.log('>>> Migration OK: database schema is ready.');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Loi migrate:', err.stack || err);
    process.exitCode = 1;
  } finally {
    client.release();
    await db.pool.end();
  }
}

migrate();
