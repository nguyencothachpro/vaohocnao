(()=>{
'use strict';
/* High-quality classroom voice layer.
   Keep native browser AEC/NS, prefer Opus, use FEC, and avoid duplicate audio paths. */
const QUALITY={minBitrate:32000,maxBitrate:96000,startBitrate:64000};
window.C3_AUDIO_QUALITY=QUALITY;

function tuneSender(sender){
  if(!sender||sender.track?.kind!=='audio'||typeof sender.getParameters!=='function')return;
  try{
    const p=sender.getParameters();
    if(!p.encodings||!p.encodings.length)p.encodings=[{}];
    p.encodings[0].minBitrate=QUALITY.minBitrate;
    p.encodings[0].maxBitrate=QUALITY.maxBitrate;
    p.encodings[0].priority='high';
    sender.setParameters(p).catch(()=>{});
  }catch(_){ }
}

if(window.RTCPeerConnection&&!window.RTCPeerConnection.__c3AudioQualityPatched){
  const Native=window.RTCPeerConnection;
  const proto=Native.prototype;
  const nativeAddTrack=proto.addTrack;
  proto.addTrack=function(track,...streams){
    const sender=nativeAddTrack.call(this,track,...streams);
    if(track?.kind==='audio'){
      tuneSender(sender);
      try{
        const tr=this.getTransceivers().find(x=>x.sender===sender);
        if(tr&&typeof tr.setCodecPreferences==='function'&&window.RTCRtpReceiver?.getCapabilities){
          const caps=RTCRtpReceiver.getCapabilities('audio');
          const opus=(caps?.codecs||[]).filter(c=>(c.mimeType||'').toLowerCase()==='audio/opus');
          const rest=(caps?.codecs||[]).filter(c=>(c.mimeType||'').toLowerCase()!=='audio/opus');
          if(opus.length)tr.setCodecPreferences([...opus,...rest]);
        }
      }catch(_){ }
    }
    return sender;
  };
  window.RTCPeerConnection.__c3AudioQualityPatched=true;
}

/* Do not let the camera path accidentally become a second microphone path. */
window.C3_CAMERA_AUDIO_DISABLED=true;
})();
