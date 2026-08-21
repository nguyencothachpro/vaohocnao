(() => {
  const C = window.CLASSROOM || {};
  const $ = id => document.getElementById(id);
  let socket = { emit(){}, on(){} };
  try { if (typeof window.io === 'function') socket = window.io(); } catch (_) {}
  const pagesEl=$('pages'), viewport=$('bookViewport'), pageNumber=$('pageNumber'), pageTotal=$('pageTotal'), zoomLabel=$('zoomLabel');
  let mode='pen', ink='#ef4444', penWidth=3, highlighterWidth=20, currentPage=0, pages=[], zoom=1;
  const canWrite=()=>Boolean(C.isTeacher||C.canWrite);
  const toast=msg=>{let e=$('classroomToast');if(!e){e=document.createElement('div');e.id='classroomToast';e.style.cssText='position:fixed;left:50%;bottom:28px;transform:translateX(-50%);z-index:9999;background:#0f172a;color:#fff;padding:10px 16px;border-radius:10px;box-shadow:0 10px 30px rgba(0,0,0,.25);font-size:13px';document.body.appendChild(e)}e.textContent=msg;clearTimeout(e._t);e._t=setTimeout(()=>e.remove(),1800)};
  function openPanel(name){document.querySelectorAll('.right-tab').forEach(t=>t.classList.toggle('active',t.dataset.panel===name));document.querySelectorAll('.right-panel').forEach(p=>p.classList.toggle('active',p.id==='panel-'+name));}
  document.querySelectorAll('.right-tab').forEach(t=>t.addEventListener('click',()=>openPanel(t.dataset.panel)));
  function setMode(next){mode=next;document.querySelectorAll('.side-tool').forEach(b=>b.classList.remove('active'));const id={pointer:'pointerTool',pen:'pen',highlighter:'highlighter',eraser:'eraser',text:'textTool'}[next];if(id)$(id)?.classList.add('active');document.querySelector('.classroom-stage')?.classList.toggle('pointer-mode',next==='pointer');toast(next==='pointer'?'🖐️ Chuột: kéo và lật trang':next==='pen'?'✏️ Bút: viết/vẽ trên trang':next==='highlighter'?'🖍️ Đánh dấu: tô nổi bật':'🧹 Tẩy: xóa nét');}
  $('pointerTool')?.addEventListener('click',()=>setMode('pointer'));$('pen')?.addEventListener('click',()=>setMode('pen'));$('highlighter')?.addEventListener('click',()=>setMode('highlighter'));$('eraser')?.addEventListener('click',()=>setMode('eraser'));$('textTool')?.addEventListener('click',()=>setMode('text'));
  $('penWidth')?.addEventListener('change',e=>penWidth=Number(e.target.value));$('highlighterWidth')?.addEventListener('change',e=>highlighterWidth=Number(e.target.value));
  document.querySelectorAll('.color-dot').forEach(b=>b.addEventListener('click',()=>{ink=b.dataset.ink;document.querySelectorAll('.color-dot').forEach(x=>x.classList.remove('active'));b.classList.add('active')}));
  function updateZoom(){if(zoomLabel)zoomLabel.textContent=Math.round(zoom*100)+'%';if(pagesEl){pagesEl.style.transform=`scale(${zoom})`;pagesEl.style.transformOrigin='center top';}}
  $('zoomIn')?.addEventListener('click',()=>{zoom=Math.min(3,+(zoom+.1).toFixed(2));updateZoom()});$('zoomOut')?.addEventListener('click',()=>{zoom=Math.max(.5,+(zoom-.1).toFixed(2));updateZoom()});
  function go(delta){if(!pages.length)return;const n=Math.max(0,Math.min(pages.length-1,currentPage+delta));if(n===currentPage)return;currentPage=n;pages.forEach((p,i)=>p.classList.toggle('is-current',i===n));if(pageNumber)pageNumber.value=n+1;if(pageTotal)pageTotal.textContent='/ '+pages.length;pages[n]?.scrollIntoView({behavior:'smooth',block:'nearest',inline:'center'});}
  $('prevPage')?.addEventListener('click',()=>go(-1));$('nextPage')?.addEventListener('click',()=>go(1));
  document.addEventListener('keydown',e=>{if(e.target.matches('input,textarea,select'))return;if(e.key==='ArrowLeft')go(-1);if(e.key==='ArrowRight')go(1)});
  if(viewport){viewport.addEventListener('wheel',e=>{if(mode==='pointer'){e.preventDefault();go((e.deltaX||e.deltaY)>0?1:-1)}},{passive:false});let sx=0,sy=0;viewport.addEventListener('pointerdown',e=>{if(mode!=='pointer')return;sx=e.clientX;sy=e.clientY});viewport.addEventListener('pointerup',e=>{if(mode!=='pointer')return;const dx=e.clientX-sx,dy=e.clientY-sy;if(Math.abs(dx)>50&&Math.abs(dx)>Math.abs(dy))go(dx<0?1:-1)});}
  setMode('pen');
})();