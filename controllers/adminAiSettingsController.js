const Settings = require('../models/Settings');

exports.form = async (req, res) => {
  const config = await Settings.getAll();
  res.render('admin/settings/ai', { config, success: null });
};

exports.save = async (req, res) => {
  const { ai_api_key, ai_model } = req.body;
  await Settings.setMany({ ai_api_key, ai_model: ai_model || 'claude-sonnet-5' });
  const config = await Settings.getAll();
  res.render('admin/settings/ai', { config, success: 'Đã lưu cài đặt AI!' });
};
