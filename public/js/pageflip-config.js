/* Shared book-flip configuration for Reader + Classroom. Loaded after page-flip and before the page code. */
(()=>{
  if(!window.St?.PageFlip) return;
  const Original=window.St.PageFlip;
  window.St.PageFlip=class extends Original{
    constructor(el,settings={}){
      const mobile=window.matchMedia('(max-width: 760px)').matches;
      super(el,{
        ...settings,
        size:'stretch',
        autoSize:false,
        usePortrait:mobile,
        minWidth:mobile?240:300,
        maxWidth:mobile?900:900,
        minHeight:mobile?320:400,
        maxHeight:mobile?1200:1100,
        drawShadow:true,
        maxShadowOpacity:.48,
        flippingTime:760,
        mobileScrollSupport:false,
        swipeDistance:28,
        useMouseEvents:true,
        clickEventForward:true,
        showPageCorners:true,
        disableFlipByClick:false,
        showCover:false
      });
    }
  };
})();
