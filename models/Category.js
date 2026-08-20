const db = require('../config/db');

const Category = {
  async all() {
    const r = await db.query('SELECT * FROM categories ORDER BY parent_id NULLS FIRST, position, id');
    return r.rows;
  },
  // Dung de dung cay danh muc dang long nhau (khong gioi han so cap)
  async tree() {
    const flat = await this.all();
    const map = {};
    flat.forEach(c => map[c.id] = { ...c, children: [] });
    const roots = [];
    flat.forEach(c => {
      if (c.parent_id && map[c.parent_id]) map[c.parent_id].children.push(map[c.id]);
      else roots.push(map[c.id]);
    });
    return roots;
  },
  async findById(id) {
    const r = await db.query('SELECT * FROM categories WHERE id=$1', [id]);
    return r.rows[0];
  },
  async findBySlug(slug) {
    const r = await db.query('SELECT * FROM categories WHERE slug=$1', [slug]);
    return r.rows[0];
  },
  async create({ parent_id, name, slug, icon, position = 0 }) {
    const r = await db.query(
      `INSERT INTO categories (parent_id,name,slug,icon,position) VALUES ($1,$2,$3,$4,$5) RETURNING *`,
      [parent_id || null, name, slug, icon || null, position]
    );
    return r.rows[0];
  },
  async update(id, { parent_id, name, slug, icon }) {
    await db.query(
      `UPDATE categories SET parent_id=$1, name=$2, slug=$3, icon=$4 WHERE id=$5`,
      [parent_id || null, name, slug, icon || null, id]
    );
  },
  async reorder(idsInOrder) {
    for (let i = 0; i < idsInOrder.length; i++) {
      await db.query('UPDATE categories SET position=$1 WHERE id=$2', [i, idsInOrder[i]]);
    }
  },
  async delete(id) {
    await db.query('DELETE FROM categories WHERE id=$1', [id]);
  },
  async count() {
    const r = await db.query('SELECT COUNT(*) c FROM categories');
    return parseInt(r.rows[0].c);
  }
};
module.exports = Category;
