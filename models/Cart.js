const db = require('../config/db');
const Course = require('./Course');
const Book = require('./Book');
const OnlineBook = require('./OnlineBook');

const Cart = {
  async add(user_id, item_type, item_id) {
    await db.query(
      `INSERT INTO cart_items (user_id,item_type,item_id) VALUES ($1,$2,$3) ON CONFLICT (user_id,item_type,item_id) DO NOTHING`,
      [user_id, item_type, item_id]
    );
  },
  async remove(user_id, item_type, item_id) {
    await db.query('DELETE FROM cart_items WHERE user_id=$1 AND item_type=$2 AND item_id=$3', [user_id, item_type, item_id]);
  },
  async clear(user_id) {
    await db.query('DELETE FROM cart_items WHERE user_id=$1', [user_id]);
  },
  async count(user_id) {
    const r = await db.query('SELECT COUNT(*) c FROM cart_items WHERE user_id=$1', [user_id]);
    return parseInt(r.rows[0].c);
  },
  // Tra ve danh sach san pham trong gio kem day du thong tin (ten, gia, anh) de hien thi
  async listWithDetails(user_id) {
    const rows = (await db.query('SELECT * FROM cart_items WHERE user_id=$1 ORDER BY added_at', [user_id])).rows;
    const items = [];
    for (const row of rows) {
      if (row.item_type === 'course') {
        const c = await Course.findById(row.item_id);
        if (c) items.push({ item_type: 'course', item_id: c.id, title: c.title, price: c.price, image: c.thumbnail_url, slug: c.slug });
      } else if (row.item_type === 'book') {
        const b = await Book.findById(row.item_id);
        if (b) items.push({ item_type: 'book', item_id: b.id, title: b.title, price: b.price, image: b.cover_url, slug: b.slug });
      } else if (row.item_type === 'online_book') {
        const ob = await OnlineBook.findById(row.item_id);
        if (ob) items.push({ item_type: 'online_book', item_id: ob.id, title: ob.title, price: ob.price, image: ob.cover_url, slug: ob.slug });
      }
    }
    return items;
  },
  async total(user_id) {
    const items = await this.listWithDetails(user_id);
    return items.reduce((sum, i) => sum + Number(i.price), 0);
  }
};
module.exports = Cart;
