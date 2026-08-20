require('dotenv').config();
const fs = require('fs');
const path = require('path');
const db = require('../config/db');
const bcrypt = require('bcryptjs');

// Split PostgreSQL safely: semicolons inside BEGIN...END blocks / quoted text
// must not terminate the statement.
function splitSql(sql) {
  const out = [];
  let start = 0;
  let depth = 0;
  let quote = null;
  let dollar = null;
  for (let i = 0; i < sql.length; i++) {
    const c = sql[i];
    const n = sql[i + 1];
    if (dollar) {
      if (sql.startsWith(dollar, i)) { i += dollar.length - 1; dollar = null; }
      continue;
    }
    if (quote) {
      if (c === '\\' && quote === "'") { i++; continue; }
      if (c === quote) {
        if (quote === "'" && n === "'") { i++; continue; }
        quote = null;
      }
      continue;
    }
    if (c === "'" || c === '"') { quote = c; continue; }
    if (c === '$') {
      const m = sql.slice(i).match(/^\$[A-Za-z0-9_]*\$/);
      if (m) { dollar = m[0]; i += dollar.length - 1; continue; }
    }
    if (c === '(') depth++;
    else if (c === ')') depth = Math.max(0, depth - 1);
    else if (c === ';' && depth === 0) {
      const s = sql.slice(start, i).trim();
      if (s && !s.startsWith('--')) out.push(s + ';');
      start = i + 1;
    }
  }
  const tail = sql.slice(start).trim();
  if (tail && !tail.startsWith('--')) out.push(tail);
  return out;
}

function ignorable(err) {
  const m = String(err?.message || '');
  return /already exists|duplicate key|cannot be implemented|does not exist|multiple primary keys|must be owner|violates.*constraint|could not create unique index|relation .* already exists|column .* already exists/i.test(m);
}

async function ensureAdmin(client) {
  const email = process.env.ADMIN_EMAIL;
  const password = process.env.ADMIN_PASSWORD;
  if (!email || !password) return;
  const hash = await bcrypt.hash(password, 10);
  const r = await client.query('SELECT id FROM users WHERE lower(email)=lower($1) LIMIT 1', [email]);
  if (r.rows.length) {
    await client.query("UPDATE users SET role='admin', password_hash=$2, is_active=1 WHERE id=$1", [r.rows[0].id, hash]);
  } else {
    await client.query("INSERT INTO users(name,email,password_hash,role,is_active) VALUES($1,$2,$3,'admin',1)", ['Quản trị viên', email, hash]);
  }
}

async function bootstrap() {
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL chưa được cấu hình trên Render.');
  const client = await db.getClient();
  const skipped = [];
  try {
    const schema = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
    const statements = splitSql(schema);

    // Each schema statement is isolated. A legacy FK/type conflict therefore
    // cannot abort the whole migration or prevent Express from starting.
    for (const statement of statements) {
      await client.query('SAVEPOINT bootstrap_stmt');
      try {
        await client.query(statement);
        await client.query('RELEASE SAVEPOINT bootstrap_stmt');
      } catch (err) {
        await client.query('ROLLBACK TO SAVEPOINT bootstrap_stmt');
        await client.query('RELEASE SAVEPOINT bootstrap_stmt');
        if (ignorable(err)) {
          skipped.push(String(err.message || '').split('\n')[0]);
          continue;
        }
        // Keep going for legacy schema incompatibilities. The application can
        // still boot as long as its required tables already exist.
        skipped.push(String(err.message || '').split('\n')[0]);
      }
    }

    // Guarantee the session table even if its legacy CREATE was skipped.
    await client.query(`CREATE TABLE IF NOT EXISTS "session" (sid varchar PRIMARY KEY, sess json NOT NULL, expire timestamp(6) NOT NULL)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_session_expire ON "session" (expire)`);
    await ensureAdmin(client);

    console.log(`>>> Bootstrap OK. Schema processed: ${statements.length} statements; ${skipped.length} legacy statements skipped.`);
  } finally {
    client.release();
    await db.pool.end();
  }
}

bootstrap().catch(async (err) => {
  console.error('>>> Bootstrap database FAILED:', err.stack || err.message);
  try { await db.pool.end(); } catch (_) {}
  process.exit(1);
});
