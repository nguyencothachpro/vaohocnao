(()=>{
'use strict';
/* OBS-style voice processing using Web Audio. Keeps speech clear, even and gentle. */
const P={sampleRate:48000,highpassHz:70,lowpassHz:11000,compressor:{threshold:-24,knee:18,ratio:3,attack:0.006,release:0.12},limiter:{threshold:-2,knee:0,ratio:20,attack:0.001,release:0.08},gainDb:2};
window.C3_VOICE_PROCESSOR=P;
const originalGetUserMedia=navigator.mediaDevices?.getUserMedia?.bind(navigator.mediaDevices);
if(!originalGetUserMedia||navigator.mediaDevices.getUserMedia.__c3VoiceWrapped)return;
let active=[];
function db(v){return Math.pow(10,v/20)}
function build(raw){
  const AC=window.AudioContext||window.webkitAudioContext;if(!AC)return null;
  const ctx=new AC({sampleRate:P.sampleRate});
  const src=ctx.createMediaStreamSource(raw);
  const hp=ctx.createBiquadFilter();hp.type='highpass';hp.frequency.value=P.highpassHz;hp.Q.value=.707;
  const lp=ctx.createBiquadFilter();lp.type='lowpass';lp.frequency.value=P.lowpassHz;lp.Q.value=.707;
  const comp=ctx.createDynamicsCompressor();Object.assign(comp,{threshold:{value:P.compressor.threshold},knee:{value:P.compressor.knee},ratio:{value:P.compressor.ratio},attack:{value:P.compressor.attack},release:{value:P.compressor.release}});
  const makeup=ctx.createGain();makeup.gain.value=db(P.gainDb);
  const lim=ctx.createDynamicsCompressor();Object.assign(lim,{threshold:{value:P.limiter.threshold},knee:{value:P.limiter.knee},ratio:{value:P.limiter.ratio},attack:{value:P.limiter.attack},release:{value:P.limiter.release}});
  const dest=ctx.createMediaStreamDestination();
  src.connect(hp).connect(lp).connect(comp).connect(makeup).connect(lim).connect(dest);
  const out=new MediaStream([...dest.stream.getAudioTracks()]);
  const stop=()=>{try{raw.getAudioTracks().forEach(t=>t.stop())}catch(_){};try{ctx.close()}catch(_){};active=active.filter(x=>x!==stop)};
  active.push(stop);
  return {stream:out,stop,context:ctx};
}
navigator.mediaDevices.getUserMedia=async constraints=>{
  const c=constraints&&typeof constraints==='object'?structuredClone(constraints):constraints;
  if(!c?.audio||window.C3_DISABLE_VOICE_PROCESSOR)return originalGetUserMedia(c);
  const raw=await originalGetUserMedia({...c,audio:{...(typeof c.audio==='object'?c.audio:{}),echoCancellation:true,noiseSuppression:true,autoGainControl:true,channelCount:1,sampleRate:P.sampleRate,sampleSize:16}});
  try{
    const processed=build(raw);if(processed){processed.stream.getAudioTracks()[0].__c3Processed=true;return new MediaStream([...processed.stream.getAudioTracks(),...raw.getVideoTracks()])}
  }catch(err){console.warn('C3 voice processor fallback',err)}
  return raw;
};
navigator.mediaDevices.getUserMedia.__c3VoiceWrapped=true;
window.C3_VOICE_PROCESSOR_STOP=()=>{active.splice(0).forEach(fn=>fn())};
})();
