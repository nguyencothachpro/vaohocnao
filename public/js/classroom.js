(() => {
  const C = window.CLASSROOM || {};
  const $ = id => document.getElementById(id);
  let socket = { emit(){}, on(){} };
  try { if (typeof window.io === 'function') socket = window.io(); } catch (_) {}

  const pagesEl = $('pages'), viewport = $('bookViewport'), emptyBoard = $('emptyBoard');
  const pageNumber = $('pageNumber'), pageTotal = $('pageTotal'), zoomLabel = $('zoomLabel');
  let mode='pen', ink='#ef4444', penWidth=3, highlighterWidth=20;
  let currentPage=0, pages=[], pageFlip=null, zoom=1, pdf=null, blankTemplate='paper';
  let localStream=null, processedStream=null, keyOn=false, keyTimer=null;
  const peers=new Map();

  const canWrite=()=>Boolean(C.isTeacher || C.canWrite);
  const toast=(msg)=>{let e=$('classroomToast');if(!e){e=document.createElement('div');e.id='classroomToast';e.style.cssText='position:fixed;left:50%;bottom:28px;transform:translateX(-50%);z-index:9999;background:#0f172a;color:#fff;padding:10px 16px;border-radius:10px;box-shadow:0 10px 30px rgba(0,0,0,.25);font-size:13px;pointer-events:none';document.body.appendChild(e)}e.textContent=msg;clearTimeout(e._t);e._t=setTimeout(()=>e.remove(),1800)};

  function openPanel(name){
    document.querySelectorAll('.right-tab').forEach(t=>t.classList.toggle('active',t.dataset.panel===name));
    document.querySelectorAll('.right-panel').forEach(p=>p.classList.toggle('active',p.id==='panel-'+name));
    if(innerWidth<=1000){
      let d=$('mobilePanelDrawer');
      if(!d){d=document.createElement('div');d.id='mobilePanelDrawer';d.style.cssText='position:fixed;inset:0;z-index:2000;background:rgba(15,23,42,.55);display:none';d.innerHTML='<div id="mobilePanelInner" style="position:absolute;right:0;top:0;bottom:0;width:min(92vw,390px);background:#fff;overflow:auto;box-shadow:-12px 0 35px rgba(0,0,0,.25)"></div>';document.body.appendChild(d);d.onclick=e=>{if(e.target===d)d.style.display='none'}}
      const src=$('panel-'+name),inner=$('mobilePanelInner');inner.innerHTML=src?.innerHTML||'';d.style.display='block';
    }
  }
  document.querySelectorAll('.right-tab').forEach(t=>t.addEventListener('click',()=>openPanel(t.dataset.panel)));
  $('noteTool')?.addEventListener('click',()=>openPanel('notes'));$('materialsTool')?.addEventListener('click',()=>openPanel('materials'));$('chatTool')?.addEventListener('click',()=>openPanel('chat'));

  function setMode(next){
    mode=next;document.querySelectorAll('.side-tool').forEach(b=>b.classList.remove('active'));
    const id={pointer:'pointerTool',pen:'pen',highlighter:'highlighter',eraser:'eraser',text:'textTool'}[next];if(id)$(id)?.classList.add('active');
    document.querySelector('.classroom-stage')?.classList.toggle('pointer-mode',next==='pointer');
    toast(next==='pointer'?'Chuột: chọn, kéo và lật trang':next==='pen'?'Bút: chọn màu và độ dày':next==='highlighter'?'Đánh dấu: chọn độ dày':next==='eraser'?'Tẩy: xóa nét':'Chữ: bấm lên trang để nhập');
  }
  $('pointerTool')?.addEventListener('click',()=>setMode('pointer'));$('pen')?.addEventListener('click',()=>setMode('pen'));$('highlighter')?.addEventListener('click',()=>setMode('highlighter'));$('eraser')?.addEventListener('click',()=>setMode('eraser'));$('textTool')?.addEventListener('click',()=>setMode('text'));
  $('penWidth')?.addEventListener('change',e=>penWidth=Number(e.target.value));$('highlighterWidth')?.addEventListener('change',e=>highlighterWidth=Number(e.target.value));
  document.querySelectorAll('.color-dot').forEach(b=>b.addEventListener('click',()=>{ink=b.dataset.ink;document.querySelectorAll('.color-dot').forEach(x=>x.classList.remove('active'));b.classList.add('active')}));

  function updateZoom(){if(zoomLabel)zoomLabel.textContent=Math.round(zoom*100)+'%';if(pagesEl){pagesEl.style.transform=`scale(${zoom})`;pagesEl.style.transformOrigin='top center';}}
  $('zoomIn')?.addEventListener('click',()=>{zoom=Math.min(3,+(zoom+.1).toFixed(2));updateZoom()});$('zoomOut')?.addEventListener('click',()=>{zoom=Math.max(.5,+(zoom-.1).toFixed(2));updateZoom()});$('fit')?.addEventListener('click',()=>fitPage());$('resetView')?.addEventListener('click',()=>{zoom=1;updateZoom();viewport?.scrollTo({top:0,behavior:'smooth'});toast('Đã đặt lại khung nhìn')});$('fullscreen')?.addEventListener('click',async()=>{try{if(!document.fullscreenElement)await document.querySelector('.classroom-app')?.requestFullscreen?.();else await document.exitFullscreen?.()}catch(_){}});
  function fitPage(){const p=pages[0];if(!p||!viewport)return;const w=p.offsetWidth||700,h=p.offsetHeight||990,aw=Math.max(280,viewport.clientWidth-30),ah=Math.max(300,viewport.clientHeight-30);zoom=Math.max(.5,Math.min(1.25,Math.min(aw/w,ah/h)));updateZoom();viewport.scrollTop=0}

  function resizeCanvas(draw,host){const r=host.getBoundingClientRect();if(!r.width||!r.height)return;const dpr=Math.max(1,devicePixelRatio||1);const old=draw.width&&draw.height?draw.toDataURL():null;draw.width=Math.round(r.width*dpr);draw.height=Math.round(r.height*dpr);draw.style.width=r.width+'px';draw.style.height=r.height+'px';const ctx=draw.getContext('2d');ctx.setTransform(dpr,0,0,dpr,0,0);if(old){const img=new Image();img.onload=()=>ctx.drawImage(img,0,0,r.width,r.height);img.src=old}}
  function makePage(index,canvas,template){const host=document.createElement('div');host.className='page-host page';host.dataset.page=index;host.style.aspectRatio='.707 / 1';if(canvas){canvas.style.cssText='display:block;width:100%;height:100%';host.appendChild(canvas)}else{const bg=document.createElement('div');bg.className='blank-page '+(template||'paper');host.appendChild(bg)}const draw=document.createElement('canvas');draw.className='draw-layer';host.appendChild(draw);const ro=new ResizeObserver(()=>resizeCanvas(draw,host));ro.observe(host);requestAnimationFrame(()=>resizeCanvas(draw,host));let drawing=false,last=null;
    draw.addEventListener('pointerdown',e=>{if(!canWrite()||mode==='pointer')return;if(mode==='text'){const text=prompt('Nhập nội dung cần viết:');if(!text?.trim())return;const r=host.getBoundingClientRect(),ctx=draw.getContext('2d');ctx.save();ctx.setTransform(devicePixelRatio||1,0,0,devicePixelRatio||1,0,0);ctx.fillStyle=ink;ctx.font='20px Arial';ctx.fillText(text.trim(),e.clientX-r.left,e.clientY-r.top);ctx.restore();emitBoard({page:index,kind:'text',x:e.clientX-r.left,y:e.clientY-r.top,text:text.trim(),color:ink});return}draw.setPointerCapture(e.pointerId);drawing=true;last=[e.offsetX,e.offsetY]});
    draw.addEventListener('pointermove',e=>{if(!drawing||!last)return;const ctx=draw.getContext('2d'),erase=mode==='eraser',highlight=mode==='highlighter',width=erase?26:(highlight?highlighterWidth:penWidth),color=highlight?'rgba(250,204,21,.38)':ink;ctx.save();ctx.globalCompositeOperation=erase?'destination-out':'source-over';ctx.lineWidth=width;ctx.lineCap='round';ctx.lineJoin='round';ctx.strokeStyle=color;ctx.beginPath();ctx.moveTo(last[0],last[1]);ctx.lineTo(e.offsetX,e.offsetY);ctx.stroke();ctx.restore();emitBoard({page:index,kind:'stroke',x1:last[0],y1:last[1],x2:e.offsetX,y2:e.offsetY,erase,highlight,width,color});last=[e.offsetX,e.offsetY]});
    const stop=()=>{drawing=false;last=null};draw.addEventListener('pointerup',stop);draw.addEventListener('pointercancel',stop);draw.addEventListener('lostpointercapture',stop);return host}

  function emitBoard(data){try{if(C.room)socket.emit('classroom:board',{room:C.room,data})}catch(_) {}}
  function go(delta){if(!pages.length)return;const n=Math.max(0,Math.min(pages.length-1,currentPage+delta));if(n===currentPage)return;currentPage=n;pages.forEach((p,i)=>p.classList.toggle('is-current',i===n));if(pageNumber)pageNumber.value=n+1;if(pageTotal)pageTotal.textContent='/ '+pages.length;pages[n]?.scrollIntoView({behavior:'smooth',block:'nearest',inline:'center'});}
  $('prevPage')?.addEventListener('click',()=>go(-1));$('nextPage')?.addEventListener('click',()=>go(1));
  document.addEventListener('keydown',e=>{if(e.target.matches('input,textarea,select'))return;if(e.key==='ArrowLeft')go(-1);if(e.key==='ArrowRight')go(1)});
  if(viewport){viewport.addEventListener('wheel',e=>{if(mode==='pointer'&&Math.abs(e.deltaY)>Math.abs(e.deltaX)){e.preventDefault();go(e.deltaY>0?1:-1)}},{passive:false});}
  setMode('pen');
})();