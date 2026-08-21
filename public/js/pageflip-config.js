/* Shared book-flip configuration. Per-view settings are respected so Classroom can disable direct page flipping while Reader keeps normal behavior. */
(()=>{
  if(!window.St?.PageFlip) return;
  const Original=window.St.PageFlip;
  window.St.PageFlip=class extends Original{
    constructor(el,settings={}){
      super(el,{
        ...settings,
        drawShadow:settings.drawShadow!==false,
        maxShadowOpacity:settings.maxShadowOpacity??.48,
        flippingTime:settings.flippingTime??620,
        mobileScrollSupport:settings.mobileScrollSupport??false,
        swipeDistance:settings.swipeDistance??35,
        useMouseEvents:settings.useMouseEvents??true,
        clickEventForward:settings.clickEventForward??true,
        showPageCorners:settings.showPageCorners??true,
        disableFlipByClick:settings.disableFlipByClick??false,
        showCover:settings.showCover??false
      });
    }
  };
})();
(()=>{const load=()=>{if(document.querySelector('script[data-c3-realtime-fix]'))return;const s=document.createElement('script');s.src='/js/classroom-realtime-fix-v2.js?v=20260821-5';s.dataset.c3RealtimeFix='1';document.head.appendChild(s)};if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',load);else setTimeout(load,50)})();
