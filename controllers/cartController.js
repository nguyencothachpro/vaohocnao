const Cart = require('../models/Cart');
const Course = require('../models/Course');
const Book = require('../models/Book');
const OnlineBook = require('../models/OnlineBook');
const Enrollment = require('../models/Enrollment');
const BookPurchase = require('../models/BookPurchase');
const OnlineBookPurchase = require('../models/OnlineBookPurchase');

exports.view = async (req, res) => {
  const items = await Cart.listWithDetails(req.session.user.id);
  const total = items.reduce((sum, i) => sum + Number(i.price), 0);
  res.render('cart', { items, total });
};

// Them 1 san pham (khoa hoc hoac sach) vao gio hang
exports.add = async (req, res) => {
  const { item_type, item_id } = req.body;
  if (item_type === 'course') {
    const already = await Enrollment.isEnrolled(req.session.user.id, item_id);
    if (already) return res.redirect(req.get('referer') || '/gio-hang');
  }
  if (item_type === 'book') {
    const already = await BookPurchase.isPurchased(req.session.user.id, item_id);
    if (already) return res.redirect(req.get('referer') || '/gio-hang');
  }
  if (item_type === 'online_book') {
    const already = await OnlineBookPurchase.isPurchased(req.session.user.id, item_id);
    if (already) return res.redirect(req.get('referer') || '/gio-hang');
  }
  await Cart.add(req.session.user.id, item_type, item_id);
  res.redirect('/gio-hang');
};

exports.remove = async (req, res) => {
  const { item_type, item_id } = req.body;
  await Cart.remove(req.session.user.id, item_type, item_id);
  res.redirect('/gio-hang');
};

// "Mua ngay" 1 khoa hoc: them vao gio roi chuyen thang qua trang thanh toan
exports.buyCourseNow = async (req, res) => {
  const course = await Course.findBySlug(req.params.slug);
  if (!course) return res.status(404).render('404');
  const already = await Enrollment.isEnrolled(req.session.user.id, course.id);
  if (already) return res.redirect(`/khoa-hoc/${course.slug}`);
  await Cart.add(req.session.user.id, 'course', course.id);
  res.redirect('/thanh-toan');
};

exports.buyBookNow = async (req, res) => {
  const book = await Book.findBySlug(req.params.slug);
  if (!book) return res.status(404).render('404');
  const already = await BookPurchase.isPurchased(req.session.user.id, book.id);
  if (already) return res.redirect(`/sach/${book.slug}`);
  await Cart.add(req.session.user.id, 'book', book.id);
  res.redirect('/thanh-toan');
};

exports.buyOnlineBookNow = async (req, res) => {
  const book = await OnlineBook.findBySlug(req.params.slug);
  if (!book) return res.status(404).render('404');
  const already = await OnlineBookPurchase.isPurchased(req.session.user.id, book.id);
  if (already) return res.redirect(`/doc-sach-online/${book.slug}`);
  await Cart.add(req.session.user.id, 'online_book', book.id);
  res.redirect('/thanh-toan');
};
