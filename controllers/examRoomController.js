const Quiz = require('../models/Quiz');
const Category = require('../models/Category');

exports.list = async (req, res) => {
  let category_id = null;
  if (req.query.danh_muc) {
    const cat = await Category.findBySlug(req.query.danh_muc);
    if (cat) category_id = cat.id;
  }
  const categories = await Category.tree();
  const exams = await Quiz.standalonePublished(category_id);
  res.render('exam-room', { exams, categories, activeCategory: req.query.danh_muc || null });
};
