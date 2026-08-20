const db = require('../config/db');
const Chapter = require('./Chapter');
const Lesson = require('./Lesson');
const Enrollment = require('./Enrollment');

const LessonProgress = {
  async markCompleted(user_id, lesson_id) {
    await db.query(
      `INSERT INTO lesson_progress (user_id, lesson_id, is_completed, last_watched_at)
       VALUES ($1,$2,1, now())
       ON CONFLICT (user_id, lesson_id) DO UPDATE SET is_completed=1, last_watched_at=now()`,
      [user_id, lesson_id]
    );
  },
  async byUserAndCourse(user_id, course_id) {
    const r = await db.query(`
      SELECT lp.* FROM lesson_progress lp
      JOIN lessons l ON l.id = lp.lesson_id
      JOIN chapters ch ON ch.id = l.chapter_id
      WHERE lp.user_id=$1 AND ch.course_id=$2`, [user_id, course_id]);
    return r.rows;
  },
  // Tinh lai % tien do hoc cua 1 hoc vien trong 1 khoa hoc va luu vao enrollments
  async recalculate(user_id, course_id) {
    const totalR = await db.query(`
      SELECT COUNT(*) c FROM lessons l JOIN chapters ch ON ch.id=l.chapter_id WHERE ch.course_id=$1`, [course_id]);
    const total = parseInt(totalR.rows[0].c);
    if (total === 0) return 0;
    const doneR = await db.query(`
      SELECT COUNT(*) c FROM lesson_progress lp
      JOIN lessons l ON l.id=lp.lesson_id
      JOIN chapters ch ON ch.id=l.chapter_id
      WHERE lp.user_id=$1 AND ch.course_id=$2 AND lp.is_completed=1`, [user_id, course_id]);
    const done = parseInt(doneR.rows[0].c);
    const percent = Math.round((done / total) * 100);
    await Enrollment.updateProgress(user_id, course_id, percent);
    return percent;
  },
  async recentLog(user_id, limit = 20) {
    const r = await db.query(`
      SELECT lp.*, l.title AS lesson_title, c.title AS course_title, c.slug AS course_slug
      FROM lesson_progress lp
      JOIN lessons l ON l.id = lp.lesson_id
      JOIN chapters ch ON ch.id = l.chapter_id
      JOIN courses c ON c.id = ch.course_id
      WHERE lp.user_id=$1
      ORDER BY lp.last_watched_at DESC LIMIT $2`, [user_id, limit]);
    return r.rows;
  }
};
module.exports = LessonProgress;
