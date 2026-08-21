(()=>{
const C=window.CLASSROOM||{},$=id=>document.getElementById(id);
const socket=window._c3Socket||(window.io?window.io():null);
let syncOn=false,snapTimer=0,exploring=false,syncCropMeta=null;

function toast(m){const e=$('c3Toast');if(!e)return;e.textContent=m;e.classList.add('show');clearTimeout(e._t);e._t=setTimeout(()=>e.classList.remove('show'),1800)}

function injectTeacherUI(){
  if(!C.isTeacher)return;
  const bar=document.querySelector('.c3-stagebar');
  if(!bar||$('c3ViewSyncBtn'))return;
  const b=document.createElement('button');
  b.id='c3ViewSyncBtn';b.className='c3-btn c3-sync-btn';b.innerHTML='🔗 Đồng bộ khung nhìn';
  b.onclick=()=>{
    syncOn=!syncOn;
    socket?.emit('classroom:view-sync-toggle',{room:C.room,on:syncOn});
    updateTeacherBtn();
    if(syncOn){toast('Đã bật đồng bộ khung nhìn cho cả lớp — nét bút vẫn tức thì như bình thường');scheduleSnapshot(true)}
    else toast('Đã tắt đồng bộ khung nhìn — học viên tự do zoom trở lại');
  };
  bar.appendChild(b);
}
function updateTeacherBtn(){const b=$('c3ViewSyncBtn');if(!b)return;b.textContent=syncOn?'🔗 Đang đồng bộ · Bấm để tắt':'🔗 Đồng bộ khung nhìn';b.classList.toggle('active',syncOn)}

function cropCanvas(){
  const view=$('c3View');if(!view)return null;
  const viewRect=view.getBoundingClientRect();
  const pageEls=[...document.querySelectorAll('#c3Book .c3-book-page')].filter(p=>{const r=p.getBoundingClientRect();return !(r.right<viewRect.left||r.left>viewRect.right||r.bottom<viewRect.top||r.top>viewRect.bottom)});
  if(!pageEls.length||viewRect.width<=0)return null;
  let minX=Infinity,minY=Infinity,maxX=-Infinity,maxY=-Infinity;
  pageEls.forEach(p=>{const r=p.getBoundingClientRect();minX=Math.min(minX,Math.max(r.left,viewRect.left));minY=Math.min(minY,Math.max(r.top,viewRect.top));maxX=Math.max(maxX,Math.min(r.right,viewRect.right));maxY=Math.max(maxY,Math.min(r.bottom,viewRect.bottom))});
  const cropW=Math.max(1,maxX-minX),cropH=Math.max(1,maxY-minY);
  const targetW=Math.min(2200,Math.max(1200,Math.round(cropW))),targetH=Math.max(300,Math.round(targetW*cropH/cropW));
  const c=document.createElement('canvas');c.width=targetW;c.height=targetH;
  const ctx=c.getContext('2d');
  ctx.fillStyle='#fff';ctx.fillRect(0,0,targetW,targetH);
  const scaleX=targetW/cropW,scaleY=targetH/cropH;
  const pagesMeta=[];
  pageEls.forEach(pageEl=>{
    const r=pageEl.getBoundingClientRect();
    const dx=(r.left-minX)*scaleX,dy=(r.top-minY)*scaleY,dw=r.width*scaleX,dh=r.height*scaleY;
    const pdfCanvas=pageEl.querySelector('canvas.pdf-page');
    if(pdfCanvas){try{ctx.drawImage(pdfCanvas,dx,dy,dw,dh)}catch(_){}}
    else{ctx.fillStyle='#fff';ctx.fillRect(dx,dy,dw,dh)}
    // nét vẽ được vẽ lại bằng lớp riêng ở phía học viên (tức thì), không cần chụp vào ảnh nền
    const pageX0=Math.max(0,(viewRect.left-r.left)/r.width),pageY0=Math.max(0,(viewRect.top-r.top)/r.height);
    const pageX1=Math.min(1,(viewRect.right-r.left)/r.width),pageY1=Math.min(1,(viewRect.bottom-r.top)/r.height);
    pagesMeta.push({index:Number(pageEl.dataset.page)||0,pageX0,pageY0,pageX1,pageY1,compX0:dx/targetW,compY0:dy/targetH,compX1:(dx+dw)/targetW,compY1:(dy+dh)/targetH});
  });
  return {canvas:c,pages:pagesMeta};
}

function captureAndSend(){
  if(!syncOn||!C.isTeacher)return;
  const res=cropCanvas();
  if(!res)return;
  try{
    const dataUrl=res.canvas.toDataURL('image/jpeg',0.9);
    socket?.emit('classroom:view-snapshot',{room:C.room,image:dataUrl,page:Number($('c3PageInput')?.value||1)-1,pages:res.pages});
  }catch(err){console.error(err)}
}
function scheduleSnapshot(immediate){
  if(!syncOn||!C.isTeacher)return;
  clearTimeout(snapTimer);
  snapTimer=setTimeout(captureAndSend,immediate?60:450);
}

function ensureOverlay(){
  let img=$('c3SyncOverlay');
  if(!img){img=document.createElement('img');img.id='c3SyncOverlay';img.className='c3-sync-overlay';$('c3BookWrap')?.appendChild(img)}
  let ink=$('c3SyncInk');
  if(!ink){ink=document.createElement('canvas');ink.id='c3SyncInk';ink.className='c3-sync-ink';$('c3BookWrap')?.appendChild(ink)}
  let banner=$('c3SyncBanner');
  if(!banner){
    banner=document.createElement('div');banner.id='c3SyncBanner';banner.className='c3-sync-banner';
    banner.innerHTML='<span>🔗 Theo giáo viên</span><button id="c3SyncExplore" type="button">Xem tự do</button>';
    $('c3View')?.appendChild(banner);
    const btn=banner.querySelector('#c3SyncExplore');
    btn.addEventListener('click',ev=>{
      ev.preventDefault();ev.stopPropagation();
      exploring=!exploring;
      applyExploreState();
      toast(exploring?'👀 Đang xem tự do — bấm lại để quay về theo giáo viên':'🔗 Đã quay về xem theo giáo viên');
    });
  }
  return {img,ink,banner};
}
function applyExploreState(){
  const bookWrap=$('c3BookWrap');
  if(bookWrap)bookWrap.classList.toggle('c3-sync-exploring',exploring);
  const btn=$('c3SyncExplore');
  if(btn)btn.textContent=exploring?'↩ Theo giáo viên':'Xem tự do';
}
function showOverlay(){const {banner}=ensureOverlay();banner.style.display='flex';$('c3BookWrap')?.classList.add('c3-sync-on');applyExploreState()}
function hideOverlay(){const banner=$('c3SyncBanner');if(banner)banner.style.display='none';exploring=false;const bookWrap=$('c3BookWrap');if(bookWrap){bookWrap.classList.remove('c3-sync-on');bookWrap.classList.remove('c3-sync-exploring')}}

function pageMetaFor(idx){return (syncCropMeta?.pages||[]).find(m=>m.index===idx)}
function mapPoint(meta,x,y){
  const dX=(meta.pageX1-meta.pageX0)||1,dY=(meta.pageY1-meta.pageY0)||1;
  const fx=(x-meta.pageX0)/dX,fy=(y-meta.pageY0)/dY;
  return [(meta.compX0+fx*(meta.compX1-meta.compX0)),(meta.compY0+fy*(meta.compY1-meta.compY0))];
}
function drawStroke(ctx,w,h,meta,s){
  if(!s.n)return;
  const [x1r,y1r]=mapPoint(meta,s.x1,s.y1),[x2r,y2r]=mapPoint(meta,s.x2,s.y2);
  const refW=window._c3BookSize?.w||600;
  const pixelsPerPageWidth=w*(meta.compX1-meta.compX0)/((meta.pageX1-meta.pageX0)||1);
  const scaleFactor=Math.max(.4,pixelsPerPageWidth/refW);
  ctx.save();
  ctx.globalCompositeOperation=s.erase?'destination-out':'source-over';
  ctx.strokeStyle=s.color||'#ef4444';
  ctx.lineWidth=Math.max(1,(s.width||3)*scaleFactor);
  ctx.lineCap='round';ctx.lineJoin='round';
  ctx.beginPath();ctx.moveTo(x1r*w,y1r*h);ctx.lineTo(x2r*w,y2r*h);ctx.stroke();
  ctx.restore();
}
function inkCanvasSize(){const img=$('c3SyncOverlay');return [img?.naturalWidth||1400,img?.naturalHeight||900]}
function redrawSyncInk(){
  if(!syncCropMeta)return;
  const {ink}=ensureOverlay();
  const [w,h]=inkCanvasSize();
  if(ink.width!==w||ink.height!==h){ink.width=w;ink.height=h}
  const ctx=ink.getContext('2d');ctx.clearRect(0,0,w,h);
  (syncCropMeta.pages||[]).forEach(meta=>{
    const strokes=(window._c3Ink&&window._c3Ink[meta.index])||[];
    strokes.forEach(s=>drawStroke(ctx,w,h,meta,s));
  });
}

function install(){
  if(C.isTeacher){
    injectTeacherUI();
    const bookWrap=$('c3BookWrap');
    if(bookWrap&&window.MutationObserver)new MutationObserver(()=>scheduleSnapshot(false)).observe(bookWrap,{attributes:true,attributeFilter:['style']});
    window.addEventListener('resize',()=>scheduleSnapshot(false));
    document.addEventListener('pointerup',()=>scheduleSnapshot(false),true);
    document.addEventListener('pointermove',()=>scheduleSnapshot(false),true);
    ['c3Prev','c3Next'].forEach(id=>$(id)?.addEventListener('click',()=>setTimeout(()=>scheduleSnapshot(true),700)));
    $('c3PageInput')?.addEventListener('change',()=>setTimeout(()=>scheduleSnapshot(true),700));
    document.addEventListener('keydown',e=>{if(e.key==='ArrowLeft'||e.key==='ArrowRight')setTimeout(()=>scheduleSnapshot(true),700)});
    setInterval(()=>{if(syncOn)scheduleSnapshot(false)},2500);
  }else{
    socket?.on('classroom:view-sync-toggle',p=>{syncOn=!!p?.on;if(syncOn)showOverlay();else hideOverlay()});
    socket?.on('classroom:view-snapshot',p=>{
      if(!p?.image)return;
      syncCropMeta={pages:Array.isArray(p.pages)?p.pages:[]};
      const {img}=ensureOverlay();
      img.onload=()=>redrawSyncInk();
      img.src=p.image;
      if(syncOn)showOverlay();
    });
    socket?.on('classroom:board',p=>{
      if(!syncOn)return;
      const d=p?.data;if(!d||d.kind!=='stroke')return;
      const meta=pageMetaFor(d.page);if(!meta)return;
      const {ink}=ensureOverlay();
      const [w,h]=inkCanvasSize();
      if(ink.width!==w||ink.height!==h){ink.width=w;ink.height=h;redrawSyncInk();return}
      drawStroke(ink.getContext('2d'),w,h,meta,d);
    });
    socket?.on('classroom:clear',()=>{if(syncOn)redrawSyncInk()});
  }
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>setTimeout(install,900));else setTimeout(install,900);
})();

