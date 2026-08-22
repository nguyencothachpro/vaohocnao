(()=>{
'use strict';
/* Natural OBS-style classroom voice processing + keep-alive for long pauses. */
const P={sampleRate:48000,highpassHz:75,lowpassHz:11500,gainDb:1.2,compressor:{threshold:-22,knee:20,ratio:2.5,attack:0.008,release:0.18},limiter:{threshold:-1.5,knee:0,ratio:12,attack:0.002,release:0.1}};
window.C3_VOICE_PROCESSOR=P;
const gum=navigator.mediaDevices?.getUserMedia?.bind(navigator.mediaDevices);
if(!gum||navigator.mediaDevices.getUserMedia.__c3VoiceWrapped)return;
const active=[];
const db=v=>Math.pow(10,v/20);
function setParam(node,key,val){try{node[key].value=val}catch(_){} }
function build(raw){
 const AC=window.AudioContext||window.webkitAudioContext;if(!AC)return null;
 const ctx=new AC({sampleRate:P.sampleRate});
 const src=ctx.createMediaStreamSource(raw);
 const hp=ctx.createBiquadFilter();hp.type='highpass';setParam(hp,'frequency',P.highpassHz);setParam(hp,'Q',.707);
 const presence=ctx.createBiquadFilter();presence.type='peaking';setParam(presence,'frequency',2500);setParam(presence,'Q',.9);setParam(presence,'gain',1.5);
 const lp=ctx.createBiquadFilter();lp.type='lowpass';setParam(lp,'frequency',P.lowpassHz);setParam(lp,'Q',.707);
 const comp=ctx.createDynamicsCompressor();Object.entries(P.compressor).forEach(([k,v])=>setParam(comp,k,v));
 const gain=ctx.createGain();gain.gain.value=db(P.gainDb);
 const lim=ctx.createDynamicsCompressor();Object.entries(P.limiter).forEach(([k,v])=>setParam(lim,k,v));
 const dest=ctx.createMediaStreamDestination();src.connect(hp).connect(presence).connect(lp).connect(comp).connect(gain).connect(lim).connect(dest);
 const outTrack=dest.stream.getAudioTracks()[0];
 let alive=true;const keep=()=>{if(!alive)return;if(ctx.state==='suspended')ctx.resume().catch(()=>{});setTimeout(keep,3000)};keep();
 const stop=()=>{alive=false;try{raw.getAudioTracks().forEach(t=>t.stop())}catch(_){}try{ctx.close()}catch(_){} };
 active.push(stop);return {stream:new MediaStream([outTrack,...raw.getVideoTracks()]),stop,context:ctx};
}
navigator.mediaDevices.getUserMedia=async constraints=>{
 const c=constraints&&typeof constraints==='object'?structuredClone(constraints):constraints;
 if(!c?.audio||window.C3_DISABLE_VOICE_PROCESSOR)return gum(c);
 const audio={...(typeof c.audio==='object'?c.audio:{}),echoCancellation:true,noiseSuppression:true,autoGainControl:true,channelCount:1,sampleRate:P.sampleRate,sampleSize:16};
 const raw=await gum({...c,audio});
 try{const p=build(raw);if(p){p.stream.getAudioTracks()[0].__c3Processed=true;return p.stream}}catch(e){console.warn('C3 voice processor fallback',e)}
 return raw;
};
navigator.mediaDevices.getUserMedia.__c3VoiceWrapped=true;
window.C3_VOICE_PROCESSOR_STOP=()=>active.splice(0).forEach(fn=>fn());
})();
