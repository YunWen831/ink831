import {canonicalMap,mapLevel,editableCell,MAP_LIMITS,MAP_COLS,MAP_TILE,MAP_WIDTH,MAP_HEIGHT} from './parkour-map.js?v=0.15.0';
import {selectionBetween,copySelection,pasteSelection,eraseSelection} from './map-edit.js?v=0.15.0';
import {drawCourse,drawSky} from './parkour-scene.js?v=0.15.0';
import {drawRunner} from './parkour-avatar.js?v=0.15.0';

export function createEditor(canvas,{send,save,name,color,onDirty,canCloud=()=>true}){
  const ctx=canvas.getContext('2d'),$=id=>document.getElementById(id),undo=[],redo=[];
  let active=false,cells='',level=null,revision=0,documentId='',dirty=false,inflight=false,verifyPending=false,cloudPending=null,timer=0,tool='1',width=960,height=640,dpr=1,pointer=null,previous=null,pan=0,zoomExtra=1,view={zoom:1,x:0,y:0},verified=false;
  let selection=null,anchor=null,stamp=null,hover=null,strokeSaved=false,cloud={id:null,version:0,cells:'',title:''},savingCloud=false;
  new ResizeObserver(()=>{const b=canvas.getBoundingClientRect();width=b.width;height=b.height;dpr=Math.min(devicePixelRatio||1,2);canvas.width=Math.round(width*dpr);canvas.height=Math.round(height*dpr);}).observe(canvas);
  const hasChanges=()=>cells!==cloud.cells||$('editorMapName').value.trim()!==cloud.title;
  function buttons(){
    $('editorUndo').disabled=!undo.length;$('editorRedo').disabled=!redo.length;$('editorCopy').disabled=!selection;$('editorPaste').disabled=!stamp;$('editorErase').disabled=!selection;
    $('editorCloudSave').disabled=savingCloud||!canCloud();$('editorCloudCopy').disabled=savingCloud||!canCloud();$('editorLibrary').disabled=!canCloud();
    $('editorCloudStatus').textContent=cloud.id?(hasChanges()?'账号存档有未保存更改':'已存入账号'):'尚未存入账号';
  }
  function status(text){$('editorStatus').textContent=text;buttons();}
  function flush(){
    clearTimeout(timer);if(inflight)return;
    if(dirty){dirty=false;inflight=true;send('parkour:map',{cells,documentId});status('同步中');}
    else{
      if(cloudPending){const meta=cloudPending;cloudPending=null;send('levels:save',{...meta,cells,revision,documentId});}
      if(verifyPending){verifyPending=false;send('parkour:verify',{revision,documentId});}
    }
  }
  function remember(){undo.push(cells);if(undo.length>60)undo.shift();redo.length=0;}
  function change(next){
    next=canonicalMap(next);if(next===cells)return false;cells=next;level=mapLevel(cells,name());
    if(verified)send('parkour:invalidate',{documentId});verified=false;onDirty?.();dirty=true;save(cells);status('待同步');clearTimeout(timer);timer=setTimeout(flush,220);return true;
  }
  function action(next){next=canonicalMap(next);if(next===cells)return;remember();change(next);}
  function setTool(value){tool=value;for(const b of document.querySelectorAll('[data-map-tool]')){b.classList.toggle('active',b.dataset.mapTool===value);b.setAttribute('aria-pressed',String(b.dataset.mapTool===value));}$('editorMechanism').value=[...$('editorMechanism').options].some(o=>o.value===value)?value:'';$('editorMechanism').classList.toggle('active',$('editorMechanism').value!=='');canvas.style.cursor=value==='pan'?'grab':'crosshair';}
  $('editorMechanism').addEventListener('change',event=>setTool(event.target.value));
  for(const button of document.querySelectorAll('[data-map-tool]'))button.addEventListener('click',()=>setTool(button.dataset.mapTool));
  $('editorZoomIn').addEventListener('click',()=>zoomExtra=Math.min(2.5,zoomExtra+.25));$('editorZoomOut').addEventListener('click',()=>zoomExtra=Math.max(.75,zoomExtra-.25));$('editorScroll').addEventListener('input',()=>pan=Number($('editorScroll').value)/100);
  $('editorVerify').addEventListener('click',()=>{verifyPending=true;flush();});
  function goUndo(forward=false){const from=forward?redo:undo,to=forward?undo:redo;if(!active||!from.length)return;to.push(cells);if(to.length>60)to.shift();change(from.pop());buttons();}
  function copy(){if(selection){stamp=copySelection(cells,selection);buttons();}}
  function paste(){if(stamp)setTool('paste');}
  function erase(){if(selection)action(eraseSelection(cells,selection));}
  $('editorUndo').addEventListener('click',()=>goUndo());$('editorRedo').addEventListener('click',()=>goUndo(true));$('editorCopy').addEventListener('click',copy);$('editorPaste').addEventListener('click',paste);$('editorErase').addEventListener('click',erase);$('editorMapName').addEventListener('input',buttons);
  window.addEventListener('keydown',e=>{
    if(!active||document.querySelector('dialog[open]')||/INPUT|TEXTAREA|SELECT/.test(e.target.tagName))return;
    const key=e.key.toLowerCase(),ctrl=e.ctrlKey||e.metaKey;
    if(ctrl&&key==='z'){e.preventDefault();goUndo(e.shiftKey);}else if(ctrl&&key==='y'){e.preventDefault();goUndo(true);}else if(ctrl&&key==='c'&&selection){e.preventDefault();copy();}else if(ctrl&&key==='v'&&stamp){e.preventDefault();paste();}else if(key==='delete'||key==='backspace'){e.preventDefault();erase();}else if(key==='escape'){selection=null;setTool('select');buttons();}
  });
  function cellAt(event){const box=canvas.getBoundingClientRect();return {c:Math.floor(((event.clientX-box.left)/view.zoom+view.x)/MAP_TILE),r:Math.floor(((event.clientY-box.top)/view.zoom+view.y)/MAP_TILE)};}
  function paint(event){
    const point=cellAt(event);hover=point;
    if(tool==='pan'){if(previous)pan=Math.max(0,Math.min(1,pan-(event.clientX-previous.clientX)/Math.max(1,MAP_WIDTH*view.zoom-width)));$('editorScroll').value=String(pan*100);previous={clientX:event.clientX};return;}
    if(tool==='select'){selection=selectionBetween(anchor||point,point);buttons();return;}
    if(tool==='paste'){if(!strokeSaved){action(pasteSelection(cells,stamp,point.c,point.r));strokeSaved=true;}return;}
    const start=previous||point,count=Math.max(Math.abs(point.c-start.c),Math.abs(point.r-start.r),1),next=Array.from(cells);
    for(let i=0;i<=Math.min(count,96);i++){const c=Math.round(start.c+(point.c-start.c)*i/count),r=Math.round(start.r+(point.r-start.r)*i/count);if(editableCell(c,r))next[r*MAP_COLS+c]=event.buttons&2?'0':tool;}
    previous=point;const requested=next.join(''),value=canonicalMap(requested);if(value!==cells){if(!strokeSaved){remember();strokeSaved=true;}change(value);}if(value!==requested&&MAP_LIMITS[tool])status(`该机关已达上限 ${MAP_LIMITS[tool]}${tool==='6'||tool==='e'?'（移动平台合计）':''}`);
  }
  canvas.addEventListener('contextmenu',e=>e.preventDefault());canvas.addEventListener('pointerdown',event=>{if(!active)return;event.preventDefault();canvas.focus({preventScroll:true});pointer=event.pointerId;previous=null;anchor=cellAt(event);strokeSaved=false;canvas.setPointerCapture(pointer);paint(event);});
  canvas.addEventListener('pointermove',event=>{hover=cellAt(event);if(active&&event.pointerId===pointer)paint(event);});canvas.addEventListener('pointerleave',()=>hover=null);
  for(const type of ['pointerup','pointercancel','lostpointercapture'])canvas.addEventListener(type,()=>{pointer=null;previous=null;anchor=null;strokeSaved=false;});
  function frame(now){
    if(active&&level){
      const zoom=Math.max(width/MAP_WIDTH,width<600?.6:.5)*zoomExtra,vw=width/zoom,vh=height/zoom;view={zoom,x:Math.max(0,MAP_WIDTH-vw)*pan,y:Math.max(-100,(MAP_HEIGHT-vh)/2)};
      ctx.setTransform(dpr,0,0,dpr,0,0);drawSky(ctx,width,height,view.x);ctx.save();ctx.scale(zoom,zoom);ctx.translate(-view.x,-view.y);ctx.imageSmoothingEnabled=false;
      ctx.fillStyle='#10293a40';ctx.fillRect(0,0,MAP_WIDTH,MAP_HEIGHT);drawCourse(ctx,level,now,true);ctx.strokeStyle='#e5efe41a';ctx.lineWidth=1/zoom;
      for(let x=0;x<=MAP_WIDTH;x+=24){ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,MAP_HEIGHT);ctx.stroke();}for(let y=0;y<=MAP_HEIGHT;y+=24){ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(MAP_WIDTH,y);ctx.stroke();}
      ctx.fillStyle='#e9d99a18';ctx.fillRect(0,0,96,MAP_HEIGHT);ctx.fillRect(MAP_WIDTH-96,0,96,MAP_HEIGHT);
      if(selection){ctx.fillStyle='#9be8db33';ctx.strokeStyle='#a8f4df';ctx.lineWidth=2/zoom;const {left,top,right,bottom}=selection;ctx.fillRect(left*24,top*24,(right-left+1)*24,(bottom-top+1)*24);ctx.strokeRect(left*24,top*24,(right-left+1)*24,(bottom-top+1)*24);}
      if(tool==='paste'&&stamp&&hover){ctx.strokeStyle='#f3df9a';ctx.lineWidth=2/zoom;ctx.strokeRect(hover.c*24,hover.r*24,stamp.width*24,stamp.height*24);}
      drawRunner(ctx,{x:48,y:504,vx:0,vy:0,facing:1,grounded:true,dash:1,dead:0},{color:color(),now,reduced:true});ctx.restore();
    }requestAnimationFrame(frame);
  }requestAnimationFrame(frame);
  return {
    get active(){return active;},get hasUnsaved(){return active&&hasChanges();},get cloudId(){return cloud.id;},get saving(){return savingCloud;},
    open(data,restore){
      const different=data.documentId!==documentId;
      if(different){clearTimeout(timer);dirty=false;inflight=false;verifyPending=false;cloudPending=null;savingCloud=false;documentId=data.documentId;undo.length=0;redo.length=0;selection=null;cloud={id:data.cloudId,version:data.cloudVersion,cells:data.cells,title:data.title};$('editorMapName').value=data.title||'我的关卡';}
      else if(data.cloudId&&(!cloud.id||data.cloudId===cloud.id)&&data.cloudVersion>cloud.version){cloud.id=data.cloudId;cloud.version=data.cloudVersion;}
      active=true;verified=data.verified;revision=data.revision;if(!dirty){cells=data.cells;level=mapLevel(cells,name());}
      status(verified?'已验证':'已同步');if(different&&restore&&data.revision===0&&restore!==cells){try{change(restore);}catch{}}
    },
    acknowledged(data){if(data.documentId!==documentId){this.open(data);return;}if(data.cloudId&&(!cloud.id||data.cloudId===cloud.id)&&data.cloudVersion>cloud.version){cloud.id=data.cloudId;cloud.version=data.cloudVersion;}revision=data.revision;verified=data.verified;if(inflight&&data.cells!==cells)dirty=true;inflight=false;if(!dirty){cells=data.cells;level=mapLevel(cells,name());status(verified?'已验证':'已同步');}if(dirty){clearTimeout(timer);timer=setTimeout(flush,140);}else flush();},
    saveCloud(copy=false){if(!active||savingCloud)return;const title=$('editorMapName').value.trim();if(!title){$('editorCloudStatus').textContent='请填写关卡名';return;}savingCloud=true;cloudPending={id:copy?null:cloud.id,version:copy?0:cloud.version,title};buttons();flush();},
    cloudSaved(data){if(data.documentId!==documentId)return;savingCloud=false;cloud={id:data.id,version:data.version,cells:data.cells,title:data.title};buttons();},
    cloudDeleted(id){if(cloud.id===id){cloud={id:null,version:0,cells:'',title:''};buttons();}},
    failed(message){savingCloud=false;cloudPending=null;buttons();$('editorCloudStatus').textContent=message;},
    stop(){active=false;clearTimeout(timer);dirty=false;inflight=false;verifyPending=false;cloudPending=null;savingCloud=false;pointer=null;previous=null;},flush
  };
}
