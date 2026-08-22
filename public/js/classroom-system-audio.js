(()=>{
'use strict';
/* Optional computer/tab audio capture. Mic stays voice-processed; system audio bypasses voice DSP. */
const C=window.CLASSROOM||{}, gum=navigator.mediaDevices?.getUserMedia?.bind(navigator.mediaDevices);
if(!gum||navigator.mediaDevices.getUserMedia.__c3SystemAudioWrapped)return;
let systemStream=null,mixCtx=null,mixSource=null,mixDest=null;
window.C3_SYSTEM_AUDIO={enabled:false,stream:null};
function toast(m){const e=document.getElementById('c3Toast');if(!e)return;e.textContent=m;e.classList.add('show');clearTimeout(e._t);e._t=setTimeout(()=>e.classList.remove('show'),2200)}
async function stopSystemAudio(){try{systemStream?.getTracks().forEach(t=>t.stop())}catch(_){}try{await mixCtx?.close()}catch(_){}systemStream=null;mixCtx=null;mixSource=null;mixDest=null;window.C3_SYSTEM_AUDIO={enabled:false,stream:null};const b=document.getElementById('c3SystemAudioBtn');if(b){b.textContent='🔊 Chia sẻ âm thanh máy tính';b.classList.remove('active')}}
async function startSystemAudio(){if(!navigator.mediaDevices.getDisplayMedia){toast('Trình duyệt này chưa hỗ trợ chia sẻ âm thanh máy tính');return}if(systemStream?.getAudioTracks().length){await stopSystemAudio();return}try{
 const display=await navigator.mediaDevices.getDisplayMedia({video:true,audio:{channelCount:2,sampleRate:48000,echoCancellation:false,noiseSuppression:false,autoGainControl:false}});
 const audioTracks=display.getAudioTracks();
 if(!audioTracks.length){display.getTracks().forEach(t=>t.stop());toast('Hãy bật "Chia sẻ âm thanh" trong hộp thoại trình duyệt');return}
 display.getVideoTracks().forEach(t=>t.stop());
 systemStream=new MediaStream(audioTracks);
 audioTracks.forEach(t=>t.addEventListener('ended',()=>stopSystemAudio(),{once:true}));
 window.C3_SYSTEM_AUDIO={enabled:true,stream:systemStream};
 const b=document.getElementById('c3SystemAudioBtn');if(b){b.textContent='🔊 Đang chia sẻ âm thanh';b.classList.add('active')}
 toast('Đã bật âm thanh máy tính — mở nhạc/video để học viên nghe');
 }catch(err){console.warn('system audio',err);toast(err.name==='NotAllowedError'?'Bạn đã hủy chia sẻ âm thanh':'Không thể lấy âm thanh máy tính')}
}
function inject(){if(document.getElementById('c3SystemAudioBtn'))return;const sidebar=document.querySelector('.c3-tools');if(!sidebar)return;const b=document.createElement('button');b.id='c3SystemAudioBtn';b.className='c3-tool';b.innerHTML='🔊 Chia sẻ âm thanh máy tính';b.title='Chia sẻ âm thanh của tab/cửa sổ/màn hình tới học viên';b.onclick=startSystemAudio;const anchor=document.querySelector('[data-mode="pointer"]');if(anchor)anchor.insertAdjacentElement('beforebegin',b);else sidebar.appendChild(b)}
const previous=navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
navigator.mediaDevices.getUserMedia=async constraints=>{
 const stream=await previous(constraints);
 if(!window.C3_SYSTEM_AUDIO?.enabled||!constraints?.audio||!systemStream?.getAudioTracks().length)return stream;
 try{
   const AC=window.AudioContext||window.webkitAudioContext;if(!AC)return stream;
   mixCtx=new AC({sampleRate:48000});
   mixSource=mixCtx.createMediaStreamSource(systemStream);
   const micTracks=stream.getAudioTracks();
   mixDest=mixCtx.createMediaStreamDestination();
   if(micTracks.length){const micOnly=new MediaStream(micTracks);mixCtx.createMediaStreamSource(micOnly).connect(mixDest)}
   mixSource.connect(mixDest);
   const out=new MediaStream([...mixDest.stream.getAudioTracks(),...stream.getVideoTracks()]);
   out.getAudioTracks()[0].__c3MixedAudio=true;
   return out;
 }catch(err){console.warn('C3 audio mix fallback',err);return stream}
};
navigator.mediaDevices.getUserMedia.__c3SystemAudioWrapped=true;
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>setTimeout(inject,1200));else setTimeout(inject,1200);
window.C3_STOP_SYSTEM_AUDIO=stopSystemAudio;
})();
