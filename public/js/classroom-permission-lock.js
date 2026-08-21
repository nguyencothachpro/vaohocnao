(()=>{
const C=window.CLASSROOM||{},$=id=>document.getElementById(id);
function toast(m){const e=$('c3Toast');if(!e)return;e.textContent=m;e.classList.add('show');clearTimeout(e._t);e._t=setTimeout(()=>e.classList.remove('show'),1800)}
const socket=window._c3Socket||(window.io?window.io():null);
let canNavigate=!!C.isTeacher||!!C.canNavigate;let canWrite=!!C.isTeacher||!!C.canWrite;let roomStatus=C.roomStatus||'live';let quickNavOn=false,quickNavBusy=false;
const navigationLocked=()=>!C.isTeacher&&!canNavigate;
function applyLock(){
  const l=navigationLocked();
  ['c3Prev','c3Next','c3PageInput'].forEach(id=>{const e=$(id);if(!e)return;e.disabled=l;e.style.opacity=l?'.5':'1';e.title=l?'Chỉ giáo viên được lật trang lúc này':''});
  document.querySelectorAll('.c3-tool[data-mode="pen"],.c3-tool[data-mode="highlighter"],.c3-tool[data-mode="eraser"],#c3Clear').forEach(e=>{e.disabled=!canWrite;e.style.opacity=canWrite?'1':'.45'});
  ['c3NewBlank','c3NotebookControls'].forEach(id=>{const e=$(id);if(e&&!C.isTeacher)e.style.display='none'});
  const req=$('c3RequestWrite');if(req)req.style.display=canWrite?'none':'';
  const view=$('c3View');if(view)view.classList.toggle('c3-student-locked',l&&!canWrite);
  let badge=document.getElementById('c3PermissionBadge');
  if(!badge&&!C.isTeacher){badge=document.createElement('div');badge.id='c3PermissionBadge';badge.className='c3-permission-badge';document.body.appendChild(badge)}
  if(badge){badge.textContent=l?(canWrite?'✓ Được viết · chưa tự lật trang':'👁 Xem tự do · chưa tự lật trang'):'✓ Bạn được tự lật trang';badge.classList.toggle('locked',l)}
}
function injectStyle(){if(document.getElementById('c3PermissionStyle'))return;const s=document.createElement('style');s.id='c3PermissionStyle';s.textContent=`.c3-student-locked .c3-book{pointer-events:none!important}.c3-permission-badge{position:fixed;right:18px;bottom:18px;z-index:99999;padding:7px 11px;border-radius:999px;background:#fff;border:1px solid #dbe3ef;box-shadow:0 4px 18px rgba(15,23,42,.12);font-size:12px;color:#166534}.c3-permission-badge.locked{color:#475569}.c3-permission-tools{margin:10px 0;padding:10px;border:1px solid #dbe3ef;border-radius:10px;background:#fff}.c3-permission-student{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:6px;align-items:center;padding:7px 0;border-top:1px solid #eef2f7;font-size:12px}.c3-permission-actions{display:flex;gap:5px}.c3-permission-student button{font-size:11px;padding:4px 7px;border:1px solid #cbd5e1;border-radius:6px;background:#fff}.c3-permission-student button.active{background:#dcfce7;border-color:#86efac;color:#166534}.c3-permission-note{font-size:11px;color:#64748b;margin-top:5px}`;document.head.appendChild(s)}
async function getPerm(){try{const r=await fetch('/phong-hoc/'+encodeURIComponent(C.room)+'/permissions',{credentials:'same-origin',cache:'no-store'});if(!r.ok)return null;return await r.json()}catch(_){return null}}
async function studentPoll(){if(C.isTeacher)return;const p=await getPerm();if(!p)return;C.memberId=p.memberId||C.memberId;roomStatus=p.roomStatus||roomStatus;canNavigate=!!p.canNavigate;canWrite=!!p.canWrite;applyLock()}
async function setPerm(id,field,value){try{const r=await fetch('/phong-hoc/'+encodeURIComponent(C.room)+'/permissions/'+id,{method:'POST',headers:{'Content-Type':'application/json'},credentials:'same-origin',body:JSON.stringify({[field]:!!value})});if(!r.ok)throw new Error('Không cập nhật được quyền');if(field==='canWrite')socket?.emit('classroom:write-grant',{userId:id,allow:!!value});return await r.json()}catch(e){console.error(e)}}
async function setPermAll(canNavigate){try{const r=await fetch('/phong-hoc/'+encodeURIComponent(C.room)+'/permissions-all',{method:'POST',headers:{'Content-Type':'application/json'},credentials:'same-origin',body:JSON.stringify({canNavigate:!!canNavigate})});if(!r.ok)throw new Error('Không cập nhật được');return await r.json()}catch(e){console.error(e)}}
function injectQuickToggle(){
  if(!C.isTeacher)return;
  const bar=document.querySelector('.c3-stagebar');
  if(!bar||$('c3NavQuickToggle'))return;
  const b=document.createElement('button');
  b.id='c3NavQuickToggle';b.className='c3-btn c3-nav-quick-toggle';
  b.innerHTML='🔒 Trang theo điều khiển GV';
  b.onclick=async()=>{
    if(quickNavBusy)return;quickNavBusy=true;
    const next=!quickNavOn;
    await setPermAll(next);
    quickNavOn=next;quickNavBusy=false;
    updateQuickToggle();
    toast(next?'Học viên được tự lật trang':'Trang chỉ theo điều khiển của giáo viên — học viên không tự lật được nữa');
    teacherRoster();
  };
  bar.appendChild(b);
}
function updateQuickToggle(){
  const b=$('c3NavQuickToggle');if(!b)return;
  b.innerHTML=quickNavOn?'🔓 Học viên tự lật trang':'🔒 Trang theo điều khiển GV';
  b.classList.toggle('active',quickNavOn);
}
async function teacherRoster(){if(!C.isTeacher)return;const p=await getPerm();if(!p?.students)return;quickNavOn=p.students.length>0&&p.students.every(st=>st.can_navigate);updateQuickToggle();let box=document.getElementById('c3PermissionTools');if(!box){const panel=document.getElementById('panel-materials');if(!panel)return;box=document.createElement('div');box.id='c3PermissionTools';box.className='c3-permission-tools';panel.insertBefore(box,panel.firstChild?.nextSibling||panel.firstChild)}box.innerHTML='<div class="c3-heading">Quyền học viên</div><div class="c3-muted">Cấp riêng <b>Viết</b> hoặc <b>Lật trang</b> cho từng học viên. Xem/zoom/kéo bài giảng luôn được tự do với mọi học viên.</div><div class="c3-permission-bulk"><button id="c3NavAllOn" class="btn btn-sm btn-outline-success">✓ Cho lật trang – Tất cả</button><button id="c3NavAllOff" class="btn btn-sm btn-outline-secondary">Thu hồi lật trang – Tất cả</button></div><input id="c3PermissionSearch" class="form-control form-control-sm mt-2" placeholder="Tìm tên hoặc mã học viên…"><div class="c3-permission-note">Đang dạy: học viên mặc định không tự lật được trang, trừ khi được cấp quyền Lật trang. Đóng lớp: học viên tự lật trang được nhưng vẫn không viết được nếu chưa cấp quyền.</div><div id="c3PermissionList"></div>';$('c3NavAllOn').onclick=async()=>{await setPermAll(true);toast('Đã cho phép lật trang cho tất cả học viên');teacherRoster()};$('c3NavAllOff').onclick=async()=>{await setPermAll(false);toast('Đã thu hồi quyền lật trang của tất cả học viên');teacherRoster()};const search=$('c3PermissionSearch'),list=$('c3PermissionList');const render=()=>{const q=String(search.value||'').trim().toLowerCase();list.innerHTML='';const rows=p.students.filter(st=>!q||String(st.display_name||'').toLowerCase().includes(q)||String(st.student_code||'').toLowerCase().includes(q)).slice(0,150);if(!rows.length){list.innerHTML='<div class="c3-permission-note">Không tìm thấy học viên.</div>';return}rows.forEach(st=>{const row=document.createElement('div');row.className='c3-permission-student';const n=document.createElement('span');n.textContent=(st.display_name||'Học viên')+' · '+st.student_code;const a=document.createElement('div');a.className='c3-permission-actions';const w=document.createElement('button');w.textContent=st.can_write?'✓ Viết':'Viết';w.classList.toggle('active',st.can_write);w.onclick=async()=>{await setPerm(st.id,'canWrite',!st.can_write);teacherRoster()};const v=document.createElement('button');v.textContent=st.can_navigate?'✓ Lật trang':'Lật trang';v.classList.toggle('active',st.can_navigate);v.onclick=async()=>{await setPerm(st.id,'canNavigate',!st.can_navigate);teacherRoster()};a.append(w,v);row.append(n,a);list.appendChild(row)})};search.oninput=render;render()}
function install(){
  injectStyle();applyLock();
  if(C.isTeacher){injectQuickToggle();teacherRoster();setInterval(teacherRoster,10000)}
  else{studentPoll();setInterval(studentPoll,4000)}
  socket?.on('classroom:write-status',m=>{if(C.memberId&&Number(m?.userId)===Number(C.memberId)){canWrite=!!m.allow;applyLock()}});
  socket?.on('classroom:navigate-status',m=>{if(C.memberId&&Number(m?.userId)===Number(C.memberId)){canNavigate=!!m.allow;applyLock()}});
  socket?.on('classroom:closed',()=>{roomStatus='closed';canNavigate=true;applyLock()});
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>setTimeout(install,800));else setTimeout(install,800);
})();
