import { SWATCHES, CLASSIC_SWATCHES, decodePixels, encodePixels, materialSize, resizePixels } from './materials.js?v=0.7.0';
import { createColorPicker } from './color-picker.js?v=0.7.0';

const textures=new Map();
export function texture(material){
  if(!material)return null;
  const key=material.id+material.pixels;if(textures.has(key))return textures.get(key);
  const pixels=decodePixels(material.pixels);if(!pixels)return null;
  const canvas=document.createElement('canvas');const size=Math.sqrt(pixels.length);canvas.width=canvas.height=size;
  const ctx=canvas.getContext('2d');
  pixels.forEach((color,i)=>{if(color.slice(6)!=='00'){ctx.fillStyle='#'+color;ctx.fillRect(i%size,Math.floor(i/size),1,1);}});
  textures.set(key,canvas);return canvas;
}
export function preview(canvas,material){
  const image=texture(material),size=image?.width||16;
  if(canvas.width!==size||canvas.height!==size)canvas.width=canvas.height=size;
  const ctx=canvas.getContext('2d');ctx.clearRect(0,0,size,size);ctx.imageSmoothingEnabled=false;
  if(image)ctx.drawImage(image,0,0,size,size);
}

export function createPainter(onSave){
  const $=id=>document.getElementById(id),canvas=$('pixelCanvas'),ctx=canvas.getContext('2d');
  let size=32,pixels=Array(size*size).fill('00000000'),color='c16d58ff',tool='brush',pointer=null,last=null,cursor=0;
  const undo=[];let picker=null;
  function remember(){undo.push({pixels:pixels.slice(),size});if(undo.length>40)undo.shift();}
  function draft(){try{localStorage.setItem('dungeon-mail-art-draft',JSON.stringify({pixels:encodePixels(pixels),size,name:$('materialName').value}));}catch{}}
  function choose(hex){
    if(!/^#[0-9a-f]{6}$/i.test(hex))return;
    color=hex.slice(1).toLowerCase()+'ff';$('paintColor').value=hex;$('paintHex').value=hex.toUpperCase();
    picker?.set(hex);
    for(const button of $('paintPalette').children)button.classList.toggle('selected',button.dataset.color===hex.toLowerCase());
    if(tool==='erase'||tool==='pick')setTool('brush');
  }
  function render(){
    const step=canvas.width/size;$('paintSize').value=String(size);canvas.setAttribute('aria-label',`${size}乘${size}像素绘画板，拖动绘画`);
    for(let i=0;i<pixels.length;i++){
      const x=i%size,y=Math.floor(i/size);ctx.fillStyle=(x+y)%2?'#dfe4de':'#f2f4f0';ctx.fillRect(x*step,y*step,step,step);
      if(pixels[i].slice(6)!=='00'){ctx.fillStyle='#'+pixels[i];ctx.fillRect(x*step,y*step,step,step);}
    }
    ctx.strokeStyle='#263f301c';ctx.lineWidth=size===64?.5:1;
    for(let i=0;i<=size;i++){ctx.beginPath();ctx.moveTo(i*step,0);ctx.lineTo(i*step,320);ctx.stroke();ctx.beginPath();ctx.moveTo(0,i*step);ctx.lineTo(320,i*step);ctx.stroke();}
    if(document.activeElement===canvas){ctx.strokeStyle='#344f37';ctx.lineWidth=1;ctx.strokeRect(cursor%size*step+.5,Math.floor(cursor/size)*step+.5,step-1,step-1);}
    preview($('paintPreview'),{id:'draft',pixels:encodePixels(pixels)});
    for(const key of textures.keys())if(key.startsWith('draft'))textures.delete(key);
    $('undoPaint').disabled=!undo.length;
  }
  function setTool(value){tool=value;for(const [id,name] of [['fillPaint','fill'],['erasePaint','erase'],['pickPaint','pick']])$(id).setAttribute('aria-pressed',String(tool===name));}
  function renderSwatches(){
  $('paintPalette').replaceChildren();
  ($('paletteMode').value==='soft'?SWATCHES:CLASSIC_SWATCHES).forEach(hex=>{
    const button=document.createElement('button');button.type='button';button.dataset.color=hex;button.style.background=hex;
    button.setAttribute('aria-label','颜色 '+hex);button.title=hex;
    button.addEventListener('click',()=>choose(hex));$('paintPalette').append(button);
  });
  for(const button of $('paintPalette').children)button.classList.toggle('selected',button.dataset.color===('#'+color.slice(0,6)));
  }
  renderSwatches();$('paletteMode').addEventListener('change',renderSwatches);picker=createColorPicker(choose);
  $('paintColor').addEventListener('input',event=>choose(event.target.value));
  $('paintHex').addEventListener('input',event=>{const value=event.target.value.trim();if(/^#?[0-9a-f]{6}$/i.test(value))choose('#'+value.replace('#',''));});
  $('paintHex').addEventListener('blur',()=>{$('paintHex').value='#'+color.slice(0,6).toUpperCase();});
  function cell(event){const box=canvas.getBoundingClientRect();return {x:Math.max(0,Math.min(size-1,Math.floor((event.clientX-box.left)/box.width*size))),y:Math.max(0,Math.min(size-1,Math.floor((event.clientY-box.top)/box.height*size)))};}
  function paint(point){
    const index=point.y*size+point.x;cursor=index;
    if(tool==='pick'){if(pixels[index].slice(6)!=='00')choose('#'+pixels[index].slice(0,6));return;}
    const value=tool==='erase'?'00000000':color;
    if(tool==='fill'){
      const before=pixels[index];if(before===value)return;
      const stack=[index];while(stack.length){const i=stack.pop();if(pixels[i]!==before)continue;pixels[i]=value;const x=i%size,y=Math.floor(i/size);if(x>0)stack.push(i-1);if(x<size-1)stack.push(i+1);if(y>0)stack.push(i-size);if(y<size-1)stack.push(i+size);}
    }else if(last){
      const distance=Math.max(Math.abs(point.x-last.x),Math.abs(point.y-last.y),1);
      for(let i=0;i<=distance;i++)pixels[Math.round(last.y+(point.y-last.y)*i/distance)*size+Math.round(last.x+(point.x-last.x)*i/distance)]=value;
    }else pixels[index]=value;
    last=point;render();
  }
  canvas.addEventListener('pointerdown',event=>{event.preventDefault();canvas.focus({preventScroll:true});pointer=event.pointerId;canvas.setPointerCapture(pointer);if(tool!=='pick')remember();last=null;paint(cell(event));});
  canvas.addEventListener('pointermove',event=>{if(pointer===event.pointerId&&tool!=='fill'&&tool!=='pick')paint(cell(event));});
  for(const name of ['pointerup','pointercancel','lostpointercapture'])canvas.addEventListener(name,()=>{pointer=null;last=null;draft();});
  canvas.addEventListener('keydown',event=>{
    let x=cursor%size,y=Math.floor(cursor/size);
    if(event.key==='ArrowLeft')x--;else if(event.key==='ArrowRight')x++;else if(event.key==='ArrowUp')y--;else if(event.key==='ArrowDown')y++;
    else if(event.code==='Space'||event.key==='Enter'){event.preventDefault();if(tool!=='pick')remember();last=null;paint({x,y});draft();return;}else return;
    event.preventDefault();cursor=Math.max(0,Math.min(size-1,y))*size+Math.max(0,Math.min(size-1,x));render();
  });
  canvas.addEventListener('focus',render);canvas.addEventListener('blur',render);
  $('undoPaint').addEventListener('click',()=>{const previous=undo.pop();if(previous){pixels=previous.pixels;size=previous.size;cursor=0;}render();draft();});
  $('paintSize').addEventListener('change',()=>{remember();const next=Number($('paintSize').value);pixels=resizePixels(pixels,next);size=next;cursor=0;last=null;render();draft();});
  $('clearPaint').addEventListener('click',()=>{remember();pixels.fill('00000000');render();draft();});
  for(const [id,name] of [['fillPaint','fill'],['erasePaint','erase'],['pickPaint','pick']])$(id).addEventListener('click',()=>setTool(tool===name?'brush':name));
  $('materialName').addEventListener('input',draft);
  $('saveMaterial').addEventListener('click',()=>{
    if(!$('materialName').value.trim()||!pixels.some(p=>p.slice(6)!=='00')){$('paintMessage').textContent='请输入名称并画上颜色。';return;}
    $('saveMaterial').disabled=true;$('saveMaterial').textContent='保存中…';$('paintMessage').textContent='';onSave({name:$('materialName').value.trim(),pixels:encodePixels(pixels)});
  });
  function unlock(){$('saveMaterial').disabled=false;$('saveMaterial').textContent='保存';}
  choose('#ff0000');
  return {
    open(){
      try{const saved=JSON.parse(localStorage.getItem('dungeon-mail-art-draft')||'null'),decoded=decodePixels(saved?.pixels);if(decoded){pixels=decoded;size=materialSize(saved.pixels);cursor=0;$('materialName').value=typeof saved.name==='string'?saved.name.slice(0,12):'';undo.length=0;}}catch{}
      $('paintMessage').textContent='';unlock();$('paintDialog').showModal();render();
    },
    saved(){unlock();$('paintMessage').textContent='';$('paintDialog').close();},
    failed(message){unlock();$('paintMessage').textContent=message;},
  };
}
