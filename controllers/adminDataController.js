const fs=require('fs');
const db=require('../config/db');

const TABLES=[
'users','categories','book_categories','book_types','online_book_categories',
'courses','books','online_books','login_logs',
'chapters','lessons','lesson_videos','lesson_files',
'book_chapters','book_lessons','book_lesson_videos','book_lesson_files',
'quizzes','quiz_questions','quiz_options','quiz_tf_items','quiz_attempts','quiz_attempt_answers','quiz_assignments','quiz_starts',
'book_quizzes','book_quiz_questions','book_quiz_options',
'enrollments','lesson_progress','book_purchases','online_book_purchases',
'activation_codes','orders','order_items','banners','news','certificates','settings','nav_menu_items','popups',
'posts','post_comments','post_likes','cart_items','classrooms','classroom_materials'
];

exports.page=async(req,res)=>res.render('admin/data-backup');
exports.export=async(req,res)=>{
  const out={version:1,exported_at:new Date().toISOString(),schema:db.schema,tables:{}};
  for(const t of TABLES){
    try{out.tables[t]=(await db.query(`SELECT * FROM "${t}"`)).rows;}catch(e){out.tables[t]=[];}
  }
  const filename=`vaohocnao-backup-${new Date().toISOString().slice(0,10)}.json`;
  res.setHeader('Content-Type','application/json; charset=utf-8');
  res.setHeader('Content-Disposition',`attachment; filename="${filename}"`);
  res.send(JSON.stringify(out,null,2));
};
exports.import=async(req,res)=>{
  if(!req.file)return res.status(400).send('Vui lòng chọn file JSON backup.');
  let data;
  try{data=JSON.parse(fs.readFileSync(req.file.path,'utf8'));}catch(e){return res.status(400).send('File JSON không hợp lệ.');}
  const client=await db.getClient();
  try{
    await client.query('BEGIN');
    await client.query(`TRUNCATE ${TABLES.map(t=>`"${t}"`).join(',')} RESTART IDENTITY CASCADE`);
    // Insert in dependency order. Settings has key as primary key, all others use id.
    for(const t of TABLES){
      const rows=data.tables?.[t]||[];
      for(const row of rows){
        const keys=Object.keys(row);
        if(!keys.length)continue;
        const cols=keys.map(k=>`"${k}"`).join(',');
        const vals=keys.map((_,i)=>`$${i+1}`).join(',');
        await client.query(`INSERT INTO "${t}" (${cols}) VALUES (${vals})`,keys.map(k=>row[k]));
      }
    }
    await client.query('COMMIT');
    res.redirect('/admin/du-lieu?restored=1');
  }catch(e){
    await client.query('ROLLBACK');
    res.status(500).send('Khôi phục thất bại: '+e.message);
  }finally{client.release();fs.unlink(req.file.path,()=>{});}
};
