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
  if (activation.product_type === 'book') {
    const BookPurchase = require('../models/BookPurchase');
    await BookPurchase.grant(req.session.user.id, activation.book_id);
    const Book = require('../models/Book');
    const book = await Book.findById(activation.book_id);
    return res.render('student/redeem', { error:null, success:`Kích hoạt thành công sách "${book.title}".` });
  }
  if (activation.product_type === 'online_book') {
    const OnlineBookPurchase = require('../models/OnlineBookPurchase');
    await OnlineBookPurchase.grant(req.session.user.id, activation.online_book_id);
    const OnlineBook = require('../models/OnlineBook');
    const book = await OnlineBook.findById(activation.online_book_id);
    return res.render('student/redeem', { error:null, success:`Kích hoạt thành công sách đọc online "${book.title}".` });
  }
  await Enrollment.create(req.session.user.id, activation.course_id, activation.expires_at || null);
  const course = await Course.findById(activation.course_id);
  res.render('student/redeem', { error: null, success: `Kích hoạt thành công! Bạn đã có thể học khóa "${course.title}".${activation.expires_at ? ' Hạn học: '+new Date(activation.expires_at).toLocaleDateString('vi-VN') : ''}` });
};

// Xem bai hoc: kiem tra da ghi danh (mua/kich hoat) hoac la bai preview mien phi
exports.watchLesson = async (req, res) => {
  const lesson = await Lesson.findById(req.params.id);
  if (!lesson) return res.status(404).render('404');
  const course = await Course.findById(lesson.course_id);
  const user = req.session.user;

  const enrolled = user ? await Enrollment.isEnrolled(user.id, course.id) : false;
  const videosAll = await LessonVideo.byLesson(lesson.id);
  const LessonFile = require('../models/LessonFile');
  const filesAll = await LessonFile.byLesson(lesson.id);
  if (!lesson.is_preview && !enrolled) {
    const freeVideos = videosAll.filter(v => Number(v.is_free) === 1);
    const freeFiles = filesAll.filter(f => Number(f.is_free) === 1);
    if (!freeVideos.length && !freeFiles.length) {
      return res.render('watch', { locked: true, course, lesson: null, videos: [], files: [] });
    }
  }
  const videos = enrolled || lesson.is_preview ? videosAll : videosAll.filter(v => Number(v.is_free) === 1);
  const files = enrolled || lesson.is_preview ? filesAll : filesAll.filter(f => Number(f.is_free) === 1);
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

exports.bookLesson = async (req,res)=>{
  const L=require('../models/BookLearning'), BookPurchase=require('../models/BookPurchase');
  const lesson=await L.getLesson(req.params.id); if(!lesson)return res.status(404).render('404');
  const purchased=await BookPurchase.isPurchased(req.session.user.id, lesson.book_id);
  const unlocked=purchased||lesson.is_preview||lesson.videos.some(v=>Number(v.is_free)===1)||lesson.files.some(f=>Number(f.is_free)===1);
  if(!unlocked)return res.status(403).send('Bài học này yêu cầu kích hoạt/mua sách.');
  res.render('book-watch',{lesson,purchased});
};

exports.profileForm=async(req,res)=>{const user=await User.findById(req.session.user.id);res.render('student/profile',{user,error:null})};
exports.profileSave=async(req,res)=>{const {name,phone,birth_date}=req.body;if(!name||!phone||!birth_date)return res.render('student/profile',{user:{...await User.findById(req.session.user.id),...req.body},error:'Vui lòng bổ sung họ tên, số điện thoại và ngày sinh.'});await User.updateStudentProfile(req.session.user.id,{name,phone,birth_date});req.session.user.name=name;req.session.user.email=(await User.findById(req.session.user.id)).email;res.redirect('/tai-khoan')};

exports.readLessonFile=async(req,res)=>{
  const LessonFile=require('../models/LessonFile'),Enrollment=require('../models/Enrollment'),Lesson=require('../models/Lesson'),Course=require('../models/Course');
  const f=await LessonFile.findById(req.params.id);if(!f)return res.status(404).render('404');
  const lesson=await Lesson.findById(f.lesson_id),course=await Course.findById(lesson.course_id);
  const enrolled=await Enrollment.isEnrolled(req.session.user.id,course.id);
  if(!f.is_free&&!lesson.is_preview&&!enrolled)return res.status(403).send('Tài liệu này yêu cầu kích hoạt khóa học.');
  res.render('pdf-reader',{title:f.title,fileUrl:'/tai-lieu/'+f.id+'/file'});
};

exports.lessonFileStream=async(req,res)=>{
  const LessonFile=require('../models/LessonFile'),Enrollment=require('../models/Enrollment'),Lesson=require('../models/Lesson'),Course=require('../models/Course'),axios=require('axios');
  const f=await LessonFile.findById(req.params.id);if(!f)return res.status(404).end();
  const lesson=await Lesson.findById(f.lesson_id),course=await Course.findById(lesson.course_id);
  const enrolled=await Enrollment.isEnrolled(req.session.user.id,course.id);
  if(!f.is_free&&!lesson.is_preview&&!enrolled)return res.status(403).end();
  try{if(f.file_url.startsWith('/uploads/'))return res.sendFile(path.join(__dirname,'..','public',f.file_url));let u=f.file_url;const m=u.match(/drive\.google\.com\/file\/d\/([^/]+)/);if(m)u=`https://drive.google.com/uc?export=download&id=${m[1]}`;const up=await axios.get(u,{responseType:'stream',maxRedirects:5,headers:{'User-Agent':'Mozilla/5.0'}});res.setHeader('Content-Type',up.headers['content-type']||'application/pdf');up.data.pipe(res)}catch(e){res.status(502).send('Không tải được tài liệu.')}
};
