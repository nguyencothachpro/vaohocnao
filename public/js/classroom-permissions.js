(() => {
  // Permission UI uses the authenticated Socket.IO session. The server is authoritative.
  const C=window.CLASSROOM||{};
  const socket=window.classroomSocket;
  if(!socket)return;
  let canWrite=!!C.isTeacher;
  const setWritable=ok=>{
    canWrite=!!ok;
    document.body.classList.toggle('classroom-readonly',!canWrite);
    document.querySelectorAll('#pen,#highlighter,#eraser,#textTool,#clear,#noteTool').forEach(b=>{
      if(!C.isTeacher)b.disabled=!canWrite;
      b.title=(!canWrite?'Giáo viên chưa cấp quyền viết':b.title||'');
    });
    let bar=document.getElementById('writePermissionBar');
    if(!bar&&!C.isTeacher){bar=document.createElement('div');bar.id='writePermissionBar';bar.className='write-permission-bar';bar.innerHTML='<span id="writePermissionText">Bạn đang ở chế độ chỉ xem</span><button id="requestWrite" class="btn btn-sm btn-primary">Xin quyền viết</button>';document.querySelector('.classroom-stage')?.appendChild(bar);document.getElementById('requestWrite').onclick=()=>socket.emit('classroom:write-request')}
    if(bar&&!C.isTeacher){document.getElementById('writePermissionText').textContent=canWrite?'Bạn được giáo viên cấp quyền viết':'Bạn đang ở chế độ chỉ xem';document.getElementById('requestWrite').textContent=canWrite?'Đã được cấp quyền':'Xin quyền viết';document.getElementById('requestWrite').disabled=canWrite}
  };
  socket.on('classroom:permissions',p=>setWritable(p.canWrite||p.isTeacher));
  socket.on('classroom:write-status',({userId,allow})=>{if(C.currentUserId&&Number(C.currentUserId)===Number(userId))setWritable(allow)});
  socket.on('classroom:write-request',({userId,user})=>{
    if(!C.isTeacher)return;
    const ok=window.confirm(`${user||'Học viên'} đang xin quyền viết lên bảng.\n\nOK = Cho phép\nCancel = Từ chối`);
    socket.emit('classroom:write-grant',{userId,allow:ok});
  });
  if(C.isTeacher){
    const bar=document.createElement('div');bar.id='writePermissionBar';bar.className='write-permission-bar teacher';bar.innerHTML='<span>👨‍🏫 Bạn là giáo viên: quyền viết mặc định thuộc về bạn.</span><button id="revokeAllWrite" class="btn btn-sm btn-outline-danger">Thu hồi quyền học sinh</button>';document.querySelector('.classroom-stage')?.appendChild(bar);document.getElementById('revokeAllWrite').onclick=()=>{if(confirm('Thu hồi quyền viết của tất cả học sinh trong phòng?'))socket.emit('classroom:write-revoke-all')};
  }
  setWritable(canWrite);
})();