const db = require('../config/db');
const Book = {
  async all() {
    const r = await db.query(`
      SELECT b.*, cat.name AS category_name, bt.name AS book_type_name
      FROM books b
      LEFT JOIN categories cat ON cat.id = b.category_id
      LEFT JOIN book_types bt ON bt.id = b.book_type_id
      ORDER BY b.created_at DESC`);
    return r.rows;
  },
  // filters: { category_id, book_type_id } - deu tuy chon
  async published(filters = {}) {
    const clauses = ['b.is_published=1'];
    const params = [];
    if (filters.category_ids && filters.category_ids.length) {
      params.push(filters.category_ids); clauses.push(`b.category_id = ANY($${params.length}::int[])`);
    } else if (filters.category_id) {
      params.push(filters.category_id); clauses.push(`b.category_id=$${params.length}`);
    }
    if (filters.book_type_id) { params.push(filters.book_type_id); clauses.push(`b.book_type_id=$${params.length}`); }
    const r = await db.query(`
      SELECT b.*, cat.name AS category_name, bt.name AS book_type_name
      FROM books b
      LEFT JOIN categories cat ON cat.id = b.category_id
      LEFT JOIN book_types bt ON bt.id = b.book_type_id
      WHERE ${clauses.join(' AND ')}
      ORDER BY b.created_at DESC`, params);
    return r.rows;
  },
  async findById(id) {
    const r = await db.query('SELECT * FROM books WHERE id=$1', [id]);
    return r.rows[0];
  },
  async findBySlug(slug) {
    const r = await db.query(`
      SELECT b.*, cat.name AS category_name, bt.name AS book_type_name
      FROM books b
      LEFT JOIN categories cat ON cat.id = b.category_id
      LEFT JOIN book_types bt ON bt.id = b.book_type_id
      WHERE b.slug=$1`, [slug]);
    return r.rows[0];
  },
  async create(data) {
    const { title, slug, author, short_desc, description, cover_url, price, compare_at_price, file_url, preview_url, category_id, book_type_id, is_published } = data;
    const r = await db.query(
      `INSERT INTO books (title,slug,author,short_desc,description,cover_url,price,compare_at_price,file_url,preview_url,category_id,book_type_id,is_published)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) RETURNING *`,
      [title, slug, author || '', short_desc || '', description || '', cover_url || null, price || 0, compare_at_price || null,
       file_url || null, preview_url || null, category_id || null, book_type_id || null, is_published ? 1 : 0]
    );
    return r.rows[0];
  },
  async update(id, data) {
    const { title, author, short_desc, description, cover_url, price, compare_at_price, file_url, preview_url, category_id, book_type_id, is_published } = data;
    await db.query(
      `UPDATE books SET title=$1, author=$2, short_desc=$3, description=$4,
       cover_url=COALESCE($5,cover_url), price=$6, compare_at_price=$7, file_url=$8, preview_url=$9,
       category_id=$10, book_type_id=$11, is_published=$12 WHERE id=$13`,
      [title, author || '', short_desc || '', description || '', cover_url || null, price || 0, compare_at_price || null,
       file_url || null, preview_url || null, category_id || null, book_type_id || null, is_published ? 1 : 0, id]
    );
  },
  async delete(id) {
    await db.query('DELETE FROM books WHERE id=$1', [id]);
  },
  async count() {
    const r = await db.query('SELECT COUNT(*) c FROM books');
    return parseInt(r.rows[0].c);
  }
};
module.exports = Book;
