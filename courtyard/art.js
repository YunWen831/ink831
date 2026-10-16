import { SWATCHES, decodePixels, encodePixels } from './materials.js?v=0.4.0';

const textures=new Map();
export function texture(material){
  if(!material)return null;
  const key=material.id+material.pixels;if(textures.has(key))return textures.get(key);
  const pixels=decodePixels(material.pixels);if(!pixels)return null;
  const canvas=document.createElement('canvas');canvas.width=canvas.height=16;
  const ctx=canvas.getContext('2d');
  pixels.forEach((color,i)=>{if(color.slice(6)!=='00'){ctx.fillStyle='#'+color;ctx.fillRect(i%16,Math.floor(i/16),1,1);}});
  textures.set(key,canvas);return canvas;
}
export function preview(canvas,material){
  const ctx=canvas.getContext('2d');ctx.clearRect(0,0,canvas.width,canvas.height);ctx.imageSmoothingEnabled=false;
  const image=texture(material);if(image)ctx.drawImage(image,0,0,canvas.width,canvas.height);
}

export function createPainter(onSave){
  const $=id=>document.getElementById(id),canvas=$('pixelCanvas'),ctx=canvas.getContext('2d');
  let pixels=Array(256).fill('00000000'),color='c16d58ff',tool='brush',pointer=null,last=null,cursor=0;
  const undo=[];
  function remember(){undo.push(pixels.slice());if(undo.length>40)undo.shift();}
  function draft(){try{localStorage.setItem('dungeon-mail-art-draft',JSON.stringify({pixels:encodePixels(pixels),name:$('materialName').value}));}catch{}}
  function choose(hex){
    if(!/^#[0-9a-f]{6}$/i.test(hex))return;
    color=hex.slice(1).toLowerCase()+'ff';$('paintColor').value=hex;$('paintHex').value=hex.toUpperCase();
    for(const button of $('paintPalette').children)button.classList.toggle('selected',button.dataset.color===hex.toLowerCase());
    if(tool==='erase'||tool==='pick')setTool('brush');
  }
  function render(){
    for(let i=0;i<256;i++){
      const x=i%16,y=Math.floor(i/16);ctx.fillStyle=(x+y)%2?'#dfe4de':'#f2f4f0';ctx.fillRect(x*20,y*20,20,20);
      if(pixels[i].slice(6)!=='00'){ctx.fillStyle='#'+pixels[i];ctx.fillRect(x*20,y*20,20,20);}
    }
    ctx.strokeStyle='#263f301c';ctx.lineWidth=1;
    for(let i=0;i<=16;i++){ctx.beginPath();ctx.moveTo(i*20,0);ctx.lineTo(i*20,320);ctx.stroke();ctx.beginPath();ctx.moveTo(0,i*20);ctx.lineTo(320,i*20);ctx.stroke();}
    if(document.activeElement===canvas){ctx.strokeStyle='#344f37';ctx.lineWidth=2;ctx.strokeRect(cursor%16*20+1,Math.floor(cursor/16)*20+1,18,18);}
    preview($('paintPreview'),{id:'draft',pixels:encodePixels(pixels)});
    // Draft changes often; do not retain every temporary image in the world cache.
    for(const key of textures.keys())if(key.startsWith('draft'))textures.delete(key);
    $('undoPaint').disabled=!undo.length;
  }
  function setTool(value){tool=value;for(const [id,name] of [['fillPaint','fill'],['erasePaint','erase'],['pickPaint','pick']])$(id).setAttribute('aria-pressed',String(tool===name));}
  SWATCHES.forEach(hex=>{
    const button=document.createElement('button');button.type='button';button.dataset.color=hex;button.style.background=hex;
    button.setAttribute('aria-label','颜色 '+hex);button.title=hex;
    button.addEventListener('click',()=>choose(hex));$('paintPalette').append(button);
  });
  $('paintColor').addEventListener('input',event=>choose(event.target.value));
  $('paintHex').addEventListener('input',event=>{const value=event.target.value.trim();if(/^#?[0-9a-f]{6}$/i.test(value))choose('#'+value.replace('#',''));});
  $('paintHex').addEventListener('blur',()=>{$('paintHex').value='#'+color.slice(0,6).toUpperCase();});
  function cell(event){const box=canvas.getBoundingClientRect();return {x:Math.max(0,Math.min(15,Math.floor((event.clientX-box.left)/box.width*16))),y:Math.max(0,Math.min(15,Math.floor((event.clientY-box.top)/box.height*16)))};}
  function paint(point){
    const index=point.y*16+point.x;cursor=index;
    if(tool==='pick'){if(pixels[index].slice(6)!=='00')choose('#'+pixels[index].slice(0,6));return;}
    const value=tool==='erase'?'00000000':color;
    if(tool==='fill'){
      const before=pixels[index];if(before===value)return;
      const stack=[index];while(stack.length){const i=stack.pop();if(pixels[i]!==before)continue;pixels[i]=value;const x=i%16,y=Math.floor(i/16);if(x>0)stack.push(i-1);if(x<15)stack.push(i+1);if(y>0)stack.push(i-16);if(y<15)stack.push(i+16);}
    }else if(last){
      const distance=Math.max(Math.abs(point.x-last.x),Math.abs(point.y-last.y),1);
      for(let i=0;i<=distance;i++)pixels[Math.round(last.y+(point.y-last.y)*i/distance)*16+Math.round(last.x+(point.x-last.x)*i/distance)]=value;
    }else pixels[index]=value;
    last=point;render();
  }
  canvas.addEventListener('pointerdown',event=>{event.preventDefault();canvas.focus({preventScroll:true});pointer=event.pointerId;canvas.setPointerCapture(pointer);if(tool!=='pick')remember();last=null;paint(cell(event));});
  canvas.addEventListener('pointermove',event=>{if(pointer===event.pointerId&&tool!=='fill'&&tool!=='pick')paint(cell(event));});
  for(const name of ['pointerup','pointercancel','lostpointercapture'])canvas.addEventListener(name,()=>{pointer=null;last=null;draft();});
  canvas.addEventListener('keydown',event=>{
    let x=cursor%16,y=Math.floor(cursor/16);
    if(event.key==='ArrowLeft')x--;else if(event.key==='ArrowRight')x++;else if(event.key==='ArrowUp')y--;else if(event.key==='ArrowDown')y++;
    else if(event.code==='Space'||event.key==='Enter'){event.preventDefault();if(tool!=='pick')remember();last=null;paint({x,y});draft();return;}else return;
    event.preventDefault();cursor=Math.max(0,Math.min(15,y))*16+Math.max(0,Math.min(15,x));render();
  });
  canvas.addEventListener('focus',render);canvas.addEventListener('blur',render);
  $('undoPaint').addEventListener('click',()=>{const previous=undo.pop();if(previous)pixels=previous;render();draft();});
  $('clearPaint').addEventListener('click',()=>{remember();pixels.fill('00000000');render();draft();});
  for(const [id,name] of [['fillPaint','fill'],['erasePaint','erase'],['pickPaint','pick']])$(id).addEventListener('click',()=>setTool(tool===name?'brush':name));
  $('materialName').addEventListener('input',draft);
  $('saveMaterial').addEventListener('click',()=>{
    if(!$('materialName').value.trim()||!pixels.some(p=>p.slice(6)!=='00')){$('paintMessage').textContent='请输入名称并画上颜色。';return;}
    $('saveMaterial').disabled=true;$('saveMaterial').textContent='保存中…';$('paintMessage').textContent='';onSave({name:$('materialName').value.trim(),pixels:encodePixels(pixels)});
  });
  function unlock(){$('saveMaterial').disabled=false;$('saveMaterial').textContent='保存';}
  choose('#c16d58');
  return {
    open(){
      try{const saved=JSON.parse(localStorage.getItem('dungeon-mail-art-draft')||'null'),decoded=decodePixels(saved?.pixels);if(decoded){pixels=decoded;$('materialName').value=typeof saved.name==='string'?saved.name.slice(0,12):'';undo.length=0;}}catch{}
      $('paintMessage').textContent='';unlock();$('paintDialog').showModal();render();
    },
    saved(){unlock();$('paintMessage').textContent='';$('paintDialog').close();},
    failed(message){unlock();$('paintMessage').textContent=message;},
  };
}
