const db = require('../config/db');
const Lesson = {
  async byChapter(chapter_id) {
    const r = await db.query('SELECT * FROM lessons WHERE chapter_id=$1 ORDER BY position', [chapter_id]);
    return r.rows;
  },
  async findById(id) {
    const r = await db.query('SELECT l.*, ch.course_id FROM lessons l JOIN chapters ch ON ch.id=l.chapter_id WHERE l.id=$1', [id]);
    return r.rows[0];
  },
  async create({ chapter_id, title, content, is_preview, position }) {
    const posR = await db.query('SELECT COALESCE(MAX(position),0)+1 p FROM lessons WHERE chapter_id=$1', [chapter_id]);
    const r = await db.query(
      `INSERT INTO lessons (chapter_id,title,content,is_preview,position) VALUES ($1,$2,$3,$4,$5) RETURNING *`,
      [chapter_id, title, content || '', is_preview ? 1 : 0, position ?? posR.rows[0].p]
    );
    return r.rows[0];
  },
  async update(id, { title, content, is_preview }) {
    await db.query('UPDATE lessons SET title=$1, content=$2, is_preview=$3 WHERE id=$4',
      [title, content || '', is_preview ? 1 : 0, id]);
  },
  async delete(id) {
    await db.query('DELETE FROM lessons WHERE id=$1', [id]);
  },
  async reorder(idsInOrder) {
    for (let i = 0; i < idsInOrder.length; i++) {
      await db.query('UPDATE lessons SET position=$1 WHERE id=$2', [i, idsInOrder[i]]);
    }
  },
  async countAll() {
    const r = await db.query('SELECT COUNT(*) c FROM lessons');
    return parseInt(r.rows[0].c);
  }
};
module.exports = Lesson;
