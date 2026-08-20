const db = require('../config/db');
const Enrollment = {
  async find(user_id, course_id) {
    const r = await db.query('SELECT * FROM enrollments WHERE user_id=$1 AND course_id=$2', [user_id, course_id]);
    return r.rows[0];
  },
  async isEnrolled(user_id, course_id) {
    return !!(await this.find(user_id, course_id));
  },
  async create(user_id, course_id) {
    const r = await db.query(
      `INSERT INTO enrollments (user_id,course_id) VALUES ($1,$2)
       ON CONFLICT (user_id,course_id) DO NOTHING RETURNING *`,
      [user_id, course_id]
    );
    return r.rows[0];
  },
  async byUser(user_id) {
    const r = await db.query(`
      SELECT e.*, c.title, c.slug, c.thumbnail_url FROM enrollments e
      JOIN courses c ON c.id = e.course_id
      WHERE e.user_id=$1 ORDER BY e.enrolled_at DESC`, [user_id]);
    return r.rows;
  },
  async byCourse(course_id) {
    const r = await db.query(`
      SELECT e.*, u.name, u.email FROM enrollments e
      JOIN users u ON u.id = e.user_id
      WHERE e.course_id=$1 ORDER BY e.enrolled_at DESC`, [course_id]);
    return r.rows;
  },
  async updateProgress(user_id, course_id, percent) {
    await db.query('UPDATE enrollments SET progress_percent=$1 WHERE user_id=$2 AND course_id=$3',
      [percent, user_id, course_id]);
  }
};
module.exports = Enrollment;
