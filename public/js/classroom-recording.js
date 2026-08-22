(()=>{
const C=window.CLASSROOM||{},$=id=>document.getElementById(id);
if(!C.isTeacher)return;
let recording=false,recorder=null,chunks=[],rafId=0,canvas=null,ctx=null,recordStart=0,recordTimer=0;

function toast(m){const e=$('c3Toast');if(!e)return;e.textContent=m;e.classList.add('show');clearTimeout(e._t);e._t=setTimeout(()=>e.classList.remove('show'),1800)}

function drawFrame(){
  if(!recording||!ctx)return;
  const view=$('c3View');
  if(view){
    const vw=view.clientWidth||1,vh=view.clientHeight||1;
    const targetW=1280,targetH=Math.round(targetW*vh/vw)||720;
    if(canvas.width!==targetW||canvas.height!==targetH){canvas.width=targetW;canvas.height=targetH}
    ctx.fillStyle='#eef2f7';ctx.fillRect(0,0,canvas.width,canvas.height);
    const viewRect=view.getBoundingClientRect();
    const scaleX=canvas.width/vw,scaleY=canvas.height/vh;
    document.querySelectorAll('#c3Book .c3-book-page').forEach(pageEl=>{
      if(pageEl.style.display==='none')return;
      const r=pageEl.getBoundingClientRect();
      const dx=(r.left-viewRect.left)*scaleX,dy=(r.top-viewRect.top)*scaleY,dw=r.width*scaleX,dh=r.height*scaleY;
      const pdfCanvas=pageEl.querySelector('canvas.pdf-page');
      if(pdfCanvas){try{ctx.drawImage(pdfCanvas,dx,dy,dw,dh)}catch(_){}}
      else{ctx.fillStyle='#fff';ctx.fillRect(dx,dy,dw,dh)}
      const inkCanvas=pageEl.querySelector('canvas.ink');
      if(inkCanvas){try{ctx.drawImage(inkCanvas,dx,dy,dw,dh)}catch(_){}}
    });
    const pip=$('c3CameraPip');
    const pipVideo=pip?.querySelector('video');
    if(pipVideo&&pipVideo.srcObject&&pip.style.display!=='none'){
      const pw=canvas.width*0.22,ph=pw*((pipVideo.videoHeight/pipVideo.videoWidth)||0.75);
      try{ctx.drawImage(pipVideo,canvas.width-pw-14,canvas.height-ph-14,pw,ph);ctx.strokeStyle='#fff';ctx.lineWidth=3;ctx.strokeRect(canvas.width-pw-14,canvas.height-ph-14,pw,ph)}catch(_){}
    }
  }
}

function injectButton(){
  const bar=document.querySelector('.c3-stagebar');
  if(!bar||$('c3RecordBtn'))return;
  const b=document.createElement('button');
  b.id='c3RecordBtn';b.className='c3-btn c3-record-btn';b.innerHTML='⏺ Ghi hình';
  b.onclick=()=>{recording?stopRecording():startRecording()};
  bar.appendChild(b);
}

function updateTimer(){
  const btn=$('c3RecordBtn');if(!btn)return;
  const s=Math.floor((Date.now()-recordStart)/1000);
  const mm=Math.floor(s/60),ss=String(s%60).padStart(2,'0');
  btn.innerHTML='⏹ Dừng ghi ('+mm+':'+ss+')';
}

function startRecording(){
  if(recording)return;
  if(!window.MediaRecorder){toast('Trình duyệt này không hỗ trợ ghi hình');return}
  canvas=document.createElement('canvas');canvas.width=1280;canvas.height=720;
  ctx=canvas.getContext('2d');
  recording=true;
  rafId=setInterval(drawFrame,66);
  const stream=canvas.captureStream(15);
  chunks=[];
  let mime='video/webm;codecs=vp9';
  if(!MediaRecorder.isTypeSupported(mime))mime='video/webm';
  try{recorder=new MediaRecorder(stream,{mimeType:mime})}
  catch(err){toast('Không khởi tạo được bộ ghi hình');recording=false;clearInterval(rafId);return}
  recorder.ondataavailable=e=>{if(e.data&&e.data.size)chunks.push(e.data)};
  recorder.onstop=()=>{
    const blob=new Blob(chunks,{type:'video/webm'});
    const url=URL.createObjectURL(blob);
    const a=document.createElement('a');
    a.href=url;a.download='bai-giang-'+(C.room||'phong')+'-'+Date.now()+'.webm';
    document.body.appendChild(a);a.click();a.remove();
    setTimeout(()=>URL.revokeObjectURL(url),8000);
    toast('Đã lưu file ghi hình về máy — kiểm tra thư mục Downloads');
  };
  recorder.start(1000);
  recordStart=Date.now();
  recordTimer=setInterval(updateTimer,1000);
  const btn=$('c3RecordBtn');if(btn){btn.classList.add('active')}
  updateTimer();
  toast('Bắt đầu ghi hình bài giảng');
}
function stopRecording(){
  if(!recording)return;
  recording=false;
  clearInterval(rafId);clearInterval(recordTimer);
  try{recorder?.stop()}catch(_){}
  const btn=$('c3RecordBtn');if(btn){btn.innerHTML='⏺ Ghi hình';btn.classList.remove('active')}
}
window.addEventListener('beforeunload',()=>{if(recording)try{recorder?.stop()}catch(_){}});

function install(){injectButton()}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>setTimeout(install,900));else setTimeout(install,900);
})();
