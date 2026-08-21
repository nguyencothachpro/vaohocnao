(()=>{
  const C=window.CLASSROOM||{};
  if(!C.room||!window.io)return;
  const socket=window.io();
  const $=id=>document.getElementById(id);
  const live=()=>C.isTeacher||document.body.dataset.classroomLiveSync!=='closed';
  let applyingRemote=false;
  let lastState=null;
  let emitTimer=null;
  let joined=false;

  function currentPage(){
    const n=Number($('c3PageInput')?.value);
    return Number.isFinite(n)&&n>0?n-1:0;
  }
  function readTransform(){
    const book=$('c3BookWrap');
    if(!book)return {zoom:1,panX:0,panY:0,page:currentPage()};
    const t=getComputedStyle(book).transform;
    if(!t||t==='none')return {zoom:1,panX:0,panY:0,page:currentPage()};
    const m=t.match(/^matrix(3d)?\\((.+)\\)$/);
    if(!m)return {zoom:1,panX:0,panY:0,page:currentPage()};
    const a=m[2].split(',').map(Number);
    if(m[1])return {zoom:a[0]||1,panX:a[12]||0,panY:a[13]||0,page:currentPage()};
    return {zoom:a[0]||1,panX:a[4]||0,panY:a[5]||0,page:currentPage()};
  }
  function emitView(){
    if(!C.isTeacher||!joined||applyingRemote)return;
    const s=readTransform();
    const payload={room:C.room,page:s.page,zoom:s.zoom,panX:s.panX,panY:s.panY};
    if(lastState&&Math.abs(lastState.zoom-payload.zoom)<.001&&Math.abs(lastState.panX-payload.panX)<.5&&Math.abs(lastState.panY-payload.panY)<.5&&lastState.page===payload.page)return;
    lastState=payload;
    socket.emit('classroom:view-state',payload);
  }
  function scheduleEmit(){
    if(!C.isTeacher||applyingRemote)return;
    clearTimeout(emitTimer);
    emitTimer=setTimeout(emitView,40);
  }
  function applyView(state){
    if(!state)return;
    const book=$('c3BookWrap');
    if(!book)return;
    applyingRemote=true;
    const zoom=Math.max(.1,Math.min(5,Number(state.zoom)||1));
    const panX=Number(state.panX)||0;
    const panY=Number(state.panY)||0;
    book.style.transformOrigin='center center';
    book.style.transform=`translate3d(${panX}px,${panY}px,0) scale(${zoom})`;
    const z=$('c3Zoom');if(z)z.textContent=Math.round(zoom*100)+'%';
    const input=$('c3PageInput');
    if(input&&Number.isFinite(Number(state.page)))input.value=Number(state.page)+1;
    setTimeout(()=>{applyingRemote=false},0);
  }
  function lockStudentViewport(){
    if(C.isTeacher)return;
    ['c3ZoomOut','c3ZoomIn','c3Fit'].forEach(id=>{const e=$(id);if(e){e.disabled=true;e.title='Trong giờ học, khung nhìn do giáo viên điều khiển'}});
    const book=$('c3BookWrap');
    if(book&&window.MutationObserver){
      const obs=new MutationObserver(()=>{
        if(applyingRemote||!lastState)return;
        const actual=readTransform();
        if(Math.abs(actual.zoom-lastState.zoom)>.01||Math.abs(actual.panX-lastState.panX)>1||Math.abs(actual.panY-lastState.panY)>1)applyView(lastState);
      });
      obs.observe(book,{attributes:true,attributeFilter:['style']});
    }
  }
  socket.on('connect',()=>{
    socket.emit('classroom:join',{room:C.room});
  });
  socket.on('classroom:permissions',p=>{
    if(p?.isTeacher===false)lockStudentViewport();
  });
  socket.on('classroom:view-state',state=>{
    if(C.isTeacher)return;
    lastState=state;
    applyView(state);
  });
  socket.on('classroom:page',state=>{
    if(C.isTeacher||!state)return;
    lastState={...(lastState||{}),page:Number(state.page)||0};
  });
  socket.on('classroom:closed',()=>{
    document.body.dataset.classroomLiveSync='closed';
    ['c3ZoomOut','c3ZoomIn','c3Fit'].forEach(id=>{const e=$(id);if(e)e.disabled=false});
  });
  socket.on('disconnect',()=>{joined=false});
  socket.on('connect_error',()=>{});

  function start(){
    joined=socket.connected;
    const book=$('c3BookWrap');
    if(book&&window.MutationObserver&&C.isTeacher){
      const obs=new MutationObserver(scheduleEmit);
      obs.observe(book,{attributes:true,attributeFilter:['style']});
    }
    if(C.isTeacher){
      ['c3Prev','c3Next','c3PageInput','c3ZoomOut','c3ZoomIn','c3Fit'].forEach(id=>{
        const e=$(id);if(!e)return;
        e.addEventListener('click',scheduleEmit,{capture:true});
        e.addEventListener('change',scheduleEmit,{capture:true});
      });
      window.addEventListener('resize',scheduleEmit);
      setTimeout(emitView,500);
    }else{
      lockStudentViewport();
    }
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start);else start();
})();
