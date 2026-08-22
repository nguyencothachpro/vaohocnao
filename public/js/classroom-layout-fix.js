(()=>{
  'use strict';

  const get=sel=>document.querySelector(sel);
  let timer=0;

  function fix(){
    const app=get('.classroom-v3');
    if(!app)return;

    const top=get('.classroom-v3 .c3-top');
    const body=get('.classroom-v3 .c3-body');
    const stage=get('.classroom-v3 .c3-stage');
    const view=get('.classroom-v3 .c3-view');
    const wrap=get('.classroom-v3 .c3-book-wrap');
    const book=get('.classroom-v3 .c3-book');
    if(!body||!stage||!view||!wrap||!book)return;

    const appRect=app.getBoundingClientRect();
    const topH=top?top.getBoundingClientRect().height:0;
    const bodyH=Math.max(0,appRect.height-topH);

    body.style.height=bodyH+'px';
    body.style.minHeight='0';
    body.style.gridTemplateRows='minmax(0,1fr)';
    stage.style.height='100%';
    stage.style.minHeight='0';
    view.style.height='100%';
    view.style.minHeight='0';
    view.style.overflow='hidden';
    wrap.style.maxWidth='100%';
    wrap.style.maxHeight='100%';
    book.style.minWidth='0';
    book.style.minHeight='0';

    const page=get('.classroom-v3 .c3-book-page');
    const pdfCanvas=get('.classroom-v3 canvas.pdf-page');

    if(page&&pdfCanvas){
      const vr=view.getBoundingClientRect();
      const vw=Math.max(1,vr.width-16);
      const vh=Math.max(1,vr.height-16);
      const naturalW=Number(pdfCanvas.width)||729;
      const naturalH=Number(pdfCanvas.height)||1032;
      const ratio=naturalW/naturalH;

      // The classroom viewer can run its PDF renderer before mobile browsers
      // finish the dvh/flex/grid layout. In that case PageFlip receives a
      // zero-sized page. Give the actual PDF page a deterministic CSS box.
      let pageW=Math.min(vw,1300);
      let pageH=pageW/ratio;
      if(pageH>vh){
        pageH=vh;
        pageW=pageH*ratio;
      }
      pageW=Math.max(1,Math.floor(pageW));
      pageH=Math.max(1,Math.floor(pageH));

      page.style.display='block';
      page.style.visibility='visible';
      page.style.opacity='1';
      page.style.width=pageW+'px';
      page.style.height=pageH+'px';
      page.style.flex='0 0 auto';
      page.style.minWidth='1px';
      page.style.minHeight='1px';

      pdfCanvas.style.display='block';
      pdfCanvas.style.visibility='visible';
      pdfCanvas.style.opacity='1';
      pdfCanvas.style.width='100%';
      pdfCanvas.style.height='100%';
      pdfCanvas.style.maxWidth='100%';
      pdfCanvas.style.maxHeight='100%';

      // Keep the annotation layer exactly over the PDF page.
      const ink=page.querySelector('canvas.ink');
      if(ink){
        ink.style.position='absolute';
        ink.style.inset='0';
        ink.style.width='100%';
        ink.style.height='100%';
        ink.style.zIndex='5';
      }
    }

    // Let the original classroom script recalculate its viewer after this
    // browser-level layout correction. A second frame is needed on iOS/Android.
    requestAnimationFrame(()=>{
      window.dispatchEvent(new Event('resize'));
      requestAnimationFrame(()=>window.dispatchEvent(new Event('resize')));
    });
  }

  function schedule(){
    clearTimeout(timer);
    timer=setTimeout(fix,30);
  }

  function boot(){
    if(!get('.classroom-v3'))return;
    fix();
    window.addEventListener('resize',schedule,{passive:true});
    window.visualViewport?.addEventListener('resize',schedule,{passive:true});
    window.visualViewport?.addEventListener('scroll',schedule,{passive:true});

    if(window.ResizeObserver){
      const ro=new ResizeObserver(schedule);
      const app=get('.classroom-v3');
      if(app)ro.observe(app);
      const view=get('.classroom-v3 .c3-view');
      if(view)ro.observe(view);
    }

    if(window.MutationObserver){
      const mo=new MutationObserver(()=>schedule());
      const book=get('.classroom-v3 .c3-book');
      if(book)mo.observe(book,{childList:true,subtree:true,attributes:true,attributeFilter:['style','class','data-rendered']});
    }

    setTimeout(fix,100);
    setTimeout(fix,300);
    setTimeout(fix,700);
    setTimeout(fix,1200);
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});
  else boot();
})();
