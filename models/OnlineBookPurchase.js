const db = require('../config/db');
const OnlineBookPurchase = {
  async isPurchased(user_id, online_book_id) {
    const r = await db.query('SELECT 1 FROM online_book_purchases WHERE user_id=$1 AND online_book_id=$2', [user_id, online_book_id]);
    return r.rows.length > 0;
  },
  async grant(user_id, online_book_id) {
    await db.query(
      `INSERT INTO online_book_purchases (user_id, online_book_id) VALUES ($1,$2) ON CONFLICT (user_id,online_book_id) DO NOTHING`,
      [user_id, online_book_id]
    );
  },
  async byUser(user_id) {
    const r = await db.query(`
      SELECT p.*, b.title, b.cover_url, b.slug FROM online_book_purchases p
      JOIN online_books b ON b.id = p.online_book_id WHERE p.user_id=$1 ORDER BY p.purchased_at DESC`, [user_id]);
    return r.rows;
  }
};
module.exports = OnlineBookPurchase;
