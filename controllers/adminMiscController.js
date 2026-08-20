const Order = require('../models/Order');
const ActivationCode = require('../models/ActivationCode');
const Banner = require('../models/Banner');
const News = require('../models/News');
const Course = require('../models/Course');
const NavMenuItem = require('../models/NavMenuItem');
const Popup = require('../models/Popup');
const { genActivationCode, makeSlug } = require('../utils');

// ---- Don hang ----
exports.orders = async (req, res) => {
  const orders = await Order.all();
  res.render('admin/orders', { orders });
};

// ---- Ma kich hoat ----
exports.activationCodes = async (req, res) => {
  const courses = await Course.all();
  const course_id = req.query.course_id || (courses[0] && courses[0].id);
  const codes = course_id ? await ActivationCode.byCourse(course_id) : [];
  res.render('admin/activation-codes', { courses, codes, selectedCourseId: course_id ? Number(course_id) : null });
};

exports.generateActivationCodes = async (req, res) => {
  const { course_id, quantity, expiry_days } = req.body;
  const qty = Math.min(parseInt(quantity) || 1, 200);
  let expires_at = null;
  if (expiry_days && parseInt(expiry_days) > 0) {
    const d = new Date();
    d.setDate(d.getDate() + parseInt(expiry_days));
    expires_at = d.toISOString();
  }
  for (let i = 0; i < qty; i++) {
    await ActivationCode.create(genActivationCode(), course_id, expires_at);
  }
  res.redirect(`/admin/ma-kich-hoat?course_id=${course_id}`);
};

exports.deactivateActivationCode = async (req, res) => {
  await ActivationCode.deactivate(req.params.id);
  res.redirect(req.get('referer') || '/admin/ma-kich-hoat');
};

exports.reactivateActivationCode = async (req, res) => {
  await ActivationCode.reactivate(req.params.id);
  res.redirect(req.get('referer') || '/admin/ma-kich-hoat');
};

exports.deleteActivationCode = async (req, res) => {
  await ActivationCode.delete(req.params.id);
  res.redirect(req.get('referer') || '/admin/ma-kich-hoat');
};

// ---- Banner ----
exports.banners = async (req, res) => {
  const banners = await Banner.all();
  res.render('admin/banners', { banners });
};
exports.createBanner = async (req, res) => {
  const image_url = req.file ? '/uploads/thumbnails/' + req.file.filename : (req.body.image_url_link || null);
  if (image_url) {
    await Banner.create({ image_url, link_url: req.body.link_url, title: req.body.title });
  }
  res.redirect('/admin/banner');
};
exports.toggleBanner = async (req, res) => { await Banner.toggle(req.params.id); res.redirect('/admin/banner'); };
exports.deleteBanner = async (req, res) => { await Banner.delete(req.params.id); res.redirect('/admin/banner'); };

// ---- Tin tuc ----
exports.newsList = async (req, res) => {
  const news = await News.all();
  res.render('admin/news/list', { news });
};
exports.newsNewForm = (req, res) => res.render('admin/news/form', {});
exports.newsCreate = async (req, res) => {
  const { title, content, is_published, thumbnail_url_link } = req.body;
  const thumbnail_url = req.file ? '/uploads/thumbnails/' + req.file.filename : (thumbnail_url_link || null);
  await News.create({
    author_id: req.session.adminUser.id, title, slug: makeSlug(title),
    thumbnail_url, content, is_published: is_published === 'on'
  });
  res.redirect('/admin/tin-tuc');
};
exports.newsDelete = async (req, res) => { await News.delete(req.params.id); res.redirect('/admin/tin-tuc'); };

// ---- Menu dieu huong (tuy chinh cac tab tren thanh nav) ----
exports.navMenu = async (req, res) => {
  const items = await NavMenuItem.all();
  res.render('admin/nav-menu', { items });
};
exports.navMenuCreate = async (req, res) => {
  await NavMenuItem.create({ label: req.body.label, url: req.body.url });
  res.redirect('/admin/menu');
};
exports.navMenuToggle = async (req, res) => { await NavMenuItem.toggle(req.params.id); res.redirect('/admin/menu'); };
exports.navMenuDelete = async (req, res) => { await NavMenuItem.delete(req.params.id); res.redirect('/admin/menu'); };
exports.navMenuReorder = async (req, res) => { await NavMenuItem.reorder(req.body.ids); res.json({ ok: true }); };

// ---- Popup quang cao ----
exports.popups = async (req, res) => {
  const popups = await Popup.all();
  res.render('admin/popups', { popups });
};
exports.popupCreate = async (req, res) => {
  const image_url = req.file ? '/uploads/thumbnails/' + req.file.filename : (req.body.image_url_link || null);
  if (image_url) {
    await Popup.create({ image_url, link_url: req.body.link_url, title: req.body.title });
  }
  res.redirect('/admin/popup');
};
exports.popupToggle = async (req, res) => { await Popup.toggle(req.params.id); res.redirect('/admin/popup'); };
exports.popupDelete = async (req, res) => { await Popup.delete(req.params.id); res.redirect('/admin/popup'); };
