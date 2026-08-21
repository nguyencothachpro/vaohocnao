(()=>{
const C=window.CLASSROOM||{},$=id=>document.getElementById(id);
const socket=window._c3Socket||(window.io?window.io():null);
const RTC_CONFIG={iceServers:[{urls:'stun:stun.l.google.com:19302'}]};
let mirrorCanvas=null,mirrorCtx=null,mirrorStream=null,rafId=0,broadcasting=false,heartbeat=0;
const peers=new Map();
let studentPc=null,liveVideoEl=null;

function toast(m){const e=$('c3Toast');if(!e)return;e.textContent=m;e.classList.add('show');clearTimeout(e._t);e._t=setTimeout(()=>e.classList.remove('show'),1800)}

function injectUI(){
  const bar=document.querySelector('.c3-stagebar');
  if(!bar||!C.isTeacher||$('c3BroadcastBtn'))return;
  const b=document.createElement('button');
  b.id='c3BroadcastBtn';b.className='c3-btn c3-broadcast-btn';b.innerHTML='🖥️ Trình chiếu trực tiếp';
  b.onclick=()=>{broadcasting?stopBroadcast():startBroadcast()};
  bar.appendChild(b);
}

function drawFrame(){
  if(!broadcasting||!mirrorCtx)return;
  const view=$('c3View');
  if(view){
    const vw=view.clientWidth||1,vh=view.clientHeight||1;
    const targetW=1280,targetH=Math.max(360,Math.round(targetW*vh/vw))||720;
    if(mirrorCanvas.width!==targetW||mirrorCanvas.height!==targetH){mirrorCanvas.width=targetW;mirrorCanvas.height=targetH}
    const scaleX=mirrorCanvas.width/vw,scaleY=mirrorCanvas.height/vh;
    mirrorCtx.fillStyle='#eef2f7';mirrorCtx.fillRect(0,0,mirrorCanvas.width,mirrorCanvas.height);
    const viewRect=view.getBoundingClientRect();
    document.querySelectorAll('#c3Book .c3-book-page').forEach(pageEl=>{
      const r=pageEl.getBoundingClientRect();
      if(r.right<viewRect.left||r.left>viewRect.right||r.bottom<viewRect.top||r.top>viewRect.bottom)return;
      const dx=(r.left-viewRect.left)*scaleX,dy=(r.top-viewRect.top)*scaleY,dw=r.width*scaleX,dh=r.height*scaleY;
      const pdfCanvas=pageEl.querySelector('canvas.pdf-page');
      if(pdfCanvas){try{mirrorCtx.drawImage(pdfCanvas,dx,dy,dw,dh)}catch(_){}}
      else{mirrorCtx.fillStyle='#fff';mirrorCtx.fillRect(dx,dy,dw,dh)}
      const inkCanvas=pageEl.querySelector('canvas.ink');
      if(inkCanvas){try{mirrorCtx.drawImage(inkCanvas,dx,dy,dw,dh)}catch(_){}}
      const dot=pageEl.querySelector('.c3-laser-dot.ping');
      if(dot){const dr=dot.getBoundingClientRect();const cx=(dr.left+dr.width/2-viewRect.left)*scaleX,cy=(dr.top+dr.height/2-viewRect.top)*scaleY;mirrorCtx.beginPath();mirrorCtx.fillStyle='rgba(239,68,68,.55)';mirrorCtx.arc(cx,cy,14*scaleX,0,Math.PI*2);mirrorCtx.fill()}
    });
  }
  rafId=requestAnimationFrame(drawFrame);
}

function startBroadcast(){
  if(!C.isTeacher||broadcasting)return;
  mirrorCanvas=document.createElement('canvas');mirrorCanvas.width=1280;mirrorCanvas.height=720;
  mirrorCtx=mirrorCanvas.getContext('2d');
  broadcasting=true;drawFrame();
  mirrorStream=mirrorCanvas.captureStream(12);
  socket?.emit('classroom:teacher-stream');
  heartbeat=setInterval(()=>{if(broadcasting)socket?.emit('classroom:teacher-stream')},5000);
  const btn=$('c3BroadcastBtn');if(btn){btn.textContent='⏹ Dừng trình chiếu';btn.classList.add('active')}
  toast('Đã bắt đầu trình chiếu trực tiếp cho cả lớp');
}

function stopBroadcast(){
  broadcasting=false;cancelAnimationFrame(rafId);clearInterval(heartbeat);
  for(const [,pc] of peers){try{pc.close()}catch(_){}}
  peers.clear();
  mirrorStream?.getTracks().forEach(t=>t.stop());mirrorStream=null;
  socket?.emit('classroom:teacher-stream-stop');
  const btn=$('c3BroadcastBtn');if(btn){btn.textContent='🖥️ Trình chiếu trực tiếp';btn.classList.remove('active')}
  toast('Đã dừng trình chiếu trực tiếp');
}

async function createPeerForStudent(studentId){
  if(!mirrorStream)return;
  if(peers.has(studentId)){try{peers.get(studentId).close()}catch(_){}}
  const pc=new RTCPeerConnection(RTC_CONFIG);
  peers.set(studentId,pc);
  mirrorStream.getTracks().forEach(t=>pc.addTrack(t,mirrorStream));
  pc.onicecandidate=e=>{if(e.candidate)socket?.emit('webrtc:ice',{to:studentId,candidate:e.candidate})};
  try{const offer=await pc.createOffer();await pc.setLocalDescription(offer);socket?.emit('webrtc:offer',{to:studentId,offer})}catch(err){console.error(err)}
}

function ensureBanner(){
  let b=$('c3LiveBanner');
  if(!b){b=document.createElement('div');b.id='c3LiveBanner';b.className='c3-live-banner';b.innerHTML='🔴 Giáo viên đang trình chiếu trực tiếp';$('c3View')?.appendChild(b)}
  return b;
}
function showLiveVideo(stream){
  const view=$('c3View');if(!view)return;
  if(!liveVideoEl){liveVideoEl=document.createElement('video');liveVideoEl.id='c3LiveVideo';liveVideoEl.autoplay=true;liveVideoEl.playsInline=true;liveVideoEl.muted=true;liveVideoEl.className='c3-live-video';view.appendChild(liveVideoEl)}
  liveVideoEl.srcObject=stream;liveVideoEl.style.display='block';
  ensureBanner().style.display='flex';
}
function hideLiveVideo(){
  if(liveVideoEl){liveVideoEl.style.display='none';liveVideoEl.srcObject=null}
  const b=$('c3LiveBanner');if(b)b.style.display='none';
}

async function handleOffer({from,offer}){
  if(C.isTeacher||!from)return;
  if(studentPc){try{studentPc.close()}catch(_){}}
  studentPc=new RTCPeerConnection(RTC_CONFIG);
  studentPc.onicecandidate=e=>{if(e.candidate)socket?.emit('webrtc:ice',{to:from,candidate:e.candidate})};
  studentPc.ontrack=e=>showLiveVideo(e.streams[0]);
  try{
    await studentPc.setRemoteDescription(new RTCSessionDescription(offer));
    const answer=await studentPc.createAnswer();
    await studentPc.setLocalDescription(answer);
    socket?.emit('webrtc:answer',{to:from,answer});
  }catch(err){console.error(err)}
}

function install(){
  injectUI();
  socket?.on('classroom:teacher-stream',()=>{if(!C.isTeacher)socket?.emit('classroom:request-stream')});
  socket?.on('classroom:teacher-stream-stop',()=>{if(!C.isTeacher){hideLiveVideo();if(studentPc){try{studentPc.close()}catch(_){}studentPc=null}}});
  socket?.on('classroom:request-stream',p=>{if(C.isTeacher&&broadcasting&&p?.id)createPeerForStudent(p.id)});
  socket?.on('webrtc:offer',handleOffer);
  socket?.on('webrtc:answer',async p=>{const pc=peers.get(p?.from);if(pc&&p?.answer)try{await pc.setRemoteDescription(new RTCSessionDescription(p.answer))}catch(err){console.error(err)}});
  socket?.on('webrtc:ice',async p=>{if(!p?.candidate)return;if(C.isTeacher){const pc=peers.get(p.from);if(pc)try{await pc.addIceCandidate(p.candidate)}catch(_){}}else if(studentPc)try{await studentPc.addIceCandidate(p.candidate)}catch(_){}});
  socket?.on('classroom:peer-left',p=>{if(C.isTeacher&&p?.id&&peers.has(p.id)){try{peers.get(p.id).close()}catch(_){}peers.delete(p.id)}});
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>setTimeout(install,900));else setTimeout(install,900);
})();
