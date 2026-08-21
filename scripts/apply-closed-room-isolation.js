const fs=require('fs');
const path=require('path');

function patch(file,replacements){
  const p=path.join(__dirname,'..',file);
  let s=fs.readFileSync(p,'utf8');
  let changed=false;
  for(const [from,to] of replacements){
    if(s.includes(to)) continue;
    if(!s.includes(from)) throw new Error(`Patch target not found in ${file}: ${from.slice(0,100)}`);
    s=s.replace(from,to);
    changed=true;
  }
  if(changed) fs.writeFileSync(p,s,'utf8');
}

patch('server.js',[
  ["if(!roomRow||roomRow.status!=='live')", "if(!roomRow||!['live','closed'].includes(roomRow.status))"],
  ["socket.data.roomId=roomRow.id;socket.data.teacherId=roomRow.teacher_id;", "socket.data.roomId=roomRow.id;socket.data.roomStatus=roomRow.status;socket.data.teacherId=roomRow.teacher_id;"],
  ["if(control||socket.data.canWrite)socket.to(`classroom:${socket.data.room}`).emit('classroom:board',payload);", "if(control||(socket.data.canWrite&&socket.data.roomStatus==='live'))socket.to(`classroom:${socket.data.room}`).emit('classroom:board',payload);"],
  ["if(socket.data.room&&socket.data.canWrite)socket.to(`classroom:${socket.data.room}`).emit('classroom:clear',payload||{});", "if(socket.data.room&&socket.data.canWrite&&socket.data.roomStatus==='live')socket.to(`classroom:${socket.data.room}`).emit('classroom:clear',payload||{});"],
  ["if(socket.data.room&&socket.data.role==='teacher')socket.to(`classroom:${socket.data.room}`).emit('classroom:page',payload);", "if(socket.data.room&&socket.data.role==='teacher'&&socket.data.roomStatus==='live')socket.to(`classroom:${socket.data.room}`).emit('classroom:page',payload);"],
  ["if(socket.data.room&&socket.data.role==='teacher')socket.to(`classroom:${socket.data.room}`).emit('classroom:material-open',payload);", "if(socket.data.room&&socket.data.role==='teacher'&&socket.data.roomStatus==='live')socket.to(`classroom:${socket.data.room}`).emit('classroom:material-open',payload);"]
]);

patch('controllers/classroomController.js',[
  ["exports.close=async(req,res)=>{await db.query(\"UPDATE classrooms SET status='closed' WHERE id=$1\",[req.params.id]);res.redirect('/admin/phong-hoc');};", "exports.close=async(req,res)=>{await db.query(\"UPDATE classrooms SET status='closed' WHERE id=$1\",[req.params.id]);const io=req.app.locals.io;if(io){for(const [,s] of io.sockets.sockets){if(Number(s.data.roomId)===Number(req.params.id)){s.data.roomStatus='closed';s.emit('classroom:closed')}}}res.redirect('/admin/phong-hoc');};"]
]);

console.log('>>> Closed classroom isolation patch ready');
