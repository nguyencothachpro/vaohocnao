const User = require('../models/User');
const Course = require('../models/Course');
const Category = require('../models/Category');
const Lesson = require('../models/Lesson');
const LessonVideo = require('../models/LessonVideo');
const Order = require('../models/Order');
const db = require('../config/db');

exports.dashboard = async (req, res) => {
  const [studentCount, courseCount, lessonCount, videoCount, videoViews, revenue] = await Promise.all([
    User.count(),
    Course.count(),
    Lesson.countAll(),
    LessonVideo.countAll(),
    LessonVideo.totalViews(),
    Order.totalRevenue()
  ]);

  // Doanh thu 6 thang gan nhat, dung cho bieu do Chart.js
  const revenueByMonth = await db.query(`
    SELECT to_char(date_trunc('month', paid_at), 'MM/YYYY') AS month, COALESCE(SUM(amount),0) AS total
    FROM orders WHERE status='paid' AND paid_at >= now() - interval '6 months'
    GROUP BY date_trunc('month', paid_at) ORDER BY date_trunc('month', paid_at)`);

  const recentOrders = (await Order.all()).slice(0, 8);

  res.render('admin/dashboard', {
    stats: { studentCount, courseCount, lessonCount, videoCount, videoViews, revenue },
    revenueByMonth: revenueByMonth.rows,
    recentOrders
  });
};
