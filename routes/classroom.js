const express=require('express');
const router=express.Router();
const c=require('../controllers/classroomController');
const materialProxy=require('../controllers/classroomMaterialProxyController');
const {requireAnyLogin,requireRole}=require('../middleware/auth');
const db=require('../config/db');

router.get('/phong-hoc',requireAnyLogin,c.list);
router.get('/phong-hoc/:code',c.room);
router.post('/phong-hoc/:code/vao',c.joinByCode);
router.get('/phong-hoc/:code/pdf',c.pdf);
router.get('/phong-hoc/:code/material-pdf',requireAnyLogin,materialProxy.pdf);

router.get('/admin/phong-hoc',requireRole('teacher'),c.adminList);
router.post('/admin/phong-hoc',requireRole('teacher'),c.create);
router.get('/admin/phong-hoc/:id',requireRole('teacher'),c.adminRoom);
router.post('/admin/phong-hoc/:id/hoc-vien',requireRole('teacher'),c.addStudents);
router.post('/admin/phong-hoc/:id/hoc-vien/:studentId',requireRole('teacher'),c.updateStudent);
router.post('/admin/phong-hoc/:id/hoc-vien/:studentId/xoa',requireRole('teacher'),c.deleteStudent);
router.post('/admin/phong-hoc/:id/cau-hinh',requireRole('teacher'),c.settings);
router.post('/admin/phong-hoc/:id/dong',requireRole('teacher'),c.close);
router.post('/admin/phong-hoc/tai-lieu',requireRole('teacher'),c.addMaterial);

router.post('/admin/phong-hoc/:id/xoa',requireRole('teacher'),async(req,res,next)=>{
  const client=await db.getClient();
  try{
    await client.query('BEGIN');
    const roomId=Number(req.params.id);
    if(!Number.isInteger(roomId)||roomId<=0)throw new Error('ID phòng học không hợp lệ');
    await client.query('DELETE FROM classroom_materials WHERE classroom_id=$1',[roomId]);
    await client.query('DELETE FROM classroom_students WHERE classroom_id=$1',[roomId]);
    await client.query('DELETE FROM classroom_settings WHERE classroom_id=$1',[roomId]);
    const deleted=await client.query('DELETE FROM classrooms WHERE id=$1 RETURNING id',[roomId]);
    if(!deleted.rows.length){await client.query('ROLLBACK');return res.status(404).send('Phòng học không tồn tại.');}
    await client.query('COMMIT');
    if(req.session.classroomMembers)delete req.session.classroomMembers[roomId];
    res.redirect('/admin/phong-hoc');
  }catch(e){await client.query('ROLLBACK');next(e)}finally{client.release()}
});
module.exports=router;
