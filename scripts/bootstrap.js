// Bootstrap kept for manual use. Production start runs the full idempotent schema migration
// before starting Express (see package.json: start = node scripts/migrate.js && node server.js).
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const db = require('../config/db');

async function bootstrap() {
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL chưa được cấu hình trên Render.');
  const schema = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
  await db.query(schema);
  console.log('>>> Bootstrap OK: full LMS schema is ready (including session/news/etc.).');
  await db.pool.end();
}
bootstrap().catch(async (err) => {
  console.error('>>> Bootstrap database FAILED:', err.stack || err.message);
  try { await db.pool.end(); } catch (_) {}
  process.exit(1);
});
