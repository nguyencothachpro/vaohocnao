(() => {
  const C=window.CLASSROOM||{};
  const originalIo=window.io;
  if(typeof originalIo!=='function')return;
  let initialized=false;
  function init(socket){
    if(initialized)return; initialized=true;
    window.classroomSocket=socket;
    let canWrite=!!C.isTeacher;
    const setWritable=ok=>{
      canWrite=!!ok;
      document.body.classList.toggle('classroom-readonly',!canWrite);
      document.querySelectorAll('#pen,#highlighter,#eraser,#textTool,#clear').forEach(b=>{if(!C.isTeacher)b.disabled=!canWrite});
      let bar=document.getElementById('writePermissionBar');
      if(!bar&&!C.isTeacher){
        bar=document.createElement('div');bar.id='writePermissionBar';bar.className='write-permission-bar';
        bar.innerHTML='<span id="writePermissionText">Bạn đang ở chế độ chỉ xem</span><button id="requestWrite" class="btn btn-sm btn-primary">Xin quyền viết</button>';
        document.querySelector('.classroom-stage')?.appendChild(bar);
        document.getElementById('requestWrite').onclick=()=>socket.emit('classroom:write-request',{userId:C.currentUserId,user:C.currentUser});
      }
      if(bar&&!C.isTeacher){
        document.getElementById('writePermissionText').textContent=canWrite?'Bạn được giáo viên cấp quyền viết':'Bạn đang ở chế độ chỉ xem';
        document.getElementById('requestWrite').textContent=canWrite?'Đã được cấp quyền':'Xin quyền viết';
        document.getElementById('requestWrite').disabled=canWrite;
      }
    };
    socket.on('classroom:permissions',p=>setWritable(p.canWrite||p.isTeacher));
    socket.on('classroom:write-status',({userId,allow})=>{if(C.currentUserId&&Number(C.currentUserId)===Number(userId))setWritable(allow)});
    socket.on('classroom:write-revoke-all',()=>{if(!C.isTeacher)setWritable(false)});
    socket.on('classroom:write-request',({userId,user})=>{
      if(!C.isTeacher)return;
      const ok=window.confirm(`${user||'Học viên'} đang xin quyền viết lên bảng.\n\nOK = Cho phép\nCancel = Từ chối`);
      socket.emit('classroom:write-grant',{userId,allow:ok});
    });
    if(C.isTeacher){
      const bar=document.createElement('div');bar.id='writePermissionBar';bar.className='write-permission-bar teacher';
      bar.innerHTML='<span>👨‍🏫 Quyền viết: giáo viên mặc định.</span><button id="revokeAllWrite" class="btn btn-sm btn-outline-danger">Thu hồi tất cả</button>';
      document.querySelector('.classroom-stage')?.appendChild(bar);
      document.getElementById('revokeAllWrite').onclick=()=>{if(confirm('Thu hồi quyền viết của tất cả học sinh trong phòng?'))socket.emit('classroom:write-revoke-all')};

      const manager=document.getElementById('writerManager');
      if(manager){
        manager.innerHTML='<div class="small fw-bold mb-2">👥 Chỉ định người được viết</div><div id="writerList" class="small text-muted">Đang lấy danh sách học viên...</div>';
        socket.on('classroom:presence-list',list=>{
          const students=(list||[]).filter(x=>x.role==='student');
          const el=document.getElementById('writerList');
          if(!el)return;
          if(!students.length){el.innerHTML='<div class="text-muted">Chưa có học viên trong phòng.</div>';return;}
          el.innerHTML=students.map(s=>`<div class="d-flex align-items-center justify-content-between gap-2 border rounded p-2 mb-1"><span class="text-truncate">${escapeHtml(s.user||'Học viên')}</span><button class="btn btn-sm ${s.canWrite?'btn-outline-danger':'btn-outline-primary'}" data-writer-id="${escapeHtml(String(s.userId||''))}" data-writer-allow="${s.canWrite?'0':'1'}">${s.canWrite?'Thu hồi':'Cho viết'}</button></div>`).join('');
          el.querySelectorAll('[data-writer-id]').forEach(btn=>btn.onclick=()=>socket.emit('classroom:write-grant',{userId:btn.dataset.writerId,allow:btn.dataset.writerAllow==='1'}));
        });
      }
    }
    setWritable(canWrite);
  }
  function escapeHtml(v){const d=document.createElement('div');d.textContent=v;return d.innerHTML;}
  window.io=function(...args){const socket=originalIo(...args);window.classroomSocket=socket;setTimeout(()=>init(socket),0);return socket};
})();
