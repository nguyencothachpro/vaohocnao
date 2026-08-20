require('dotenv').config();
const fs = require('fs');
const path = require('path');
const db = require('../config/db');

async function tableExists(client, table) {
  const r = await client.query(`SELECT to_regclass(format('%I.%I', current_schema(), $1)) IS NOT NULL AS exists`, [table]);
  return !!r.rows[0]?.exists;
}

async function columnType(client, table, column) {
  const r = await client.query(`
    SELECT format_type(a.atttypid, a.atttypmod) AS type
    FROM pg_attribute a
    JOIN pg_class c ON c.oid = a.attrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE c.relname = $1
      AND n.nspname = current_schema()
      AND a.attname = $2
      AND NOT a.attisdropped
    LIMIT 1
  `, [table, column]);
  return r.rows[0]?.type || null;
}

async function dropForeignKeysBetween(client, childTable, parentTable) {
  await client.query(`
    DO $$
    DECLARE r record;
    BEGIN
      IF to_regclass(format('%I.%I', current_schema(), $1)) IS NULL THEN
        RETURN;
      END IF;
      FOR r IN
        SELECT conname
        FROM pg_constraint
        WHERE conrelid = format('%I.%I', current_schema(), $1)::regclass
          AND confrelid = format('%I.%I', current_schema(), $2)::regclass
          AND contype = 'f'
      LOOP
        EXECUTE format('ALTER TABLE %I DROP CONSTRAINT %I', $1, r.conname);
      END LOOP;
    END $$;
  `, [childTable, parentTable]);
}

async function ensureSimpleFK(client, childTable, childColumn, parentTable, parentColumn, constraintName) {
  await client.query(`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = $1
          AND conrelid = format('%I.%I', current_schema(), $2)::regclass
      ) THEN
        EXECUTE format(
          'ALTER TABLE %I ADD CONSTRAINT %I FOREIGN KEY (%I) REFERENCES %I(%I) ON DELETE CASCADE',
          $2, $1, $3, $4, $5
        );
      END IF;
    END $$;
  `, [constraintName, childTable, childColumn, parentTable, parentColumn]);
}

async function migrate() {
  const client = await db.getClient();
  try {
    await client.query('BEGIN');

    // Parent tables first. This makes the migration safe against a legacy DB
    // whose tables were created in an incompatible order.
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

    const usersIdType = (await columnType(client, 'users', 'id')) || 'integer';

    // Normalize the legacy login_logs table without ever relying on
    // CREATE TABLE IF NOT EXISTS to repair an existing column definition.
    const loginLogsExists = await tableExists(client, 'login_logs');
    if (!loginLogsExists) {
      await client.query(`
        CREATE TABLE login_logs (
          id SERIAL PRIMARY KEY,
          user_id ${usersIdType} NOT NULL,
          ip_address TEXT,
          user_agent TEXT,
          logged_in_at TIMESTAMPTZ DEFAULT now()
        );
      `);
    } else {
      await dropForeignKeysBetween(client, 'login_logs', 'users');
      const childType = await columnType(client, 'login_logs', 'user_id');
      if (!childType) {
        await client.query(`ALTER TABLE login_logs ADD COLUMN user_id ${usersIdType}`);
      } else if (childType !== usersIdType) {
        // Preserve existing values; normal user IDs are integer-range.
        await client.query(`
          ALTER TABLE login_logs
          ALTER COLUMN user_id TYPE ${usersIdType}
          USING NULLIF(user_id::text, '')::${usersIdType}
        `);
      }
    }
    await client.query(`ALTER TABLE login_logs ALTER COLUMN user_id SET NOT NULL`);
    await ensureSimpleFK(client, 'login_logs', 'user_id', 'users', 'id', 'login_logs_user_id_fkey');

    // Read and apply the original LMS schema statement-by-statement. Legacy
    // databases may contain tables with mismatched FK types, so normalize
    // common FK pairs BEFORE PostgreSQL attempts to recreate their constraints.
    const schemaPath = path.join(__dirname, 'schema.sql');
    const schema = fs.readFileSync(schemaPath, 'utf8');
    const statements = schema
      .split(/;\s*(?=CREATE TABLE|ALTER TABLE|DO \$\$|CREATE INDEX|--)/g)
      .map(s => s.trim())
      .filter(Boolean);

    // Reorder the statements roughly by dependency level to avoid creating
    // child tables before their parents on a fresh DB.
    const rank = (s) => {
      const x = s.replace(/\s+/g, ' ').trim().toLowerCase();
      if (x.includes('create table if not exists users')) return 0;
      if (x.includes('create table if not exists categories')) return 1;
      if (x.includes('create table if not exists courses')) return 2;
      if (x.includes('create table if not exists chapters')) return 3;
      if (x.includes('create table if not exists lessons')) return 4;
      if (x.includes('create table if not exists books')) return 2;
      if (x.includes('create table if not exists online_books')) return 2;
      if (x.includes('create table if not exists banners')) return 2;
      return 10;
    };
    statements.sort((a, b) => rank(a) - rank(b));

    for (const raw of statements) {
      const statement = raw.endsWith(';') ? raw : `${raw};`;
      const normalized = statement.replace(/\s+/g, ' ').trim().toLowerCase();

      // users/login_logs are already created/normalized above.
      if (normalized.includes('create table if not exists users')) continue;
      if (normalized.includes('create table if not exists login_logs')) continue;

      // Normalize known legacy FK targets before CREATE TABLE for existing DBs.
      // categories.parent_id -> categories.id
      if (normalized.includes('create table if not exists categories')) {
        await client.query(statement);
        const idType = (await columnType(client, 'categories', 'id')) || 'integer';
        const parentType = await columnType(client, 'categories', 'parent_id');
        if (parentType && parentType !== idType) {
          await dropForeignKeysBetween(client, 'categories', 'categories');
          await client.query(`ALTER TABLE categories ALTER COLUMN parent_id TYPE ${idType} USING NULLIF(parent_id::text, '')::${idType}`);
        }
        continue;
      }

      // courses.category_id -> categories.id / teacher_id -> users.id
      if (normalized.includes('create table if not exists courses')) {
        // Ensure categories parent exists before this CREATE.
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
            teacher_id ${usersIdType},
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
        continue;
      }

      // If an existing table triggers a FK mismatch, handle it explicitly for
      // the common LMS child->parent pairs and then continue with the rest.
      try {
        await client.query(statement);
      } catch (err) {
        const msg = String(err.message || '');
        const match = msg.match(/foreign key constraint "([^"]+)" cannot be implemented/i);
        if (!match) throw err;

        const constraint = match[1];
        const isCoursesCategory = constraint === 'courses_category_id_fkey';
        if (isCoursesCategory && await tableExists(client, 'courses') && await tableExists(client, 'categories')) {
          await dropForeignKeysBetween(client, 'courses', 'categories');
          const parentType = (await columnType(client, 'categories', 'id')) || 'integer';
          const childType = await columnType(client, 'courses', 'category_id');
          if (!childType) {
            await client.query(`ALTER TABLE courses ADD COLUMN category_id ${parentType}`);
          } else if (childType !== parentType) {
            await client.query(`ALTER TABLE courses ALTER COLUMN category_id TYPE ${parentType} USING NULLIF(category_id::text, '')::${parentType}`);
          }
          await ensureSimpleFK(client, 'courses', 'category_id', 'categories', 'id', constraint);
          continue;
        }
        throw err;
      }
    }

    // Session store.
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
    console.log(`>>> Migration OK. users.id=${usersIdType}; legacy FKs normalized; full LMS schema ready.`);
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
