const express=require('express');
const router=express.Router();
const c=require('../controllers/classroomController');
const {requireLogin,requireRole}=require('../middleware/auth');

router.get('/phong-hoc',requireLogin,c.list);
router.get('/phong-hoc/:code',requireLogin,c.room);
router.get('/phong-hoc/:code/pdf',requireLogin,c.pdf);
router.get('/admin/phong-hoc',requireRole('teacher'),c.adminList);
router.post('/admin/phong-hoc',requireRole('teacher'),c.create);
router.post('/admin/phong-hoc/:id/dong',requireRole('teacher'),c.close);
router.post('/admin/phong-hoc/tai-lieu',requireRole('teacher'),c.addMaterial);
module.exports=router;
