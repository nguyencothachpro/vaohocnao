const db = require('../config/db');

// Danh muc rieng cho "Doc sach online", TACH BIET hoan toan voi danh muc Sach (BookCategory)
const OnlineBookCategory = {
  async all() {
    const r = await db.query('SELECT * FROM online_book_categories ORDER BY parent_id NULLS FIRST, position, id');
    return r.rows;
  },
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
    const r = await db.query('SELECT * FROM online_book_categories WHERE id=$1', [id]);
    return r.rows[0];
  },
  async findBySlug(slug) {
    const r = await db.query('SELECT * FROM online_book_categories WHERE slug=$1', [slug]);
    return r.rows[0];
  },
  // Tra ve mang [id] gom chinh danh muc nay + TAT CA danh muc con chau (moi cap)
  async subtreeIds(id) {
    const flat = await this.all();
    const result = [Number(id)];
    let frontier = [Number(id)];
    while (frontier.length) {
      const next = flat.filter(c => frontier.includes(c.parent_id)).map(c => c.id);
      result.push(...next);
      frontier = next;
    }
    return result;
  },
  async create({ parent_id, name, slug, position = 0 }) {
    const r = await db.query(
      `INSERT INTO online_book_categories (parent_id,name,slug,position) VALUES ($1,$2,$3,$4) RETURNING *`,
      [parent_id || null, name, slug, position]
    );
    return r.rows[0];
  },
  async update(id, { parent_id, name, slug }) {
    await db.query(
      `UPDATE online_book_categories SET parent_id=$1, name=$2, slug=$3 WHERE id=$4`,
      [parent_id || null, name, slug, id]
    );
  },
  async delete(id) {
    await db.query('DELETE FROM online_book_categories WHERE id=$1', [id]);
  },
  async reorder(idsInOrder) {
    for (let i = 0; i < idsInOrder.length; i++) {
      await db.query('UPDATE online_book_categories SET position=$1 WHERE id=$2', [i, idsInOrder[i]]);
    }
  }
};
module.exports = OnlineBookCategory;
