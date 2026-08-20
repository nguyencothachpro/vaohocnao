const Category = require('../models/Category');
const { makeSlug } = require('../utils');

exports.list = async (req, res) => {
  const tree = await Category.tree();
  res.render('admin/categories/list', { tree });
};

exports.newForm = async (req, res) => {
  const categories = await Category.all();
  res.render('admin/categories/form', { category: null, categories });
};

exports.create = async (req, res) => {
  const { name, parent_id, icon } = req.body;
  await Category.create({ name, parent_id: parent_id || null, slug: makeSlug(name), icon });
  res.redirect('/admin/danh-muc');
};

exports.editForm = async (req, res) => {
  const category = await Category.findById(req.params.id);
  const categories = (await Category.all()).filter(c => c.id != req.params.id);
  res.render('admin/categories/form', { category, categories });
};

exports.update = async (req, res) => {
  const { name, parent_id, icon } = req.body;
  const existing = await Category.findById(req.params.id);
  await Category.update(req.params.id, { name, parent_id: parent_id || null, slug: existing.slug, icon });
  res.redirect('/admin/danh-muc');
};

exports.delete = async (req, res) => {
  await Category.delete(req.params.id);
  res.redirect('/admin/danh-muc');
};

exports.reorder = async (req, res) => {
  await Category.reorder(req.body.ids);
  res.json({ ok: true });
};
