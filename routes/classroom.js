const express=require('express');
const router=express.Router();
const c=require('../controllers/classroomController');
const materialProxy=require('../controllers/classroomMaterialProxyController');
const {requireAnyLogin,requireRole}=require('../middleware/auth');
const db=require('../config/db');

router.get('/phong-hoc',requireAnyLogin,c.list);
router.get('/phong-hoc/:code',(req,res,next)=>{res.set('Cache-Control','no-store, no-cache, must-revalidate');next()},c.room);
router.post('/phong-hoc/:code/vao',c.joinByCode);
router.get('/phong-hoc/:code/pdf',c.pdf);
router.get('/phong-hoc/:code/material-pdf',requireAnyLogin,materialProxy.pdf);

router.get('/phong-hoc/:code/permissions',requireAnyLogin,async(req,res,next)=>{
  try{
    const code=String(req.params.code||'').trim();
    const room=(await db.query('SELECT id,room_code,title,teacher_id,status FROM classrooms WHERE room_code=$1',[code])).rows[0];
    if(!room)return res.status(404).json({error:'Phòng học không tồn tại'});
    const user=req.session.adminUser||req.session.user||null;
    const isTeacher=Boolean(user&&(Number(user.id)===Number(room.teacher_id)||['super_admin','admin'].includes(user.role)));
    if(isTeacher){
      const students=(await db.query('SELECT id,student_code,display_name,status,can_write,can_navigate,last_seen FROM classroom_students WHERE classroom_id=$1 ORDER BY id',[room.id])).rows;
      return res.json({roomStatus:room.status,students});
    }
    let memberId=req.session.classroomMembers?.[room.id]||null;
    let member=null;
    if(memberId)member=(await db.query("SELECT id,display_name,status,can_write,can_navigate FROM classroom_students WHERE classroom_id=$1 AND id=$2 AND status='active'",[room.id,memberId])).rows[0]||null;
    if(!member&&user?.id)member=(await db.query("SELECT id,display_name,status,can_write,can_navigate FROM classroom_students WHERE classroom_id=$1 AND user_id=$2 AND status='active' LIMIT 1",[room.id,user.id])).rows[0]||null;
    if(!member)return res.status(403).json({error:'Bạn chưa được cấp quyền vào phòng'});
    req.session.classroomMembers=req.session.classroomMembers||{};req.session.classroomMembers[room.id]=member.id;
    return res.json({roomStatus:room.status,memberId:member.id,canWrite:Boolean(member.can_write),canNavigate:room.status!=='live'||Boolean(member.can_navigate)});
  }catch(e){next(e)}
});

router.post('/phong-hoc/:code/permissions/:studentId',requireAnyLogin,async(req,res,next)=>{
  try{
    const code=String(req.params.code||'').trim();
    const room=(await db.query('SELECT id,teacher_id,status FROM classrooms WHERE room_code=$1',[code])).rows[0];
    const user=req.session.adminUser||req.session.user||null;
    const isTeacher=Boolean(room&&user&&(Number(user.id)===Number(room.teacher_id)||['super_admin','admin'].includes(user.role)));
    if(!isTeacher)return res.status(403).json({error:'Chỉ giáo viên mới được cấp quyền'});
    const id=Number(req.params.studentId);
    const hasWrite=Object.prototype.hasOwnProperty.call(req.body,'canWrite');
    const hasNavigate=Object.prototype.hasOwnProperty.call(req.body,'canNavigate');
    if(!hasWrite&&!hasNavigate)return res.status(400).json({error:'Thiếu quyền cần cập nhật'});
    const write=hasWrite?Boolean(req.body.canWrite):null;
    const nav=hasNavigate?Boolean(req.body.canNavigate):null;
    const updated=(await db.query(`UPDATE classroom_students SET can_write=COALESCE($1,can_write),can_navigate=COALESCE($2,can_navigate) WHERE id=$3 AND classroom_id=$4 RETURNING id,display_name,can_write,can_navigate`,[write,nav,id,room.id])).rows[0];
    if(!updated)return res.status(404).json({error:'Không tìm thấy học viên'});
    const io=req.app.locals.io;
    if(io){for(const [,s] of io.sockets.sockets){if(s.data.roomId===room.id&&Number(s.data.studentId)===id){if(hasWrite){s.data.canWrite=updated.can_write;s.emit('classroom:write-status',{userId:id,allow:updated.can_write})}if(hasNavigate){s.data.canNavigate=updated.can_navigate;s.emit('classroom:navigate-status',{userId:id,allow:updated.can_navigate})}}}}
    return res.json({ok:true,...updated});
  }catch(e){next(e)}
});

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
