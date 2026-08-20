require('dotenv').config();
const fs = require('fs');
const path = require('path');
const db = require('../config/db');

async function migrate() {
  const client = await db.getClient();
  try {
    await client.query('BEGIN');

    // Ensure the parent table exists before anything references users.id.
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

    // IMPORTANT: this repository has been deployed against older databases.
    // An existing login_logs table may have user_id as bigint/smallint while
    // users.id is integer (or vice versa). CREATE TABLE IF NOT EXISTS cannot
    // repair an existing column, and PostgreSQL then refuses the FK.
    // Normalize the existing child column to the exact type of users.id first.
    const parentType = await client.query(`
      SELECT format_type(a.atttypid, a.atttypmod) AS type
      FROM pg_attribute a
      JOIN pg_class c ON c.oid = a.attrelid
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE c.relname = 'users'
        AND n.nspname = current_schema()
        AND a.attname = 'id'
        AND NOT a.attisdropped
      LIMIT 1
    `);

    const usersIdType = parentType.rows[0]?.type || 'integer';

    const loginLogsExists = await client.query(`
      SELECT to_regclass(format('%I.%I', current_schema(), 'login_logs')) IS NOT NULL AS exists
    `);

    if (!loginLogsExists.rows[0].exists) {
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
      // Remove the old FK before changing the column type.
      await client.query(`
        DO $$
        DECLARE r record;
        BEGIN
          FOR r IN
            SELECT conname
            FROM pg_constraint
            WHERE conrelid = 'login_logs'::regclass
              AND contype = 'f'
              AND confrelid = 'users'::regclass
          LOOP
            EXECUTE format('ALTER TABLE login_logs DROP CONSTRAINT %I', r.conname);
          END LOOP;
        END $$;
      `);

      const childType = await client.query(`
        SELECT format_type(a.atttypid, a.atttypmod) AS type
        FROM pg_attribute a
        JOIN pg_class c ON c.oid = a.attrelid
        JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE c.relname = 'login_logs'
          AND n.nspname = current_schema()
          AND a.attname = 'user_id'
          AND NOT a.attisdropped
        LIMIT 1
      `);

      if (childType.rows.length === 0) {
        await client.query(`ALTER TABLE login_logs ADD COLUMN user_id ${usersIdType}`);
      } else if (childType.rows[0].type !== usersIdType) {
        // Both integer and bigint are safely castable for normal user IDs.
        // Preserve existing values while normalizing the type.
        await client.query(`
          ALTER TABLE login_logs
          ALTER COLUMN user_id TYPE ${usersIdType}
          USING user_id::${usersIdType}
        `);
      }

      await client.query(`ALTER TABLE login_logs ALTER COLUMN user_id SET NOT NULL`);
    }

    // Now the FK can be created safely because both columns have identical types.
    await client.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint
          WHERE conname = 'login_logs_user_id_fkey'
            AND conrelid = 'login_logs'::regclass
        ) THEN
          ALTER TABLE login_logs
            ADD CONSTRAINT login_logs_user_id_fkey
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
        END IF;
      END $$;
    `);

    // Apply the original LMS schema. Existing tables/columns are protected by
    // IF NOT EXISTS / IF NOT EXISTS ALTER clauses in schema.sql.
    const schemaPath = path.join(__dirname, 'schema.sql');
    const schema = fs.readFileSync(schemaPath, 'utf8');

    // Remove the base users/login_logs CREATE TABLE blocks because they were
    // normalized above. Keep the rest of the original schema intact.
    const statements = schema
      .split(/;\s*(?=CREATE TABLE|ALTER TABLE|DO \$\$|CREATE INDEX|--)/g)
      .map(s => s.trim())
      .filter(Boolean);

    for (const raw of statements) {
      const statement = raw.endsWith(';') ? raw : `${raw};`;
      const normalized = statement.replace(/\s+/g, ' ').trim().toLowerCase();
      if (normalized.includes('create table if not exists users')) continue;
      if (normalized.includes('create table if not exists login_logs')) continue;
      await client.query(statement);
    }

    // Session store for connect-pg-simple.
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
    console.log(`>>> Migration OK. users.id=${usersIdType}; login_logs.user_id normalized; full LMS schema ready.`);
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
