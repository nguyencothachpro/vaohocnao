const db = require('../config/db');
const LessonFile = {
  async byLesson(lesson_id) { const r = await db.query('SELECT * FROM lesson_files WHERE lesson_id=$1 ORDER BY position, id', [lesson_id]); return r.rows; },
  async findById(id) { const r = await db.query('SELECT * FROM lesson_files WHERE id=$1', [id]); return r.rows[0]; },
  async create({ lesson_id, title, file_url, file_type, file_source, is_free, position }) {
    const posR = await db.query('SELECT COALESCE(MAX(position),0)+1 p FROM lesson_files WHERE lesson_id=$1', [lesson_id]);
    const r = await db.query(`INSERT INTO lesson_files (lesson_id,title,file_url,file_type,file_source,is_free,position) VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`, [lesson_id,title,file_url,file_type||'pdf',file_source||'upload',is_free?1:0,position??posR.rows[0].p]);
    return r.rows[0];
  },
  async update(id,data){ await db.query(`UPDATE lesson_files SET title=$1,file_url=$2,file_type=$3,file_source=$4,is_free=$5 WHERE id=$6`,[data.title,data.file_url,data.file_type||'pdf',data.file_source||'link',data.is_free?1:0,id]); },
  async delete(id){ await db.query('DELETE FROM lesson_files WHERE id=$1',[id]); },
  async reorder(idsInOrder){ for(let i=0;i<idsInOrder.length;i++) await db.query('UPDATE lesson_files SET position=$1 WHERE id=$2',[i+1,idsInOrder[i]]); }
};
module.exports = LessonFile;
