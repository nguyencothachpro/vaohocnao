const db = require('../config/db');
const News = {
  async published() {
    const r = await db.query('SELECT * FROM news WHERE is_published=1 ORDER BY created_at DESC');
    return r.rows;
  },
  async all() {
    const r = await db.query(`SELECT n.*, u.name AS author_name FROM news n
      LEFT JOIN users u ON u.id=n.author_id ORDER BY n.created_at DESC`);
    return r.rows;
  },
  async findBySlug(slug) {
    const r = await db.query('SELECT * FROM news WHERE slug=$1', [slug]);
    return r.rows[0];
  },
  async create({ author_id, title, slug, thumbnail_url, content, is_published }) {
    const r = await db.query(
      `INSERT INTO news (author_id,title,slug,thumbnail_url,content,is_published)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
      [author_id || null, title, slug, thumbnail_url || null, content || '', is_published ? 1 : 0]
    );
    return r.rows[0];
  },
  async delete(id) {
    await db.query('DELETE FROM news WHERE id=$1', [id]);
  }
};
module.exports = News;
