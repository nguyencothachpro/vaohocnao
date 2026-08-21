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
