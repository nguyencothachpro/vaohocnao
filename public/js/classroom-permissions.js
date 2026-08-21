(() => {
  const C=window.CLASSROOM||{}, originalIo=window.io;
  if(typeof originalIo!=='function')return;
  let initialized=false;
  const escapeHtml=v=>{const d=document.createElement('div');d.textContent=v??'';return d.innerHTML};
  function init(socket){
    if(initialized)return;initialized=true;window.classroomSocket=socket;
    let canWrite=!!C.isTeacher;
    const publish=()=>window.dispatchEvent(new CustomEvent('classroom:write-change',{detail:{canWrite}}));
    const setWritable=ok=>{
      canWrite=!!ok;document.body.classList.toggle('classroom-readonly',!canWrite);document.body.classList.toggle('classroom-can-write',canWrite);publish();
      document.querySelectorAll('#pen,#highlighter,#eraser,#textTool,#clear').forEach(b=>{if(!C.isTeacher)b.disabled=!canWrite});
      if(!C.isTeacher){
        let bar=document.getElementById('writePermissionBar');
        if(!bar){bar=document.createElement('div');bar.id='writePermissionBar';bar.className='write-permission-bar';bar.innerHTML='<span id="writePermissionText">Bạn đang ở chế độ chỉ xem</span><button id="requestWrite" class="btn btn-sm btn-primary">Xin quyền viết</button>';document.querySelector('.classroom-stage')?.appendChild(bar);document.getElementById('requestWrite').onclick=()=>socket.emit('classroom:write-request',{userId:C.currentUserId,user:C.currentUser})}
        document.getElementById('writePermissionText').textContent=canWrite?'Bạn được giáo viên cấp quyền viết':'Bạn đang ở chế độ chỉ xem';document.getElementById('requestWrite').textContent=canWrite?'Đã được cấp quyền':'Xin quyền viết';document.getElementById('requestWrite').disabled=canWrite;
      }
    };
    socket.on('classroom:permissions',p=>setWritable(p.canWrite||p.isTeacher));
    socket.on('classroom:write-status',({userId,allow})=>{if(C.currentUserId&&String(C.currentUserId)===String(userId))setWritable(allow)});
    socket.on('classroom:write-revoke-all',()=>{if(!C.isTeacher)setWritable(false)});
    socket.on('classroom:write-request',({userId,user})=>{if(!C.isTeacher)return;const ok=window.confirm(`${user||'Học viên'} đang xin quyền viết lên bảng.\n\nOK = Cho phép\nCancel = Từ chối`);socket.emit('classroom:write-grant',{userId,allow:ok})});
    if(C.isTeacher){
      const bar=document.createElement('div');bar.id='writePermissionBar';bar.className='write-permission-bar teacher';bar.innerHTML='<span>👨‍🏫 Giáo viên có quyền viết.</span><button id="revokeAllWrite" class="btn btn-sm btn-outline-danger">Thu hồi tất cả</button>';document.querySelector('.classroom-stage')?.appendChild(bar);document.getElementById('revokeAllWrite').onclick=()=>{if(confirm('Thu hồi quyền viết của tất cả học sinh trong phòng?'))socket.emit('classroom:write-revoke-all')};
      const manager=document.getElementById('writerManager');
      if(manager){manager.innerHTML='<div class="small fw-bold mb-2">👥 Người được phép viết</div><div id="writerList" class="small text-muted">Đang tải học viên...</div>';socket.on('classroom:presence-list',list=>{const students=(list||[]).filter(x=>x.role==='student');const el=document.getElementById('writerList');if(!el)return;if(!students.length){el.innerHTML='<div class="text-muted">Chưa có học viên trong phòng.</div>';return}el.innerHTML=students.map(s=>`<div class="writer-member"><span class="text-truncate">${escapeHtml(s.user||'Học viên')}</span><button class="btn btn-sm ${s.canWrite?'btn-outline-danger':'btn-outline-primary'}" data-writer-id="${escapeHtml(String(s.userId||''))}" data-writer-allow="${s.canWrite?'0':'1'}">${s.canWrite?'Thu hồi':'Cho viết'}</button></div>`).join('');el.querySelectorAll('[data-writer-id]').forEach(btn=>btn.onclick=()=>socket.emit('classroom:write-grant',{userId:btn.dataset.writerId,allow:btn.dataset.writerAllow==='1'}))})}
      const qm=document.getElementById('questionModeManager');if(qm){qm.innerHTML='<div class="qmode-card"><div class="small fw-bold mb-2">❓ Hỏi giáo viên</div><label class="small d-flex align-items-center gap-2"><input id="questionModeToggle" type="checkbox"> Cho học viên đặt câu hỏi</label><div class="small text-muted mt-1">Tắt khi đang giảng để tránh bị làm phiền.</div></div>';const toggle=document.getElementById('questionModeToggle');toggle.checked=true;toggle.onchange=()=>socket.emit('classroom:question-mode',{enabled:toggle.checked})}
    }
    socket.on('classroom:question-mode',({enabled})=>{const box=document.getElementById('questionBox');if(box&&!C.isTeacher)box.classList.toggle('d-none',!enabled);const t=document.getElementById('questionModeToggle');if(t&&C.isTeacher)t.checked=!!enabled});
    socket.on('classroom:question',p=>{if(!C.isTeacher)return;const add=window.addClassroomChatMessage;add?.('❓ '+(p.user||'Học viên'),p.text||'');const ev=new CustomEvent('classroom:question-received',{detail:p});window.dispatchEvent(ev)});
    document.getElementById('questionForm')?.addEventListener('submit',e=>{e.preventDefault();const i=document.getElementById('questionInput');const text=i?.value.trim();if(!text)return;socket.emit('classroom:question',{user:C.currentUser||'Học viên',userId:C.currentUserId,text});i.value=''});
    socket.on('classroom:chat',m=>{if(m.userId&&C.currentUserId&&String(m.userId)===String(C.currentUserId))return;const panel=document.getElementById('panel-chat');if(!panel?.classList.contains('active')){const ev=new CustomEvent('classroom:chat-unread');window.dispatchEvent(ev)}});
    setWritable(canWrite);
  }
  window.io=function(...args){const socket=originalIo(...args);window.classroomSocket=socket;setTimeout(()=>init(socket),0);return socket};
})();