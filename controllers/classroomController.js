const crypto=require('crypto');
const axios=require('axios');
const db=require('../config/db');

function code(){return crypto.randomBytes(4).toString('hex').toUpperCase();}

exports.list=async(req,res)=>{
  const rooms=(await db.query(`SELECT c.*,u.name teacher_name FROM classrooms c LEFT JOIN users u ON u.id=c.teacher_id WHERE c.status='live' ORDER BY c.created_at DESC`)).rows;
  res.render('classrooms',{rooms});
};
exports.adminList=async(req,res)=>{
  const rooms=(await db.query(`SELECT c.*,u.name teacher_name FROM classrooms c LEFT JOIN users u ON u.id=c.teacher_id ORDER BY c.created_at DESC`)).rows;
  res.render('admin/classrooms',{rooms});
};
exports.create=async(req,res)=>{
  const teacher=req.session.adminUser||req.session.user;
  let roomCode=code();
  for(let i=0;i<5;i++){
    const x=await db.query('SELECT 1 FROM classrooms WHERE room_code=$1',[roomCode]);
    if(!x.rows.length) break;
    roomCode=code();
  }
  const r=await db.query(`INSERT INTO classrooms(room_code,title,teacher_id,status,live_url,pdf_url) VALUES($1,$2,$3,'live',$4,$5) RETURNING *`,
    [roomCode,req.body.title||'Phòng học mới',teacher?.id||null,req.body.live_url||null,req.body.pdf_url||null]);
  res.redirect('/phong-hoc/'+r.rows[0].room_code);
};
exports.close=async(req,res)=>{
  await db.query("UPDATE classrooms SET status='closed' WHERE id=$1",[req.params.id]);
  res.redirect('/admin/phong-hoc');
};
exports.room=async(req,res)=>{
  const room=(await db.query(`SELECT c.*,u.name teacher_name FROM classrooms c LEFT JOIN users u ON u.id=c.teacher_id WHERE room_code=$1`,[req.params.code])).rows[0];
  if(!room)return res.status(404).render('404');
  const materials=(await db.query('SELECT * FROM classroom_materials WHERE classroom_id=$1 ORDER BY position,id',[room.id])).rows;
  const isTeacher=(req.session.adminUser?.id===room.teacher_id)||(req.session.user?.id===room.teacher_id);
  res.render('classroom',{room,materials,isTeacher});
};
exports.addMaterial=async(req,res)=>{
  await db.query('INSERT INTO classroom_materials(classroom_id,title,kind,url) VALUES($1,$2,$3,$4)',[req.body.classroom_id,req.body.title,req.body.kind||'link',req.body.url||null]);
  res.redirect('/phong-hoc/'+req.body.room_code);
};

exports.pdf=async(req,res)=>{
  const room=(await db.query('SELECT pdf_url FROM classrooms WHERE room_code=$1',[req.params.code])).rows[0];
  if(!room?.pdf_url)return res.status(404).end();
  let url=room.pdf_url.trim();
  const m=url.match(/drive\.google\.com\/file\/d\/([^/]+)/);
  if(m) url=`https://drive.google.com/uc?export=download&id=${m[1]}`;
  try{
    const up=await axios.get(url,{responseType:'stream',maxRedirects:5,headers:{'User-Agent':'Mozilla/5.0'}});
    res.setHeader('Content-Type',up.headers['content-type']||'application/pdf');
    up.data.pipe(res);
  }catch(e){res.status(502).send('Không tải được PDF của phòng học. Hãy kiểm tra link chia sẻ.');}
};
