(()=>{
const C=window.CLASSROOM||{},$=id=>document.getElementById(id);
const socket=window._c3Socket||(window.io?window.io():null);
const RTC_CONFIG={iceServers:[{urls:'stun:stun.l.google.com:19302'}]};
let localStream=null,camOn=false,studentPc=null;
const peers=new Map();

function toast(m){const e=$('c3Toast');if(!e)return;e.textContent=m;e.classList.add('show');clearTimeout(e._t);e._t=setTimeout(()=>e.classList.remove('show'),1800)}

function ensurePip(){
  let pip=document.getElementById('c3CameraPip');
  if(!pip){
    pip=document.createElement('div');pip.id='c3CameraPip';pip.className='c3-camera-pip';
    pip.innerHTML='<video autoplay playsinline></video><div class="c3-camera-drag" title="Kéo để di chuyển"><i class="fa-solid fa-up-down-left-right"></i></div>';
    document.getElementById('c3View')?.appendChild(pip);
    makeDraggable(pip);
  }
  return pip;
}
function makeDraggable(pip){
  const handle=pip.querySelector('.c3-camera-drag');
  let dragging=false,startX=0,startY=0,startLeft=0,startTop=0;
  const start=e=>{
    dragging=true;
    const r=pip.getBoundingClientRect(),view=document.getElementById('c3View')?.getBoundingClientRect();
    startX=e.clientX;startY=e.clientY;
    startLeft=r.left-(view?.left||0);startTop=r.top-(view?.top||0);
    pip.style.right='auto';pip.style.left=startLeft+'px';pip.style.top=startTop+'px';
    pip.setPointerCapture?.(e.pointerId);
    e.preventDefault();e.stopPropagation();
  };
  const move=e=>{
    if(!dragging)return;
    const view=document.getElementById('c3View');
    const vw=view?.clientWidth||9999,vh=view?.clientHeight||9999;
    const r=pip.getBoundingClientRect();
    let nl=startLeft+(e.clientX-startX),nt=startTop+(e.clientY-startY);
    nl=Math.max(0,Math.min(vw-r.width,nl));nt=Math.max(0,Math.min(vh-r.height,nt));
    pip.style.left=nl+'px';pip.style.top=nt+'px';
    e.preventDefault();e.stopPropagation();
  };
  const end=e=>{dragging=false;try{pip.releasePointerCapture?.(e.pointerId)}catch(_){}};
  handle.addEventListener('pointerdown',start);
  handle.addEventListener('pointermove',move);
  handle.addEventListener('pointerup',end);
  handle.addEventListener('pointercancel',end);
}
function showLocalCamera(stream){const pip=ensurePip();const v=pip.querySelector('video');v.muted=true;v.srcObject=stream;pip.style.display='block'}
function showRemoteCamera(stream){const pip=ensurePip();const v=pip.querySelector('video');v.muted=false;v.srcObject=stream;pip.style.display='block';v.play?.().catch(()=>{toast('Bấm vào màn hình một lần để nghe được âm thanh')})}
function hidePip(){const pip=document.getElementById('c3CameraPip');if(pip){pip.style.display='none';const v=pip.querySelector('video');if(v)v.srcObject=null}}

function injectTeacherButton(){
  if(!C.isTeacher)return;
  const bar=document.querySelector('.c3-stagebar');
  if(!bar||$('c3CameraBtn'))return;
  const b=document.createElement('button');
  b.id='c3CameraBtn';b.className='c3-btn c3-camera-btn';b.innerHTML='📷 Camera';
  b.onclick=async()=>{
    if(camOn){stopCamera();return}
    try{
      localStream=await navigator.mediaDevices.getUserMedia({video:{width:320,height:240},audio:{echoCancellation:true,noiseSuppression:true}});
    }catch(err){toast('Không mở được camera — kiểm tra quyền truy cập trình duyệt');return}
    camOn=true;
    b.innerHTML='⏹ Tắt camera';b.classList.add('active');
    showLocalCamera(localStream);
    socket?.emit('classroom:camera-on');
    toast('Đã bật camera cho cả lớp');
  };
  bar.appendChild(b);
}
function stopCamera(){
  camOn=false;
  const b=$('c3CameraBtn');if(b){b.innerHTML='📷 Camera';b.classList.remove('active')}
  localStream?.getTracks().forEach(t=>t.stop());localStream=null;
  for(const [,pc] of peers){try{pc.close()}catch(_){}}
  peers.clear();
  hidePip();
  socket?.emit('classroom:camera-off');
  toast('Đã tắt camera');
}
async function createPeerForStudent(studentId){
  if(!localStream||!studentId)return;
  if(peers.has(studentId)){try{peers.get(studentId).close()}catch(_){}}
  const pc=new RTCPeerConnection(RTC_CONFIG);
  peers.set(studentId,pc);
  localStream.getTracks().forEach(t=>pc.addTrack(t,localStream));
  pc.onicecandidate=e=>{if(e.candidate)socket?.emit('webrtc:ice',{to:studentId,candidate:e.candidate,kind:'camera'})};
  try{const offer=await pc.createOffer();await pc.setLocalDescription(offer);socket?.emit('webrtc:offer',{to:studentId,offer,kind:'camera'})}catch(err){console.error(err)}
}
async function handleOfferAsStudent({from,offer,kind}){
  if(C.isTeacher||!from||kind!=='camera')return;
  if(studentPc){try{studentPc.close()}catch(_){}}
  studentPc=new RTCPeerConnection(RTC_CONFIG);
  studentPc.onicecandidate=e=>{if(e.candidate)socket?.emit('webrtc:ice',{to:from,candidate:e.candidate,kind:'camera'})};
  studentPc.ontrack=e=>showRemoteCamera(e.streams[0]);
  try{
    await studentPc.setRemoteDescription(new RTCSessionDescription(offer));
    const answer=await studentPc.createAnswer();
    await studentPc.setLocalDescription(answer);
    socket?.emit('webrtc:answer',{to:from,answer,kind:'camera'});
  }catch(err){console.error(err)}
}

function install(){
  injectTeacherButton();
  if(C.isTeacher){
    socket?.on('classroom:camera-request',p=>{if(camOn&&p?.id)createPeerForStudent(p.id)});
    socket?.on('classroom:peer-left',p=>{if(p?.id&&peers.has(p.id)){try{peers.get(p.id).close()}catch(_){}peers.delete(p.id)}});
  }else{
    socket?.on('classroom:camera-on',()=>{socket?.emit('classroom:camera-request')});
    socket?.on('classroom:camera-off',()=>{if(studentPc){try{studentPc.close()}catch(_){}studentPc=null}hidePip()});
    socket?.on('webrtc:offer',handleOfferAsStudent);
  }
  socket?.on('webrtc:answer',async p=>{if(p?.kind!=='camera')return;const pc=peers.get(p?.from);if(pc&&p?.answer)try{await pc.setRemoteDescription(new RTCSessionDescription(p.answer))}catch(err){console.error(err)}});
  socket?.on('webrtc:ice',async p=>{if(p?.kind!=='camera'||!p?.candidate)return;if(C.isTeacher){const pc=peers.get(p.from);if(pc)try{await pc.addIceCandidate(p.candidate)}catch(_){}}else if(studentPc)try{await studentPc.addIceCandidate(p.candidate)}catch(_){}});
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>setTimeout(install,900));else setTimeout(install,900);
})();
