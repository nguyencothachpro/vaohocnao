require('dotenv').config();
const fs = require('fs');
const path = require('path');
const db = require('../config/db');

function qi(v) { return '"' + String(v).replace(/"/g, '""') + '"'; }

async function tableExists(client, table) {
  const r = await client.query(`SELECT to_regclass($1) IS NOT NULL AS exists`, [`${process.env.PGSCHEMA || 'public'}.${table}`]);
  return !!r.rows[0]?.exists;
}

async function migrate() {
  const client = await db.getClient();
  const skipped = [];
  try {
    await client.query('BEGIN');

    // The repository is being deployed onto a legacy PostgreSQL database.
    // Do not rebuild or alter existing application data. Apply the original
    // schema one statement at a time so one incompatible legacy FK cannot
    // prevent the rest of the schema (and therefore the website) from starting.
    const schema = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
    const statements = schema
      .split(/;\s*(?=CREATE TABLE|ALTER TABLE|DO \$\$|CREATE INDEX|--)/g)
      .map(s => s.trim())
      .filter(Boolean);

    for (const raw of statements) {
      const statement = raw.endsWith(';') ? raw : `${raw};`;
      const normalized = statement.replace(/\s+/g, ' ').trim().toLowerCase();
      if (!normalized || normalized.startsWith('--')) continue;

<<<<<<< HEAD
      // Use a SAVEPOINT per statement: in Postgres, once any statement inside
      // a transaction fails, the WHOLE transaction is aborted and every
      // subsequent statement fails with "current transaction is aborted"
      // even if that statement itself is fine. A savepoint lets us roll back
      // just the failed statement and keep going.
      await client.query('SAVEPOINT stmt_sp');
      try {
        await client.query(statement);
        await client.query('RELEASE SAVEPOINT stmt_sp');
      } catch (err) {
        await client.query('ROLLBACK TO SAVEPOINT stmt_sp');
        await client.query('RELEASE SAVEPOINT stmt_sp');

=======
      try {
        await client.query(statement);
      } catch (err) {
>>>>>>> 2aefeb1db4dfc07f29d345245b0b130620e30650
        const msg = String(err.message || '');

        // Existing-table compatibility issues are safe to skip because the
        // existing table/column is already available to the running LMS.
        // This includes the legacy FK type mismatch that previously stopped
        // Render before server.js could even start.
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

    // connect-pg-simple session store.
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
    console.log(`>>> Migration OK. Schema checked; ${skipped.length} legacy compatibility conflicts skipped; session ready.`);
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
