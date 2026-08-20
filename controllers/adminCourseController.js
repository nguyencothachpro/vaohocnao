const Course = require('../models/Course');
const Category = require('../models/Category');
const User = require('../models/User');
const { makeSlug } = require('../utils');

exports.list = async (req, res) => {
  const courses = await Course.all();
  res.render('admin/courses/list', { courses });
};

exports.newForm = async (req, res) => {
  const categories = await Category.all();
  const teachers = await User.listStaff();
  res.render('admin/courses/form', { course: null, categories, teachers });
};

exports.create = async (req, res) => {
  const { title, category_id, teacher_id, short_desc, description, price, compare_at_price, intro_video_url, is_published, thumbnail_url_link } = req.body;
  // Uu tien file upload neu co, khong thi dung link anh da dan vao
  const thumbnail_url = req.file ? '/uploads/thumbnails/' + req.file.filename : (thumbnail_url_link || null);
  const course = await Course.create({
    title, category_id, teacher_id, short_desc, description, price, compare_at_price: compare_at_price || null, intro_video_url, thumbnail_url,
    is_published: is_published === 'on', slug: makeSlug(title)
  });
  res.redirect(`/admin/khoa-hoc/${course.id}/noi-dung`);
};

exports.editForm = async (req, res) => {
  const course = await Course.findById(req.params.id);
  if (!course) return res.redirect('/admin/khoa-hoc');
  const categories = await Category.all();
  const teachers = await User.listStaff();
  res.render('admin/courses/form', { course, categories, teachers });
};

exports.update = async (req, res) => {
  const existing = await Course.findById(req.params.id);
  const { title, category_id, teacher_id, short_desc, description, price, compare_at_price, intro_video_url, is_published, thumbnail_url_link } = req.body;
  // Uu tien file upload neu co, sau do link anh da dan, khong thi giu anh cu
  const thumbnail_url = req.file ? '/uploads/thumbnails/' + req.file.filename : (thumbnail_url_link || null);
  await Course.update(req.params.id, {
    title, category_id, teacher_id, short_desc, description, price, compare_at_price: compare_at_price || null, intro_video_url, thumbnail_url,
    is_published: is_published === 'on', slug: existing.slug
  });
  res.redirect('/admin/khoa-hoc');
};

exports.delete = async (req, res) => {
  await Course.delete(req.params.id);
  res.redirect('/admin/khoa-hoc');
};

// Trang quan ly noi dung: Chuong > Bai > Video/File (keo tha sap xep ngay tren trang nay)
exports.contentPage = async (req, res) => {
  const course = await Course.findById(req.params.id);
  if (!course) return res.redirect('/admin/khoa-hoc');
  const chapters = await Course.fullTree(course.id);
  res.render('admin/courses/content', { course, chapters });
};
