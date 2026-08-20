# KingEdu V9 FIX2 – full database bootstrap

This build fixes the Render error `relation "news" does not exist` (and the earlier `relation "session" does not exist`).

## Why it happened
The previous `start` command created only the PostgreSQL `session` table. The application also requires the full LMS schema, including `news`, `users`, `courses`, `chapters`, `lessons`, `books`, `online_books`, quiz tables, menus, etc.

## What FIX2 does
Render startup now runs:

```bash
node scripts/migrate.js && node server.js
```

`migrate.js` executes the complete idempotent `scripts/schema.sql` before Express starts. Existing data is not deleted; the schema uses `CREATE TABLE IF NOT EXISTS` and `ADD COLUMN IF NOT EXISTS` for additions.

## Deploy
Replace the GitHub repository contents with this package and let Render redeploy. Keep the existing `DATABASE_URL`, `ADMIN_EMAIL`, `ADMIN_PASSWORD`, `SESSION_SECRET`, and `NODE_ENV`.

No Render Shell, Neon, or new Supabase project is required.
