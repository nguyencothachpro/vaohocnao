require('dotenv').config();
const fs = require('fs');
const path = require('path');
const db = require('../config/db');

async function tableExists(client, table) {
  const r = await client.query(
    `SELECT to_regclass(format('%I.%I', current_schema(), $1::text)) IS NOT NULL AS exists`,
    [table]
  );
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
  const r = await client.query(`
    SELECT conname
    FROM pg_constraint
    WHERE conrelid = to_regclass(format('%I.%I', current_schema(), $1::text))
      AND confrelid = to_regclass(format('%I.%I', current_schema(), $2::text))
      AND contype = 'f'
  `, [childTable, parentTable]);
  for (const row of r.rows) {
    await client.query(`ALTER TABLE ${quoteIdent(childTable)} DROP CONSTRAINT ${quoteIdent(row.conname)}`);
  }
}

function quoteIdent(value) {
  return '"' + String(value).replace(/"/g, '""') + '"';
}

async function ensureSimpleFK(client, childTable, childColumn, parentTable, parentColumn, constraintName, onDelete = 'CASCADE') {
  const exists = await client.query(`
    SELECT 1
    FROM pg_constraint
    WHERE conname = $1
      AND conrelid = to_regclass(format('%I.%I', current_schema(), $2::text))
    LIMIT 1
  `, [constraintName, childTable]);
  if (exists.rows.length) return;

  await client.query(`ALTER TABLE ${quoteIdent(childTable)} ADD CONSTRAINT ${quoteIdent(constraintName)} FOREIGN KEY (${quoteIdent(childColumn)}) REFERENCES ${quoteIdent(parentTable)}(${quoteIdent(parentColumn)}) ON DELETE ${onDelete}`);
}

async function migrate() {
  const client = await db.getClient();
  try {
    await client.query('BEGIN');

    // Base parent table first.
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

    // Normalize login_logs against the existing users.id type.
    if (!await tableExists(client, 'login_logs')) {
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
        await client.query(`ALTER TABLE login_logs ALTER COLUMN user_id TYPE ${usersIdType} USING NULLIF(user_id::text, '')::${usersIdType}`);
      }
    }
    await client.query(`ALTER TABLE login_logs ALTER COLUMN user_id SET NOT NULL`);
    await ensureSimpleFK(client, 'login_logs', 'user_id', 'users', 'id', 'login_logs_user_id_fkey');

    const schemaPath = path.join(__dirname, 'schema.sql');
    const schema = fs.readFileSync(schemaPath, 'utf8');
    const statements = schema
      .split(/;\s*(?=CREATE TABLE|ALTER TABLE|DO \$\$|CREATE INDEX|--)/g)
      .map(s => s.trim())
      .filter(Boolean);

    const rank = (s) => {
      const x = s.replace(/\s+/g, ' ').trim().toLowerCase();
      if (x.includes('create table if not exists users')) return 0;
      if (x.includes('create table if not exists categories')) return 1;
      if (x.includes('create table if not exists courses')) return 2;
      if (x.includes('create table if not exists chapters')) return 3;
      if (x.includes('create table if not exists lessons')) return 4;
      if (x.includes('create table if not exists books')) return 2;
      if (x.includes('create table if not exists online_books')) return 2;
      return 10;
    };
    statements.sort((a, b) => rank(a) - rank(b));

    for (const raw of statements) {
      const statement = raw.endsWith(';') ? raw : `${raw};`;
      const normalized = statement.replace(/\s+/g, ' ').trim().toLowerCase();

      if (normalized.includes('create table if not exists users')) continue;
      if (normalized.includes('create table if not exists login_logs')) continue;

      if (normalized.includes('create table if not exists categories')) {
        await client.query(statement);
        const idType = (await columnType(client, 'categories', 'id')) || 'integer';
        const parentType = await columnType(client, 'categories', 'parent_id');
        if (parentType && parentType !== idType) {
          await dropForeignKeysBetween(client, 'categories', 'categories');
          await client.query(`ALTER TABLE categories ALTER COLUMN parent_id TYPE ${idType} USING NULLIF(parent_id::text, '')::${idType}`);
        }
        if (await columnType(client, 'categories', 'parent_id')) {
          await ensureSimpleFK(client, 'categories', 'parent_id', 'categories', 'id', 'categories_parent_id_fkey', 'CASCADE');
        }
        continue;
      }

      if (normalized.includes('create table if not exists courses')) {
        // Ensure categories exists with a compatible shape first.
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
        if (!await columnType(client, 'categories', 'id')) throw new Error('categories.id is missing');
        const categoryIdType = await columnType(client, 'categories', 'id');

        await client.query(`
          CREATE TABLE IF NOT EXISTS courses (
            id SERIAL PRIMARY KEY,
            category_id ${categoryIdType},
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

        await dropForeignKeysBetween(client, 'courses', 'categories');
        await dropForeignKeysBetween(client, 'courses', 'users');

        const courseCategoryType = await columnType(client, 'courses', 'category_id');
        if (courseCategoryType && courseCategoryType !== categoryIdType) {
          await client.query(`ALTER TABLE courses ALTER COLUMN category_id TYPE ${categoryIdType} USING NULLIF(category_id::text, '')::${categoryIdType}`);
        }
        const teacherType = await columnType(client, 'courses', 'teacher_id');
        if (teacherType && teacherType !== usersIdType) {
          await client.query(`ALTER TABLE courses ALTER COLUMN teacher_id TYPE ${usersIdType} USING NULLIF(teacher_id::text, '')::${usersIdType}`);
        }

        await ensureSimpleFK(client, 'courses', 'category_id', 'categories', 'id', 'courses_category_id_fkey', 'SET NULL');
        await ensureSimpleFK(client, 'courses', 'teacher_id', 'users', 'id', 'courses_teacher_id_fkey', 'SET NULL');
        continue;
      }

      // Existing schemas can contain legacy tables with incompatible FK types.
      // For the remaining statements, try normally and, on a known FK mismatch,
      // normalize the specific child column to the referenced parent's ID type.
      try {
        await client.query(statement);
      } catch (err) {
        const msg = String(err.message || '');
        const match = msg.match(/foreign key constraint "([^"]+)" cannot be implemented/i);
        if (!match) throw err;

        const constraint = match[1];
        // Generic fallback: derive child/parent columns from pg_constraint and
        // normalize the child column to the parent's referenced column type.
        const meta = await client.query(`
          SELECT
            child.relname AS child_table,
            parent.relname AS parent_table,
            child_att.attname AS child_column,
            parent_att.attname AS parent_column
          FROM pg_constraint c
          JOIN pg_class child ON child.oid = c.conrelid
          JOIN pg_class parent ON parent.oid = c.confrelid
          JOIN LATERAL unnest(c.conkey) WITH ORDINALITY ck(attnum, ord) ON true
          JOIN LATERAL unnest(c.confkey) WITH ORDINALITY pk(attnum, ord) ON pk.ord = ck.ord
          JOIN pg_attribute child_att ON child_att.attrelid = child.oid AND child_att.attnum = ck.attnum
          JOIN pg_attribute parent_att ON parent_att.attrelid = parent.oid AND parent_att.attnum = pk.attnum
          WHERE c.conname = $1
          LIMIT 1
        `, [constraint]);

        if (meta.rows.length) {
          const { child_table, parent_table, child_column, parent_column } = meta.rows[0];
          const parentType = await columnType(client, parent_table, parent_column);
          const childType = await columnType(client, child_table, child_column);
          if (parentType && childType && parentType !== childType) {
            await dropForeignKeysBetween(client, child_table, parent_table);
            await client.query(`ALTER TABLE ${quoteIdent(child_table)} ALTER COLUMN ${quoteIdent(child_column)} TYPE ${parentType} USING NULLIF(${quoteIdent(child_column)}::text, '')::${parentType}`);
            await ensureSimpleFK(client, child_table, child_column, parent_table, parent_column, constraint, 'CASCADE');
            continue;
          }
        }
        throw err;
      }
    }

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
