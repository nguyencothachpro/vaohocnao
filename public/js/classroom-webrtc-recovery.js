(()=>{
'use strict';
/* Keep classroom WebRTC audio alive after silence, network changes and ICE stalls. */
const REC={maxRestarts:4,restartDelay:900,watchMs:2500};
window.C3_WEBRTC_RECOVERY=REC;
const pcs=new Set();
const Native=window.RTCPeerConnection;
if(!Native||Native.__c3RecoveryPatched)return;
const Orig=Native;
function watch(pc){
  pcs.add(pc);
  let last='';let failures=0;let timer=0;
  const recover=()=>{
    const state=pc.connectionState||pc.iceConnectionState;
    if(state==='failed'||state==='disconnected'){
      if(failures>=REC.maxRestarts)return;
      failures++;
      clearTimeout(timer);timer=setTimeout(async()=>{
        try{
          if(pc.restartIce)pc.restartIce();
          if(pc.signalingState==='stable'&&pc.createOffer){
            const offer=await pc.createOffer({iceRestart:true});
            await pc.setLocalDescription(offer);
            pc.dispatchEvent(new CustomEvent('c3:ice-restart',{detail:{offer}}));
          }
        }catch(e){console.warn('C3 ICE recovery',e)}
      },REC.restartDelay);
    }else if(state==='connected'||state==='completed'){failures=0}
  };
  pc.addEventListener('connectionstatechange',recover);
  pc.addEventListener('iceconnectionstatechange',recover);
  pc.addEventListener('icegatheringstatechange',()=>{last=pc.iceGatheringState});
  setInterval(()=>{if(pc.signalingState!=='closed')recover()},REC.watchMs);
}
window.RTCPeerConnection=function(...args){const pc=new Orig(...args);watch(pc);return pc};
window.RTCPeerConnection.prototype=Orig.prototype;
Object.setPrototypeOf(window.RTCPeerConnection,Orig);
window.RTCPeerConnection.__c3RecoveryPatched=true;
})();
