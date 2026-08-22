(()=>{
const C=window.CLASSROOM||{},$=id=>document.getElementById(id);
const socket=window._c3Socket||(window.io?window.io():null);
const RTC_CONFIG={iceServers:[{urls:'stun:stun.l.google.com:19302'}]};
let rawStream=null,camOn=false,studentPc=null,chromaOn=false,chromaCanvas=null,chromaCtx=null,chromaStream=null,chromaTimer=0;
const peers=new Map();

function toast(m){const e=$('c3Toast');if(!e)return;e.textContent=m;e.classList.add('show');clearTimeout(e._t);e._t=setTimeout(()=>e.classList.remove('show'),1800)}

function ensurePip(){
  let pip=document.getElementById('c3CameraPip');
  if(!pip){
    pip=document.createElement('div');pip.id='c3CameraPip';pip.className='c3-camera-pip';
    pip.innerHTML='<video autoplay playsinline></video><div class="c3-camera-drag" title="Kéo để di chuyển"><i class="fa-solid fa-up-down-left-right"></i></div><div class="c3-camera-resize" title="Kéo để đổi cỡ"></div>';
    document.getElementById('c3View')?.appendChild(pip);
    makeDraggable(pip);
    makeResizable(pip);
  }
  return pip;
}
function pxToLocal(pip,e){
  const view=document.getElementById('c3View')?.getBoundingClientRect();
  return{x:e.clientX-(view?.left||0),y:e.clientY-(view?.top||0)};
}
function makeDraggable(pip){
  const handle=pip.querySelector('.c3-camera-drag');
  let dragging=false,startX=0,startY=0,startLeft=0,startTop=0;
  handle.addEventListener('pointerdown',e=>{
    dragging=true;
    const r=pip.getBoundingClientRect(),view=document.getElementById('c3View')?.getBoundingClientRect();
    startX=e.clientX;startY=e.clientY;
    startLeft=r.left-(view?.left||0);startTop=r.top-(view?.top||0);
    pip.style.right='auto';pip.style.left=startLeft+'px';pip.style.top=startTop+'px';
    handle.setPointerCapture?.(e.pointerId);
    e.preventDefault();e.stopPropagation();
  });
  handle.addEventListener('pointermove',e=>{
    if(!dragging)return;
    const view=document.getElementById('c3View');
    const vw=view?.clientWidth||9999,vh=view?.clientHeight||9999;
    const r=pip.getBoundingClientRect();
    let nl=startLeft+(e.clientX-startX),nt=startTop+(e.clientY-startY);
    nl=Math.max(0,Math.min(vw-r.width,nl));nt=Math.max(0,Math.min(vh-r.height,nt));
    pip.style.left=nl+'px';pip.style.top=nt+'px';
    e.preventDefault();e.stopPropagation();
  });
  const end=e=>{dragging=false;try{handle.releasePointerCapture?.(e.pointerId)}catch(_){}};
  handle.addEventListener('pointerup',end);
  handle.addEventListener('pointercancel',end);
}
function makeResizable(pip){
  const handle=pip.querySelector('.c3-camera-resize');
  let resizing=false,startX=0,startWidth=0;
  handle.addEventListener('pointerdown',e=>{
    resizing=true;startX=e.clientX;startWidth=pip.getBoundingClientRect().width;
    handle.setPointerCapture?.(e.pointerId);
    e.preventDefault();e.stopPropagation();
  });
  handle.addEventListener('pointermove',e=>{
    if(!resizing)return;
    const view=document.getElementById('c3View');
    const maxW=(view?.clientWidth||900)*0.7;
    let nw=Math.max(120,Math.min(maxW,startWidth+(e.clientX-startX)));
    pip.style.width=nw+'px';
    e.preventDefault();e.stopPropagation();
  });
  const end=e=>{resizing=false;try{handle.releasePointerCapture?.(e.pointerId)}catch(_){}};
  handle.addEventListener('pointerup',end);
  handle.addEventListener('pointercancel',end);
}
function showLocalCamera(stream){const pip=ensurePip();const v=pip.querySelector('video');v.muted=true;v.srcObject=stream;pip.style.display='block'}
function showRemoteCamera(stream){const pip=ensurePip();const v=pip.querySelector('video');v.muted=false;v.srcObject=stream;pip.style.display=pipHiddenByStudent?'none':'block';v.play?.().catch(()=>{toast('Bấm vào màn hình một lần để nghe được âm thanh')});injectHideToggle(pip);injectRestoreBtn()}
function hidePip(){const pip=document.getElementById('c3CameraPip');if(pip){pip.style.display='none';const v=pip.querySelector('video');if(v)v.srcObject=null}removeRestoreBtn();pipHiddenByStudent=false}
let pipHiddenByStudent=false;
function injectHideToggle(pip){
  if(C.isTeacher||pip.querySelector('.c3-camera-hide'))return;
  const b=document.createElement('button');
  b.className='c3-camera-hide';b.title='Ẩn camera giáo viên';b.innerHTML='<i class="fa-solid fa-eye-slash"></i>';
  b.onclick=e=>{
    e.preventDefault();e.stopPropagation();
    pipHiddenByStudent=true;pip.style.display='none';
    injectRestoreBtn();
  };
  pip.appendChild(b);
}
function injectRestoreBtn(){
  if(C.isTeacher||!pipHiddenByStudent)return;
  let r=$('c3CameraRestore');
  if(!r){
    r=document.createElement('button');r.id='c3CameraRestore';r.className='c3-camera-restore';r.innerHTML='📷 Hiện camera giáo viên';
    r.onclick=()=>{pipHiddenByStudent=false;const pip=$('c3CameraPip');if(pip)pip.style.display='block';removeRestoreBtn()};
    document.getElementById('c3View')?.appendChild(r);
  }
  r.style.display='flex';
}
function removeRestoreBtn(){const r=$('c3CameraRestore');if(r)r.style.display='none'}

function outgoingStream(){
  const tracks=[];
  if(chromaOn&&chromaStream)tracks.push(...chromaStream.getVideoTracks());
  else if(rawStream)tracks.push(...rawStream.getVideoTracks());
  if(rawStream)tracks.push(...rawStream.getAudioTracks());
  return new MediaStream(tracks);
}
function replaceOutgoingTracks(){
  const stream=outgoingStream();
  for(const [,pc] of peers){
    const vSender=pc.getSenders().find(s=>s.track&&s.track.kind==='video');
    const vTrack=stream.getVideoTracks()[0];
    if(vSender&&vTrack)vSender.replaceTrack(vTrack).catch(()=>{});
  }
}
function chromaKeyLoop(){
  if(!chromaOn||!rawStream)return;
  const pip=$('c3CameraPip'),video=pip?.querySelector('video');
  if(video&&video.videoWidth){
    chromaCanvas.width=video.videoWidth;chromaCanvas.height=video.videoHeight;
    chromaCtx.drawImage(video,0,0,chromaCanvas.width,chromaCanvas.height);
    const frame=chromaCtx.getImageData(0,0,chromaCanvas.width,chromaCanvas.height);
    const d=frame.data;
    for(let i=0;i<d.length;i+=4){
      const r=d[i],g=d[i+1],b=d[i+2];
      if(g>85&&g>r*1.3&&g>b*1.15){d[i]=17;d[i+1]=24;d[i+2]=39}
    }
    chromaCtx.putImageData(frame,0,0);
  }
  chromaTimer=setTimeout(chromaKeyLoop,1000/20);
}
function startChroma(){
  if(chromaOn)return;
  chromaCanvas=document.createElement('canvas');chromaCanvas.width=320;chromaCanvas.height=240;
  chromaCtx=chromaCanvas.getContext('2d',{willReadFrequently:true});
  chromaOn=true;
  chromaStream=chromaCanvas.captureStream(20);
  chromaKeyLoop();
  const pip=$('c3CameraPip');const v=pip?.querySelector('video');if(v)v.style.display='none';
  let preview=$('c3ChromaPreview');
  if(!preview){preview=document.createElement('canvas');preview.id='c3ChromaPreview';preview.className='c3-chroma-preview';pip?.insertBefore(preview,pip.querySelector('.c3-camera-drag'))}
  preview.style.display='block';
  const drawPreview=()=>{if(!chromaOn)return;const pctx=preview.getContext('2d');preview.width=chromaCanvas.width;preview.height=chromaCanvas.height;pctx.drawImage(chromaCanvas,0,0);requestAnimationFrame(drawPreview)};
  drawPreview();
  replaceOutgoingTracks();
  const btn=$('c3ChromaBtn');if(btn)btn.classList.add('active');
  toast('Đã bật xóa phông xanh — nền xanh sẽ được thay bằng màu tối trơn');
}
function stopChroma(){
  chromaOn=false;clearTimeout(chromaTimer);
  chromaStream?.getTracks().forEach(t=>t.stop());chromaStream=null;
  const pip=$('c3CameraPip');const v=pip?.querySelector('video');if(v)v.style.display='block';
  const preview=$('c3ChromaPreview');if(preview)preview.style.display='none';
  replaceOutgoingTracks();
  const btn=$('c3ChromaBtn');if(btn)btn.classList.remove('active');
  toast('Đã tắt xóa phông xanh');
}

function injectTeacherButton(){
  if(!C.isTeacher)return;
  const bar=document.querySelector('.c3-stagebar');
  if(!bar||$('c3CameraBtn'))return;
  const b=document.createElement('button');
  b.id='c3CameraBtn';b.className='c3-btn c3-camera-btn';b.innerHTML='📷 Camera';
  b.onclick=async()=>{
    if(camOn){stopCamera();return}
    try{
      rawStream=await navigator.mediaDevices.getUserMedia({video:{width:320,height:240},audio:{echoCancellation:true,noiseSuppression:true}});
    }catch(err){toast('Không mở được camera — kiểm tra quyền truy cập trình duyệt');return}
    camOn=true;
    b.innerHTML='⏹ Tắt camera';b.classList.add('active');
    showLocalCamera(rawStream);
    injectChromaButton();
    socket?.emit('classroom:camera-on');
    toast('Đã bật camera cho cả lớp — kéo góc khung để đổi cỡ, kéo icon để di chuyển');
  };
  bar.appendChild(b);
}
function injectChromaButton(){
  const bar=document.querySelector('.c3-stagebar');
  if(!bar||$('c3ChromaBtn'))return;
  const b=document.createElement('button');
  b.id='c3ChromaBtn';b.className='c3-btn c3-chroma-btn';b.innerHTML='🟩 Xóa phông xanh';
  b.onclick=()=>{chromaOn?stopChroma():startChroma()};
  bar.appendChild(b);
}
function removeChromaButton(){const b=$('c3ChromaBtn');if(b)b.remove()}
function stopCamera(){
  camOn=false;
  if(chromaOn)stopChroma();
  removeChromaButton();
  const b=$('c3CameraBtn');if(b){b.innerHTML='📷 Camera';b.classList.remove('active')}
  rawStream?.getTracks().forEach(t=>t.stop());rawStream=null;
  for(const [,pc] of peers){try{pc.close()}catch(_){}}
  peers.clear();
  hidePip();
  socket?.emit('classroom:camera-off');
  toast('Đã tắt camera');
}
async function createPeerForStudent(studentId){
  if(!rawStream||!studentId)return;
  if(peers.has(studentId)){try{peers.get(studentId).close()}catch(_){}}
  const pc=new RTCPeerConnection(RTC_CONFIG);
  peers.set(studentId,pc);
  outgoingStream().getTracks().forEach(t=>pc.addTrack(t,rawStream));
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

