const db = require('../config/db');
const BookType = {
  async all() {
    const r = await db.query('SELECT * FROM book_types ORDER BY position, id');
    return r.rows;
  },
  async findBySlug(slug) {
    const r = await db.query('SELECT * FROM book_types WHERE slug=$1', [slug]);
    return r.rows[0];
  },
  async create({ name, slug }) {
    const r = await db.query('INSERT INTO book_types (name, slug) VALUES ($1,$2) RETURNING *', [name, slug]);
    return r.rows[0];
  },
  async delete(id) {
    await db.query('DELETE FROM book_types WHERE id=$1', [id]);
  }
};
module.exports = BookType;
