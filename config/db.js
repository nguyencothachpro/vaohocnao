// Database layer: dedicated PostgreSQL schema so the rebuilt LMS never collides
// with legacy public tables from previous versions.
require('dotenv').config();
const { Pool } = require('pg');

const schema = process.env.DB_SCHEMA || 'lms_v2';
if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(schema)) throw new Error('DB_SCHEMA khong hop le');

const connectionString = process.env.DATABASE_URL;
if (!connectionString) console.error('>>> LOI: Thieu DATABASE_URL');

const pool = new Pool({
  connectionString,
  ssl: connectionString && /localhost|127\.0\.0\.1/.test(connectionString) ? false : { rejectUnauthorized:false },
  options: `-c search_path=${schema},public`
});

pool.on('error', err => console.error('Postgres idle error:', err.message));

module.exports = {
  schema,
  query: (text, params) => pool.query(text, params),
  getClient: () => pool.connect(),
  pool
};
