const bcrypt = require('bcryptjs');
const User = require('../models/User');
const Enrollment = require('../models/Enrollment');

// ---- Hoc vien ----
exports.students = async (req, res) => {
  const students = await User.listStudents();
  res.render('admin/students', { students });
};

exports.studentDetail = async (req, res) => {
  const student = await User.findById(req.params.id);
  const enrollments = await Enrollment.byUser(req.params.id);
  const BookPurchase = require('../models/BookPurchase');
  const books = await BookPurchase.byUser(req.params.id);
  res.render('admin/student-detail', { student, enrollments, books });
};

exports.toggleStudentActive = async (req, res) => {
  const student = await User.findById(req.params.id);
  await User.setActive(req.params.id, student.is_active ? 0 : 1);
  res.redirect('/admin/hoc-vien');
};

// ---- Nhan su noi bo: Admin / Giang vien / Tro giang (phan quyen) ----
exports.staffList = async (req, res) => {
  const staff = await User.listStaff();
  res.render('admin/staff/list', { staff });
};

exports.staffNewForm = (req, res) => res.render('admin/staff/form', { error: null });

exports.staffCreate = async (req, res) => {
  const { name, email, password, role } = req.body;
  const existing = await User.findByEmail(email);
  if (existing) return res.render('admin/staff/form', { error: 'Email đã tồn tại.' });
  const hash = bcrypt.hashSync(password, 10);
  await User.create({ name, email, password_hash: hash, role });
  res.redirect('/admin/nhan-su');
};

exports.staffChangeRole = async (req, res) => {
  await User.setRole(req.params.id, req.body.role);
  res.redirect('/admin/nhan-su');
};

// ---- Doi mat khau cua chinh admin dang dang nhap ----
exports.showChangePassword = (req, res) => res.render('admin/change-password', { error: null, success: null });

exports.changePassword = async (req, res) => {
  const { current_password, new_password, confirm_password } = req.body;
  const user = await User.findById(req.session.adminUser.id);
  if (!bcrypt.compareSync(current_password, user.password_hash)) {
    return res.render('admin/change-password', { error: 'Mật khẩu hiện tại không đúng.', success: null });
  }
  if (new_password !== confirm_password || new_password.length < 6) {
    return res.render('admin/change-password', { error: 'Mật khẩu mới không hợp lệ (tối thiểu 6 ký tự).', success: null });
  }
  await User.updatePassword(user.id, bcrypt.hashSync(new_password, 10));
  res.render('admin/change-password', { error: null, success: 'Đổi mật khẩu thành công!' });
};
