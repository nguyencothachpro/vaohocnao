const db = require('../config/db');
const OnlineBook = {
  async all() {
    const r = await db.query(`
      SELECT ob.*, obc.name AS category_name,
        (SELECT COUNT(*) FROM online_book_chapters WHERE online_book_id=ob.id) AS chapter_count
      FROM online_books ob
      LEFT JOIN online_book_categories obc ON obc.id = ob.category_id
      ORDER BY ob.created_at DESC`);
    return r.rows;
  },
  // filters: { category_id, category_ids } - deu tuy chon.
  // category_ids (mang): dung khi loc theo 1 danh muc cha, gom ca sach cua danh muc con ben trong.
  async published({ category_id, category_ids } = {}) {
    const params = [];
    let where = 'ob.is_published=1';
    if (category_ids && category_ids.length) {
      params.push(category_ids); where += ` AND ob.category_id = ANY($${params.length}::int[])`;
    } else if (category_id) {
      params.push(category_id); where += ` AND ob.category_id=$${params.length}`;
    }
    const r = await db.query(`
      SELECT ob.*, obc.name AS category_name,
        (SELECT COUNT(*) FROM online_book_chapters WHERE online_book_id=ob.id) AS chapter_count
      FROM online_books ob
      LEFT JOIN online_book_categories obc ON obc.id = ob.category_id
      WHERE ${where} ORDER BY ob.created_at DESC`, params);
    return r.rows;
  },
  async findById(id) {
    const r = await db.query('SELECT * FROM online_books WHERE id=$1', [id]);
    return r.rows[0];
  },
  async findBySlug(slug) {
    const r = await db.query('SELECT * FROM online_books WHERE slug=$1', [slug]);
    return r.rows[0];
  },
  async create(data) {
    const { title, slug, author, short_desc, description, cover_url, price, compare_at_price, is_published, file_url, file_source, category_id } = data;
    const r = await db.query(
      `INSERT INTO online_books (title,slug,author,short_desc,description,cover_url,price,compare_at_price,is_published,file_url,file_source,category_id)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING *`,
      [title, slug, author || '', short_desc || '', description || '', cover_url || null, price || 0, compare_at_price || null, is_published ? 1 : 0, file_url || null, file_source || null, category_id || null]
    );
    return r.rows[0];
  },
  async update(id, data) {
    const { title, author, short_desc, description, cover_url, price, compare_at_price, is_published, file_url, file_source, category_id } = data;
    await db.query(
      `UPDATE online_books SET title=$1, author=$2, short_desc=$3, description=$4,
       cover_url=COALESCE($5,cover_url), price=$6, compare_at_price=$7, is_published=$8,
       file_url=COALESCE($9,file_url), file_source=COALESCE($10,file_source), category_id=$11 WHERE id=$12`,
      [title, author || '', short_desc || '', description || '', cover_url || null, price || 0, compare_at_price || null, is_published ? 1 : 0, file_url || null, file_source || null, category_id || null, id]
    );
  },
  async delete(id) {
    await db.query('DELETE FROM online_books WHERE id=$1', [id]);
  },
  async count() {
    const r = await db.query('SELECT COUNT(*) c FROM online_books');
    return parseInt(r.rows[0].c);
  }
};
module.exports = OnlineBook;
