const express = require('express');
const router = express.Router();

const authController = require('../controllers/authController');
const dashboardController = require('../controllers/adminDashboardController');
const categoryController = require('../controllers/adminCategoryController');
const courseController = require('../controllers/adminCourseController');
const contentController = require('../controllers/adminContentController');
const bookLearningController = require('../controllers/adminBookLearningController');
const userController = require('../controllers/adminUserController');
const dataController = require('../controllers/adminDataController');
const { uploadBackup } = require('../middleware/upload');
const miscController = require('../controllers/adminMiscController');
const checkoutController = require('../controllers/checkoutController');
const siteSettingsController = require('../controllers/adminSiteSettingsController');
const adminQuizController = require('../controllers/adminQuizController');
const adminExamImportController = require('../controllers/adminExamImportController');
const adminAiSettingsController = require('../controllers/adminAiSettingsController');
const adminBookController = require('../controllers/adminBookController');
const adminOnlineBookController = require('../controllers/adminOnlineBookController');

const { requireAdminLogin, requireRole } = require('../middleware/auth');
const { uploadThumbnail, uploadVideo, uploadFile, uploadExamDoc, uploadOnlineBookForm } = require('../middleware/upload');

// ---- Dang nhap rieng cho quan tri / giang vien / tro giang ----
router.get('/dang-nhap', authController.showAdminLogin);
router.post('/dang-nhap', authController.adminLogin);
router.get('/dang-xuat', authController.adminLogout);

router.use(requireAdminLogin); // tu day tro xuong bat buoc phai dang nhap

// ---- Dashboard ----
router.get('/', dashboardController.dashboard);

// ---- 7. Doi mat khau (khong can vao database) ----
router.get('/doi-mat-khau', userController.showChangePassword);
router.post('/doi-mat-khau', userController.changePassword);

// ---- 1. Danh muc ----
router.get('/danh-muc', categoryController.list);
router.get('/danh-muc/them-moi', requireRole('admin'), categoryController.newForm);
router.post('/danh-muc', requireRole('admin'), categoryController.create);
router.get('/danh-muc/:id/sua', requireRole('admin'), categoryController.editForm);
router.post('/danh-muc/sap-xep', requireRole('admin'), categoryController.reorder);
router.post('/danh-muc/:id', requireRole('admin'), categoryController.update);
router.post('/danh-muc/:id/xoa', requireRole('admin'), categoryController.delete);

// ---- Khoa hoc ----
router.get('/khoa-hoc', courseController.list);
router.get('/khoa-hoc/them-moi', requireRole('teacher'), courseController.newForm);
router.post('/khoa-hoc', requireRole('teacher'), uploadThumbnail.single('thumbnail'), courseController.create);
router.get('/khoa-hoc/:id/sua', requireRole('teacher'), courseController.editForm);
router.post('/khoa-hoc/:id', requireRole('teacher'), uploadThumbnail.single('thumbnail'), courseController.update);
router.post('/khoa-hoc/:id/xoa', requireRole('admin'), courseController.delete);

// ---- Sach (ban/tai file) - KHONG con chuc nang doc chuong nua, tach rieng sang Doc sach online ----
router.get('/sach/danh-muc', requireRole('admin'), adminBookController.categories);
router.get('/sach/danh-muc/them-moi', requireRole('admin'), adminBookController.categoryNewForm);
router.post('/sach/danh-muc', requireRole('admin'), adminBookController.categoryCreate);
router.get('/sach/danh-muc/:id/sua', requireRole('admin'), adminBookController.categoryEditForm);
router.post('/sach/danh-muc/sap-xep', requireRole('admin'), adminBookController.categoryReorder);
router.post('/sach/danh-muc/:id', requireRole('admin'), adminBookController.categoryUpdate);
router.post('/sach/danh-muc/:id/xoa', requireRole('admin'), adminBookController.categoryDelete);
router.get('/sach/loai', requireRole('admin'), adminBookController.bookTypes);
router.post('/sach/loai', requireRole('admin'), adminBookController.bookTypeCreate);
router.post('/sach/loai/:id/xoa', requireRole('admin'), adminBookController.bookTypeDelete);
router.get('/sach', requireRole('teacher'), adminBookController.list);
router.get('/sach/them-moi', requireRole('teacher'), adminBookController.newForm);
router.post('/sach', requireRole('teacher'), uploadThumbnail.single('cover'), adminBookController.create);
router.get('/sach/:id/sua', requireRole('teacher'), adminBookController.editForm);
router.post('/sach/:id', requireRole('teacher'), uploadThumbnail.single('cover'), adminBookController.update);
router.post('/sach/:id/xoa', requireRole('admin'), adminBookController.delete);
router.get('/sach/:id/noi-dung', requireRole('teacher'), bookLearningController.content);
router.post('/sach/chuong', requireRole('teacher'), bookLearningController.chapterCreate);
router.post('/sach/chuong/sap-xep', requireRole('teacher'), bookLearningController.chapterReorder);
router.post('/sach/chuong/:id/xoa', requireRole('teacher'), bookLearningController.chapterDelete);
router.post('/sach/bai-hoc', requireRole('teacher'), bookLearningController.lessonCreate);
router.post('/sach/bai-hoc/:id/xoa', requireRole('teacher'), bookLearningController.lessonDelete);
router.post('/sach/video', requireRole('teacher'), uploadVideo.single('video_file'), bookLearningController.videoCreate);
router.post('/sach/tai-lieu', requireRole('teacher'), uploadFile.single('file'), bookLearningController.fileCreate);

// ---- Doc sach online (TACH RIENG HOAN TOAN voi Sach) ----
router.get('/doc-sach-online/danh-muc', requireRole('admin'), adminOnlineBookController.categories);
router.get('/doc-sach-online/danh-muc/them-moi', requireRole('admin'), adminOnlineBookController.categoryNewForm);
router.post('/doc-sach-online/danh-muc', requireRole('admin'), adminOnlineBookController.categoryCreate);
router.get('/doc-sach-online/danh-muc/:id/sua', requireRole('admin'), adminOnlineBookController.categoryEditForm);
router.post('/doc-sach-online/danh-muc/sap-xep', requireRole('admin'), adminOnlineBookController.categoryReorder);
router.post('/doc-sach-online/danh-muc/:id', requireRole('admin'), adminOnlineBookController.categoryUpdate);
router.post('/doc-sach-online/danh-muc/:id/xoa', requireRole('admin'), adminOnlineBookController.categoryDelete);

router.get('/doc-sach-online', requireRole('teacher'), adminOnlineBookController.list);
router.get('/doc-sach-online/them-moi', requireRole('teacher'), adminOnlineBookController.newForm);
router.post('/doc-sach-online', requireRole('teacher'), (req, res, next) => {
  uploadOnlineBookForm(req, res, (err) => {
    if (err) {
      console.error('Loi upload sach doc online:', err);
      return res.status(400).send(
        `<pre style="white-space:pre-wrap;font-family:monospace;padding:20px;color:#b5433a">Lỗi khi tải file lên: ${err.message}</pre>`
      );
    }
    next();
  });
}, adminOnlineBookController.create);
router.get('/doc-sach-online/:id/sua', requireRole('teacher'), adminOnlineBookController.editForm);
router.post('/doc-sach-online/:id', requireRole('teacher'), (req, res, next) => {
  uploadOnlineBookForm(req, res, (err) => {
    if (err) {
      console.error('Loi upload sach doc online:', err);
      return res.status(400).send(
        `<pre style="white-space:pre-wrap;font-family:monospace;padding:20px;color:#b5433a">Lỗi khi tải file lên: ${err.message}</pre>`
      );
    }
    next();
  });
}, adminOnlineBookController.update);
router.post('/doc-sach-online/:id/xoa', requireRole('admin'), adminOnlineBookController.delete);

router.get('/doc-sach-online/:id/chuong', requireRole('teacher'), adminOnlineBookController.chapters);
router.get('/doc-sach-online/:id/chuong/nhap-tu-file', requireRole('teacher'), adminOnlineBookController.chapterImportForm);
router.post('/doc-sach-online/:id/chuong/nhap-tu-file', requireRole('teacher'), (req, res, next) => {
  uploadExamDoc.single('exam_file')(req, res, (err) => {
    if (err) {
      console.error('Loi upload file sach doc online:', err);
      return res.status(400).send(
        `<pre style="white-space:pre-wrap;font-family:monospace;padding:20px;color:#b5433a">Lỗi khi tải file lên: ${err.message}</pre>`
      );
    }
    next();
  });
}, adminOnlineBookController.chapterImport);
router.post('/doc-sach-online-chuong/nhap-tu-file/luu', requireRole('teacher'), adminOnlineBookController.chapterImportSave);
router.post('/doc-sach-online-chuong', requireRole('teacher'), adminOnlineBookController.chapterCreate);
router.get('/doc-sach-online-chuong/:id/sua', requireRole('teacher'), adminOnlineBookController.chapterEditForm);
router.post('/doc-sach-online-chuong/sap-xep', requireRole('teacher'), adminOnlineBookController.chapterReorder);
router.post('/doc-sach-online-chuong/:id', requireRole('teacher'), adminOnlineBookController.chapterUpdate);
router.post('/doc-sach-online-chuong/:id/xoa', requireRole('teacher'), adminOnlineBookController.chapterDelete);

router.get('/doc-sach-online/:id/muc-luc', requireRole('teacher'), adminOnlineBookController.tocPage);
router.post('/doc-sach-online-muc-luc', requireRole('teacher'), adminOnlineBookController.tocCreate);
router.get('/doc-sach-online-muc-luc/:id/sua', requireRole('teacher'), adminOnlineBookController.tocEntryEditForm);
router.post('/doc-sach-online-muc-luc/:id', requireRole('teacher'), adminOnlineBookController.tocUpdate);
router.post('/doc-sach-online-muc-luc/:id/xoa', requireRole('teacher'), adminOnlineBookController.tocDelete);

// ---- Noi dung khoa hoc: Chuong > Bai > Video/File ----
router.get('/khoa-hoc/:id/noi-dung', courseController.contentPage);

router.post('/chuong', requireRole('teacher'), contentController.createChapter);
router.post('/chuong/sap-xep', requireRole('teacher'), contentController.reorderChapters);
router.post('/chuong/:id', requireRole('teacher'), contentController.updateChapter);
router.post('/chuong/:id/xoa', requireRole('teacher'), contentController.deleteChapter);

router.post('/bai-hoc', requireRole('teacher'), contentController.createLesson);
router.post('/bai-hoc/sap-xep', requireRole('teacher'), contentController.reorderLessons);
router.post('/bai-hoc/:id', requireRole('teacher'), contentController.updateLesson);
router.post('/bai-hoc/:id/xoa', requireRole('teacher'), contentController.deleteLesson);

router.post('/video', requireRole('teacher'), uploadVideo.single('video_file'), contentController.createVideo);
router.post('/video/:id/xoa', requireRole('teacher'), contentController.deleteVideo);
router.post('/video/sap-xep', requireRole('teacher'), contentController.reorderVideos);

router.post('/tai-lieu', requireRole('teacher'), uploadFile.single('file'), contentController.createFile);
router.post('/tai-lieu/:id/xoa', requireRole('teacher'), contentController.deleteFile);

// ---- Bai kiem tra (quiz) ----
router.get('/bai-hoc/:lessonId/bai-kiem-tra', requireRole('teacher'), adminQuizController.manage);
router.post('/bai-kiem-tra', requireRole('teacher'), adminQuizController.create);
router.post('/bai-kiem-tra/:id/xoa', requireRole('teacher'), adminQuizController.delete);
router.post('/bai-kiem-tra/cau-hoi', requireRole('teacher'), adminQuizController.addQuestion);
router.post('/cau-hoi/:id/xoa', requireRole('teacher'), adminQuizController.deleteQuestion);
router.get('/bai-kiem-tra/:quizId/ket-qua', requireRole('ta'), adminQuizController.results);
router.post('/bai-kiem-tra/cham-tay', requireRole('teacher'), adminQuizController.gradeManual);

// ---- Thuc chien phong thi (de thi doc lap, khong gan voi khoa hoc nao) ----
router.get('/phong-thi', requireRole('teacher'), adminQuizController.examRoomList);
router.get('/phong-thi/them-moi', requireRole('teacher'), adminQuizController.examRoomNewForm);
router.post('/phong-thi', requireRole('teacher'), adminQuizController.examRoomCreate);
router.get('/bai-kiem-tra/:quizId/cau-hoi', requireRole('teacher'), adminQuizController.manageStandalone);
router.get('/bai-kiem-tra/:quizId/giao-de', requireRole('teacher'), adminQuizController.assignForm);
router.post('/bai-kiem-tra/:quizId/giao-de', requireRole('teacher'), adminQuizController.assignSubmit);
router.post('/bai-kiem-tra/:quizId/giao-de/:userId/huy', requireRole('teacher'), adminQuizController.unassign);

// ---- Upload de thi tu file Word/PDF hoac link Google Drive (tu dong nhan dien + xem truoc de sua) ----
router.get('/bai-kiem-tra/:quizId/tai-de', requireRole('teacher'), adminExamImportController.uploadForm);
router.post('/bai-kiem-tra/:quizId/tai-de', requireRole('teacher'), (req, res, next) => {
  uploadExamDoc.single('exam_file')(req, res, (err) => {
    if (err) {
      console.error('Loi upload file de thi:', err);
      return res.status(400).send(
        `<pre style="white-space:pre-wrap;font-family:monospace;padding:20px;color:#b5433a">Lỗi khi tải file lên: ${err.message}</pre>`
      );
    }
    next();
  });
}, adminExamImportController.upload);
router.post('/bai-kiem-tra/luu-de-import', requireRole('teacher'), adminExamImportController.save);

// ---- 4. Hoc vien ----
router.get('/hoc-vien', requireRole('ta'), userController.students);
router.get('/hoc-vien/:id', requireRole('ta'), userController.studentDetail);
router.post('/hoc-vien/:id/gia-han', requireRole('admin'), userController.extendEnrollment);
router.post('/hoc-vien/:id/khoa-mo', requireRole('admin'), userController.toggleStudentActive);

// ---- Nhan su & phan quyen (6) ----
router.get('/nhan-su', requireRole('admin'), userController.staffList);
router.get('/nhan-su/them-moi', requireRole('admin'), userController.staffNewForm);
router.post('/nhan-su', requireRole('admin'), userController.staffCreate);
router.post('/nhan-su/:id/vai-tro', requireRole('super_admin'), userController.staffChangeRole);

// ---- 5. Don hang & Thanh toan ----
router.get('/don-hang', requireRole('ta'), miscController.orders);
router.post('/don-hang/:order_id/xac-nhan', requireRole('admin'), checkoutController.adminConfirmPaid);

// ---- Ma kich hoat ----
router.get('/ma-kich-hoat', requireRole('ta'), miscController.activationCodes);
router.post('/ma-kich-hoat', requireRole('teacher'), miscController.generateActivationCodes);
router.post('/ma-kich-hoat/:id/xoa', requireRole('teacher'), miscController.deleteActivationCode);
router.post('/ma-kich-hoat/:id/vo-hieu-hoa', requireRole('teacher'), miscController.deactivateActivationCode);
router.post('/ma-kich-hoat/:id/kich-hoat-lai', requireRole('teacher'), miscController.reactivateActivationCode);

// ---- Banner ----
router.get('/banner', requireRole('admin'), miscController.banners);
router.post('/banner', requireRole('admin'), uploadThumbnail.single('image'), miscController.createBanner);
router.post('/banner/:id/bat-tat', requireRole('admin'), miscController.toggleBanner);
router.post('/banner/:id/xoa', requireRole('admin'), miscController.deleteBanner);

// ---- Cai dat chung (chu tren website) ----
router.get('/cai-dat/chung', requireRole('admin'), siteSettingsController.form);
router.post('/cai-dat/chung', requireRole('admin'), siteSettingsController.save);

// ---- Cai dat AI (nhap de thi tu file) ----
router.get('/cai-dat/ai', requireRole('admin'), adminAiSettingsController.form);
router.post('/cai-dat/ai', requireRole('admin'), adminAiSettingsController.save);

// ---- Cai dat thanh toan ----
router.get('/cai-dat/thanh-toan', requireRole('admin'), checkoutController.settingsForm);
router.post('/cai-dat/thanh-toan', requireRole('admin'), checkoutController.settingsSave);

// ---- Tin tuc ----
router.get('/tin-tuc', requireRole('admin'), miscController.newsList);
router.get('/tin-tuc/them-moi', requireRole('admin'), miscController.newsNewForm);
router.post('/tin-tuc', requireRole('admin'), uploadThumbnail.single('thumbnail'), miscController.newsCreate);
router.post('/tin-tuc/:id/xoa', requireRole('admin'), miscController.newsDelete);

// ---- Menu dieu huong ----
router.get('/menu', requireRole('admin'), miscController.navMenu);
router.post('/menu', requireRole('admin'), miscController.navMenuCreate);
router.post('/menu/:id/bat-tat', requireRole('admin'), miscController.navMenuToggle);
router.post('/menu/:id/xoa', requireRole('admin'), miscController.navMenuDelete);
router.post('/menu/sap-xep', requireRole('admin'), miscController.navMenuReorder);

// ---- Popup quang cao ----
router.get('/popup', requireRole('admin'), miscController.popups);
router.post('/popup', requireRole('admin'), uploadThumbnail.single('image'), miscController.popupCreate);
router.post('/popup/:id/bat-tat', requireRole('admin'), miscController.popupToggle);
router.post('/popup/:id/xoa', requireRole('admin'), miscController.popupDelete);

module.exports = router;
