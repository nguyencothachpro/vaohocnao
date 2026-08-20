const db = require('../config/db');
const Banner = {
  async active() {
    const r = await db.query('SELECT * FROM banners WHERE is_active=1 ORDER BY position');
    return r.rows;
  },
  async all() {
    const r = await db.query('SELECT * FROM banners ORDER BY position');
    return r.rows;
  },
  async create({ image_url, link_url, title, position }) {
    const r = await db.query(
      `INSERT INTO banners (image_url,link_url,title,position) VALUES ($1,$2,$3,$4) RETURNING *`,
      [image_url, link_url || null, title || '', position || 0]
    );
    return r.rows[0];
  },
  async toggle(id) {
    await db.query('UPDATE banners SET is_active = 1 - is_active WHERE id=$1', [id]);
  },
  async delete(id) {
    await db.query('DELETE FROM banners WHERE id=$1', [id]);
  }
};
module.exports = Banner;
