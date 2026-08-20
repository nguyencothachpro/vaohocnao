const db = require('../config/db');
const OnlineBookTocEntry = {
  async byBook(online_book_id) {
    const r = await db.query(
      'SELECT * FROM online_book_toc_entries WHERE online_book_id=$1 ORDER BY page_number, position, id',
      [online_book_id]
    );
    return r.rows;
  },
  async findById(id) {
    const r = await db.query('SELECT * FROM online_book_toc_entries WHERE id=$1', [id]);
    return r.rows[0];
  },
  async create({ online_book_id, title, page_number }) {
    const posR = await db.query('SELECT COALESCE(MAX(position),0)+1 p FROM online_book_toc_entries WHERE online_book_id=$1', [online_book_id]);
    const r = await db.query(
      `INSERT INTO online_book_toc_entries (online_book_id,title,page_number,position) VALUES ($1,$2,$3,$4) RETURNING *`,
      [online_book_id, title, page_number, posR.rows[0].p]
    );
    return r.rows[0];
  },
  async update(id, { title, page_number }) {
    await db.query('UPDATE online_book_toc_entries SET title=$1, page_number=$2 WHERE id=$3', [title, page_number, id]);
  },
  async delete(id) {
    await db.query('DELETE FROM online_book_toc_entries WHERE id=$1', [id]);
  }
};
module.exports = OnlineBookTocEntry;
