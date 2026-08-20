const bcrypt = require('bcryptjs');
const QRCode = require('qrcode');
const path = require('path');
const User = require('../models/User');
const Course = require('../models/Course');
const Enrollment = require('../models/Enrollment');
const LessonProgress = require('../models/LessonProgress');
const LessonVideo = require('../models/LessonVideo');
const Lesson = require('../models/Lesson');
const ActivationCode = require('../models/ActivationCode');
const LoginLog = require('../models/LoginLog');
const Certificate = require('../models/Certificate');
const { genCertCode } = require('../utils');

// Trang "Tài khoản của tôi": khoá học đã ghi danh + tiến độ
exports.dashboard = async (req, res) => {
  const enrollments = await Enrollment.byUser(req.session.user.id);
  const logs = await LessonProgress.recentLog(req.session.user.id, 10);
  const loginHistory = await LoginLog.byUser(req.session.user.id, 5);
  res.render('student/dashboard', { enrollments, logs, loginHistory });
};

exports.showChangePassword = (req, res) => res.render('student/change-password', { error: null, success: null });

exports.changePassword = async (req, res) => {
  const { current_password, new_password, confirm_password } = req.body;
  const user = await User.findById(req.session.user.id);
  if (!bcrypt.compareSync(current_password, user.password_hash)) {
    return res.render('student/change-password', { error: 'Mật khẩu hiện tại không đúng.', success: null });
  }
  if (new_password !== confirm_password || new_password.length < 6) {
    return res.render('student/change-password', { error: 'Mật khẩu mới không khớp hoặc quá ngắn (tối thiểu 6 ký tự).', success: null });
  }
  await User.updatePassword(user.id, bcrypt.hashSync(new_password, 10));
  res.render('student/change-password', { error: null, success: 'Đổi mật khẩu thành công!' });
};

exports.updateAvatar = async (req, res) => {
  if (req.file) {
    const avatar_url = '/uploads/avatars/' + req.file.filename;
    await User.updateProfile(req.session.user.id, { name: req.session.user.name, phone: req.body.phone || null, avatar_url });
    req.session.user.avatar_url = avatar_url;
  }
  res.redirect('/tai-khoan');
};

// Nhap ma kich hoat de mo khoa hoc
exports.redeemForm = (req, res) => res.render('student/redeem', { error: null, success: null });

exports.redeem = async (req, res) => {
  const code = (req.body.code || '').trim().toUpperCase();
  const activation = await ActivationCode.findByCode(code);
  if (!activation) return res.render('student/redeem', { error: 'Mã kích hoạt không tồn tại.', success: null });
  if (!activation.is_active) return res.render('student/redeem', { error: 'Mã kích hoạt này đã bị vô hiệu hóa.', success: null });
  if (activation.is_used) return res.render('student/redeem', { error: 'Mã kích hoạt này đã được sử dụng.', success: null });
  if (activation.expires_at && new Date(activation.expires_at) < new Date()) {
    return res.render('student/redeem', { error: 'Mã kích hoạt này đã hết hạn sử dụng.', success: null });
  }
  await ActivationCode.markUsed(activation.id, req.session.user.id);
  await Enrollment.create(req.session.user.id, activation.course_id);
  const course = await Course.findById(activation.course_id);
  res.render('student/redeem', { error: null, success: `Kích hoạt thành công! Bạn đã có thể học khóa "${course.title}".` });
};

// Xem bai hoc: kiem tra da ghi danh (mua/kich hoat) hoac la bai preview mien phi
exports.watchLesson = async (req, res) => {
  const lesson = await Lesson.findById(req.params.id);
  if (!lesson) return res.status(404).render('404');
  const course = await Course.findById(lesson.course_id);
  const user = req.session.user;

  const enrolled = user ? await Enrollment.isEnrolled(user.id, course.id) : false;
  if (!lesson.is_preview && !enrolled) {
    return res.render('watch', { locked: true, course, lesson: null, videos: [], files: [] });
  }

  const videos = await LessonVideo.byLesson(lesson.id);
  const LessonFile = require('../models/LessonFile');
  const files = await LessonFile.byLesson(lesson.id);
  const fullTree = await Course.fullTree(course.id);
  const Quiz = require('../models/Quiz');
  const quiz = await Quiz.findByLesson(lesson.id);

  if (user && enrolled) {
    await LessonProgress.markCompleted(user.id, lesson.id);
    const percent = await LessonProgress.recalculate(user.id, course.id);
    if (percent === 100) {
      const existing = await Certificate.find(user.id, course.id);
      if (!existing) await Certificate.create({ user_id: user.id, course_id: course.id, certificate_code: genCertCode(), file_url: null });
    }
  }

  res.render('watch', { locked: false, course, lesson, videos, files, fullTree, quiz });
};

// Tu sach da mua
exports.myBooks = async (req, res) => {
  const BookPurchase = require('../models/BookPurchase');
  const books = await BookPurchase.byUser(req.session.user.id);
  res.render('student/my-books', { books });
};

// Sach doc online da mua
exports.myOnlineBooks = async (req, res) => {
  const OnlineBookPurchase = require('../models/OnlineBookPurchase');
  const books = await OnlineBookPurchase.byUser(req.session.user.id);
  res.render('student/my-online-books', { books });
};

// Chung chi: xem + xac thuc qua QR
exports.myCertificates = async (req, res) => {
  const certs = await Certificate.byUser(req.session.user.id);
  res.render('student/certificates', { certs });
};

exports.verifyCertificate = async (req, res) => {
  const cert = await Certificate.findByCode(req.params.code);
  res.render('certificate-verify', { cert });
};

exports.certificateQR = async (req, res) => {
  const url = `${req.protocol}://${req.get('host')}/chung-chi/xac-thuc/${req.params.code}`;
  res.setHeader('Content-Type', 'image/png');
  QRCode.toFileStream(res, url, { width: 300 });
};

exports.watchBookLesson = async (req,res) => {
  const lesson = await Lesson.findById(req.params.id);
  if (!lesson || !lesson.book_id) return res.status(404).render('404');
  const Book = require('../models/Book'); const BookPurchase=require('../models/BookPurchase');
  const book=await Book.findById(lesson.book_id); const purchased=await BookPurchase.isPurchased(req.session.user.id,book.id);
  if(!purchased && !lesson.is_preview) return res.render('watch-book',{locked:true,book,lesson:null,videos:[],files:[],fullTree:[]});
  const videos=await LessonVideo.byLesson(lesson.id); const LessonFile=require('../models/LessonFile'); const files=await LessonFile.byLesson(lesson.id); const fullTree=await require('../models/ContentTree').fullTree('book',book.id);
  res.render('watch-book',{locked:false,book,lesson,videos,files,fullTree});
};
