const db = require('../config/db');
const Certificate = {
  async find(user_id, course_id) {
    const r = await db.query('SELECT * FROM certificates WHERE user_id=$1 AND course_id=$2', [user_id, course_id]);
    return r.rows[0];
  },
  async findByCode(code) {
    const r = await db.query(`
      SELECT ce.*, u.name AS student_name, c.title AS course_title
      FROM certificates ce
      JOIN users u ON u.id = ce.user_id
      JOIN courses c ON c.id = ce.course_id
      WHERE ce.certificate_code=$1`, [code]);
    return r.rows[0];
  },
  async create({ user_id, course_id, certificate_code, file_url }) {
    const r = await db.query(
      `INSERT INTO certificates (user_id,course_id,certificate_code,file_url) VALUES ($1,$2,$3,$4)
       ON CONFLICT (user_id,course_id) DO UPDATE SET file_url=EXCLUDED.file_url RETURNING *`,
      [user_id, course_id, certificate_code, file_url]
    );
    return r.rows[0];
  },
  async byUser(user_id) {
    const r = await db.query(`
      SELECT ce.*, c.title AS course_title FROM certificates ce
      JOIN courses c ON c.id=ce.course_id WHERE ce.user_id=$1 ORDER BY ce.issued_at DESC`, [user_id]);
    return r.rows;
  }
};
module.exports = Certificate;
