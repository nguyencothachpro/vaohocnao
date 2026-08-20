const db = require('../config/db');

const Course = {
  async all() {
    const r = await db.query(`
      SELECT c.*, cat.name AS category_name, u.name AS teacher_name
      FROM courses c
      LEFT JOIN categories cat ON cat.id = c.category_id
      LEFT JOIN users u ON u.id = c.teacher_id
      ORDER BY c.position, c.id DESC`);
    return r.rows;
  },
  async published() {
    const r = await db.query(`SELECT c.*, cat.name AS category_name FROM courses c
      LEFT JOIN categories cat ON cat.id = c.category_id
      WHERE c.is_published = 1 ORDER BY c.position, c.id DESC`);
    return r.rows;
  },
  async byCategory(category_id) {
    const r = await db.query(`SELECT * FROM courses WHERE category_id=$1 AND is_published=1 ORDER BY position`, [category_id]);
    return r.rows;
  },
  async findById(id) {
    const r = await db.query(`SELECT c.*, cat.name AS category_name, cat.slug AS category_slug, u.name AS teacher_name
      FROM courses c
      LEFT JOIN categories cat ON cat.id = c.category_id
      LEFT JOIN users u ON u.id = c.teacher_id
      WHERE c.id=$1`, [id]);
    return r.rows[0];
  },
  async findBySlug(slug) {
    const r = await db.query(`SELECT c.*, cat.name AS category_name, cat.slug AS category_slug, u.name AS teacher_name
      FROM courses c
      LEFT JOIN categories cat ON cat.id = c.category_id
      LEFT JOIN users u ON u.id = c.teacher_id
      WHERE c.slug=$1`, [slug]);
    return r.rows[0];
  },
  async create(data) {
    const { category_id, teacher_id, title, slug, short_desc, description, thumbnail_url, price, compare_at_price, intro_video_url, is_published } = data;
    const r = await db.query(
      `INSERT INTO courses (category_id,teacher_id,title,slug,short_desc,description,thumbnail_url,price,compare_at_price,intro_video_url,is_published)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING *`,
      [category_id || null, teacher_id || null, title, slug, short_desc || '', description || '', thumbnail_url || null, price || 0, compare_at_price || null, intro_video_url || null, is_published ? 1 : 0]
    );
    return r.rows[0];
  },
  async update(id, data) {
    const { category_id, teacher_id, title, slug, short_desc, description, thumbnail_url, price, compare_at_price, intro_video_url, is_published } = data;
    await db.query(
      `UPDATE courses SET category_id=$1, teacher_id=$2, title=$3, slug=$4, short_desc=$5,
       description=$6, thumbnail_url=COALESCE($7,thumbnail_url), price=$8, compare_at_price=$9, intro_video_url=$10, is_published=$11 WHERE id=$12`,
      [category_id || null, teacher_id || null, title, slug, short_desc || '', description || '', thumbnail_url || null, price || 0, compare_at_price || null, intro_video_url || null, is_published ? 1 : 0, id]
    );
  },
  async delete(id) {
    await db.query('DELETE FROM courses WHERE id=$1', [id]);
  },
  async incrementView(id) {
    await db.query('UPDATE courses SET view_count = view_count + 1 WHERE id=$1', [id]);
  },
  async count() {
    const r = await db.query('SELECT COUNT(*) c FROM courses');
    return parseInt(r.rows[0].c);
  },
  async totalViews() {
    const r = await db.query('SELECT COALESCE(SUM(view_count),0) v FROM courses');
    return parseInt(r.rows[0].v);
  },
  async fullTree(course_id) {
    return require('./ContentTree').fullTree('course', course_id);
  }
};
module.exports = Course;
