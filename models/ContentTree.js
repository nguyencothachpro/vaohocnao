const db = require('../config/db');
async function fullTree(type, id) {
  const field = type === 'book' ? 'book_id' : 'course_id';
  const chapters = (await db.query(`SELECT * FROM chapters WHERE ${field}=$1 ORDER BY position,id`, [id])).rows;
  if (!chapters.length) return [];
  const chapterIds = chapters.map(x=>x.id);
  const lessons = (await db.query('SELECT * FROM lessons WHERE chapter_id = ANY($1) ORDER BY position,id',[chapterIds])).rows;
  const lessonIds = lessons.map(x=>x.id);
  let videos=[],files=[],quizzes=[];
  if (lessonIds.length) {
    [videos,files,quizzes] = await Promise.all([
      db.query('SELECT * FROM lesson_videos WHERE lesson_id=ANY($1) ORDER BY position,id',[lessonIds]).then(r=>r.rows),
      db.query('SELECT * FROM lesson_files WHERE lesson_id=ANY($1) ORDER BY position,id',[lessonIds]).then(r=>r.rows),
      db.query('SELECT DISTINCT ON (lesson_id) * FROM quizzes WHERE lesson_id=ANY($1) ORDER BY lesson_id,id DESC',[lessonIds]).then(r=>r.rows)
    ]);
  }
  lessons.forEach(l=>{ l.videos=videos.filter(v=>v.lesson_id===l.id); l.files=files.filter(f=>f.lesson_id===l.id); l.quiz=quizzes.find(q=>q.lesson_id===l.id)||null; });
  chapters.forEach(c=>{ c.lessons=lessons.filter(l=>l.chapter_id===c.id); });
  return chapters;
}
module.exports={fullTree};
