(() => {
  const C = window.CLASSROOM || {};
  const socket = io();
  const pagesEl = document.getElementById('pages');
  const viewport = document.getElementById('bookViewport');
  const emptyBoard = document.getElementById('emptyBoard');
  const zoomLabel = document.getElementById('zoomLabel');
  const pageNumber = document.getElementById('pageNumber');
  const pageTotal = document.getElementById('pageTotal');
  let mode = 'pen';
  let currentPage = 0;
  let pages = [];
  let pageFlip = null;
  let pdf = null;
  let zoom = 1;
  let localStream = null;
  let processedStream = null;
  let keyOn = false;
  let keyTimer = null;
  const peers = new Map();

  function setMode(next) {
    mode = next;
    document.querySelectorAll('.side-tool').forEach(b => b.classList.remove('active'));
    const map = {pen:'pen', highlighter:'highlighter', eraser:'eraser', text:'textTool', note:'noteTool'};
    if (map[next]) document.getElementById(map[next])?.classList.add('active');
  }
  ['pen','highlighter','eraser'].forEach(id => document.getElementById(id)?.addEventListener('click', () => setMode(id)));
  document.getElementById('textTool')?.addEventListener('click', () => setMode('text'));
  document.getElementById('noteTool')?.addEventListener('click', () => document.querySelector('[data-panel="notes"]')?.click());

  function updateZoom() {
    if (zoomLabel) zoomLabel.textContent = Math.round(zoom * 100) + '%';
    if (pagesEl) pagesEl.style.transform = `scale(${zoom})`;
  }
  document.getElementById('zoomIn')?.addEventListener('click', () => { zoom = Math.min(2.5, zoom + .1); updateZoom(); });
  document.getElementById('zoomOut')?.addEventListener('click', () => { zoom = Math.max(.5, zoom - .1); updateZoom(); });
  document.getElementById('fit')?.addEventListener('click', () => { zoom = 1; updateZoom(); viewport?.scrollTo({top:0,left:0,behavior:'smooth'}); });
  document.getElementById('resetView')?.addEventListener('click', () => { zoom = 1; updateZoom(); viewport?.scrollTo({top:0,left:0,behavior:'smooth'}); });
  document.getElementById('fullscreen')?.addEventListener('click', async () => {
    const target = document.querySelector('.classroom-app');
    if (!document.fullscreenElement) await target?.requestFullscreen?.(); else await document.exitFullscreen?.();
  });

  function pageSize(host) {
    const r = host.getBoundingClientRect();
    return {w: Math.max(1, r.width), h: Math.max(1, r.height)};
  }

  function emitBoard(payload) {
    socket.emit('classroom:board', {...payload, user:C.currentUser || (C.isTeacher ? 'Giáo viên' : 'Học viên')});
  }

  function makePage(index, pdfCanvas) {
    const host = document.createElement('div');
    host.className = 'page-host'; host.dataset.page = index;
    host.style.aspectRatio = '0.707 / 1';
    if (pdfCanvas) { pdfCanvas.style.width='100%'; pdfCanvas.style.height='100%'; host.appendChild(pdfCanvas); }
    const draw = document.createElement('canvas'); draw.className='draw-layer'; host.appendChild(draw);

    const resize = () => {
      const r = host.getBoundingClientRect();
      if (!r.width || !r.height) return;
      const old = draw.width && draw.height ? draw.toDataURL() : null;
      draw.width = Math.round(r.width * devicePixelRatio);
      draw.height = Math.round(r.height * devicePixelRatio);
      draw.style.width = r.width+'px'; draw.style.height = r.height+'px';
      const ctx = draw.getContext('2d'); ctx.setTransform(devicePixelRatio,0,0,devicePixelRatio,0,0);
      if (old) { const img=new Image(); img.onload=()=>ctx.drawImage(img,0,0,r.width,r.height); img.src=old; }
    };
    if (window.ResizeObserver) new ResizeObserver(resize).observe(host);
    requestAnimationFrame(resize);

    let drawing=false,last=null;
    draw.addEventListener('pointerdown', e => {
      if (mode === 'text') {
        const text = prompt('Nhập nội dung cần viết:');
        if (!text) return;
        const ctx=draw.getContext('2d'); const x=e.offsetX,y=e.offsetY;
        ctx.save(); ctx.globalCompositeOperation='source-over'; ctx.fillStyle='#111827'; ctx.font='20px Arial'; ctx.fillText(text,x,y); ctx.restore();
        emitBoard({page:index,kind:'text',x,y,text}); return;
      }
      draw.setPointerCapture(e.pointerId); drawing=true; last=[e.offsetX,e.offsetY];
    });
    draw.addEventListener('pointerup', () => {drawing=false;last=null;});
    draw.addEventListener('pointercancel', () => {drawing=false;last=null;});
    draw.addEventListener('pointermove', e => {
      if (!drawing) return;
      const x=e.offsetX,y=e.offsetY,ctx=draw.getContext('2d');
      const erase=mode==='eraser';
      ctx.save();
      ctx.globalCompositeOperation=erase?'destination-out':'source-over';
      ctx.lineWidth=erase?24:(mode==='highlighter'?18:3); ctx.lineCap='round'; ctx.lineJoin='round';
      if(mode==='highlighter'){ctx.strokeStyle='rgba(250,204,21,.35)';} else {ctx.strokeStyle='#ef4444';}
      ctx.beginPath();ctx.moveTo(last[0],last[1]);ctx.lineTo(x,y);ctx.stroke();ctx.restore();
      emitBoard({page:index,kind:'stroke',x1:last[0],y1:last[1],x2:x,y2:y,erase,highlight:mode==='highlighter'}); last=[x,y];
    });
    host.addEventListener('paste', e => {
      const items=e.clipboardData?.items||[];
      for(const item of items){if(!item.type.startsWith('image/'))continue;const f=item.getAsFile();const url=URL.createObjectURL(f);const img=new Image();img.onload=()=>{const ctx=draw.getContext('2d');ctx.drawImage(img,20,20,Math.min(img.width,500),Math.min(img.height,350));URL.revokeObjectURL(url)};img.src=url;}
    });
    return host;
  }

  function applyRemote(p) {
    const host=pages[p.page]; if(!host)return;
    const draw=host.querySelector('.draw-layer'); if(!draw)return;
    const ctx=draw.getContext('2d'); const r=host.getBoundingClientRect();
    const sx=r.width/(draw.width/devicePixelRatio), sy=r.height/(draw.height/devicePixelRatio);
    ctx.save(); ctx.globalCompositeOperation=p.erase?'destination-out':'source-over'; ctx.lineCap='round'; ctx.lineJoin='round';
    ctx.lineWidth=p.erase?24:(p.highlight?18:3); ctx.strokeStyle=p.highlight?'rgba(250,204,21,.35)':'#ef4444';
    if(p.kind==='stroke'){ctx.beginPath();ctx.moveTo(p.x1/sx,p.y1/sy);ctx.lineTo(p.x2/sx,p.y2/sy);ctx.stroke();}
    if(p.kind==='text'){ctx.globalCompositeOperation='source-over';ctx.fillStyle='#111827';ctx.font='20px Arial';ctx.fillText(p.text,p.x/sx,p.y/sy);}
    if(p.kind==='clear'){ctx.clearRect(0,0,draw.width,draw.height);}
    ctx.restore();
  }
  socket.on('classroom:board', applyRemote);
  socket.on('classroom:clear', () => pages.forEach(p=>p.querySelector('.draw-layer')?.getContext('2d').clearRect(0,0,p.querySelector('.draw-layer').width,p.querySelector('.draw-layer').height)));

  function goToPage(n, broadcast=true) {
    n=Math.max(0,Math.min((pages.length||1)-1,Number(n)||0)); currentPage=n;
    if(pageFlip){try{pageFlip.flip(n);}catch(e){}}
    if(pageNumber) pageNumber.value=n+1;
    if(broadcast && C.isTeacher) socket.emit('classroom:page', {page:n});
  }
  document.getElementById('prev')?.addEventListener('click',()=>goToPage(currentPage-1));
  document.getElementById('next')?.addEventListener('click',()=>goToPage(currentPage+1));
  pageNumber?.addEventListener('change',()=>goToPage(Number(pageNumber.value)-1));
  socket.on('classroom:page', ({page})=>{if(!C.isTeacher)goToPage(page,false);});

  async function loadPdf(url) {
    pdfjsLib.GlobalWorkerOptions.workerSrc='https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
    pdf=await pdfjsLib.getDocument(url).promise;
    pagesEl.innerHTML=''; pages=[];
    for(let i=1;i<=pdf.numPages;i++){
      const p=await pdf.getPage(i); const vp=p.getViewport({scale:1.45}); const c=document.createElement('canvas'); c.width=vp.width;c.height=vp.height;
      await p.render({canvasContext:c.getContext('2d'),viewport:vp}).promise; pagesEl.appendChild(makePage(i-1,c));
    }
    pages=[...pagesEl.children]; pageTotal.textContent=pages.length; emptyBoard?.classList.add('d-none');
    if(window.St?.PageFlip){pageFlip=new St.PageFlip(pagesEl,{width:720,height:1018,size:'stretch',minWidth:300,maxWidth:900,minHeight:430,maxHeight:1280,showCover:true,maxShadowOpacity:.35});pageFlip.loadFromHTML(pages);pageFlip.on('flip',e=>{currentPage=e.data;pageNumber.value=currentPage+1;if(C.isTeacher)socket.emit('classroom:page',{page:currentPage});});}
    goToPage(0,false); updateZoom();
  }

  async function openMaterial(url,kind) {
    if(!url)return;
    if(kind==='pdf' || /\.pdf(?:\?|$)/i.test(url)) { try { await loadPdf(url); return; } catch(e) {} }
    if(kind==='image' || /\.(png|jpe?g|webp|gif)(?:\?|$)/i.test(url)) {
      const img=new Image(); img.crossOrigin='anonymous'; img.onload=()=>{const c=document.createElement('canvas');c.width=img.naturalWidth;c.height=img.naturalHeight;c.getContext('2d').drawImage(img,0,0);pagesEl.innerHTML='';pages=[makePage(0,c)];pagesEl.appendChild(pages[0]);pageTotal.textContent='1';emptyBoard?.classList.add('d-none');};img.src=url;return;
    }
    window.open(url,'_blank','noopener');
  }
  document.querySelectorAll('[data-open-pdf]').forEach(b=>b.addEventListener('click',()=>openMaterial(b.dataset.openPdf,'pdf')));
  document.querySelectorAll('[data-material-url]').forEach(b=>b.addEventListener('click',()=>openMaterial(b.dataset.materialUrl,b.dataset.materialKind)));
  document.getElementById('openPdf')?.addEventListener('click',()=>{if(C.initialPdf)openMaterial('/phong-hoc/'+C.room+'/pdf','pdf');});

  async function camera() {
    try{
      localStream=await navigator.mediaDevices.getUserMedia({video:true,audio:true});
      const v=document.getElementById('localVideo');v.srcObject=localStream;document.getElementById('videoPip')?.classList.remove('d-none');
      if(C.isTeacher)socket.emit('classroom:teacher-stream');
    }catch(e){alert('Không mở được camera/micro. Hãy cấp quyền camera và micro cho website rồi thử lại.');}
  }
  document.getElementById('cam')?.addEventListener('click',camera);
  document.getElementById('screen')?.addEventListener('click',async()=>{try{const s=await navigator.mediaDevices.getDisplayMedia({video:true,audio:true});document.getElementById('localVideo').srcObject=s;document.getElementById('videoPip')?.classList.remove('d-none');if(C.isTeacher)socket.emit('classroom:teacher-stream');}catch(e){}});
  document.getElementById('green')?.addEventListener('click',()=>{if(!localStream){alert('Hãy bật Camera trước.');return;}keyOn=!keyOn;if(keyOn)applyGreenKey();else{if(keyTimer)cancelAnimationFrame(keyTimer);processedStream=null;document.getElementById('localVideo').srcObject=localStream;}});
  function applyGreenKey(){const v=document.getElementById('localVideo'),c=document.getElementById('keyCanvas'),ctx=c.getContext('2d');c.width=640;c.height=360;const tick=()=>{if(!keyOn)return;ctx.drawImage(v,0,0,c.width,c.height);const img=ctx.getImageData(0,0,c.width,c.height),d=img.data;for(let i=0;i<d.length;i+=4){const r=d[i],g=d[i+1],b=d[i+2];if(g>r*1.35&&g>b*1.15&&g>70)d[i+3]=0;}ctx.putImageData(img,0,0);keyTimer=requestAnimationFrame(tick)};tick();processedStream=c.captureStream(30);localStream.getAudioTracks().forEach(t=>processedStream.addTrack(t));v.srcObject=processedStream;if(C.isTeacher)socket.emit('classroom:teacher-stream');}

  socket.on('classroom:request-stream',async({id})=>{if(!C.isTeacher||!(processedStream||localStream))return;const stream=processedStream||localStream;const pc=new RTCPeerConnection();peers.set(id,pc);stream.getTracks().forEach(t=>pc.addTrack(t,stream));pc.onicecandidate=e=>e.candidate&&socket.emit('webrtc:ice',{to:id,candidate:e.candidate});const offer=await pc.createOffer();await pc.setLocalDescription(offer);socket.emit('webrtc:offer',{to:id,offer});});
  socket.on('classroom:teacher-stream',()=>{if(!C.isTeacher)socket.emit('classroom:request-stream',{id:socket.id});});
  socket.on('webrtc:offer',async({from,offer})=>{if(C.isTeacher)return;const pc=new RTCPeerConnection();peers.set(from,pc);pc.ontrack=e=>{const v=document.getElementById('remoteVideo');v.srcObject=e.streams[0];document.getElementById('remotePip')?.classList.remove('d-none');};pc.onicecandidate=e=>e.candidate&&socket.emit('webrtc:ice',{to:from,candidate:e.candidate});await pc.setRemoteDescription(offer);const answer=await pc.createAnswer();await pc.setLocalDescription(answer);socket.emit('webrtc:answer',{to:from,answer});});
  socket.on('webrtc:answer',async({from,answer})=>{const pc=peers.get(from);if(pc)await pc.setRemoteDescription(answer);});
  socket.on('webrtc:ice',async({from,candidate})=>{const pc=peers.get(from);if(pc)try{await pc.addIceCandidate(candidate)}catch(e){}});

  document.getElementById('clear')?.addEventListener('click',()=>{const p=pages[currentPage]?.querySelector('.draw-layer');if(p)p.getContext('2d').clearRect(0,0,p.width,p.height);socket.emit('classroom:clear');});

  const notes=document.getElementById('notesArea'); if(notes){notes.value=localStorage.getItem('vaohocnao_notes_'+C.room)||'';let timer;notes.addEventListener('input',()=>{clearTimeout(timer);timer=setTimeout(()=>{localStorage.setItem('vaohocnao_notes_'+C.room,notes.value);document.getElementById('notesSaved').textContent='Đã tự lưu';},300);});}
  document.querySelectorAll('.right-tab').forEach(tab=>tab.addEventListener('click',()=>{document.querySelectorAll('.right-tab').forEach(t=>t.classList.remove('active'));document.querySelectorAll('.right-panel').forEach(p=>p.classList.remove('active'));tab.classList.add('active');document.getElementById('panel-'+tab.dataset.panel)?.classList.add('active');}));

  const chatMessages=document.getElementById('chatMessages');
  function addChat(m){if(!chatMessages)return;const d=document.createElement('div');d.className='chat-msg';d.innerHTML='<b></b><span></span>';d.querySelector('b').textContent=m.user||'Thành viên';d.querySelector('span').textContent=m.text;chatMessages.appendChild(d);chatMessages.scrollTop=chatMessages.scrollHeight;}
  socket.on('classroom:chat',addChat);
  document.getElementById('chatForm')?.addEventListener('submit',e=>{e.preventDefault();const i=document.getElementById('chatInput');if(!i.value.trim())return;socket.emit('classroom:chat',{text:i.value.trim(),user:C.currentUser||'Thành viên'});i.value='';});
  socket.on('classroom:presence',({count})=>{const el=document.getElementById('presenceText');if(el)el.textContent=`Đang có ${count} người trong phòng`;});

  socket.emit('classroom:join',{room:C.room,role:C.isTeacher?'teacher':'student'});
  if(!C.isTeacher)socket.emit('classroom:request-stream',{id:socket.id});
  if(C.initialPdf) loadPdf('/phong-hoc/'+C.room+'/pdf').catch(()=>{});
  else {const p=makePage(0);pages=[p];pagesEl.appendChild(p);pageTotal.textContent='1';}
})();
