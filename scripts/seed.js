require('dotenv').config();
const bcrypt=require('bcryptjs');
const db=require('../config/db');

async function seed(){
  const email=(process.env.ADMIN_EMAIL||'admin@example.com').trim().toLowerCase();
  const password=process.env.ADMIN_PASSWORD||'admin123';
  const hash=bcrypt.hashSync(password,10);

  const existing=await db.query('SELECT id FROM users WHERE lower(email)=lower($1) LIMIT 1',[email]);
  if(existing.rows.length){
    await db.query("UPDATE users SET password_hash=$2, role='super_admin', is_active=1 WHERE id=$1",[existing.rows[0].id,hash]);
  }else{
    await db.query("INSERT INTO users(name,email,password_hash,role) VALUES($1,$2,$3,'super_admin')",['Quản trị viên',email,hash]);
  }

  const settings={
    site_name_1:'King',site_name_2:'Edu',
    hero_title:'Học tập hiện đại – học mọi lúc, mọi nơi',
    hero_subtitle:'Khóa học, sách, đọc sách online và phòng học cùng thầy cô trên một nền tảng.',
    footer_text:'KingEdu — Nền tảng học tập trực tuyến',
    left_side_image:'',left_side_link:'',
    right_side_image:'',right_side_link:'',
    footer_logo:'',footer_link:''
  };
  for(const [key,value] of Object.entries(settings)){
    await db.query(`INSERT INTO settings(key,value) VALUES($1,$2) ON CONFLICT(key) DO NOTHING`,[key,value]);
  }

  const menus=[
    ['Khóa học','/khoa-hoc',1],['Sách','/sach',2],
    ['Học cùng thầy cô','/phong-hoc',3],['Đọc sách - tài liệu','/doc-sach-online',4]
  ];
  const count=await db.query('SELECT COUNT(*) c FROM nav_menu_items');
  if(Number(count.rows[0].c)===0){
    for(const m of menus) await db.query('INSERT INTO nav_menu_items(label,url,position) VALUES($1,$2,$3)',m);
  }
  console.log(`>>> ADMIN: ${email}`);
  if(!process.env.ADMIN_PASSWORD) console.log('>>> ADMIN_PASSWORD chua dat, dang dung mat khau tam admin123 — doi ngay sau khi dang nhap.');
}
seed().catch(e=>{console.error('SEED FAILED',e);process.exit(1)});
