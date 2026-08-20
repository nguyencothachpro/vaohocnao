require('dotenv').config();
const db = require('../config/db');

async function bootstrap() {
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL chưa được cấu hình trên Render.');
  }

  // connect-pg-simple expects this exact table by default when tableName = "session".
  // Keep this bootstrap intentionally small and idempotent so an existing database is safe.
  await db.query(`
    CREATE TABLE IF NOT EXISTS "session" (
      "sid" varchar NOT NULL COLLATE "default",
      "sess" json NOT NULL,
      "expire" timestamp(6) NOT NULL
    )
  `);

  await db.query(`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'session_pkey'
          AND conrelid = 'session'::regclass
      ) THEN
        ALTER TABLE "session" ADD CONSTRAINT "session_pkey" PRIMARY KEY ("sid");
      END IF;
    END $$;
  `);

  await db.query(`
    CREATE INDEX IF NOT EXISTS "IDX_session_expire" ON "session" ("expire");
  `);

  console.log('>>> Bootstrap OK: PostgreSQL session table is ready.');
  await db.pool.end();
}

bootstrap().catch(async (err) => {
  console.error('>>> Bootstrap database FAILED:', err.message);
  try { await db.pool.end(); } catch (_) {}
  process.exit(1);
});
