import {RIG_VIEWS,RIG_PARTS,rigTemplate,rigFromFrames,validRig} from './avatar-rig.js?v=0.13.0';
import {validAvatar} from './avatar-data.js?v=0.13.0';
import {decodeRig,pixelCanvas} from './avatar-render.js?v=0.13.0';
import {drawRig,rigPose} from './avatar-motion.js?v=0.13.0';
import {CLASSIC_SWATCHES,SWATCHES} from './materials.js?v=0.13.0';
import {createColorPicker} from './color-picker.js?v=0.13.0';
export function createAvatarPainter({userId,current,onSave,defaultColor=()=> '568a78'}){
  const $=id=>document.getElementById(id),canvas=$('skinCanvas'),ctx=canvas.getContext('2d'),preview=$('skinPreview'),pc=preview.getContext('2d'),history=[];
  let rig=rigTemplate(),parts=decodeRig(rig),view='down',part='head',owner='',color='ff0000ff',tool='brush',pointer=null,last=null,clipboard=null,cursor=0,picker,saving=false,lastPreview=0;
  const spec=()=>RIG_PARTS.find(p=>p.id===part),pixels=()=>rig.views[view][part].match(/.{8}/g),clone=value=>JSON.parse(JSON.stringify(value));
  const draft=()=>{if(owner)try{localStorage.setItem('dungeon-mail-avatar-parts-draft-'+owner,JSON.stringify(rig));}catch{}};
  function remember(){history.push({rig:clone(rig),view,part});if(history.length>30)history.shift();}
  function refresh(){parts=decodeRig(rig);render();draft();}
  function update(p){rig.views[view][part]=p.join('');const {w,h}=spec();parts[view][part]=pixelCanvas(rig.views[view][part],w,h);render();}
  function choose(hex){if(!/^#[a-f0-9]{6}$/i.test(hex))return;color=hex.slice(1).toLowerCase()+'ff';$('skinColor').value=hex;$('skinHex').value=hex.toUpperCase();picker?.set(hex);if(tool==='erase'||tool==='pick')setTool('brush');for(const b of $('skinPalette').children)b.classList.toggle('selected',b.dataset.color===hex.toLowerCase());}
  function setTool(value){tool=value;for(const [id,name] of [['skinFill','fill'],['skinErase','erase'],['skinPick','pick']])$(id).setAttribute('aria-pressed',String(value===name));}
  function swatches(){$('skinPalette').replaceChildren();for(const hex of ($('skinPaletteMode').value==='soft'?SWATCHES:CLASSIC_SWATCHES)){const b=document.createElement('button');b.type='button';b.style.background=hex;b.dataset.color=hex;b.setAttribute('aria-label','人物颜色 '+hex);b.addEventListener('click',()=>choose(hex));$('skinPalette').append(b);}}
  function render(){
    const {w,h}=spec(),p=pixels(),unit=12;canvas.width=w*unit;canvas.height=h*unit;canvas.style.width=Math.min(260,280*w/h)+'px';canvas.style.aspectRatio=w+'/'+h;
    $('skinDirection').value=view;$('skinPart').value=part;$('skinSize').textContent=w+' × '+h;$('skinPair').hidden=!/Arm|Leg/.test(part);
    for(let i=0;i<p.length;i++){const x=i%w,y=Math.floor(i/w);ctx.fillStyle=(x+y)%2?'#dfe4de':'#f2f4f0';ctx.fillRect(x*unit,y*unit,unit,unit);if(p[i].slice(6)!=='00'){ctx.fillStyle='#'+p[i];ctx.fillRect(x*unit,y*unit,unit,unit);}}
    ctx.strokeStyle='#263f3020';ctx.lineWidth=.5;for(let x=0;x<=w;x++){ctx.beginPath();ctx.moveTo(x*unit,0);ctx.lineTo(x*unit,h*unit);ctx.stroke();}for(let y=0;y<=h;y++){ctx.beginPath();ctx.moveTo(0,y*unit);ctx.lineTo(w*unit,y*unit);ctx.stroke();}
    if(document.activeElement===canvas){ctx.strokeStyle='#344f37';ctx.lineWidth=1;ctx.strokeRect(cursor%w*unit+.5,Math.floor(cursor/w)*unit+.5,unit-1,unit-1);}
    $('skinUndo').disabled=!history.length;$('skinPaste').disabled=!clipboard||clipboard.w!==w||clipboard.h!==h;
  }
  function paint(point){
    const {w,h}=spec(),p=pixels(),i=point.y*w+point.x;cursor=i;if(tool==='pick'){if(p[i].slice(6)!=='00')choose('#'+p[i].slice(0,6));return;}
    const value=tool==='erase'?'00000000':color;
    if(tool==='fill'){const before=p[i];if(before===value)return;const stack=[i];while(stack.length){const n=stack.pop();if(p[n]!==before)continue;p[n]=value;const x=n%w,y=Math.floor(n/w);if(x>0)stack.push(n-1);if(x<w-1)stack.push(n+1);if(y>0)stack.push(n-w);if(y<h-1)stack.push(n+w);}}
    else if(last){const n=Math.max(1,Math.abs(point.x-last.x),Math.abs(point.y-last.y));for(let j=0;j<=n;j++)p[Math.round(last.y+(point.y-last.y)*j/n)*w+Math.round(last.x+(point.x-last.x)*j/n)]=value;}else p[i]=value;
    last=point;update(p);
  }
  function cell(e){const b=canvas.getBoundingClientRect(),{w,h}=spec();return {x:Math.max(0,Math.min(w-1,Math.floor((e.clientX-b.left)/b.width*w))),y:Math.max(0,Math.min(h-1,Math.floor((e.clientY-b.top)/b.height*h)))};}
  canvas.addEventListener('pointerdown',e=>{e.preventDefault();canvas.focus({preventScroll:true});pointer=e.pointerId;canvas.setPointerCapture(pointer);last=null;if(tool!=='pick')remember();paint(cell(e));});
  canvas.addEventListener('pointermove',e=>{if(e.pointerId===pointer&&!['fill','pick'].includes(tool))paint(cell(e));});
  for(const event of ['pointerup','pointercancel','lostpointercapture'])canvas.addEventListener(event,()=>{pointer=null;last=null;draft();});
  canvas.addEventListener('keydown',e=>{const {w,h}=spec();let x=cursor%w,y=Math.floor(cursor/w);if(e.key==='ArrowLeft')x--;else if(e.key==='ArrowRight')x++;else if(e.key==='ArrowUp')y--;else if(e.key==='ArrowDown')y++;else if(e.code==='Space'||e.key==='Enter'){e.preventDefault();if(tool!=='pick')remember();last=null;paint({x,y});draft();return;}else return;e.preventDefault();cursor=Math.max(0,Math.min(h-1,y))*w+Math.max(0,Math.min(w-1,x));render();});
  canvas.addEventListener('focus',render);canvas.addEventListener('blur',render);
  $('skinDirection').addEventListener('change',e=>{view=e.target.value;cursor=0;last=null;render();});$('skinPart').addEventListener('change',e=>{part=e.target.value;cursor=0;last=null;render();});
  $('skinUndo').addEventListener('click',()=>{const old=history.pop();if(old){rig=old.rig;view=old.view;part=old.part;cursor=0;refresh();}});
  $('skinCopy').addEventListener('click',()=>{clipboard={...spec(),pixels:pixels()};render();});$('skinPaste').addEventListener('click',()=>{if(clipboard&&clipboard.w===spec().w&&clipboard.h===spec().h){remember();update(clipboard.pixels.slice());draft();}});
  function mirrored(){const {w,h}=spec(),p=pixels();return Array.from({length:h},(_,y)=>p.slice(y*w,(y+1)*w).reverse()).flat();}
  $('skinMirror').addEventListener('click',()=>{remember();update(mirrored());draft();});
  $('skinPair').addEventListener('click',()=>{if(!/Arm|Leg/.test(part))return;remember();const target=part.startsWith('left')?part.replace('left','right'):part.replace('right','left');rig.views[view][target]=mirrored().join('');refresh();});
  $('skinClear').addEventListener('click',()=>{remember();update(Array(spec().w*spec().h).fill('00000000'));draft();});
  $('skinTemplate').addEventListener('click',()=>{remember();rig=rigTemplate(defaultColor());refresh();$('skinMessage').textContent='';});
  for(const [id,name] of [['skinFill','fill'],['skinErase','erase'],['skinPick','pick']])$(id).addEventListener('click',()=>setTool(tool===name?'brush':name));
  swatches();$('skinPaletteMode').addEventListener('change',swatches);picker=createColorPicker(choose,'skin');choose('#ff0000');
  $('skinColor').addEventListener('input',e=>choose(e.target.value));$('skinHex').addEventListener('input',e=>{const value=e.target.value.trim();if(/^#?[a-f0-9]{6}$/i.test(value))choose('#'+value.replace('#',''));});$('skinHex').addEventListener('blur',()=>$('skinHex').value='#'+color.slice(0,6).toUpperCase());
  $('skinSave').addEventListener('click',()=>{if(!validRig(rig)){$('skinMessage').textContent='每个朝向至少保留一些像素。';return;}saving=true;$('skinSave').disabled=true;$('skinSave').textContent='保存中…';$('skinMessage').textContent='';draft();onSave(clone(rig));});
  function unlock(){saving=false;$('skinSave').disabled=false;$('skinSave').textContent='保存人物';}
  function animate(now){
    if($('avatarDialog').open&&now-lastPreview>1000/45){lastPreview=now;pc.clearRect(0,0,preview.width,preview.height);pc.imageSmoothingEnabled=false;pc.save();pc.translate(32,9);pc.scale(3,3);drawRig(pc,parts[view],rigPose(view,now*.0114,$('skinAnimate').checked?1:0));pc.restore();}requestAnimationFrame(animate);
  }requestAnimationFrame(animate);
  return {
    get saving(){return saving;},
    open(){
      const id=userId();if(!id)return;owner=id;let data=current()?.rig,legacy=false,warning='';
      try{const saved=JSON.parse(localStorage.getItem('dungeon-mail-avatar-parts-draft-'+id)||'null');if(validRig(saved))data=saved;}catch{}
      if(!validRig(data)){let frames=current()?.frames;try{const old=JSON.parse(localStorage.getItem('dungeon-mail-avatar-draft-'+id)||'null');if(validAvatar(old))frames=old;}catch{}if(validAvatar(frames)){data=rigFromFrames(frames);legacy=true;if(!validRig(data)){data=rigTemplate(defaultColor());warning='旧人物的形状不适合自动拆分，已载入部件模板；保存会替换当前人物。';}}else data=rigTemplate(defaultColor());}
      rig=clone(data);parts=decodeRig(rig);view='down';part='head';cursor=0;history.length=0;$('skinMessage').textContent=warning||(legacy?'旧人物已拆为部件，保存后启用自动动作。可先预览和调整。':'');unlock();$('avatarDialog').showModal();render();
    },
    saved(){unlock();try{localStorage.removeItem('dungeon-mail-avatar-parts-draft-'+owner);localStorage.removeItem('dungeon-mail-avatar-draft-'+owner);}catch{}$('avatarDialog').close();},
    failed(message){unlock();$('skinMessage').textContent=message;}
  };
}
