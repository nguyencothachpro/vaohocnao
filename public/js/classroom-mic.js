(()=>{
const C=window.CLASSROOM||{},$=id=>document.getElementById(id);
const socket=window._c3Socket||(window.io?window.io():null);
const RTC_CONFIG={iceServers:[{urls:'stun:stun.l.google.com:19302'}]};
let micStream=null,micOn=false,amISpeaking=false,raiseCooldown=false;
const outgoingPeers=new Map();
const incomingPeers=new Map();
const audioEls=new Map();
const speakers=new Map();

function toast(m){const e=$('c3Toast');if(!e)return;e.textContent=m;e.classList.add('show');clearTimeout(e._t);e._t=setTimeout(()=>e.classList.remove('show'),1800)}

function ensureSpeakBadge(){
  let b=$('c3SpeakingBadge');
  if(!b){b=document.createElement('div');b.id='c3SpeakingBadge';b.className='c3-speaking-badge';document.getElementById('c3View')?.appendChild(b)}
  return b;
}
function showSpeaking(text){const b=ensureSpeakBadge();b.textContent='🎤 '+text;b.style.display='flex'}
function hideSpeaking(){const b=$('c3SpeakingBadge');if(b)b.style.display='none'}

function ensureStopButton(){
  let b=$('c3StopSpeakBtn');
  if(!b){
    b=document.createElement('button');b.id='c3StopSpeakBtn';b.className='c3-stop-speak-btn';b.innerHTML='⏹ Ngừng nói';
    b.onclick=()=>stopSpeaking(false);
    document.getElementById('c3View')?.appendChild(b);
  }
  b.style.display='block';
}
function hideStopButton(){const b=$('c3StopSpeakBtn');if(b)b.style.display='none'}

function injectRaiseHandButton(){
  if(C.isTeacher)return;
  const sidebar=document.querySelector('.c3-tools');
  if(!sidebar||$('c3RaiseHandBtn'))return;
  const ref=$('c3RequestWrite');
  const b=document.createElement('button');
  b.id='c3RaiseHandBtn';b.className='c3-tool';b.innerHTML='<i class="fa-solid fa-hand"></i>Giơ tay xin nói';
  b.onclick=()=>{
    if(raiseCooldown)return;
    socket?.emit('classroom:raise-hand');
    toast('Đã gửi yêu cầu xin nói tới giáo viên');
    raiseCooldown=true;b.disabled=true;b.style.opacity='.5';
    setTimeout(()=>{raiseCooldown=false;b.disabled=false;b.style.opacity='1'},15000);
  };
  if(ref)ref.insertAdjacentElement('afterend',b);else sidebar.appendChild(b);
}

async function startSpeaking(peerIds){
  amISpeaking=true;
  showSpeaking('Bạn đang nói — cả lớp nghe được');
  ensureStopButton();
  try{micStream=await navigator.mediaDevices.getUserMedia({audio:{echoCancellation:true,noiseSuppression:true,autoGainControl:true,channelCount:1,sampleRate:48000,sampleSize:16}})}
  catch(err){
    toast('Không mở được micro — kiểm tra quyền truy cập trình duyệt');
    amISpeaking=false;hideSpeaking();hideStopButton();
    socket?.emit('classroom:mic-stop');
    return;
  }
  micOn=true;
  for(const id of peerIds||[])connectOut(id);
}
async function boostAudioBitrate(sender){
  try{
    const params=sender.getParameters();
    if(!params.encodings||!params.encodings.length)params.encodings=[{}];
    params.encodings[0].maxBitrate=128000;
    await sender.setParameters(params);
  }catch(err){console.error(err)}
}
async function connectOut(peerId){
  if(!micStream||!peerId)return;
  if(outgoingPeers.has(peerId)){try{outgoingPeers.get(peerId).close()}catch(_){}}
  const pc=new RTCPeerConnection(RTC_CONFIG);
  outgoingPeers.set(peerId,pc);
  micStream.getTracks().forEach(t=>{const sender=pc.addTrack(t,micStream);if(t.kind==='audio')boostAudioBitrate(sender)});
  pc.onicecandidate=e=>{if(e.candidate)socket?.emit('webrtc:ice',{to:peerId,candidate:e.candidate,kind:'mic'})};
  try{
    const offer=await pc.createOffer();
    await pc.setLocalDescription(offer);
    socket?.emit('webrtc:offer',{to:peerId,offer,kind:'mic'});
  }catch(err){console.error(err)}
}
function stopSpeaking(silent){
  micOn=false;amISpeaking=false;
  micStream?.getTracks().forEach(t=>t.stop());micStream=null;
  for(const [,pc] of outgoingPeers){try{pc.close()}catch(_){}}
  outgoingPeers.clear();
  hideSpeaking();hideStopButton();
  if(!silent)socket?.emit('classroom:mic-stop');
}

async function handleIncomingOffer({from,offer,kind}){
  if(kind!=='mic'||!from)return;
  if(incomingPeers.has(from)){try{incomingPeers.get(from).close()}catch(_){}}
  const pc=new RTCPeerConnection(RTC_CONFIG);
  incomingPeers.set(from,pc);
  pc.onicecandidate=e=>{if(e.candidate)socket?.emit('webrtc:ice',{to:from,candidate:e.candidate,kind:'mic'})};
  pc.ontrack=e=>{
    let audio=audioEls.get(from);
    if(!audio){audio=document.createElement('audio');audio.autoplay=true;document.body.appendChild(audio);audioEls.set(from,audio)}
    audio.srcObject=e.streams[0];
    audio.play?.().catch(()=>toast('Bấm vào màn hình một lần để nghe được âm thanh'));
  };
  try{
    await pc.setRemoteDescription(new RTCSessionDescription(offer));
    const answer=await pc.createAnswer();
    await pc.setLocalDescription(answer);
    socket?.emit('webrtc:answer',{to:from,answer,kind:'mic'});
  }catch(err){console.error(err)}
}
function cleanupPeer(peerId){
  const out=outgoingPeers.get(peerId);if(out){try{out.close()}catch(_){}outgoingPeers.delete(peerId)}
  const inc=incomingPeers.get(peerId);if(inc){try{inc.close()}catch(_){}incomingPeers.delete(peerId)}
  const audio=audioEls.get(peerId);if(audio){audio.remove();audioEls.delete(peerId)}
}

function addMicRequest(r){
  if(!C.isTeacher)return;
  const box=$('c3Requests');if(!box)return;
  const el=document.createElement('div');el.className='c3-request';
  const t=document.createElement('span');t.textContent='🎤 '+(r.user||'Học viên')+' muốn nói';
  const actions=document.createElement('span');
  const y=document.createElement('button');y.className='grant';y.textContent='Cho nói';
  y.onclick=()=>{socket?.emit('classroom:mic-grant',{userId:r.userId,allow:true});el.remove()};
  const n=document.createElement('button');n.className='deny';n.textContent='Từ chối';
  n.onclick=()=>{socket?.emit('classroom:mic-grant',{userId:r.userId,allow:false});el.remove()};
  actions.append(y,n);el.append(t,actions);box.prepend(el);
  document.querySelector('.c3-right')?.classList.add('open');
  document.querySelectorAll('.c3-panel').forEach(x=>x.classList.toggle('active',x.id==='panel-requests'));
  document.querySelectorAll('.c3-tab').forEach(x=>x.classList.remove('active'));
  toast('🎤 '+(r.user||'Học viên')+' đang giơ tay xin nói');
}

function ensureSpeakerPanel(){
  let box=$('c3SpeakerPanel');
  if(!box){
    box=document.createElement('div');box.id='c3SpeakerPanel';box.className='c3-speaker-panel';
    document.getElementById('c3View')?.appendChild(box);
  }
  return box;
}
function renderSpeakerPanel(){
  const box=$('c3SpeakerPanel');
  if(!box)return;
  if(!speakers.size){box.style.display='none';box.innerHTML='';return}
  box.style.display='flex';
  box.innerHTML='';
  speakers.forEach((user,userId)=>{
    const row=document.createElement('div');row.className='c3-speaker-row';
    const label=document.createElement('span');label.textContent='🎤 '+user;
    const mute=document.createElement('button');mute.textContent='🔇 Tắt mic';
    mute.onclick=()=>{socket?.emit('classroom:mic-force-stop',{userId})};
    row.append(label,mute);box.appendChild(row);
  });
}

function install(){
  injectRaiseHandButton();
  socket?.on('classroom:raise-hand',addMicRequest);
  socket?.on('classroom:mic-status',p=>{
    if(p?.allow)startSpeaking(p.peers||[]);
    else{toast('Giáo viên đã từ chối/thu hồi quyền nói');stopSpeaking(true)}
  });
  socket?.on('classroom:mic-speaking',p=>{
    if(!p)return;
    if(C.isTeacher){
      if(p.speaking)speakers.set(p.userId,p.user||'Học viên');else speakers.delete(p.userId);
      ensureSpeakerPanel();renderSpeakerPanel();
    }
    if(amISpeaking)return;
    if(p.speaking)showSpeaking((p.user||'Một học viên')+' đang nói');else hideSpeaking();
  });
  socket?.on('webrtc:offer',handleIncomingOffer);
  socket?.on('webrtc:answer',async p=>{
    if(p?.kind!=='mic')return;
    const pc=outgoingPeers.get(p.from);
    if(pc&&p.answer)try{await pc.setRemoteDescription(new RTCSessionDescription(p.answer))}catch(err){console.error(err)}
  });
  socket?.on('webrtc:ice',async p=>{
    if(p?.kind!=='mic'||!p.candidate)return;
    const out=outgoingPeers.get(p.from);if(out){try{await out.addIceCandidate(p.candidate)}catch(_){}return}
    const inc=incomingPeers.get(p.from);if(inc)try{await inc.addIceCandidate(p.candidate)}catch(_){}
  });
  socket?.on('classroom:peer-left',p=>{if(p?.id)cleanupPeer(p.id)});
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>setTimeout(install,900));else setTimeout(install,900);
})();

