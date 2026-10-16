import {canonicalMap,mapLevel,editableCell,MAP_COLS,MAP_TILE,MAP_WIDTH,MAP_HEIGHT} from './parkour-map.js?v=0.5.0';
import {drawCourse,drawSky} from './parkour-scene.js?v=0.5.0';
import {drawRunner} from './parkour-avatar.js?v=0.5.0';

export function createEditor(canvas,{send,save,name,color,onDirty}){
  const ctx=canvas.getContext('2d'),$=id=>document.getElementById(id);
  let active=false,cells='',level=null,revision=0,dirty=false,inflight=false,verifyPending=false,timer=0,tool='1',width=960,height=640,dpr=1,pointer=null,previous=null,pan=0,zoomExtra=1,view={zoom:1,x:0,y:0},verified=false;
  new ResizeObserver(()=>{const b=canvas.getBoundingClientRect();width=b.width;height=b.height;dpr=Math.min(devicePixelRatio||1,2);canvas.width=Math.round(width*dpr);canvas.height=Math.round(height*dpr);}).observe(canvas);
  function status(text){$('editorStatus').textContent=text;}
  function flush(){clearTimeout(timer);if(inflight)return;if(dirty){dirty=false;inflight=true;send('parkour:map',{cells});status('保存中');}else if(verifyPending){verifyPending=false;send('parkour:verify',{revision});}}
  function change(next){cells=canonicalMap(next);level=mapLevel(cells,name());if(verified)send('parkour:invalidate');verified=false;onDirty?.();dirty=true;save(cells);status('待保存');clearTimeout(timer);timer=setTimeout(flush,220);}
  for(const button of document.querySelectorAll('[data-map-tool]'))button.addEventListener('click',()=>{tool=button.dataset.mapTool;for(const b of document.querySelectorAll('[data-map-tool]')){b.classList.toggle('active',b===button);b.setAttribute('aria-pressed',String(b===button));}});
  $('editorZoomIn').addEventListener('click',()=>zoomExtra=Math.min(2.5,zoomExtra+.25));$('editorZoomOut').addEventListener('click',()=>zoomExtra=Math.max(.75,zoomExtra-.25));
  $('editorScroll').addEventListener('input',()=>pan=Number($('editorScroll').value)/100);
  $('editorVerify').addEventListener('click',()=>{verifyPending=true;flush();});
  function cellAt(event){const box=canvas.getBoundingClientRect();return {c:Math.floor(((event.clientX-box.left)/view.zoom+view.x)/MAP_TILE),r:Math.floor(((event.clientY-box.top)/view.zoom+view.y)/MAP_TILE)};}
  function paint(event){
    const point=cellAt(event);if(tool==='pan'){if(previous)pan=Math.max(0,Math.min(1,pan-(event.clientX-previous.clientX)/Math.max(1,MAP_WIDTH*view.zoom-width)));$('editorScroll').value=String(pan*100);previous={clientX:event.clientX};return;}
    const start=previous||point,count=Math.max(Math.abs(point.c-start.c),Math.abs(point.r-start.r),1),next=Array.from(cells);let changed=false;
    for(let i=0;i<=Math.min(count,96);i++){const c=Math.round(start.c+(point.c-start.c)*i/count),r=Math.round(start.r+(point.r-start.r)*i/count);if(editableCell(c,r)){const k=event.buttons&2?'0':tool;if(next[r*MAP_COLS+c]!==k){next[r*MAP_COLS+c]=k;changed=true;}}}
    previous=point;if(changed)change(next.join(''));
  }
  canvas.addEventListener('contextmenu',e=>e.preventDefault());canvas.addEventListener('pointerdown',event=>{if(!active)return;event.preventDefault();pointer=event.pointerId;previous=null;canvas.setPointerCapture(pointer);paint(event);});canvas.addEventListener('pointermove',event=>{if(active&&event.pointerId===pointer)paint(event);});
  for(const type of ['pointerup','pointercancel','lostpointercapture'])canvas.addEventListener(type,()=>{pointer=null;previous=null;});
  function frame(now){
    if(active&&level){
      const zoom=Math.max(width/MAP_WIDTH,width<600?.6:.5)*zoomExtra,vw=width/zoom,vh=height/zoom;
      view={zoom,x:Math.max(0,MAP_WIDTH-vw)*pan,y:Math.max(-100,(MAP_HEIGHT-vh)/2)};
      ctx.setTransform(dpr,0,0,dpr,0,0);drawSky(ctx,width,height,view.x);ctx.save();ctx.scale(zoom,zoom);ctx.translate(-view.x,-view.y);ctx.imageSmoothingEnabled=false;
      ctx.fillStyle='#10293a40';ctx.fillRect(0,0,MAP_WIDTH,MAP_HEIGHT);drawCourse(ctx,level,now,true);ctx.strokeStyle='#e5efe41a';ctx.lineWidth=1/zoom;
      for(let x=0;x<=MAP_WIDTH;x+=24){ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,MAP_HEIGHT);ctx.stroke();}for(let y=0;y<=MAP_HEIGHT;y+=24){ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(MAP_WIDTH,y);ctx.stroke();}
      ctx.fillStyle='#e9d99a18';ctx.fillRect(0,0,96,MAP_HEIGHT);ctx.fillRect(MAP_WIDTH-96,0,96,MAP_HEIGHT);drawRunner(ctx,{x:48,y:504,vx:0,vy:0,facing:1,grounded:true,dash:1,dead:0},{color:color(),now,reduced:true});ctx.restore();
    }requestAnimationFrame(frame);
  }requestAnimationFrame(frame);
  return {
    open(data,restore){active=true;verified=data.verified;revision=data.revision;if(!dirty){cells=data.cells;level=mapLevel(cells,name());}status(verified?'已验证':'已保存');if(restore&&data.revision===0&&restore!==cells){try{change(restore);}catch{/* Ignore a stale or damaged browser draft. */}}},
    acknowledged(data){revision=data.revision;verified=data.verified;if(inflight&&data.cells!==cells)dirty=true;inflight=false;if(!dirty){cells=data.cells;level=mapLevel(cells,name());status(verified?'已验证':'已保存');}if(dirty){clearTimeout(timer);timer=setTimeout(flush,140);}else if(verifyPending)flush();},
    stop(){active=false;clearTimeout(timer);dirty=false;inflight=false;verifyPending=false;pointer=null;previous=null;},flush
  };
}
