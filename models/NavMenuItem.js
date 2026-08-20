const db = require('../config/db');
const NavMenuItem = {
  async active() {
    const r = await db.query('SELECT * FROM nav_menu_items WHERE is_active=1 ORDER BY position, id');
    return r.rows;
  },
  async all() {
    const r = await db.query('SELECT * FROM nav_menu_items ORDER BY position, id');
    return r.rows;
  },
  async create({ label, url, position }) {
    const r = await db.query(
      `INSERT INTO nav_menu_items (label, url, position) VALUES ($1,$2,$3) RETURNING *`,
      [label, url, position || 0]
    );
    return r.rows[0];
  },
  async toggle(id) {
    await db.query('UPDATE nav_menu_items SET is_active = 1 - is_active WHERE id=$1', [id]);
  },
  async delete(id) {
    await db.query('DELETE FROM nav_menu_items WHERE id=$1', [id]);
  },
  async reorder(idsInOrder) {
    for (let i = 0; i < idsInOrder.length; i++) {
      await db.query('UPDATE nav_menu_items SET position=$1 WHERE id=$2', [i, idsInOrder[i]]);
    }
  }
};
module.exports = NavMenuItem;
