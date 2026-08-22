(()=>{
'use strict';
const C=window.CLASSROOM||{};
const $=id=>document.getElementById(id);
const prefsKey='c3-media-preferences-v1';
let prefs={audioInputId:'',videoInputId:'',audioOutputId:''};
try{prefs={...prefs,...JSON.parse(localStorage.getItem(prefsKey)||'{}')}}catch(_){ }
window.C3_MEDIA_PREFERENCES=prefs;
const toast=m=>{const e=$('c3Toast');if(!e)return;e.textContent=m;e.classList.add('show');clearTimeout(e._t);e._t=setTimeout(()=>e.classList.remove('show'),2200)};
function savePrefs(){window.C3_MEDIA_PREFERENCES=prefs;try{localStorage.setItem(prefsKey,JSON.stringify(prefs))}catch(_){} }
if(navigator.mediaDevices?.getUserMedia&&!navigator.mediaDevices.getUserMedia.__c3MediaWrapped){
  const original=navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
  const wrapped=constraints=>{
    const c=constraints?structuredClone(constraints):constraints;
    if(!c)return original(c);
    if(c.audio){
      if(typeof c.audio==='object'){
        c.audio={...c.audio,echoCancellation:true,noiseSuppression:true,autoGainControl:true,channelCount:1,sampleRate:48000,sampleSize:16};
        if(prefs.audioInputId)c.audio.deviceId={exact:prefs.audioInputId};
      }else if(prefs.audioInputId)c.audio={deviceId:{exact:prefs.audioInputId},echoCancellation:true,noiseSuppression:true,autoGainControl:true,channelCount:1,sampleRate:48000};
    }
    if(c.video){
      if(typeof c.video==='object'){
        c.video={...c.video,width:{ideal:1280,max:1920},height:{ideal:720,max:1080},frameRate:{ideal:30,max:30}};
        if(prefs.videoInputId)c.video.deviceId={exact:prefs.videoInputId};
      }else if(prefs.videoInputId)c.video={deviceId:{exact:prefs.videoInputId},width:{ideal:1280,max:1920},height:{ideal:720,max:1080},frameRate:{ideal:30,max:30}};
    }
    return original(c);
  };
  wrapped.__c3MediaWrapped=true;navigator.mediaDevices.getUserMedia=wrapped;
}
if(window.RTCPeerConnection&&!window.RTCPeerConnection.__c3MediaWrapped){
  const Native=window.RTCPeerConnection;
  class PatchedRTCPeerConnection extends Native{
    constructor(config={}){
      const extra=Array.isArray(window.C3_ICE_SERVERS)?window.C3_ICE_SERVERS:[];
      const base=Array.isArray(config.iceServers)?config.iceServers:[];
      super({...config,iceServers:[...base,...extra]});
      this.__c3IceQueue=[];
      this.addEventListener('connectionstatechange',()=>{if(this.connectionState==='failed')toast('Kết nối âm thanh/video thất bại — mạng có thể cần TURN relay')});
    }
  }
  PatchedRTCPeerConnection.__c3MediaWrapped=true;
  const nativeAdd=Native.prototype.addIceCandidate;
  const nativeSetRemote=Native.prototype.setRemoteDescription;
  PatchedRTCPeerConnection.prototype.addIceCandidate=async function(candidate){
    if(!this.remoteDescription){this.__c3IceQueue.push(candidate);return;}
    return nativeAdd.call(this,candidate);
  };
  PatchedRTCPeerConnection.prototype.setRemoteDescription=async function(desc){
    const result=await nativeSetRemote.call(this,desc);
    const queue=this.__c3IceQueue.splice(0);
    for(const candidate of queue){try{await nativeAdd.call(this,candidate)}catch(err){console.warn('queued ICE candidate',err)}}
    return result;
  };
  window.RTCPeerConnection=PatchedRTCPeerConnection;
}
function mediaEls(){return [...document.querySelectorAll('audio,video')].filter(e=>e.id!=='c3CameraPreview');}
function isLocalPreview(el){return !!el.closest('#c3CameraPip');}
async function applyOutput(el){if(isLocalPreview(el)||!prefs.audioOutputId||typeof el.setSinkId!=='function')return;try{await el.setSinkId(prefs.audioOutputId)}catch(err){console.warn('setSinkId',err)} }
async function unlockAllAudio(){
  let played=0;
  for(const el of mediaEls()){
    if(!el.srcObject||isLocalPreview(el))continue;
    el.autoplay=true;el.playsInline=true;el.muted=false;await applyOutput(el);
    try{await el.play();played++}catch(_){}
  }
  const b=$('c3MediaUnlock');if(b)b.classList.remove('show');
  toast(played?'Đã bật âm thanh lớp học':'Chưa có luồng âm thanh để phát');
}
function monitorMedia(){
  for(const el of mediaEls()){
    if(el.dataset.c3MediaObserved)return;
    el.dataset.c3MediaObserved='1';
    el.addEventListener('loadedmetadata',()=>{applyOutput(el);if(!isLocalPreview(el)&&!el.muted)el.play?.().catch(()=>showUnlock())});
    el.addEventListener('play',()=>applyOutput(el));
  }
}
function showUnlock(){const b=$('c3MediaUnlock');if(b)b.classList.add('show')}
async function enumerate(){
  if(!navigator.mediaDevices?.enumerateDevices){toast('Trình duyệt không hỗ trợ chọn thiết bị');return}
  try{const devices=await navigator.mediaDevices.enumerateDevices();fill('c3MicSelect',devices.filter(d=>d.kind==='audioinput'),'Chọn micro');fill('c3CameraSelect',devices.filter(d=>d.kind==='videoinput'),'Chọn camera');fill('c3OutputSelect',devices.filter(d=>d.kind==='audiooutput'),'Âm thanh mặc định')}
  catch(err){console.error(err);toast('Không đọc được danh sách thiết bị')}
}
function fill(id,devices,defaultLabel){const s=$(id);if(!s)return;const old=s.value;s.innerHTML='';const first=document.createElement('option');first.value='';first.textContent=defaultLabel;s.appendChild(first);devices.forEach((d,i)=>{const o=document.createElement('option');o.value=d.deviceId;o.textContent=d.label||((d.kind==='audioinput'?'Micro ':d.kind==='videoinput'?'Camera ':'Thiết bị ')+(i+1));s.appendChild(o)});const want=id==='c3MicSelect'?prefs.audioInputId:id==='c3CameraSelect'?prefs.videoInputId:prefs.audioOutputId;if([...s.options].some(o=>o.value===old))s.value=old;else if([...s.options].some(o=>o.value===want))s.value=want}
async function requestLabels(){try{const s=await navigator.mediaDevices.getUserMedia({audio:true,video:true});s.getTracks().forEach(t=>t.stop());await enumerate();toast('Đã tải danh sách micro/camera')}catch(err){console.error(err);await enumerate();toast('Hãy cấp quyền micro/camera để thấy tên thiết bị')}}
async function selectOutputPrompt(){
  if(!navigator.mediaDevices?.selectAudioOutput){toast('Trình duyệt này chưa hỗ trợ chọn loa/tai nghe trực tiếp');return}
  try{const d=await navigator.mediaDevices.selectAudioOutput(prefs.audioOutputId?{deviceId:prefs.audioOutputId}:undefined);prefs.audioOutputId=d.deviceId;savePrefs();await enumerate();for(const el of mediaEls())await applyOutput(el);toast('Đã chọn thiết bị phát âm thanh: '+(d.label||'thiết bị đã chọn'))}catch(err){console.error(err);toast('Chưa chọn thiết bị phát âm thanh')}
}
function ensurePanel(){
  if($('c3MediaPanel'))return;
  const p=document.createElement('div');p.id='c3MediaPanel';p.className='c3-media-panel';
  p.innerHTML='<div class="c3-media-title">🎙 Thiết bị âm thanh & camera</div><div class="c3-media-sub">Chọn micro, camera và loa/tai nghe trước khi bật. Camera ưu tiên 1280×720 / 30fps; hệ thống tự giữ chống vọng, lọc ồn và tự cân bằng mic.</div><div class="c3-media-row"><label>🎤 Micro đầu vào</label><select id="c3MicSelect"><option value="">Chọn micro</option></select></div><div class="c3-media-row"><label>📷 Camera</label><select id="c3CameraSelect"><option value="">Chọn camera</option></select></div><div class="c3-media-row"><label>🔊 Loa / tai nghe đầu ra</label><select id="c3OutputSelect"><option value="">Âm thanh mặc định</option></select></div><div class="c3-media-actions"><button id="c3LoadDevices" class="primary">🔄 Tải thiết bị</button><button id="c3SelectOutput" class="c3-media-device-btn">🎧 Chọn loa/tai nghe</button><button id="c3MediaTestMic">🎤 Test mic</button></div><div id="c3MediaStatus" class="c3-media-status">Chưa kiểm tra thiết bị.</div><div class="c3-media-level"><span id="c3MediaLevelBar"></span></div>';
  document.body.appendChild(p);
  $('c3MicSelect').onchange=e=>{prefs.audioInputId=e.target.value;savePrefs();toast('Micro sẽ được dùng ở lần bật mic tiếp theo')};
  $('c3CameraSelect').onchange=e=>{prefs.videoInputId=e.target.value;savePrefs();toast('Camera sẽ được dùng ở lần bật camera tiếp theo')};
  $('c3OutputSelect').onchange=async e=>{prefs.audioOutputId=e.target.value;savePrefs();for(const el of mediaEls())await applyOutput(el);toast('Đã đổi thiết bị phát âm thanh')};
  $('c3LoadDevices').onclick=requestLabels;$('c3SelectOutput').onclick=selectOutputPrompt;$('c3MediaTestMic').onclick=testMic;enumerate();
}
function injectButton(){
  const bar=document.querySelector('.c3-stagebar');if(!bar||$('c3MediaSettingsBtn'))return;
  const b=document.createElement('button');b.id='c3MediaSettingsBtn';b.className='c3-btn c3-media-device-btn';b.textContent='🎙 Thiết bị';b.onclick=()=>{$('c3MediaPanel')?.classList.toggle('open');enumerate()};bar.appendChild(b);
  const u=document.createElement('button');u.id='c3MediaUnlock';u.className='c3-media-unlock';u.textContent='🔊 Bật âm thanh lớp học';u.onclick=unlockAllAudio;document.body.appendChild(u);
}
async function testMic(){
  try{const s=await navigator.mediaDevices.getUserMedia({audio:{echoCancellation:true,noiseSuppression:true,autoGainControl:true,channelCount:1,sampleRate:48000}});const ctx=new (window.AudioContext||window.webkitAudioContext)();const src=ctx.createMediaStreamSource(s);const a=ctx.createAnalyser();a.fftSize=256;src.connect(a);const data=new Uint8Array(a.fftSize),bar=$('c3MediaLevelBar'),status=$('c3MediaStatus');status.textContent='Đang test micro… Hãy nói bình thường.';let until=Date.now()+4000;const tick=()=>{a.getByteTimeDomainData(data);let sum=0;for(const x of data){const n=(x-128)/128;sum+=n*n}const rms=Math.sqrt(sum/data.length);if(bar)bar.style.width=Math.min(100,Math.round(rms*320))+'%';if(Date.now()<until)requestAnimationFrame(tick);else{bar.style.width='0';status.textContent='Test mic xong — nếu thanh nhảy rõ, micro hoạt động tốt.';s.getTracks().forEach(t=>t.stop());ctx.close()}};tick()}catch(err){toast('Không test được micro: '+err.name)}
}
function observeConnections(){const observer=new MutationObserver(muts=>{monitorMedia();for(const m of muts)for(const n of m.addedNodes||[])if(n.nodeType===1&&n.matches?.('audio,video')){applyOutput(n);if(!isLocalPreview(n))n.play?.().catch(showUnlock)}});observer.observe(document.body,{childList:true,subtree:true})}
function boot(){if(!document.querySelector('.classroom-v3'))return;ensurePanel();injectButton();monitorMedia();observeConnections();navigator.mediaDevices?.addEventListener?.('devicechange',enumerate);setTimeout(monitorMedia,500);setTimeout(monitorMedia,1500)}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();
