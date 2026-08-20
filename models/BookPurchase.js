const db = require('../config/db');
const BookPurchase = {
  async isPurchased(user_id, book_id) {
    const r = await db.query('SELECT 1 FROM book_purchases WHERE user_id=$1 AND book_id=$2', [user_id, book_id]);
    return r.rows.length > 0;
  },
  async grant(user_id, book_id) {
    await db.query(
      `INSERT INTO book_purchases (user_id, book_id) VALUES ($1,$2) ON CONFLICT (user_id,book_id) DO NOTHING`,
      [user_id, book_id]
    );
  },
  async byUser(user_id) {
    const r = await db.query(`
      SELECT bp.*, b.title, b.cover_url, b.file_url, b.author FROM book_purchases bp
      JOIN books b ON b.id = bp.book_id WHERE bp.user_id=$1 ORDER BY bp.purchased_at DESC`, [user_id]);
    return r.rows;
  }
};
module.exports = BookPurchase;
