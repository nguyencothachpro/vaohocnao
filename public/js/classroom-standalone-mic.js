(()=>{
'use strict';
const C=window.CLASSROOM||{},$=id=>document.getElementById(id),socket=window._c3Socket||(window.io?window.io():null);
let stream=null,on=false,muted=false;
function toast(m){const e=$('c3Toast');if(!e)return;e.textContent=m;e.classList.add('show');clearTimeout(e._t);e._t=setTimeout(()=>e.classList.remove('show'),1800)}
function button(){let b=$('c3StandaloneMic');if(b)return b;const bar=document.querySelector('.c3-stagebar');if(!bar)return null;b=document.createElement('button');b.id='c3StandaloneMic';b.className='c3-btn c3-mic-btn';b.innerHTML='🎤 Bật mic';b.onclick=async()=>{if(!on){try{stream=await navigator.mediaDevices.getUserMedia({audio:{echoCancellation:true,noiseSuppression:true,autoGainControl:true,channelCount:1,sampleRate:48000,sampleSize:16}});on=true;muted=false;b.innerHTML='🎤 Mic đang bật';b.classList.add('active');socket?.emit('classroom:mic-start');toast('Micro đã bật độc lập với camera')}catch(e){toast('Không mở được micro — hãy cho phép trình duyệt sử dụng micro')}}else{muted=!muted;stream?.getAudioTracks().forEach(t=>t.enabled=!muted);b.innerHTML=muted?'🔇 Mic đã tắt':'🎤 Mic đang bật';b.classList.toggle('muted',muted);socket?.emit('classroom:mic-toggle',{muted});toast(muted?'Đã tắt mic':'Đã bật mic')}};bar.appendChild(b);return b}
function stop(){stream?.getTracks().forEach(t=>t.stop());stream=null;on=false;muted=false;const b=$('c3StandaloneMic');if(b){b.innerHTML='🎤 Bật mic';b.classList.remove('active','muted')}}
function install(){button();window.C3_STOP_STANDALONE_MIC=stop}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>setTimeout(install,700));else setTimeout(install,700);
})();
