import { WORLD, OBSTACLES, FACILITIES, TILE_SIZE, isBuildCell, BUILD_REACH } from './world.js?v=0.2.0';
import { RemoteMotion } from './motion.js?v=0.2.0';
import { texture } from './art.js?v=0.2.0';

const map = document.createElement('canvas');
map.width = WORLD.width; map.height = WORLD.height;
const g = map.getContext('2d');
const rect = (x,y,w,h,color) => { g.fillStyle=color; g.fillRect(x,y,w,h); };
const noise = (x,y) => { const a=Math.sin(x*127.1+y*311.7)*43758.5453; return a-Math.floor(a); };

function tree(x,y,size=1) {
  g.save(); g.translate(x,y); g.scale(size,size);
  g.fillStyle='#627b4933'; g.beginPath(); g.ellipse(0,10,28,11,0,0,Math.PI*2); g.fill();
  rect(-5,-12,10,28,'#8c8054'); rect(-1,-12,4,28,'#a0915d');
  rect(-24,-51,48,25,'#718d55'); rect(-32,-40,64,27,'#718d55'); rect(-21,-63,42,23,'#8b9f60');
  rect(-29,-44,48,24,'#8b9f60'); rect(-15,-66,31,13,'#a4b877'); rect(-22,-48,15,7,'#afbd7c');
  rect(20,-30,8,9,'#69834f'); rect(-31,-22,13,7,'#69834f');
  g.restore();
}
function house(x,y,w,h) {
  rect(x-4,y+11,w+11,h,'#78855d26'); rect(x,y,w,h,'#e5d7af'); rect(x+7,y+5,w-14,h-5,'#efe3bf');
  for(let i=0;i<w;i+=23) rect(x+i,y+h-8,18,8,'#d8ca9e');
  rect(x+w/2-11,y+h-37,23,37,'#84775c'); rect(x+w/2-7,y+h-33,15,33,'#9c8966'); rect(x+w/2+5,y+h-17,3,3,'#d6b26d');
  for(const xx of [x+13,x+w-31]) {rect(xx,y+30,19,22,'#9eac8c'); rect(xx+3,y+33,13,16,'#c8d5ae');rect(xx+9,y+33,2,16,'#8f9f7b');rect(xx+3,y+40,13,2,'#8f9f7b');}
  rect(x-9,y-3,w+18,23,'#ad7f64'); rect(x-3,y-17,w+6,20,'#b88c6a');rect(x+8,y-30,w-16,14,'#c39b75');
  for(let yy=0;yy<3;yy++)for(let xx=0;xx<6;xx++)rect(x+xx*20-4+yy*5,y-13+yy*11,15,2,'#9f765d50');
  rect(x+w-25,y-41,12,25,'#9b8a6c');rect(x+w-28,y-44,18,6,'#bbaa83');
}
function drawMap() {
  rect(0,0,WORLD.width,WORLD.height,'#b8cb98');
  for(let y=0;y<640;y+=16)for(let x=0;x<960;x+=16){const n=noise(x,y);if(n>.35)rect(x+3,y+6,2+n*6,2,n>.72?'#aabd86':'#c3d3a4');}
  rect(38,44,884,551,'#bdcf9a');
  rect(318,59,324,524,'#d5d3a6');rect(54,242,852,136,'#d5d3a6');
  rect(334,59,292,524,'#dedab4');rect(54,256,852,108,'#dedab4');
  for(let y=69;y<580;y+=23)for(let x=60;x<906;x+=26){
    if((x>337&&x<621)||(y>258&&y<356)){
      const n=noise(x,y);g.strokeStyle='#c1bf984a';g.strokeRect(x+(y%2?0:8),y,18+n*5,14+n*4);
      if(n>.79)rect(x+4,y+4,9,2,'#eee9c7');
    }
  }
  // Low garden wall and its uneven capstones.
  for(let x=34;x<926;x+=28){rect(x,38,27,15,'#8d9d72');rect(x,32,27,10,'#d0d2ac');rect(x+3,34,20,2,'#e0dfbd');}
  for(let y=51;y<584;y+=26)for(const x of [34,912]){rect(x,y,14,25,'#8d9d72');rect(x-3,y,19,6,'#c6cca3');}
  rect(0,596,960,44,'#8db6a2');rect(0,591,960,10,'#9bb893');rect(0,588,960,5,'#d1cf9f');
  for(let x=0;x<960;x+=47){rect(x,612+(x%3)*4,23,2,'#b2ceba');rect(x+17,631,12,2,'#78a48f');}
  for(const o of OBSTACLES){
    if(o.kind==='house')house(o.x,o.y,o.w,o.h);
    if(o.kind==='garden'){
      rect(o.x-3,o.y+3,o.w+6,o.h,'#9b9c732c');rect(o.x,o.y,o.w,o.h,'#a29c70');rect(o.x+4,o.y+4,o.w-8,o.h-8,'#887f5b');
      for(let x=o.x+9;x<o.x+o.w-5;x+=13){rect(x,o.y+10,8,13,'#8eaa60');rect(x+3,o.y+6,3,14,'#b0bd71');rect(x+2,o.y+4,5,5,(x%2)?'#e4c58d':'#caa18b');}
    }
    if(o.kind==='fountain'){
      rect(o.x-4,o.y+8,o.w+8,o.h,'#7c8b6d30');rect(o.x,o.y,o.w,o.h,'#a5aa88');rect(o.x+5,o.y+4,o.w-10,o.h-10,'#e1dcbc');
      rect(o.x+13,o.y+11,o.w-26,o.h-24,'#8eb6a5');rect(o.x+21,o.y+20,o.w-42,o.h-40,'#a4c5b2');
      rect(o.x+o.w/2-8,o.y+11,16,28,'#a2a68b');rect(o.x+o.w/2-14,o.y+5,28,10,'#d5d2b3');
      rect(o.x+22,o.y+45,19,2,'#c4ddc4');rect(o.x+60,o.y+24,15,2,'#c4ddc4');
    }
  }
  // The future gate is scenery only in this connectivity test.
  rect(430,137,100,35,'#b3bc912b');rect(444,92,15,68,'#9aa67f');rect(501,92,15,68,'#9aa67f');
  rect(443,81,74,15,'#bdc3a0');rect(455,72,50,12,'#cdd0ac');rect(460,97,40,59,'#809a87');rect(465,102,30,50,'#a3b8a1');
  for(const x of [437,508]){rect(x,117,15,11,'#d6c897');rect(x+5,108,5,12,'#ead9a0');}
  rect(442,162,75,7,'#b5bc95');rect(431,170,98,6,'#c5c8a5');
  // Postbox, signposts, scattered flowers and stone details.
  rect(280,197,6,39,'#9b8963');rect(269,190,29,23,'#b77d63');rect(268,186,31,8,'#c68c6c');rect(274,196,18,3,'#795e4c');
  rect(674,213,5,32,'#9c8c64');rect(655,205,45,18,'#d9cc9e');rect(660,212,20,2,'#a49a74');
  for(let i=0;i<90;i++){
    const x=64+noise(i,7)*828,y=83+noise(i,43)*475;
    if((x>300&&x<653)||(y>231&&y<388))continue;
    if(OBSTACLES.some(o=>x>o.x-15&&x<o.x+o.w+15&&y>o.y-35&&y<o.y+o.h+15))continue;
    rect(x,y,2,7,'#91a76c');rect(x-2,y-1,6,4,i%3?'#eee2ac':'#d8ab94');rect(x,y,2,2,'#d0b66c');
  }
  for(const [x,y,s] of [[103,307,1],[850,307,1],[80,102,1.1],[880,100,1.1],[83,551,.9],[877,548,.9]])tree(x,y,s);
  for(let x=270;x<700;x+=58){rect(x,560,25,13,'#b3bc93');rect(x+3,558,21,10,'#d3d2ad');}
  // A protected bridge leads to the communal construction meadow.
  rect(432,582,96,68,'#a38d65');rect(440,582,80,68,'#d2bd8b');
  for(let y=584;y<650;y+=10)rect(439,y,82,2,'#a18f64');
  rect(33,646,14,262,'#a5b586');rect(913,646,14,262,'#a5b586');
  rect(48,907,864,13,'#a5b586');rect(434,650,92,255,'#d6d3aa');rect(442,650,76,255,'#e1d9b3');
  for(const x of [64,544]){rect(x,640,352,224,'#c8d3a5');g.strokeStyle='#8da37066';g.setLineDash([5,6]);g.strokeRect(x+.5,640.5,351,223);g.setLineDash([]);}
  for(let i=0;i<90;i++){const x=66+noise(i,111)*828,y=654+noise(i,99)*235;if(x>425&&x<535)continue;rect(x,y,3,2,i%2?'#b6c694':'#d3dcb5');}
  for(const [x,y,s] of [[86,895,.8],[868,896,.8],[73,680,.65],[886,675,.65]])tree(x,y,s);
  rect(463,650,34,8,'#b19465');rect(465,654,4,17,'#9d845c');rect(491,654,4,17,'#9d845c');
  rect(470,631,22,20,'#f3e8c5');rect(474,635,6,6,'#bd8165');rect(482,640,6,6,'#87a77a');
  g.fillStyle='#71805a';g.textAlign='center';g.font='11px "Microsoft YaHei",sans-serif';g.fillText('公共建筑区 · 西草地',240,885);g.fillText('公共建筑区 · 东草地',720,885);
}
drawMap();

export function createScene(canvas, getWorld) {
  const ctx=canvas.getContext('2d');
  const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
  const positions=new Map(),motions=new Map();
  let width=960,height=640,dpr=1;
  let view={zoom:1,cameraX:0,cameraY:0};
  new ResizeObserver(()=>{
    const bounds=canvas.getBoundingClientRect();width=bounds.width;height=bounds.height;dpr=Math.min(devicePixelRatio||1,2);
    canvas.width=Math.round(width*dpr);canvas.height=Math.round(height*dpr);
  }).observe(canvas);
  function frame(now){
    const world=getWorld();
    const me=world.me;
    const zoom=Math.max(width/WORLD.width,height/WORLD.height,me&&width<600?.85:0);
    const cameraX=Math.max(0,Math.min(WORLD.width-width/zoom,(me?.x??480)-width/zoom/2));
    const cameraY=Math.max(0,Math.min(WORLD.height-height/zoom,(me?.y??320)-height/zoom/2));
    view={zoom,cameraX,cameraY};
    ctx.setTransform(dpr,0,0,dpr,0,0);ctx.clearRect(0,0,width,height);ctx.imageSmoothingEnabled=false;
    ctx.scale(zoom,zoom);ctx.translate(-cameraX,-cameraY);ctx.drawImage(map,0,0);
    if(world.space==='lobby'){
      if(world.tool==='place'||world.tool==='remove'){
        ctx.strokeStyle='#738d5430';ctx.lineWidth=.6;
        for(let row=20;row<=26;row++)for(let col=2;col<=27;col++)if(isBuildCell(col,row))ctx.strokeRect(col*TILE_SIZE,row*TILE_SIZE,TILE_SIZE,TILE_SIZE);
      }
      for(const tile of world.tiles.values()){
        const image=texture(world.materials.get(tile.material));if(!image)continue;
        const x=tile.col*TILE_SIZE,y=tile.row*TILE_SIZE;
        if(tile.solid){ctx.fillStyle='#4d60342d';ctx.fillRect(x+3,y+5,TILE_SIZE,TILE_SIZE);}
        ctx.fillStyle=tile.solid?'#c6cfaa':'#ccd7ad';ctx.fillRect(x,y,TILE_SIZE,TILE_SIZE);ctx.drawImage(image,x,y,TILE_SIZE,TILE_SIZE);
        if(tile.solid){ctx.fillStyle='#334b3324';ctx.fillRect(x,y+TILE_SIZE-4,TILE_SIZE,4);ctx.strokeStyle='#faf2d75c';ctx.strokeRect(x+.5,y+.5,TILE_SIZE-1,TILE_SIZE-1);}
      }
      for(const f of FACILITIES){
        ctx.font='11px "Microsoft YaHei",sans-serif';ctx.textAlign='center';const tw=ctx.measureText(f.name).width;
        ctx.fillStyle=world.nearFacility===f.id?'#fff6d8':'#f6f4dfdf';ctx.fillRect(f.x-tw/2-9,f.y-59,tw+18,21);ctx.fillStyle='#526e43';ctx.fillText(f.name,f.x,f.y-44);
      }
      if(world.hover&&me&&(world.tool==='place'||world.tool==='remove')){
        const {col,row}=world.hover,valid=isBuildCell(col,row)&&Math.hypot(me.x-(col+.5)*TILE_SIZE,me.y-(row+.5)*TILE_SIZE)<=BUILD_REACH;
        ctx.fillStyle=valid?'#f2f2c53d':'#d47e6a30';ctx.fillRect(col*TILE_SIZE,row*TILE_SIZE,TILE_SIZE,TILE_SIZE);ctx.strokeStyle=valid?'#faf8d3':'#ba7765';ctx.lineWidth=2;ctx.strokeRect(col*TILE_SIZE+1,row*TILE_SIZE+1,TILE_SIZE-2,TILE_SIZE-2);
      }
    }
    const people=[];
    for(const [id,p] of world.players){
      const target=id===world.self&&me?{...p,...me}:p;
      const previous=positions.get(id)||{x:target.x,y:target.y};
      let next={x:target.x,y:target.y};
      if(id!==world.self){
        let motion=motions.get(id);
        if(!motion){motion=new RemoteMotion(p,now);motions.set(id,motion);}
        motion.update(p,now);next=motion.sample(now,world.space==='lobby'?world.tiles:undefined);
      }
      const moving=Math.hypot(next.x-previous.x,next.y-previous.y)>.2;
      positions.set(id,next);people.push({...target,...next,id,moving});
    }
    for(const id of positions.keys())if(!world.players.has(id)){positions.delete(id);motions.delete(id);}
    people.sort((a,b)=>a.y-b.y);
    const labelRects=[],ownPerson=people.find(p=>p.id===world.self);
    ctx.font='11px "Microsoft YaHei",sans-serif';
    if(ownPerson){const w=ctx.measureText(ownPerson.name+' · 你').width+12;labelRects.push({x:ownPerson.x-w/2,y:ownPerson.y-55,w,h:17});}
    for(const p of people){
      const x=Math.round(p.x),y=Math.round(p.y),self=p.id===world.self;
      const bounce=p.moving&&!reduced?Math.round(Math.sin(now/90)*1.5):0;
      ctx.save();ctx.globalAlpha=p.connected?1:.4;
      ctx.fillStyle='#3e503c35';ctx.beginPath();ctx.ellipse(x,y+3,12,5,0,0,Math.PI*2);ctx.fill();
      if(self){ctx.strokeStyle='#fdf8dd';ctx.lineWidth=1.5;ctx.beginPath();ctx.ellipse(x,y+3,15,7,0,0,Math.PI*2);ctx.stroke();}
      ctx.translate(x,y+bounce);
      ctx.fillStyle='#5a6756';ctx.fillRect(-7,-6,5,7);ctx.fillRect(3,-6,5,7);
      ctx.fillStyle=p.color;ctx.fillRect(-10,-19,20,15);ctx.fillRect(-13,-17,5,10);ctx.fillRect(9,-17,5,10);
      ctx.fillStyle='#edd6a6';ctx.fillRect(-8,-32,16,16);ctx.fillStyle='#59624b';ctx.fillRect(-9,-33,18,6);ctx.fillRect(-10,-29,4,8);
      ctx.fillStyle='#444d3c';ctx.fillRect(1,-25,2,3);ctx.fillRect(6,-25,2,3);ctx.fillStyle='#d2ae85';ctx.fillRect(4,-20,3,2);
      ctx.fillStyle='#efdfb2';ctx.fillRect(-7,-16,14,3);ctx.fillRect(-5,-12,3,6);
      ctx.font='11px "Microsoft YaHei",sans-serif';ctx.textAlign='center';const label=p.name+(self?' · 你':'');const tw=ctx.measureText(label).width;
      let labelY=-55,showLabel=true;
      if(!self){
        const collision=()=>labelRects.some(r=>x-tw/2-6<r.x+r.w&&x+tw/2+6>r.x&&y+labelY<r.y+r.h&&y+labelY+17>r.y);
        for(let i=0;i<3&&collision();i++)labelY-=19;
        showLabel=!collision();if(showLabel)labelRects.push({x:x-tw/2-6,y:y+labelY,w:tw+12,h:17});
      }
      if(showLabel){ctx.fillStyle=self?'#f8f6e9ee':'#fcf9e4d9';ctx.fillRect(-tw/2-6,labelY,tw+12,17);ctx.fillStyle='#45573f';ctx.fillText(label,0,labelY+12);}
      const emote=world.emotes.get(p.id);
      const speech=world.speech?.get(p.id);
      if(speech&&now-speech.at<5500){const text=Array.from(speech.text).slice(0,19).join('')+(Array.from(speech.text).length>19?'…':'');ctx.font='11px "Microsoft YaHei",sans-serif';const w=ctx.measureText(text).width;ctx.fillStyle='#fffbeef2';ctx.fillRect(-w/2-8,labelY-25,w+16,20);ctx.fillRect(-2,labelY-6,5,4);ctx.fillStyle='#53684a';ctx.fillText(text,0,labelY-11);}
      else if(emote&&now-emote<2300){ctx.fillStyle='#fffbe9';ctx.fillRect(14,-42,32,23);ctx.fillRect(14,-21,5,5);ctx.fillStyle='#9c7853';ctx.font='bold 12px sans-serif';ctx.fillText('嗨!',30,-26);}
      ctx.restore();
    }
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
  return {pointAt(clientX,clientY){const box=canvas.getBoundingClientRect();return {x:(clientX-box.left)/view.zoom+view.cameraX,y:(clientY-box.top)/view.zoom+view.cameraY};}};
}
