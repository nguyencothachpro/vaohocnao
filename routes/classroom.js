const express=require('express');
const router=express.Router();
const c=require('../controllers/classroomController');
const {requireAnyLogin,requireRole}=require('../middleware/auth');

// Danh sach phong van yeu cau dang nhap. Trang phong co the hien man hinh nhap ma hoc vien.
router.get('/phong-hoc',requireAnyLogin,c.list);
router.get('/phong-hoc/:code',requireAnyLogin,c.room);
router.post('/phong-hoc/:code/vao',requireAnyLogin,c.joinByCode);
router.get('/phong-hoc/:code/pdf',requireAnyLogin,c.pdf);

// Quan ly lop/phong: giao vien, admin, super_admin.
router.get('/admin/phong-hoc',requireRole('teacher'),c.adminList);
router.post('/admin/phong-hoc',requireRole('teacher'),c.create);
router.get('/admin/phong-hoc/:id',requireRole('teacher'),c.adminRoom);
router.post('/admin/phong-hoc/:id/hoc-vien',requireRole('teacher'),c.addStudents);
router.post('/admin/phong-hoc/:id/hoc-vien/:studentId',requireRole('teacher'),c.updateStudent);
router.post('/admin/phong-hoc/:id/hoc-vien/:studentId/xoa',requireRole('teacher'),c.deleteStudent);
router.post('/admin/phong-hoc/:id/cau-hinh',requireRole('teacher'),c.settings);
router.post('/admin/phong-hoc/:id/dong',requireRole('teacher'),c.close);
router.post('/admin/phong-hoc/tai-lieu',requireRole('teacher'),c.addMaterial);
module.exports=router;
