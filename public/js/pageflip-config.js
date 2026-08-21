/* Shared book-flip configuration. Do not override size/geometry: Reader + Classroom calculate stable fixed page sizes themselves. */
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
        mobileScrollSupport:false,
        swipeDistance:settings.swipeDistance??35,
        useMouseEvents:true,
        clickEventForward:true,
        showPageCorners:true,
        disableFlipByClick:false,
        showCover:false
      });
    }
  };
})();
