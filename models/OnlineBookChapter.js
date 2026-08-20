const db = require('../config/db');
const OnlineBookChapter = {
  async byBook(online_book_id) {
    const r = await db.query('SELECT * FROM online_book_chapters WHERE online_book_id=$1 ORDER BY position, id', [online_book_id]);
    return r.rows;
  },
  async findById(id) {
    const r = await db.query('SELECT * FROM online_book_chapters WHERE id=$1', [id]);
    return r.rows[0];
  },
  async create({ online_book_id, title, content, is_free }) {
    const posR = await db.query('SELECT COALESCE(MAX(position),0)+1 p FROM online_book_chapters WHERE online_book_id=$1', [online_book_id]);
    const r = await db.query(
      `INSERT INTO online_book_chapters (online_book_id,title,content,is_free,position) VALUES ($1,$2,$3,$4,$5) RETURNING *`,
      [online_book_id, title, content || '', is_free ? 1 : 0, posR.rows[0].p]
    );
    return r.rows[0];
  },
  async update(id, { title, content, is_free }) {
    await db.query('UPDATE online_book_chapters SET title=$1, content=$2, is_free=$3 WHERE id=$4',
      [title, content || '', is_free ? 1 : 0, id]);
  },
  async delete(id) {
    await db.query('DELETE FROM online_book_chapters WHERE id=$1', [id]);
  },
  async reorder(idsInOrder) {
    for (let i = 0; i < idsInOrder.length; i++) {
      await db.query('UPDATE online_book_chapters SET position=$1 WHERE id=$2', [i, idsInOrder[i]]);
    }
  }
};
module.exports = OnlineBookChapter;
