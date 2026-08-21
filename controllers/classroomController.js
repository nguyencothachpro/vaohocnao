const crypto=require('crypto');
const axios=require('axios');
const db=require('../config/db');

function code(){return crypto.randomBytes(4).toString('hex').toUpperCase();}
function activeUser(req){return req.session.adminUser||req.session.user||null;}

exports.list=async(req,res)=>{
  const rooms=(await db.query(`SELECT c.*,u.name teacher_name FROM classrooms c LEFT JOIN users u ON u.id=c.teacher_id WHERE c.status='live' ORDER BY c.created_at DESC`)).rows;
  res.render('classrooms',{rooms});
};

exports.adminList=async(req,res)=>{
  const rooms=(await db.query(`SELECT c.*,u.name teacher_name FROM classrooms c LEFT JOIN users u ON u.id=c.teacher_id ORDER BY CASE WHEN c.status='live' THEN 0 ELSE 1 END,c.created_at DESC`)).rows;
  res.render('admin/classrooms',{rooms,adminUser:req.session.adminUser||req.session.user});
};

exports.create=async(req,res)=>{
  const teacher=activeUser(req);
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
  const user=activeUser(req);
  const isTeacher=Boolean(user && (Number(user.id)===Number(room.teacher_id) || ['super_admin','admin'].includes(user.role)));
  res.render('classroom',{room,materials,isTeacher});
};

exports.addMaterial=async(req,res)=>{
  await db.query('INSERT INTO classroom_materials(classroom_id,title,kind,url) VALUES($1,$2,$3,$4)',[req.body.classroom_id,req.body.title,req.body.kind||'link',req.body.url||null]);
  res.redirect('/phong-hoc/'+req.body.room_code);
};

function extractDriveId(url){
  const m=String(url||'').match(/drive\.google\.com\/(?:file\/d\/|open\?id=|uc\?(?:[^#]*&)?id=)([^/?&#]+)/i);
  return m?.[1]||null;
}

async function downloadPdf(url){
  const driveId=extractDriveId(url);
  const candidates=[];
  if(driveId){
    candidates.push(`https://drive.usercontent.google.com/download?id=${encodeURIComponent(driveId)}&export=download&confirm=t`);
    candidates.push(`https://drive.google.com/uc?export=download&id=${encodeURIComponent(driveId)}&confirm=t`);
  }
  candidates.push(url);

  let lastError=null;
  for(const candidate of candidates){
    try{
      const up=await axios.get(candidate,{responseType:'arraybuffer',maxRedirects:8,timeout:30000,headers:{'User-Agent':'Mozilla/5.0','Accept':'application/pdf,application/octet-stream,*/*'}});
      const data=Buffer.from(up.data);
      const contentType=String(up.headers['content-type']||'').toLowerCase();
      const isPdf=data.subarray(0,4).toString('ascii')==='%PDF' || contentType.includes('application/pdf');
      if(isPdf)return {data,contentType:contentType.includes('pdf')?'application/pdf':'application/pdf'};
      lastError=new Error(`Nguồn không trả về PDF (${contentType||'không có content-type'})`);
    }catch(e){lastError=e;}
  }
  throw lastError||new Error('Không tải được PDF');
}

exports.pdf=async(req,res)=>{
  const room=(await db.query('SELECT pdf_url FROM classrooms WHERE room_code=$1',[req.params.code])).rows[0];
  if(!room?.pdf_url)return res.status(404).send('Phòng học chưa có PDF.');
  try{
    const pdf=await downloadPdf(room.pdf_url.trim());
    res.setHeader('Content-Type','application/pdf');
    res.setHeader('Content-Length',String(pdf.data.length));
    res.setHeader('Cache-Control','private, max-age=300');
    res.setHeader('Content-Disposition','inline; filename="bai-giang.pdf"');
    return res.status(200).send(pdf.data);
  }catch(e){
    console.error('Loi tai PDF phong hoc:',e.message);
    return res.status(502).send('Không tải được PDF của phòng học. Hãy dùng link PDF công khai hoặc upload PDF lên kho lưu trữ và dán link trực tiếp.');
  }
};
