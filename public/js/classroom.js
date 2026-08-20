(() => {
const C=window.CLASSROOM; const socket=io();
let mode='pen', currentPage=0, pages=[], pageFlip=null, pdf=null, localStream=null, peers=new Map();
const pagesEl=document.getElementById('pages');

function makePage(i, pdfCanvas){
  const host=document.createElement('div'); host.className='page-host'; host.dataset.page=i;
  host.style.width='100%'; host.style.aspectRatio='0.707 / 1';
  if(pdfCanvas){pdfCanvas.style.width='100%';pdfCanvas.style.height='100%';host.appendChild(pdfCanvas)}
  const draw=document.createElement('canvas'); draw.className='draw-layer'; host.appendChild(draw);
  const resize=()=>{const r=host.getBoundingClientRect();const old=draw.width;const data=old?draw.toDataURL():null;draw.width=r.width*devicePixelRatio;draw.height=r.height*devicePixelRatio;draw.style.width=r.width+'px';draw.style.height=r.height+'px';const x=draw.getContext('2d');x.scale(devicePixelRatio,devicePixelRatio);if(data){const img=new Image();img.onload=()=>x.drawImage(img,0,0,r.width,r.height);img.src=data}};
  new ResizeObserver(resize).observe(host); resize();
  draw.addEventListener('pointerdown',e=>{if(mode==='text'){const t=prompt('Nhập chữ');if(t){const x=draw.getContext('2d');x.font='24px Arial';x.fillStyle='#111';x.fillText(t,e.offsetX,e.offsetY);socket.emit('classroom:board',{page:i,kind:'text',x:e.offsetX,y:e.offsetY,text:t})}return;}draw.setPointerCapture(e.pointerId);});
  let down=false,last=null;
  draw.addEventListener('pointerdown',e=>{if(mode==='text')return;down=true;last=[e.offsetX,e.offsetY]});
  draw.addEventListener('pointerup',()=>down=false);
  draw.addEventListener('pointermove',e=>{if(!down)return;const x=draw.getContext('2d');const nx=e.offsetX,ny=e.offsetY;x.lineWidth=mode==='eraser'?22:3;x.lineCap='round';x.globalCompositeOperation=mode==='eraser'?'destination-out':'source-over';x.beginPath();x.moveTo(last[0],last[1]);x.lineTo(nx,ny);x.stroke();socket.emit('classroom:board',{page:i,kind:'stroke',x1:last[0],y1:last[1],x2:nx,y2:ny,erase:mode==='eraser'});last=[nx,ny]});
  host.addEventListener('paste',e=>{const items=e.clipboardData?.items||[];for(const item of items){if(item.type.startsWith('image/')){const f=item.getAsFile();const url=URL.createObjectURL(f);const img=new Image();img.onload=()=>{const x=draw.getContext('2d');x.globalCompositeOperation='source-over';x.drawImage(img,20,20,Math.min(img.width,400),Math.min(img.height,300));URL.revokeObjectURL(url)};img.src=url}}});
  return host;
}
function drawRemote(p){
 const host=pages[p.page];if(!host)return;const draw=host.querySelector('canvas.draw-layer'),x=draw.getContext('2d');
 if(p.kind==='clear'){x.clearRect(0,0,draw.width,draw.height);return}
 const r=host.getBoundingClientRect(), sx=r.width/(draw.width/devicePixelRatio),sy=r.height/(draw.height/devicePixelRatio);
 x.globalCompositeOperation=p.erase?'destination-out':'source-over';x.lineWidth=p.erase?22:3;x.lineCap='round';x.beginPath();
 if(p.kind==='stroke'){x.moveTo(p.x1/sx,p.y1/sy);x.lineTo(p.x2/sx,p.y2/sy);x.stroke()}
 if(p.kind==='text'){x.font='24px Arial';x.fillStyle='#111';x.fillText(p.text,p.x/sx,p.y/sy)}
}
socket.on('classroom:board',drawRemote);
socket.on('classroom:clear',()=>pages.forEach(p=>p.querySelector('canvas.draw-layer')?.getContext('2d').clearRect(0,0,9999,9999)));

async function loadPdf(url){
 const pdfjs=window.pdfjsLib; pdfjs.GlobalWorkerOptions.workerSrc='https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
 pdf=await pdfjs.getDocument(url).promise; pagesEl.innerHTML='';
 for(let i=1;i<=pdf.numPages;i++){
   const page=await pdf.getPage(i);const vp=page.getViewport({scale:1.2});const c=document.createElement('canvas');c.width=vp.width;c.height=vp.height;
   await page.render({canvasContext:c.getContext('2d'),viewport:vp}).promise;pagesEl.appendChild(makePage(i-1,c));
 }
 pages=[...pagesEl.children]; if(window.St?.PageFlip){pageFlip=new St.PageFlip(pagesEl,{width:700,height:990,size:'stretch',minWidth:300,maxWidth:900,minHeight:420,maxHeight:1300,showCover:true});pageFlip.loadFromHTML(pages);pageFlip.on('flip',e=>currentPage=e.data)}
}
async function start(){
 socket.emit('classroom:join',{room:C.room,role:C.isTeacher?'teacher':'student'});if(!C.isTeacher)socket.emit('classroom:request-stream',{id:socket.id});
 if(C.initialPdf){await loadPdf('/phong-hoc/'+C.room+'/pdf').catch(()=>pages=[makePage(0)]);}else{pages=[makePage(0)];pagesEl.appendChild(pages[0])}
}
document.getElementById('pen').onclick=()=>mode='pen';document.getElementById('eraser').onclick=()=>mode='eraser';document.getElementById('textTool').onclick=()=>mode='text';
document.getElementById('clear').onclick=()=>{const p=pages[currentPage]?.querySelector('canvas.draw-layer');p?.getContext('2d').clearRect(0,0,p.width,p.height);socket.emit('classroom:clear')};
document.getElementById('prev').onclick=()=>pageFlip?.flipPrev();document.getElementById('next').onclick=()=>pageFlip?.flipNext();

async function applyGreenKey(){
 if(!localStream)return;
 const v=document.getElementById('localVideo'), c=document.getElementById('keyCanvas'), x=c.getContext('2d');
 const w=640,h=360;c.width=w;c.height=h;
 if(keyTimer)cancelAnimationFrame(keyTimer);
 const tick=()=>{
   if(!keyOn)return;
   x.drawImage(v,0,0,w,h);const img=x.getImageData(0,0,w,h),d=img.data;
   for(let i=0;i<d.length;i+=4){const r=d[i],g=d[i+1],b=d[i+2];if((g>r*1.35&&g>b*1.18&&g>70)||(b>r*1.35&&b>g*1.05&&b>70)){d[i+3]=0}}
   x.putImageData(img,0,0);keyTimer=requestAnimationFrame(tick);
 };
 keyOn=true;tick();processedStream=c.captureStream(30);
 const audio=localStream.getAudioTracks()[0];if(audio)processedStream.addTrack(audio);
 document.getElementById('localVideo').srcObject=processedStream;
}
document.getElementById('cam').onclick=async()=>{
 try{localStream=await navigator.mediaDevices.getUserMedia({video:true,audio:true});document.getElementById('localVideo').srcObject=localStream;if(C.isTeacher)socket.emit('classroom:teacher-stream')}catch(e){alert('Trình duyệt chưa cho phép camera/mic. Hãy cấp quyền cho website.')}
};
document.getElementById('green').onclick=()=>{if(!localStream)return;keyOn=!keyOn;if(keyOn)applyGreenKey();else{if(keyTimer)cancelAnimationFrame(keyTimer);document.getElementById('localVideo').srcObject=localStream;processedStream=null}};
document.getElementById('screen').onclick=async()=>{
 try{const s=await navigator.mediaDevices.getDisplayMedia({video:true,audio:true});document.getElementById('localVideo').srcObject=s;if(C.isTeacher)socket.emit('classroom:teacher-stream')}catch(e){}
};
socket.on('classroom:request-stream',async({id})=>{if(!C.isTeacher||!(processedStream||localStream))return;const pc=new RTCPeerConnection();peers.set(id,pc);(processedStream||localStream).getTracks().forEach(t=>pc.addTrack(t,processedStream||localStream));pc.onicecandidate=e=>e.candidate&&socket.emit('webrtc:ice',{to:id,candidate:e.candidate});const offer=await pc.createOffer();await pc.setLocalDescription(offer);socket.emit('webrtc:offer',{to:id,offer})});
socket.on('classroom:teacher-stream',()=>{if(!C.isTeacher)socket.emit('classroom:request-stream',{id:socket.id});});
socket.on('classroom:peer-joined',async({id,role})=>{if(!C.isTeacher||role!=='student'||!localStream)return;const pc=new RTCPeerConnection();peers.set(id,pc);(processedStream||localStream).getTracks().forEach(t=>pc.addTrack(t,processedStream||localStream));pc.onicecandidate=e=>e.candidate&&socket.emit('webrtc:ice',{to:id,candidate:e.candidate});const offer=await pc.createOffer();await pc.setLocalDescription(offer);socket.emit('webrtc:offer',{to:id,offer})});
socket.on('webrtc:offer',async({from,offer})=>{if(C.isTeacher)return;const pc=new RTCPeerConnection();peers.set(from,pc);pc.ontrack=e=>document.getElementById('remoteVideo').srcObject=e.streams[0];pc.onicecandidate=e=>e.candidate&&socket.emit('webrtc:ice',{to:from,candidate:e.candidate});await pc.setRemoteDescription(offer);const answer=await pc.createAnswer();await pc.setLocalDescription(answer);socket.emit('webrtc:answer',{to:from,answer})});
socket.on('webrtc:answer',async({from,answer})=>{const pc=peers.get(from);if(pc)await pc.setRemoteDescription(answer)});
socket.on('webrtc:ice',async({from,candidate})=>{const pc=peers.get(from);if(pc)try{await pc.addIceCandidate(candidate)}catch(e){}});
start();
})();