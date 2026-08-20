const Settings = require('../models/Settings');

exports.form = async (req, res) => {
  const config = await Settings.getAll();
  res.render('admin/settings/general', { config, success: null });
};

exports.save = async (req, res) => {
  const { site_name_1, site_name_2, hero_title, hero_subtitle, footer_text, custom_domain, custom_domain_path } = req.body;
  await Settings.setMany({ site_name_1, site_name_2, hero_title, hero_subtitle, footer_text, custom_domain, custom_domain_path: custom_domain_path || '/truyen' });
  const config = await Settings.getAll();
  res.render('admin/settings/general', { config, success: 'Đã lưu cài đặt!' });
};
