require('dotenv').config();
const fs = require('fs');
const path = require('path');
const db = require('../config/db');

const qi = (v) => '"' + String(v).replace(/"/g, '""') + '"';
const schemaName = process.env.PGSCHEMA || 'public';

async function tableExists(client, table) {
  const r = await client.query(`SELECT to_regclass($1::text) IS NOT NULL AS exists`, [`${schemaName}.${table}`]);
  return !!r.rows[0]?.exists;
}

async function columnType(client, table, column) {
  const r = await client.query(`
    SELECT format_type(a.atttypid, a.atttypmod) AS type
    FROM pg_attribute a
    JOIN pg_class c ON c.oid = a.attrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE c.relname = $1
      AND n.nspname = $2
      AND a.attname = $3
      AND NOT a.attisdropped
    LIMIT 1
  `, [table, schemaName, column]);
  return r.rows[0]?.type || null;
}

async function ensureColumn(client, table, column, sqlType, defaultSql = null) {
  if (await columnType(client, table, column)) return;
  await client.query(`ALTER TABLE ${qi(table)} ADD COLUMN ${qi(column)} ${sqlType}${defaultSql ? ` DEFAULT ${defaultSql}` : ''}`);
}

async function dropForeignKeysBetween(client, childTable, parentTable) {
  if (!(await tableExists(client, childTable)) || !(await tableExists(client, parentTable))) return;
  const r = await client.query(`
    SELECT conname
    FROM pg_constraint
    WHERE conrelid = to_regclass($1::text)
      AND confrelid = to_regclass($2::text)
      AND contype = 'f'
  `, [`${schemaName}.${childTable}`, `${schemaName}.${parentTable}`]);
  for (const row of r.rows) {
    await client.query(`ALTER TABLE ${qi(childTable)} DROP CONSTRAINT ${qi(row.conname)}`);
  }
}

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
  // 1) Users is the main parent table.
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

  // 2) Categories: deliberately create it WITHOUT the self-referencing FK.
  // Legacy DBs may have a different id type; the FK is attached only after
  // the existing shape is normalized.
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

  const usersIdType = (await columnType(client, 'users', 'id')) || 'integer';
  const categoryIdType = (await columnType(client, 'categories', 'id')) || 'integer';

  await ensureColumn(client, 'categories', 'parent_id', categoryIdType, 'NULL');

  // Normalize categories.parent_id before attempting the FK.
  await dropForeignKeysBetween(client, 'categories', 'categories');
  const parentType = await columnType(client, 'categories', 'parent_id');
  if (parentType && parentType !== categoryIdType) {
    await client.query(`ALTER TABLE ${qi('categories')} ALTER COLUMN ${qi('parent_id')} TYPE ${categoryIdType} USING NULLIF(${qi('parent_id')}::text, '')::${categoryIdType}`);
  }

  // Attach the self-FK only when the column is known to exist.
  if (await columnType(client, 'categories', 'parent_id')) {
    await client.query(`ALTER TABLE ${qi('categories')} DROP CONSTRAINT IF EXISTS ${qi('categories_parent_id_fkey')}`);
    await client.query(`ALTER TABLE ${qi('categories')} ADD CONSTRAINT ${qi('categories_parent_id_fkey')} FOREIGN KEY (${qi('parent_id')}) REFERENCES ${qi('categories')}(${qi('id')}) ON DELETE CASCADE`);
  }

  // 3) Courses without FKs first, then normalize child columns.
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

  await ensureColumn(client, 'courses', 'category_id', categoryIdType, 'NULL');
  await ensureColumn(client, 'courses', 'teacher_id', usersIdType, 'NULL');

  await dropForeignKeysBetween(client, 'courses', 'categories');
  await dropForeignKeysBetween(client, 'courses', 'users');

  const courseCategoryType = await columnType(client, 'courses', 'category_id');
  if (courseCategoryType && courseCategoryType !== categoryIdType) {
    await client.query(`ALTER TABLE ${qi('courses')} ALTER COLUMN ${qi('category_id')} TYPE ${categoryIdType} USING NULLIF(${qi('category_id')}::text, '')::${categoryIdType}`);
  }
  const teacherType = await columnType(client, 'courses', 'teacher_id');
  if (teacherType && teacherType !== usersIdType) {
    await client.query(`ALTER TABLE ${qi('courses')} ALTER COLUMN ${qi('teacher_id')} TYPE ${usersIdType} USING NULLIF(${qi('teacher_id')}::text, '')::${usersIdType}`);
  }

  await client.query(`ALTER TABLE ${qi('courses')} DROP CONSTRAINT IF EXISTS ${qi('courses_category_id_fkey')}`);
  await client.query(`ALTER TABLE ${qi('courses')} DROP CONSTRAINT IF EXISTS ${qi('courses_teacher_id_fkey')}`);
  await client.query(`ALTER TABLE ${qi('courses')} ADD CONSTRAINT ${qi('courses_category_id_fkey')} FOREIGN KEY (${qi('category_id')}) REFERENCES ${qi('categories')}(${qi('id')}) ON DELETE SET NULL`);
  await client.query(`ALTER TABLE ${qi('courses')} ADD CONSTRAINT ${qi('courses_teacher_id_fkey')} FOREIGN KEY (${qi('teacher_id')}) REFERENCES ${qi('users')}(${qi('id')}) ON DELETE SET NULL`);

  // 4) Other root tables.
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

  // 5) Core child tables with no FKs, so schema.sql can safely add columns.
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

async function applyRemainingSchema(client, schema, skipped) {
  const statements = schema
    .split(/;\s*(?=CREATE TABLE|ALTER TABLE|DO \$\$|CREATE INDEX|--)/g)
    .map(s => s.trim())
    .filter(Boolean);

  const rank = (s) => {
    const x = s.replace(/\s+/g, ' ').trim().toLowerCase();
    if (x.includes('create table if not exists users')) return 0;
    if (x.includes('create table if not exists categories')) return 1;
    if (x.includes('create table if not exists courses')) return 2;
    if (x.includes('create table if not exists books')) return 2;
    if (x.includes('create table if not exists online_books')) return 2;
    if (x.includes('create table if not exists chapters')) return 3;
    if (x.includes('create table if not exists lessons')) return 4;
    if (x.includes('create table if not exists quizzes')) return 5;
    if (x.includes('create table if not exists quiz_questions')) return 6;
    return 10;
  };
  statements.sort((a, b) => rank(a) - rank(b));

  for (const raw of statements) {
    const statement = raw.endsWith(';') ? raw : `${raw};`;
    const normalized = statement.replace(/\s+/g, ' ').trim().toLowerCase();
    if (!normalized || normalized.startsWith('--')) continue;
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
      const msg = String(err.message || '');
      const canSkip =
        /foreign key constraint .* cannot be implemented/i.test(msg) ||
        /constraint .* already exists/i.test(msg) ||
        /relation .* already exists/i.test(msg) ||
        /column .* already exists/i.test(msg) ||
        /multiple primary keys for table/i.test(msg) ||
        /duplicate key value violates unique constraint/i.test(msg) ||
        /already exists/i.test(msg);
      if (canSkip) {
        skipped.push(msg.split('\n')[0]);
        continue;
      }
      throw err;
    }
  }
}

async function migrate() {
  const client = await db.getClient();
  const skipped = [];
  try {
    await client.query('BEGIN');
    await ensureCoreTables(client);
    const schema = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
    await applyRemainingSchema(client, schema, skipped);
    await ensureSession(client);
    await client.query('COMMIT');
    console.log(`>>> Migration OK. Core tables ensured; ${skipped.length} legacy compatibility conflicts skipped.`);
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
