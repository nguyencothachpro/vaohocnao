(()=>{
const C=window.CLASSROOM||{},$=id=>document.getElementById(id);
const socket=window._c3Socket||(window.io?window.io():null);
let syncOn=false,snapTimer=0,exploring=false;

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
    if(syncOn){toast('Đã bật đồng bộ khung nhìn cho cả lớp');scheduleSnapshot(true)}
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
  const targetW=1400,targetH=Math.max(300,Math.round(targetW*cropH/cropW));
  const c=document.createElement('canvas');c.width=targetW;c.height=targetH;
  const ctx=c.getContext('2d');
  ctx.fillStyle='#fff';ctx.fillRect(0,0,targetW,targetH);
  const scaleX=targetW/cropW,scaleY=targetH/cropH;
  pageEls.forEach(pageEl=>{
    const r=pageEl.getBoundingClientRect();
    const dx=(r.left-minX)*scaleX,dy=(r.top-minY)*scaleY,dw=r.width*scaleX,dh=r.height*scaleY;
    const pdfCanvas=pageEl.querySelector('canvas.pdf-page');
    if(pdfCanvas){try{ctx.drawImage(pdfCanvas,dx,dy,dw,dh)}catch(_){}}
    else{ctx.fillStyle='#fff';ctx.fillRect(dx,dy,dw,dh)}
    const inkCanvas=pageEl.querySelector('canvas.ink');
    if(inkCanvas){try{ctx.drawImage(inkCanvas,dx,dy,dw,dh)}catch(_){}}
    const dot=pageEl.querySelector('.c3-laser-dot.ping');
    if(dot){const dr=dot.getBoundingClientRect();const cx=(dr.left+dr.width/2-minX)*scaleX,cy=(dr.top+dr.height/2-minY)*scaleY;ctx.beginPath();ctx.fillStyle='rgba(239,68,68,.55)';ctx.arc(cx,cy,14*scaleX,0,Math.PI*2);ctx.fill()}
  });
  return c;
}

function captureAndSend(){
  if(!syncOn||!C.isTeacher)return;
  const c=cropCanvas();
  if(!c)return;
  try{
    const dataUrl=c.toDataURL('image/jpeg',0.78);
    socket?.emit('classroom:view-snapshot',{room:C.room,image:dataUrl,page:Number($('c3PageInput')?.value||1)-1});
  }catch(err){console.error(err)}
}
function scheduleSnapshot(immediate){
  if(!syncOn||!C.isTeacher)return;
  clearTimeout(snapTimer);
  snapTimer=setTimeout(captureAndSend,immediate?60:450);
}

function ensureOverlay(){
  let img=$('c3SyncOverlay');
  if(!img){img=document.createElement('img');img.id='c3SyncOverlay';img.className='c3-sync-overlay';$('c3View')?.appendChild(img)}
  let banner=$('c3SyncBanner');
  if(!banner){
    banner=document.createElement('div');banner.id='c3SyncBanner';banner.className='c3-sync-banner';
    banner.innerHTML='<span>🔗 Đang xem theo khung giáo viên</span><button id="c3SyncExplore" type="button">Xem tự do</button>';
    $('c3View')?.appendChild(banner);
    banner.querySelector('#c3SyncExplore').onclick=()=>{
      exploring=!exploring;
      img.style.display=exploring?'none':'block';
      banner.querySelector('#c3SyncExplore').textContent=exploring?'↩ Quay lại theo giáo viên':'Xem tự do';
    };
  }
  return {img,banner};
}
function showOverlay(){const {img,banner}=ensureOverlay();banner.style.display='flex';if(!exploring)img.style.display='block'}
function hideOverlay(){const img=$('c3SyncOverlay'),banner=$('c3SyncBanner');if(img)img.style.display='none';if(banner)banner.style.display='none';exploring=false}

function install(){
  if(C.isTeacher){
    injectTeacherUI();
    const bookWrap=$('c3BookWrap');
    if(bookWrap&&window.MutationObserver)new MutationObserver(()=>scheduleSnapshot(false)).observe(bookWrap,{attributes:true,attributeFilter:['style']});
    window.addEventListener('resize',()=>scheduleSnapshot(false));
    document.addEventListener('pointerup',()=>scheduleSnapshot(false));
    ['c3Prev','c3Next'].forEach(id=>$(id)?.addEventListener('click',()=>setTimeout(()=>scheduleSnapshot(true),700)));
    $('c3PageInput')?.addEventListener('change',()=>setTimeout(()=>scheduleSnapshot(true),700));
    document.addEventListener('keydown',e=>{if(e.key==='ArrowLeft'||e.key==='ArrowRight')setTimeout(()=>scheduleSnapshot(true),700)});
  }else{
    socket?.on('classroom:view-sync-toggle',p=>{syncOn=!!p?.on;if(syncOn)showOverlay();else hideOverlay()});
    socket?.on('classroom:view-snapshot',p=>{if(!p?.image)return;ensureOverlay().img.src=p.image;if(syncOn)showOverlay()});
  }
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>setTimeout(install,900));else setTimeout(install,900);
})();
