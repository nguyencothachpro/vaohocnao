(()=>{
  const C=window.CLASSROOM||{};
  let eraserSize=28, drawing=false, last=null, activeCanvas=null;
  const isEraser=()=>document.querySelector('.c3-tool[data-mode="eraser"]')?.classList.contains('active');
  const canWrite=()=>Boolean(C.isTeacher||C.canWrite);
  const socket=window.io?window.io():null;
  function cursor(canvas){
    const s=Math.max(8,Math.min(80,eraserSize)), r=Math.round(s/2);
    const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="${s}" height="${s}" viewBox="0 0 ${s} ${s}"><circle cx="${r}" cy="${r}" r="${Math.max(2,r-1)}" fill="rgba(255,255,255,.18)" stroke="#111827" stroke-width="2"/></svg>`;
    canvas.style.cursor=`url("data:image/svg+xml,${encodeURIComponent(svg)}") ${r} ${r}, crosshair`;
  }
  function allCursors(){document.querySelectorAll('.c3-book-page .ink').forEach(cursor)}
  function setSize(v){
    eraserSize=Math.max(6,Math.min(80,Number(v)||28));
    const out=document.getElementById('c3EraserSizeValue');
    if(out)out.textContent=eraserSize+' px';
    allCursors();
  }
  function inject(){
    if(document.getElementById('c3EraserControls'))return;
    const box=document.createElement('div');
    box.id='c3EraserControls';
    box.innerHTML='<label>Kích thước tẩy</label><div class="c3-eraser-row"><input id="c3EraserSize" type="range" min="6" max="80" step="2" value="28"><b id="c3EraserSizeValue">28 px</b></div><div class="c3-eraser-hint">Tẩy tròn · kéo để tăng/giảm</div>';
    const opts=document.querySelector('.c3-options');
    if(opts)opts.appendChild(box);else document.body.appendChild(box);
    document.getElementById('c3EraserSize').addEventListener('input',e=>setSize(e.target.value));
    const style=document.createElement('style');
    style.textContent='#c3EraserControls{display:none;margin-top:7px;padding-top:7px;border-top:1px solid #263449}#c3EraserControls label{font-size:9px;color:#94a3b8;display:block;margin-bottom:4px}.c3-eraser-row{display:grid;grid-template-columns:1fr auto;gap:6px;align-items:center}.c3-eraser-row input{width:100%;accent-color:#f59e0b}.c3-eraser-row b{font-size:9px;color:#e5e7eb;white-space:nowrap}.c3-eraser-hint{font-size:8px;color:#64748b;margin-top:3px}@media(max-width:650px){#c3EraserControls{display:block;position:fixed;left:64px;bottom:14px;z-index:9998;background:#111827;border:1px solid #334155;border-radius:10px;padding:8px 10px;box-shadow:0 10px 30px rgba(0,0,0,.3);width:190px}#c3EraserControls label{font-size:10px}.c3-eraser-hint{font-size:9px}}';
    document.head.appendChild(style);
    const observer=new MutationObserver(()=>{const show=isEraser();box.style.display=show?'block':'none';if(show)allCursors()});
    observer.observe(document.body,{subtree:true,attributes:true,attributeFilter:['class']});
  }
  function start(e){
    if(!isEraser()||!canWrite())return;
    const c=e.target.closest?.('canvas.ink');
    if(!c)return;
    e.preventDefault();e.stopImmediatePropagation();
    drawing=true;activeCanvas=c;last=[e.offsetX,e.offsetY];
    try{c.setPointerCapture?.(e.pointerId)}catch(_){ }
    cursor(c);
  }
  function move(e){
    if(!drawing||!activeCanvas||!isEraser())return;
    e.preventDefault();e.stopImmediatePropagation();
    const x=e.offsetX,y=e.offsetY;
    if(!last)return;
    const ctx=activeCanvas.getContext('2d');
    ctx.save();ctx.globalCompositeOperation='destination-out';ctx.lineWidth=eraserSize;ctx.lineCap='round';ctx.lineJoin='round';
    ctx.beginPath();ctx.moveTo(last[0],last[1]);ctx.lineTo(x,y);ctx.stroke();ctx.restore();
    const page=Number(activeCanvas.parentElement?.dataset.page||0);
    window._c3Ink=window._c3Ink||{};window._c3Ink[page]=window._c3Ink[page]||[];
    const s={x1:last[0],y1:last[1],x2:x,y2:y,erase:true,width:eraserSize,color:'rgba(0,0,0,0)'};
    window._c3Ink[page].push(s);
    socket?.emit('classroom:board',{room:C.room,data:{page,kind:'stroke',...s}});
    last=[x,y];
  }
  function end(e){
    if(!drawing)return;
    e.preventDefault();e.stopImmediatePropagation();drawing=false;last=null;activeCanvas=null;
  }
  document.addEventListener('pointerdown',start,true);
  document.addEventListener('pointermove',move,true);
  document.addEventListener('pointerup',end,true);
  document.addEventListener('pointercancel',end,true);
  const ready=()=>{inject();allCursors()};
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',ready);else setTimeout(ready,0);
})();

/* Classroom interaction upgrade: pen mouse input, hand/space pan, batch notebook pages. */
(()=>{const $=id=>document.getElementById(id);let space=false,drag=false,lastX=0,lastY=0,px=0,py=0,penDown=false,penCanvas=null,penLast=null;
const active=m=>document.querySelector(`.c3-tool[data-mode="${m}"]`)?.classList.contains('active');
const stage=()=>$('c3View'),wrap=()=>$('c3BookWrap');
function isPen(){return active('pen')||active('highlighter')||active('eraser')}
function color(){return document.querySelector('.c3-color.active')?.dataset.color||'#ef4444'}
function penWidth(){return Number($('c3PenWidth')?.value||3)}
function highWidth(){return Number($('c3HighWidth')?.value||20)}
function apply(){const w=wrap();if(!w)return;w.style.transformOrigin='center center';w.style.transform=`translate(${px}px,${py}px)`;w.style.willChange='transform'}
function injectHand(){if(document.querySelector('.c3-tool[data-mode="hand"]'))return;const host=document.querySelector('.c3-tool[data-mode="pointer"]')?.parentElement;if(!host)return;const b=document.createElement('button');b.type='button';b.className='c3-tool';b.dataset.mode='hand';b.title='Bàn tay / Di chuyển trang';b.innerHTML='✋<span>Bàn tay</span>';host.insertBefore(b,host.children[1]||null);b.onclick=()=>{document.querySelectorAll('.c3-tool[data-mode]').forEach(x=>x.classList.toggle('active',x.dataset.mode==='hand'));const v=stage();if(v)v.style.cursor='grab'};const s=document.createElement('style');s.textContent='.c3-tool[data-mode="hand"]{cursor:grab}.c3-tool[data-mode="hand"].active{outline:2px solid #f97316}';document.head.appendChild(s)}
function injectBatch(){if($('c3BatchPages'))return;const target=document.querySelector('.c3-right')||document.body;const box=document.createElement('div');box.id='c3BatchPages';box.style.cssText='margin:10px 0;padding:10px;border:1px solid #dbe3ef;border-radius:10px;background:#fff';box.innerHTML='<b>Tạo sổ note nhiều trang</b><div style="display:flex;gap:6px;margin-top:7px"><input id="c3BatchCount" type="number" min="1" max="200" value="10" style="width:70px"><button id="c3BatchMake" type="button">+ Tạo trang</button></div><small>Có thể tạo tiếp nhiều lần.</small>';target.appendChild(box);$('c3BatchMake').onclick=()=>{const n=Math.max(1,Math.min(200,Number($('c3BatchCount').value)||1)),btn=document.querySelector('[data-blank-template]');if(!btn)return;let i=0;const step=()=>{if(i++>=n)return;btn.click();setTimeout(step,15)};step()}}
function panStart(e){if(!(space||active('hand'))||e.button===2)return;drag=true;lastX=e.clientX;lastY=e.clientY;e.preventDefault();e.stopImmediatePropagation();stage()?.setPointerCapture?.(e.pointerId);if(stage())stage().style.cursor='grabbing'}
function panMove(e){if(!drag)return;e.preventDefault();e.stopImmediatePropagation();px+=e.clientX-lastX;py+=e.clientY-lastY;lastX=e.clientX;lastY=e.clientY;apply()}
function panEnd(e){if(!drag)return;drag=false;e?.stopImmediatePropagation();if(stage())stage().style.cursor=space||active('hand')?'grab':'default'}
function penStart(e){if(!isPen()||e.pointerType!=='mouse')return;const c=e.target.closest?.('canvas.ink');if(!c)return;penDown=true;penCanvas=c;penLast=[e.offsetX,e.offsetY];e.preventDefault();e.stopImmediatePropagation();c.setPointerCapture?.(e.pointerId)}
function penMove(e){if(!penDown||!penCanvas||!isPen())return;e.preventDefault();e.stopImmediatePropagation();const x=e.offsetX,y=e.offsetY;if(!penLast)return;const high=active('highlighter'),erase=active('eraser'),s={x1:penLast[0],y1:penLast[1],x2:x,y2:y,erase,width:erase?26:(high?highWidth():penWidth()),color:high?'rgba(250,204,21,.38)':color()};const ctx=penCanvas.getContext('2d');ctx.save();ctx.globalCompositeOperation=erase?'destination-out':'source-over';ctx.strokeStyle=s.color;ctx.lineWidth=s.width;ctx.lineCap='round';ctx.lineJoin='round';ctx.beginPath();ctx.moveTo(s.x1,s.y1);ctx.lineTo(s.x2,s.y2);ctx.stroke();ctx.restore();const page=Number(penCanvas.parentElement?.dataset.page||0);window._c3Ink=window._c3Ink||{};window._c3Ink[page]=window._c3Ink[page]||[];window._c3Ink[page].push(s);const sock=window.io?window.io():null;sock?.emit('classroom:board',{room:(window.CLASSROOM||{}).room,data:{page,kind:'stroke',...s}});penLast=[x,y]}
function penEnd(e){if(!penDown)return;penDown=false;penCanvas=null;penLast=null;e?.stopImmediatePropagation()}
document.addEventListener('pointerdown',penStart,true);document.addEventListener('pointermove',penMove,true);document.addEventListener('pointerup',penEnd,true);document.addEventListener('pointercancel',penEnd,true);
document.addEventListener('keydown',e=>{if(e.code==='Space'&&!e.repeat){space=true;const v=stage();if(v)v.style.cursor='grab';e.preventDefault()}});
document.addEventListener('keyup',e=>{if(e.code==='Space'){space=false;if(stage())stage().style.cursor=active('hand')?'grab':'default'}});
const ready=()=>{injectHand();injectBatch();const v=stage();v?.addEventListener('pointerdown',panStart,true);v?.addEventListener('pointermove',panMove,true);v?.addEventListener('pointerup',panEnd,true);v?.addEventListener('pointercancel',panEnd,true)};
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',ready);else setTimeout(ready,100);
})();
