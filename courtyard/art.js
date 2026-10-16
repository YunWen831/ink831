import { PALETTE } from './materials.js?v=0.2.0';

const textures=new Map();
export function texture(material){
  if(!material)return null;
  const key=material.id+material.pixels;
  if(textures.has(key))return textures.get(key);
  const canvas=document.createElement('canvas');canvas.width=canvas.height=16;
  const ctx=canvas.getContext('2d');
  for(let i=0;i<256;i++){const color=parseInt(material.pixels[i],16);if(color){ctx.fillStyle=PALETTE[color];ctx.fillRect(i%16,Math.floor(i/16),1,1);}}
  textures.set(key,canvas);return canvas;
}
export function preview(canvas,material){
  const ctx=canvas.getContext('2d');ctx.clearRect(0,0,canvas.width,canvas.height);ctx.imageSmoothingEnabled=false;
  const image=texture(material);if(image)ctx.drawImage(image,0,0,canvas.width,canvas.height);
}

export function createPainter(onSave){
  const $=id=>document.getElementById(id),canvas=$('pixelCanvas'),ctx=canvas.getContext('2d');
  let pixels=Array(256).fill('0'),color='9',tool='brush',pointer=null,last=null,cursor=0;
  const undo=[];
  function remember(){undo.push(pixels.join(''));if(undo.length>32)undo.shift();}
  function draft(){try{localStorage.setItem('dungeon-mail-art-draft',JSON.stringify({pixels:pixels.join(''),name:$('materialName').value}));}catch{}}
  function render(){
    for(let i=0;i<256;i++){
      const x=i%16,y=Math.floor(i/16);ctx.fillStyle=(x+y)%2?'#dee5d0':'#eef1e3';ctx.fillRect(x*20,y*20,20,20);
      if(pixels[i]!=='0'){ctx.fillStyle=PALETTE[parseInt(pixels[i],16)];ctx.fillRect(x*20,y*20,20,20);}
    }
    ctx.strokeStyle='#526e3d20';ctx.lineWidth=1;for(let i=0;i<=16;i++){ctx.beginPath();ctx.moveTo(i*20,0);ctx.lineTo(i*20,320);ctx.stroke();ctx.beginPath();ctx.moveTo(0,i*20);ctx.lineTo(320,i*20);ctx.stroke();}
    if(document.activeElement===canvas){ctx.strokeStyle='#344f37';ctx.lineWidth=2;ctx.strokeRect(cursor%16*20+1,Math.floor(cursor/16)*20+1,18,18);}
    const small=$('paintPreview').getContext('2d');small.clearRect(0,0,16,16);
    pixels.forEach((c,i)=>{if(c!=='0'){small.fillStyle=PALETTE[parseInt(c,16)];small.fillRect(i%16,Math.floor(i/16),1,1);}});
    $('undoPaint').disabled=!undo.length;
  }
  function setTool(value){tool=value;$('fillPaint').setAttribute('aria-pressed',String(tool==='fill'));$('erasePaint').setAttribute('aria-pressed',String(tool==='erase'));}
  PALETTE.forEach((hex,index)=>{
    const button=document.createElement('button');button.type='button';button.style.background=index?hex:'repeating-conic-gradient(#d7dfcb 0% 25%, #fff 0% 50%) 0 / 10px 10px';
    button.setAttribute('aria-label',index?`颜色 ${index} ${hex}`:'透明颜色');button.title=index?hex:'透明';button.classList.toggle('selected',index===9);
    button.addEventListener('click',()=>{color=index.toString(16);if(tool==='erase')setTool('brush');for(const b of $('paintPalette').children)b.classList.toggle('selected',b===button);});$('paintPalette').append(button);
  });
  function cell(event){const box=canvas.getBoundingClientRect();return {x:Math.max(0,Math.min(15,Math.floor((event.clientX-box.left)/box.width*16))),y:Math.max(0,Math.min(15,Math.floor((event.clientY-box.top)/box.height*16)))};}
  function paint(point){
    const index=point.y*16+point.x,value=tool==='erase'?'0':color;cursor=index;
    if(tool==='fill'){
      const before=pixels[index];if(before===value)return;
      const stack=[index];while(stack.length){const i=stack.pop();if(pixels[i]!==before)continue;pixels[i]=value;const x=i%16,y=Math.floor(i/16);if(x>0)stack.push(i-1);if(x<15)stack.push(i+1);if(y>0)stack.push(i-16);if(y<15)stack.push(i+16);}
    }else if(last){
      const distance=Math.max(Math.abs(point.x-last.x),Math.abs(point.y-last.y),1);
      for(let i=0;i<=distance;i++)pixels[Math.round(last.y+(point.y-last.y)*i/distance)*16+Math.round(last.x+(point.x-last.x)*i/distance)]=value;
    }else pixels[index]=value;
    last=point;render();
  }
  canvas.addEventListener('pointerdown',event=>{event.preventDefault();canvas.focus({preventScroll:true});pointer=event.pointerId;canvas.setPointerCapture(pointer);remember();last=null;paint(cell(event));});
  canvas.addEventListener('pointermove',event=>{if(pointer===event.pointerId&&tool!=='fill')paint(cell(event));});
  for(const name of ['pointerup','pointercancel','lostpointercapture'])canvas.addEventListener(name,()=>{pointer=null;last=null;draft();});
  canvas.addEventListener('keydown',event=>{
    let x=cursor%16,y=Math.floor(cursor/16);
    if(event.key==='ArrowLeft')x--;else if(event.key==='ArrowRight')x++;else if(event.key==='ArrowUp')y--;else if(event.key==='ArrowDown')y++;
    else if(event.code==='Space'||event.key==='Enter'){event.preventDefault();remember();last=null;paint({x,y});draft();return;}else return;
    event.preventDefault();cursor=Math.max(0,Math.min(15,y))*16+Math.max(0,Math.min(15,x));render();
  });
  canvas.addEventListener('focus',render);canvas.addEventListener('blur',render);
  $('undoPaint').addEventListener('click',()=>{const previous=undo.pop();if(previous)pixels=[...previous];render();draft();});
  $('clearPaint').addEventListener('click',()=>{remember();pixels.fill('0');render();draft();});
  $('fillPaint').addEventListener('click',()=>setTool(tool==='fill'?'brush':'fill'));
  $('erasePaint').addEventListener('click',()=>setTool(tool==='erase'?'brush':'erase'));
  $('materialName').addEventListener('input',draft);
  $('saveMaterial').addEventListener('click',()=>{
    if(!$('materialName').value.trim()||!pixels.some(p=>p!=='0')){$('paintMessage').textContent='给材料起个名字，并至少画一个像素。';return;}
    $('saveMaterial').disabled=true;$('saveMaterial').textContent='正在保存…';$('paintMessage').textContent='正在把作品保存到庭院。';onSave({name:$('materialName').value.trim(),pixels:pixels.join('')});
  });
  function unlock(){$('saveMaterial').disabled=false;$('saveMaterial').textContent='保存到公共材料栏 ↗';}
  return {
    open(){
      try{const saved=JSON.parse(localStorage.getItem('dungeon-mail-art-draft')||'null');if(/^[0-9a-f]{256}$/.test(saved?.pixels)){pixels=[...saved.pixels];$('materialName').value=typeof saved.name==='string'?saved.name.slice(0,12):'';}}catch{}
      $('paintMessage').textContent='';unlock();$('paintDialog').showModal();render();
    },
    saved(){unlock();$('paintMessage').textContent='已保存';$('paintDialog').close();},
    failed(message){unlock();$('paintMessage').textContent=message;},
  };
}
