const crypto=require('crypto');
const db=require('../config/db');
exports.show=async(req,res)=>{const code=(req.params.code||'').toUpperCase(); const r=await db.query('SELECT * FROM classroom_rooms WHERE room_code=$1',[code]); let room=r.rows[0]; if(!room){room=(await db.query('INSERT INTO classroom_rooms(room_code,title,teacher_id,status) VALUES($1,$2,$3,\'live\') RETURNING *',[code,'Phòng học KingEdu',req.session.user?.id||null])).rows[0];} res.render('classroom',{room,teacher:!!req.session.user});};
exports.create=async(req,res)=>{const code=crypto.randomBytes(3).toString('hex').toUpperCase(); const title=(req.body.title||'Lớp học mới').trim(); const r=await db.query('INSERT INTO classroom_rooms(room_code,title,teacher_id,status) VALUES($1,$2,$3,\'scheduled\') RETURNING *',[code,title,req.session.user.id]); res.redirect('/hoc-cung-thay-co/'+r.rows[0].room_code);};
exports.index=async(req,res)=>res.render('classroom-lobby');
