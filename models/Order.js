const db = require('../config/db');
const Enrollment = require('./Enrollment');
const BookPurchase = require('./BookPurchase');
const OnlineBookPurchase = require('./OnlineBookPurchase');

const Order = {
  async findById(id) {
    const r = await db.query('SELECT * FROM orders WHERE id=$1', [id]);
    return r.rows[0];
  },

  // Don hang cu (1 khoa hoc/don) - giu lai de tuong thich nguoc, it dung tu khi co gio hang
  async create({ user_id, course_id, amount, payment_method, status = 'pending', transaction_id = null, recipient_name = null, recipient_phone = null, recipient_address = null }) {
    const r = await db.query(
      `INSERT INTO orders (user_id,course_id,amount,payment_method,status,transaction_id,recipient_name,recipient_phone,recipient_address)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
      [user_id, course_id, amount, payment_method, status, transaction_id, recipient_name, recipient_phone, recipient_address]
    );
    return r.rows[0];
  },

  // Don hang moi: nhieu san pham (khoa hoc + sach) trong 1 don, dung cho luong gio hang
  async createWithItems({ user_id, items, amount, payment_method, status = 'pending', recipient_name = null, recipient_phone = null, recipient_address = null, recipient_birth_year = null }) {
    const r = await db.query(
      `INSERT INTO orders (user_id,course_id,amount,payment_method,status,recipient_name,recipient_phone,recipient_address,recipient_birth_year)
       VALUES ($1,NULL,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
      [user_id, amount, payment_method, status, recipient_name, recipient_phone, recipient_address, recipient_birth_year || null]
    );
    const order = r.rows[0];
    for (const item of items) {
      await db.query(
        `INSERT INTO order_items (order_id,item_type,item_id,title_snapshot,price_snapshot) VALUES ($1,$2,$3,$4,$5)`,
        [order.id, item.item_type, item.item_id, item.title, item.price]
      );
    }
    return order;
  },

  async itemsByOrder(order_id) {
    const r = await db.query('SELECT * FROM order_items WHERE order_id=$1', [order_id]);
    return r.rows;
  },

  async markPaid(id, transaction_id) {
    await db.query(`UPDATE orders SET status='paid', transaction_id=COALESCE($1,transaction_id), paid_at=now() WHERE id=$2`,
      [transaction_id, id]);
  },

  // Sau khi xac nhan thanh toan: mo khoa hoc / cap quyen tai sach tuong ung voi tung san pham trong don
  async fulfill(order) {
    if (order.course_id) {
      await Enrollment.create(order.user_id, order.course_id); // don kieu cu (1 khoa hoc)
    }
    const items = await this.itemsByOrder(order.id);
    for (const item of items) {
      if (item.item_type === 'course') await Enrollment.create(order.user_id, item.item_id);
      else if (item.item_type === 'book') await BookPurchase.grant(order.user_id, item.item_id);
      else if (item.item_type === 'online_book') await OnlineBookPurchase.grant(order.user_id, item.item_id);
    }
  },

  async all() {
    const r = await db.query(`
      SELECT o.*, u.name AS user_name, u.email, c.title AS course_title
      FROM orders o
      JOIN users u ON u.id=o.user_id
      LEFT JOIN courses c ON c.id=o.course_id
      ORDER BY o.created_at DESC`);
    const orders = r.rows;
    for (const o of orders) {
      if (!o.course_title) {
        const items = await this.itemsByOrder(o.id);
        o.items_summary = items.map(i => i.title_snapshot).join(', ') || '(không có sản phẩm)';
      }
    }
    return orders;
  },

  async totalRevenue() {
    const r = await db.query(`SELECT COALESCE(SUM(amount),0) t FROM orders WHERE status='paid'`);
    return parseInt(r.rows[0].t);
  }
};
module.exports = Order;
