const express = require('express');
const router = express.Router();
const studentController = require('../controllers/studentController');
const checkoutController = require('../controllers/checkoutController');
const certificateController = require('../controllers/certificateController');
const quizController = require('../controllers/quizController');
const cartController = require('../controllers/cartController');
const postController = require('../controllers/postController');
const { requireLogin } = require('../middleware/auth');
const { uploadAvatar } = require('../middleware/upload');

router.get('/tai-khoan', requireLogin, studentController.dashboard);
router.post('/tai-khoan/avatar', requireLogin, uploadAvatar.single('avatar'), studentController.updateAvatar);
router.get('/tai-khoan/doi-mat-khau', requireLogin, studentController.showChangePassword);
router.post('/tai-khoan/doi-mat-khau', requireLogin, studentController.changePassword);
router.get('/tai-khoan/chung-chi', requireLogin, studentController.myCertificates);
router.get('/tai-khoan/tu-sach', requireLogin, studentController.myBooks);
router.get('/tai-khoan/doc-sach-online-da-mua', requireLogin, studentController.myOnlineBooks);

router.get('/kich-hoat', requireLogin, studentController.redeemForm);
router.post('/kich-hoat', requireLogin, studentController.redeem);

router.get('/hoc/:id', studentController.watchLesson);
router.get('/hoc-sach/:id', requireLogin, studentController.watchBookLesson); // co the la bai preview => khong bat buoc dang nhap

router.get('/thi/:id', requireLogin, quizController.take);
router.post('/thi/:id/nop-bai', requireLogin, quizController.submit);
router.get('/thi/:id/xep-hang', requireLogin, quizController.leaderboard);
router.get('/tai-khoan/bai-duoc-giao', requireLogin, quizController.myAssignments);

// ---- Gio hang & thanh toan (khoa hoc + sach mua chung) ----
router.get('/gio-hang', requireLogin, cartController.view);
router.post('/gio-hang/them', requireLogin, cartController.add);
router.post('/gio-hang/xoa', requireLogin, cartController.remove);
router.get('/mua-ngay/khoa-hoc/:slug', requireLogin, cartController.buyCourseNow);
router.get('/mua-ngay/sach/:slug', requireLogin, cartController.buyBookNow);
router.get('/mua-ngay/doc-sach-online/:slug', requireLogin, cartController.buyOnlineBookNow);

router.get('/thanh-toan', requireLogin, checkoutController.checkoutForm);
router.post('/thanh-toan', requireLogin, checkoutController.createOrder);
router.get('/thanh-toan/qr-anh/:orderId', requireLogin, checkoutController.qrImage);
router.get('/thanh-toan/vnpay/tra-ve', checkoutController.vnpayReturn);

// ---- Bang tin cong dong ----
router.get('/cong-dong', requireLogin, postController.feed);
router.post('/cong-dong', requireLogin, postController.create);
router.post('/cong-dong/:id/xoa', requireLogin, postController.deletePost);
router.post('/cong-dong/:id/thich', requireLogin, postController.toggleLike);
router.post('/cong-dong/:id/binh-luan', requireLogin, postController.addComment);

router.get('/chung-chi/tai-xuong/:courseId', requireLogin, certificateController.downloadCertificate);
router.get('/chung-chi/xac-thuc/:code', studentController.verifyCertificate);
router.get('/chung-chi/qr/:code', studentController.certificateQR);

module.exports = router;
