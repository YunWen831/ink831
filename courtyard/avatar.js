import { AVATAR_DIRECTIONS,avatarTemplate,validAvatar } from './avatar-data.js?v=0.8.0';
import { CLASSIC_SWATCHES,SWATCHES } from './materials.js?v=0.8.0';
import { createColorPicker } from './color-picker.js?v=0.8.0';

const images=new Map();
export function avatarImage(data,direction='down',frame=0){
  if(!data)return null;const key=data.userId+':'+data.revision;
  let frames=images.get(key);
  if(!frames){
    frames=data.frames.map(text=>{const canvas=document.createElement('canvas');canvas.width=32;canvas.height=48;const context=canvas.getContext('2d'),image=context.createImageData(32,48);for(let i=0;i<1536;i++)for(let c=0;c<4;c++)image.data[i*4+c]=parseInt(text.slice(i*8+c*2,i*8+c*2+2),16);context.putImageData(image,0,0);return canvas;});
    images.set(key,frames);if(images.size>128)images.delete(images.keys().next().value);
  }
  return frames[Math.max(0,AVATAR_DIRECTIONS.indexOf(direction))*3+Math.max(0,Math.min(2,frame))];
}
export function createAvatarPainter({userId,current,onSave}){
  const $=id=>document.getElementById(id),canvas=$('skinCanvas'),ctx=canvas.getContext('2d'),preview=$('skinPreview'),pc=preview.getContext('2d');
  let frames=avatarTemplate().map(s=>s.match(/.{8}/g)),direction=0,frame=0,color='ff0000ff',tool='brush',pointer=null,last=null,clipboard=null,cursor=0,picker;
  const history=[];let changed=false,owner='',lastPreview=0,saving=false;
  const index=()=>direction*3+frame,pixels=()=>frames[index()];
  function remember(){history.push({frames:frames.map(p=>p.slice()),direction,frame});if(history.length>24)history.shift();changed=true;}
  function draft(){if(!owner)return;try{localStorage.setItem('dungeon-mail-avatar-draft-'+owner,JSON.stringify(frames.map(p=>p.join(''))));}catch{}}
  function choose(hex){if(!/^#[a-f0-9]{6}$/i.test(hex))return;color=hex.slice(1).toLowerCase()+'ff';$('skinColor').value=hex;$('skinHex').value=hex.toUpperCase();picker?.set(hex);if(tool==='erase'||tool==='pick')setTool('brush');for(const b of $('skinPalette').children)b.classList.toggle('selected',b.dataset.color===hex.toLowerCase());}
  function swatches(){
    $('skinPalette').replaceChildren();for(const hex of ($('skinPaletteMode').value==='soft'?SWATCHES:CLASSIC_SWATCHES)){const button=document.createElement('button');button.type='button';button.style.background=hex;button.dataset.color=hex;button.setAttribute('aria-label','人物颜色 '+hex);button.addEventListener('click',()=>choose(hex));$('skinPalette').append(button);}
  }
  function setTool(value){tool=value;for(const [id,name] of [['skinFill','fill'],['skinErase','erase'],['skinPick','pick']])$(id).setAttribute('aria-pressed',String(value===name));}
  function render(){
    $('skinDirection').value=String(direction);$('skinFrame').value=String(frame);const p=pixels();
    for(let i=0;i<p.length;i++){const x=i%32,y=Math.floor(i/32);ctx.fillStyle=(x+y)%2?'#dfe4de':'#f2f4f0';ctx.fillRect(x*10,y*10,10,10);if(p[i].slice(6)!=='00'){ctx.fillStyle='#'+p[i];ctx.fillRect(x*10,y*10,10,10);}}
    ctx.strokeStyle='#263f301c';ctx.lineWidth=.5;for(let x=0;x<=32;x++){ctx.beginPath();ctx.moveTo(x*10,0);ctx.lineTo(x*10,480);ctx.stroke();}for(let y=0;y<=48;y++){ctx.beginPath();ctx.moveTo(0,y*10);ctx.lineTo(320,y*10);ctx.stroke();}
    if(document.activeElement===canvas){ctx.strokeStyle='#344f37';ctx.lineWidth=1;ctx.strokeRect(cursor%32*10+.5,Math.floor(cursor/32)*10+.5,9,9);}
    $('skinUndo').disabled=!history.length;$('skinPaste').disabled=!clipboard;
  }
  function paint(point){
    const p=pixels(),i=point.y*32+point.x;cursor=i;
    if(tool==='pick'){if(p[i].slice(6)!=='00')choose('#'+p[i].slice(0,6));return;}
    const value=tool==='erase'?'00000000':color;
    if(tool==='fill'){
      const before=p[i];if(before===value)return;const stack=[i];while(stack.length){const n=stack.pop();if(p[n]!==before)continue;p[n]=value;const x=n%32,y=Math.floor(n/32);if(x>0)stack.push(n-1);if(x<31)stack.push(n+1);if(y>0)stack.push(n-32);if(y<47)stack.push(n+32);}
    }else if(last){const steps=Math.max(1,Math.abs(point.x-last.x),Math.abs(point.y-last.y));for(let n=0;n<=steps;n++)p[Math.round(last.y+(point.y-last.y)*n/steps)*32+Math.round(last.x+(point.x-last.x)*n/steps)]=value;}else p[i]=value;
    last=point;render();
  }
  function cell(e){const b=canvas.getBoundingClientRect();return {x:Math.max(0,Math.min(31,Math.floor((e.clientX-b.left)/b.width*32))),y:Math.max(0,Math.min(47,Math.floor((e.clientY-b.top)/b.height*48)))};}
  canvas.addEventListener('pointerdown',e=>{e.preventDefault();canvas.focus({preventScroll:true});pointer=e.pointerId;canvas.setPointerCapture(pointer);last=null;if(tool!=='pick')remember();paint(cell(e));});
  canvas.addEventListener('pointermove',e=>{if(e.pointerId===pointer&&!['fill','pick'].includes(tool))paint(cell(e));});
  for(const event of ['pointerup','pointercancel','lostpointercapture'])canvas.addEventListener(event,()=>{pointer=null;last=null;draft();});
  canvas.addEventListener('keydown',e=>{let x=cursor%32,y=Math.floor(cursor/32);if(e.key==='ArrowLeft')x--;else if(e.key==='ArrowRight')x++;else if(e.key==='ArrowUp')y--;else if(e.key==='ArrowDown')y++;else if(e.code==='Space'||e.key==='Enter'){e.preventDefault();if(tool!=='pick')remember();last=null;paint({x,y});draft();return;}else return;e.preventDefault();cursor=Math.max(0,Math.min(47,y))*32+Math.max(0,Math.min(31,x));render();});
  canvas.addEventListener('focus',render);canvas.addEventListener('blur',render);
  $('skinDirection').addEventListener('change',e=>{direction=Number(e.target.value);last=null;render();});$('skinFrame').addEventListener('change',e=>{frame=Number(e.target.value);last=null;render();});
  $('skinUndo').addEventListener('click',()=>{const old=history.pop();if(old){frames=old.frames;direction=old.direction;frame=old.frame;render();draft();}});
  $('skinCopy').addEventListener('click',()=>{clipboard=pixels().slice();render();});
  $('skinPaste').addEventListener('click',()=>{if(clipboard){remember();frames[index()]=clipboard.slice();render();draft();}});
  $('skinMirror').addEventListener('click',()=>{remember();const old=pixels();frames[index()]=Array.from({length:48},(_,y)=>old.slice(y*32,y*32+32).reverse()).flat();render();draft();});
  $('skinTemplate').addEventListener('click',()=>{remember();frames=avatarTemplate().map(s=>s.match(/.{8}/g));render();draft();});
  for(const [id,name] of [['skinFill','fill'],['skinErase','erase'],['skinPick','pick']])$(id).addEventListener('click',()=>setTool(tool===name?'brush':name));
  swatches();$('skinPaletteMode').addEventListener('change',swatches);picker=createColorPicker(choose,'skin');choose('#ff0000');
  $('skinColor').addEventListener('input',e=>choose(e.target.value));$('skinHex').addEventListener('input',e=>{const value=e.target.value.trim();if(/^#?[a-f0-9]{6}$/i.test(value))choose('#'+value.replace('#',''));});$('skinHex').addEventListener('blur',()=>$('skinHex').value='#'+color.slice(0,6).toUpperCase());
  $('skinSave').addEventListener('click',()=>{const data=frames.map(p=>p.join(''));if(!validAvatar(data)){$('skinMessage').textContent='每一帧至少保留一个像素。';return;}saving=true;$('skinSave').disabled=true;$('skinSave').textContent='保存中…';$('skinMessage').textContent='';draft();onSave(data);});
  function unlock(){saving=false;$('skinSave').disabled=false;$('skinSave').textContent='保存人物';}
  function animate(now){
    if($('avatarDialog').open&&now-lastPreview>120){lastPreview=now;pc.clearRect(0,0,96,144);pc.imageSmoothingEnabled=false;const selected=$('skinAnimate').checked?[0,1,0,2][Math.floor(now/150)%4]:frame,p=frames[direction*3+selected];for(let i=0;i<p.length;i++)if(p[i].slice(6)!=='00'){pc.fillStyle='#'+p[i];pc.fillRect(i%32*3,Math.floor(i/32)*3,3,3);}}
    requestAnimationFrame(animate);
  }requestAnimationFrame(animate);
  return {
    get saving(){return saving;},
    open(){const id=userId();if(!id)return;owner=id;let data=current()?.frames;try{const saved=JSON.parse(localStorage.getItem('dungeon-mail-avatar-draft-'+id)||'null');if(validAvatar(saved))data=saved;}catch{}frames=(validAvatar(data)?data:avatarTemplate()).map(s=>s.match(/.{8}/g));direction=0;frame=0;history.length=0;changed=false;cursor=0;$('skinMessage').textContent='';unlock();$('avatarDialog').showModal();render();},
    saved(){changed=false;unlock();try{localStorage.removeItem('dungeon-mail-avatar-draft-'+owner);}catch{}$('avatarDialog').close();},
    failed(message){unlock();$('skinMessage').textContent=message;},
  };
}
