(()=>{
  'use strict';
  const isClassroom=()=>!!document.querySelector('.classroom-v3');
  const apply=()=>{
    const app=document.querySelector('.classroom-v3');
    if(!app)return;
    const top=app.querySelector('.c3-top');
    const body=app.querySelector('.c3-body');
    const stage=app.querySelector('.c3-stage');
    const view=app.querySelector('.c3-view');
    const wrap=app.querySelector('.c3-book-wrap');
    if(!body||!stage||!view)return;

    const appH=app.getBoundingClientRect().height;
    const topH=top?top.getBoundingClientRect().height:0;
    const bodyH=Math.max(0,appH-topH);

    body.style.height=bodyH+'px';
    body.style.minHeight='0px';
    body.style.gridTemplateRows='minmax(0,1fr)';
    stage.style.height='100%';
    stage.style.minHeight='0px';
    view.style.height='100%';
    view.style.minHeight='0px';

    if(wrap){
      wrap.style.maxHeight='100%';
      wrap.style.maxWidth='100%';
    }

    // Give the existing classroom viewer another layout pass after dimensions
    // become real. This is important on Android/iPad after toolbar/viewport changes.
    requestAnimationFrame(()=>window.dispatchEvent(new Event('resize')));
  };

  let timer=0;
  const schedule=()=>{
    clearTimeout(timer);
    timer=setTimeout(apply,40);
  };

  const boot=()=>{
    if(!isClassroom())return;
    apply();
    window.addEventListener('resize',schedule,{passive:true});
    window.visualViewport?.addEventListener('resize',schedule,{passive:true});
    window.visualViewport?.addEventListener('scroll',schedule,{passive:true});
    if(window.ResizeObserver){
      const ro=new ResizeObserver(schedule);
      const app=document.querySelector('.classroom-v3');
      if(app)ro.observe(app);
    }
    setTimeout(apply,150);
    setTimeout(apply,500);
    setTimeout(apply,1000);
  };

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});
  else boot();
})();
