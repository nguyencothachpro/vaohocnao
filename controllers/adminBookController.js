const Book = require('../models/Book');
const BookType = require('../models/BookType');
const BookCategory = require('../models/BookCategory');
const { makeSlug } = require('../utils');

exports.list = async (req, res) => {
  const books = await Book.all();
  res.render('admin/books/list', { books });
};

exports.newForm = async (req, res) => {
  const categories = await BookCategory.tree();
  const bookTypes = await BookType.all();
  res.render('admin/books/form', { book: null, categories, bookTypes });
};

exports.create = async (req, res) => {
  const { title, author, short_desc, description, price, compare_at_price, file_url, preview_url, category_id, book_type_id, is_published, cover_url_link } = req.body;
  const cover_url = req.file ? '/uploads/thumbnails/' + req.file.filename : (cover_url_link || null);
  await Book.create({
    title, author, short_desc, description, price, compare_at_price: compare_at_price || null,
    file_url, preview_url, category_id: category_id || null, book_type_id: book_type_id || null,
    cover_url, is_published: is_published === 'on', slug: makeSlug(title)
  });
  res.redirect('/admin/sach');
};

exports.editForm = async (req, res) => {
  const book = await Book.findById(req.params.id);
  if (!book) return res.redirect('/admin/sach');
  const categories = await BookCategory.tree();
  const bookTypes = await BookType.all();
  res.render('admin/books/form', { book, categories, bookTypes });
};

exports.update = async (req, res) => {
  const { title, author, short_desc, description, price, compare_at_price, file_url, preview_url, category_id, book_type_id, is_published, cover_url_link } = req.body;
  const cover_url = req.file ? '/uploads/thumbnails/' + req.file.filename : (cover_url_link || null);
  await Book.update(req.params.id, {
    title, author, short_desc, description, price, compare_at_price: compare_at_price || null,
    file_url, preview_url, category_id: category_id || null, book_type_id: book_type_id || null,
    cover_url, is_published: is_published === 'on'
  });
  res.redirect('/admin/sach');
};

exports.delete = async (req, res) => {
  await Book.delete(req.params.id);
  res.redirect('/admin/sach');
};

// ---- Quan ly "Loai sach" (Van hoc, Tham khao, Chu de...) ----
exports.bookTypes = async (req, res) => {
  const bookTypes = await BookType.all();
  res.render('admin/books/types', { bookTypes });
};
exports.bookTypeCreate = async (req, res) => {
  await BookType.create({ name: req.body.name, slug: makeSlug(req.body.name) });
  res.redirect('/admin/sach/loai');
};
exports.bookTypeDelete = async (req, res) => {
  await BookType.delete(req.params.id);
  res.redirect('/admin/sach/loai');
};

// ---- Quan ly "Danh muc sach" - cay rieng, TACH BIET voi Danh muc Khoa hoc ----
exports.categories = async (req, res) => {
  const tree = await BookCategory.tree();
  res.render('admin/books/categories', { tree });
};
exports.categoryNewForm = async (req, res) => {
  const categories = await BookCategory.all();
  res.render('admin/books/category-form', { category: null, categories });
};
exports.categoryCreate = async (req, res) => {
  const { name, parent_id } = req.body;
  await BookCategory.create({ name, parent_id: parent_id || null, slug: makeSlug(name) });
  res.redirect('/admin/sach/danh-muc');
};
exports.categoryEditForm = async (req, res) => {
  const category = await BookCategory.findById(req.params.id);
  const categories = (await BookCategory.all()).filter(c => c.id != req.params.id);
  res.render('admin/books/category-form', { category, categories });
};
exports.categoryUpdate = async (req, res) => {
  const { name, parent_id } = req.body;
  const existing = await BookCategory.findById(req.params.id);
  await BookCategory.update(req.params.id, { name, parent_id: parent_id || null, slug: existing.slug });
  res.redirect('/admin/sach/danh-muc');
};
exports.categoryDelete = async (req, res) => {
  await BookCategory.delete(req.params.id);
  res.redirect('/admin/sach/danh-muc');
};
exports.categoryReorder = async (req, res) => {
  await BookCategory.reorder(req.body.ids);
  res.json({ ok: true });
};
