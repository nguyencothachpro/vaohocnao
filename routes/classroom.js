const express=require('express');
const router=express.Router();
const c=require('../controllers/classroomController');
const {requireLogin,requireAnyLogin,requireRole}=require('../middleware/auth');

// Học sinh và Admin/Giáo viên đều có thể vào phòng; danh sách phòng vẫn yêu cầu đăng nhập.
router.get('/phong-hoc',requireAnyLogin,c.list);
router.get('/phong-hoc/:code',requireAnyLogin,c.room);
router.get('/phong-hoc/:code/pdf',requireAnyLogin,c.pdf);

// Khu quản trị phòng học. Dùng requireRole để thống nhất với Admin và đảm bảo adminUser được truyền vào EJS.
router.get('/admin/phong-hoc',requireRole('teacher'),c.adminList);
router.post('/admin/phong-hoc',requireRole('teacher'),c.create);
router.post('/admin/phong-hoc/:id/dong',requireRole('teacher'),c.close);
router.post('/admin/phong-hoc/tai-lieu',requireRole('teacher'),c.addMaterial);
module.exports=router;
