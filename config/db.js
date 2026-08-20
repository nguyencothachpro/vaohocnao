// Ket noi PostgreSQL (dung duoc voi Neon, Supabase, Render Postgres... bat ky nha cung cap nao co DATABASE_URL)
require('dotenv').config();
const { Pool } = require('pg');

if (!process.env.DATABASE_URL) {
  console.error('>>> LOI: Chua khai bao DATABASE_URL trong file .env');
  console.error('>>> Vao Neon.tech (mien phi) tao database, copy Connection String dan vao .env');
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL && process.env.DATABASE_URL.includes('localhost')
    ? false
    : { rejectUnauthorized: false } // Neon/Render Postgres yeu cau SSL
});

pool.on('error', (err) => {
  console.error('Loi ket noi Postgres (idle client):', err.message);
});

module.exports = {
  query: (text, params) => pool.query(text, params),
  getClient: () => pool.connect(),
  pool
};
