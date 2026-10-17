import {WORLD,TILE_SIZE,FACILITIES} from './world.js?v=0.13.1';
export function createPlayerMap({players,tiles,self}){
 const dialog=document.createElement('dialog');dialog.className='modal player-map-modal';dialog.id='playerMapDialog';dialog.innerHTML='<div class="modal-heading"><h2>大厅玩家地图</h2><button class="close-button" aria-label="关闭">×</button></div><canvas id="playerMapCanvas" width="960" height="720" aria-label="大厅地图上的玩家位置"></canvas><div id="mapPlayerList" class="map-player-list"></div>';document.body.append(dialog);
 const canvas=dialog.querySelector('canvas'),ctx=canvas.getContext('2d'),list=dialog.querySelector('#mapPlayerList');dialog.querySelector('button').onclick=()=>dialog.close();
 function render(){
  if(!dialog.open)return;const sx=canvas.width/WORLD.width,sy=canvas.height/WORLD.height;ctx.fillStyle='#b9cfa8';ctx.fillRect(0,0,960,720);ctx.fillStyle='#e0e3c4';ctx.fillRect(448*sx,0,64*sx,720);ctx.fillRect(0,368*sy,960,64*sy);
  ctx.fillStyle='#7c9270';for(const t of tiles().values())ctx.fillRect(t.col*TILE_SIZE*sx,t.row*TILE_SIZE*sy,TILE_SIZE*sx,TILE_SIZE*sy);
  const labelScale=Math.max(1,960/canvas.getBoundingClientRect().width),lineHeight=18*labelScale;
  ctx.font='13px sans-serif';for(const f of FACILITIES){ctx.fillStyle='#8a6b3a';ctx.fillRect(f.x*sx-4,f.y*sy-4,8,8);if(labelScale<2)ctx.fillText(f.name,Math.max(4,f.x*sx-30),Math.max(15,f.y*sy-10));}
  ctx.font=`${12*labelScale}px sans-serif`;
  const labels=[];list.replaceChildren();
  for(const [id,p] of players()){
   const x=p.x*sx,y=p.y*sy;ctx.fillStyle=id===self()?'#fff9df':p.color;ctx.strokeStyle='#315742';ctx.lineWidth=labelScale;ctx.beginPath();ctx.arc(x,y,(id===self()?4:3)*labelScale,0,Math.PI*2);ctx.fill();ctx.stroke();
   const name=p.name+(id===self()?' · 你':''),w=ctx.measureText(name).width+8*labelScale;let ly=Math.max(lineHeight,y-lineHeight);const lx=Math.max(1,Math.min(960-w-1,x-w/2));for(let i=0;i<30&&labels.some(r=>Math.abs(r.y-ly)<lineHeight&&lx<r.x+r.w&&lx+w>r.x);i++)ly+=lineHeight;
   ly=Math.min(720-lineHeight,ly);labels.push({x:lx,y:ly,w});ctx.strokeStyle=p.color;ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(lx+w/2,ly);ctx.stroke();ctx.fillStyle='#fffdf0ed';ctx.fillRect(lx,ly-13*labelScale,w,lineHeight);ctx.fillStyle='#315742';ctx.fillText(name,lx+4*labelScale,ly);
   const line=document.createElement('span');line.textContent=`${name}  (${Math.round(p.x)}, ${Math.round(p.y)})${p.connected?'':' · 重连中'}`;line.style.borderLeftColor=p.color;list.append(line);
  }
 }
 setInterval(render,500);return {open(){dialog.showModal();render();}};
}
