const db = require('../config/db');
const LessonVideo = {
  async byLesson(lesson_id) {
    const r = await db.query('SELECT * FROM lesson_videos WHERE lesson_id=$1 ORDER BY position', [lesson_id]);
    return r.rows;
  },
  async findById(id) {
    const r = await db.query('SELECT * FROM lesson_videos WHERE id=$1', [id]);
    return r.rows[0];
  },
  async create({ lesson_id, title, source_type, source_value, duration_seconds, position, is_free }) {
    const posR = await db.query('SELECT COALESCE(MAX(position),0)+1 p FROM lesson_videos WHERE lesson_id=$1', [lesson_id]);
    const r = await db.query(
      `INSERT INTO lesson_videos (lesson_id,title,source_type,source_value,duration_seconds,position,is_free)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
      [lesson_id, title, source_type, source_value, duration_seconds || null, position ?? posR.rows[0].p, is_free ? 1 : 0]
    );
    return r.rows[0];
  },
  async delete(id) {
    await db.query('DELETE FROM lesson_videos WHERE id=$1', [id]);
  },
  async reorder(idsInOrder) {
    for (let i = 0; i < idsInOrder.length; i++) {
      await db.query('UPDATE lesson_videos SET position=$1 WHERE id=$2', [i, idsInOrder[i]]);
    }
  },
  async incrementView(id) {
    await db.query('UPDATE lesson_videos SET view_count = view_count + 1 WHERE id=$1', [id]);
  },
  async countAll() {
    const r = await db.query('SELECT COUNT(*) c FROM lesson_videos');
    return parseInt(r.rows[0].c);
  },
  async totalViews() {
    const r = await db.query('SELECT COALESCE(SUM(view_count),0) v FROM lesson_videos');
    return parseInt(r.rows[0].v);
  }
};
module.exports = LessonVideo;
