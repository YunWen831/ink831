export function hsvToHex(h,s,v){
  const c=v*s,x=c*(1-Math.abs((h/60)%2-1)),m=v-c;
  const [r,g,b]=h<60?[c,x,0]:h<120?[x,c,0]:h<180?[0,c,x]:h<240?[0,x,c]:h<300?[x,0,c]:[c,0,x];
  return '#'+[r,g,b].map(n=>Math.round((n+m)*255).toString(16).padStart(2,'0')).join('');
}
export function hexToHsv(hex){
  const [r,g,b]=[1,3,5].map(i=>parseInt(hex.slice(i,i+2),16)/255),max=Math.max(r,g,b),min=Math.min(r,g,b),d=max-min;
  let h=d===0?0:max===r?60*(((g-b)/d)%6):max===g?60*((b-r)/d+2):60*((r-g)/d+4);if(h<0)h+=360;
  return {h,s:max===0?0:d/max,v:max};
}
export function createColorPicker(onChange){
  const $=id=>document.getElementById(id),canvas=$('paintSpectrum'),ctx=canvas.getContext('2d'),channels=['R','G','B'];
  let h=0,s=1,v=1,pointer=null;
  function render(){
    ctx.fillStyle=hsvToHex(h,1,1);ctx.fillRect(0,0,256,96);
    const white=ctx.createLinearGradient(0,0,256,0);white.addColorStop(0,'#ffffff');white.addColorStop(1,'#ffffff00');ctx.fillStyle=white;ctx.fillRect(0,0,256,96);
    const black=ctx.createLinearGradient(0,0,0,96);black.addColorStop(0,'#00000000');black.addColorStop(1,'#000000');ctx.fillStyle=black;ctx.fillRect(0,0,256,96);
    ctx.beginPath();ctx.arc(s*256,(1-v)*96,4,0,Math.PI*2);ctx.strokeStyle='#fff';ctx.lineWidth=2;ctx.stroke();ctx.strokeStyle='#203443';ctx.lineWidth=1;ctx.stroke();
    canvas.setAttribute('aria-valuenow',String(Math.round(s*100)));canvas.setAttribute('aria-valuetext',`饱和度 ${Math.round(s*100)}%，明度 ${Math.round(v*100)}%`);
  }
  function emit(){onChange(hsvToHex(h,s,v));}
  function point(e){const b=canvas.getBoundingClientRect();s=Math.max(0,Math.min(1,(e.clientX-b.left)/b.width));v=1-Math.max(0,Math.min(1,(e.clientY-b.top)/b.height));emit();}
  canvas.addEventListener('pointerdown',e=>{e.preventDefault();canvas.focus({preventScroll:true});pointer=e.pointerId;canvas.setPointerCapture(pointer);point(e);});canvas.addEventListener('pointermove',e=>{if(e.pointerId===pointer)point(e);});for(const type of ['pointerup','pointercancel','lostpointercapture'])canvas.addEventListener(type,()=>pointer=null);
  canvas.addEventListener('keydown',e=>{const step=e.shiftKey?.1:.01;if(e.key==='ArrowLeft')s=Math.max(0,s-step);else if(e.key==='ArrowRight')s=Math.min(1,s+step);else if(e.key==='ArrowUp')v=Math.min(1,v+step);else if(e.key==='ArrowDown')v=Math.max(0,v-step);else if(e.key==='Home'){s=1;v=1;}else if(e.key==='End')v=0;else return;e.preventDefault();emit();});
  $('paintHue').addEventListener('input',e=>{h=Number(e.target.value);emit();render();});
  channels.forEach(channel=>{
    for(const suffix of ['','Value'])$('paint'+channel+suffix).addEventListener('input',e=>{
      if(e.target.value==='')return;const n=Math.max(0,Math.min(255,Number(e.target.value)));if(!Number.isFinite(n))return;
      $('paint'+channel).value=String(n);const hex='#'+channels.map(c=>Math.round(Number($('paint'+c).value)).toString(16).padStart(2,'0')).join('');onChange(hex);
    });
  });
  return {set(hex){
    const hsv=hexToHsv(hex);if(hsv.s>0)h=hsv.h;s=hsv.s;v=hsv.v;$('paintHue').value=String(Math.round(h));
    const rgb=[1,3,5].map(i=>parseInt(hex.slice(i,i+2),16));channels.forEach((c,i)=>{const a=rgb.slice(),b=rgb.slice();a[i]=0;b[i]=255;$('paint'+c).value=String(rgb[i]);$('paint'+c+'Value').value=String(rgb[i]);$('paint'+c).style.background=`linear-gradient(to right,rgb(${a.join(',')}),rgb(${b.join(',')}))`;});render();
  }};
}
