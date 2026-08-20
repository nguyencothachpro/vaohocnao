const db = require('../config/db');
const Chapter = {
  async byCourse(course_id) {
    const r = await db.query('SELECT * FROM chapters WHERE course_id=$1 ORDER BY position, id', [course_id]);
    return r.rows;
  },
  async byBook(book_id) {
    const r = await db.query('SELECT * FROM chapters WHERE book_id=$1 ORDER BY position, id', [book_id]);
    return r.rows;
  },
  async findById(id) {
    const r = await db.query('SELECT * FROM chapters WHERE id=$1', [id]);
    return r.rows[0];
  },
  async create({ course_id, book_id, title, position }) {
    const parentField = course_id ? 'course_id' : 'book_id';
    const parentId = course_id || book_id;
    const posR = await db.query(`SELECT COALESCE(MAX(position),0)+1 p FROM chapters WHERE ${parentField}=$1`, [parentId]);
    const r = await db.query(
      `INSERT INTO chapters (course_id,book_id,title,position) VALUES ($1,$2,$3,$4) RETURNING *`,
      [course_id || null, book_id || null, title, position ?? posR.rows[0].p]
    );
    return r.rows[0];
  },
  async update(id, { title }) { await db.query('UPDATE chapters SET title=$1 WHERE id=$2', [title, id]); },
  async delete(id) { await db.query('DELETE FROM chapters WHERE id=$1', [id]); },
  async reorder(idsInOrder) {
    await db.query('BEGIN');
    try {
      for (let i = 0; i < idsInOrder.length; i++) await db.query('UPDATE chapters SET position=$1 WHERE id=$2', [i + 1, idsInOrder[i]]);
      await db.query('COMMIT');
    } catch (e) { await db.query('ROLLBACK'); throw e; }
  }
};
module.exports = Chapter;
