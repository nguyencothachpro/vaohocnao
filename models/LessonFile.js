const db = require('../config/db');
const LessonFile = {
  async findById(id){const r=await db.query('SELECT f.*,l.chapter_id,l.title lesson_title,ch.course_id FROM lesson_files f JOIN lessons l ON l.id=f.lesson_id JOIN chapters ch ON ch.id=l.chapter_id WHERE f.id=$1',[id]);return r.rows[0];},
  async byLesson(lesson_id) {
    const r = await db.query('SELECT * FROM lesson_files WHERE lesson_id=$1 ORDER BY position', [lesson_id]);
    return r.rows;
  },
  async create({ lesson_id, title, file_url, file_type, position, is_free }) {
    const posR = await db.query('SELECT COALESCE(MAX(position),0)+1 p FROM lesson_files WHERE lesson_id=$1', [lesson_id]);
    const r = await db.query(
      `INSERT INTO lesson_files (lesson_id,title,file_url,file_type,position,is_free) VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
      [lesson_id, title, file_url, file_type || 'pdf', position ?? posR.rows[0].p, is_free ? 1 : 0]
    );
    return r.rows[0];
  },
  async delete(id) {
    await db.query('DELETE FROM lesson_files WHERE id=$1', [id]);
  }
};
module.exports = LessonFile;
