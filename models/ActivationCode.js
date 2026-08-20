const db = require('../config/db');
const ActivationCode = {
  async byCourse(course_id) {
    const r = await db.query('SELECT * FROM activation_codes WHERE course_id=$1 ORDER BY created_at DESC', [course_id]);
    return r.rows;
  },
  async findByCode(code) {
    const r = await db.query('SELECT * FROM activation_codes WHERE code=$1', [code]);
    return r.rows[0];
  },
  async create(code, course_id, expires_at) {
    const r = await db.query(
      `INSERT INTO activation_codes (code, course_id, expires_at) VALUES ($1,$2,$3) RETURNING *`,
      [code, course_id, expires_at || null]
    );
    return r.rows[0];
  },
  async markUsed(id, user_id) {
    await db.query(
      `UPDATE activation_codes SET is_used=1, used_by_user_id=$1, used_at=now() WHERE id=$2`,
      [user_id, id]
    );
  },
  async deactivate(id) {
    await db.query(`UPDATE activation_codes SET is_active=0 WHERE id=$1`, [id]);
  },
  async reactivate(id) {
    await db.query(`UPDATE activation_codes SET is_active=1 WHERE id=$1`, [id]);
  },
  async delete(id) {
    await db.query('DELETE FROM activation_codes WHERE id=$1', [id]);
  },
  // Trang thai tinh toan de hien thi: chua_dung / da_dung / het_han / vo_hieu_hoa
  status(code) {
    if (!code.is_active) return 'vo_hieu_hoa';
    if (code.is_used) return 'da_dung';
    if (code.expires_at && new Date(code.expires_at) < new Date()) return 'het_han';
    return 'chua_dung';
  }
};
module.exports = ActivationCode;
