const db = require('../config/db');
const Popup = {
  async activeOne() {
    const r = await db.query('SELECT * FROM popups WHERE is_active=1 ORDER BY created_at DESC LIMIT 1');
    return r.rows[0];
  },
  async all() {
    const r = await db.query('SELECT * FROM popups ORDER BY created_at DESC');
    return r.rows;
  },
  async create({ image_url, link_url, title }) {
    const r = await db.query(
      `INSERT INTO popups (image_url, link_url, title) VALUES ($1,$2,$3) RETURNING *`,
      [image_url, link_url || null, title || '']
    );
    return r.rows[0];
  },
  async toggle(id) {
    await db.query('UPDATE popups SET is_active = 1 - is_active WHERE id=$1', [id]);
  },
  async delete(id) {
    await db.query('DELETE FROM popups WHERE id=$1', [id]);
  }
};
module.exports = Popup;
