import { bubbleDuration, wrapMessage } from './chat.js?v=0.11.0';

const overlaps = (a,b) => a.x < b.x+b.w+5 && a.x+a.w+5 > b.x && a.y < b.y+b.h+5 && a.y+a.h+5 > b.y;
const clamp = (v,low,high) => Math.max(low,Math.min(high,v));

export function drawBubbles(ctx, items, now, bounds, self) {
  ctx.save();ctx.font='12px "Microsoft YaHei",sans-serif';ctx.textAlign='left';
  const visible=items.filter(item=>item.text&&now-item.at < bubbleDuration(item.text));
  visible.sort((a,b)=>(b.id===self)-(a.id===self)||b.at-a.at);
  const occupied=items.map(p=>({x:p.x-(p.bodyWidth||24)/2,y:p.y-(p.bodyHeight||37),w:p.bodyWidth||24,h:(p.bodyHeight||37)+3}));
  for(const item of visible.slice(0,8)) {
    const maxWidth=Math.min(250,bounds.w-30),lines=wrapMessage(item.text,text=>ctx.measureText(text).width,maxWidth-20,12);
    const w=Math.max(38,Math.min(maxWidth,Math.max(...lines.map(text=>ctx.measureText(text).width))+20)),h=lines.length*16+16;
    const minX=bounds.x+8,maxX=bounds.x+bounds.w-w-8,minY=bounds.y+8,maxY=bounds.y+bounds.h-h-8;
    let box;
    const above=(item.labelTop||53)+8;
    const positions=[{x:item.x-w/2,y:item.y-above-h},{x:item.x-w-22,y:item.y-38-h/2},{x:item.x+22,y:item.y-38-h/2},{x:item.x-w/2,y:item.y+19}];
    for(let level=0;level<4&&!box;level++)for(const point of positions){
      const candidate={x:clamp(point.x,minX,maxX),y:clamp(point.y-level*(h+8),minY,maxY),w,h};
      if(!occupied.some(other=>overlaps(candidate,other))){box=candidate;break;}
    }
    if(!box){if(occupied.length>items.length)continue;box={x:clamp(item.x-w/2,minX,maxX),y:clamp(item.y-above-h,minY,maxY),w,h};}
    occupied.push(box);
    const remaining=bubbleDuration(item.text)-(now-item.at);ctx.globalAlpha=Math.min(1,remaining/450);
    const tailX=clamp(item.x,box.x+8,box.x+w-8),below=box.y>item.y;
    ctx.fillStyle='#fffdf3f5';ctx.strokeStyle='#a2b69a99';ctx.lineWidth=1;
    ctx.fillRect(box.x,box.y,w,h);ctx.strokeRect(box.x+.5,box.y+.5,w-1,h-1);
    ctx.beginPath();ctx.moveTo(tailX-4,below?box.y:box.y+h);ctx.lineTo(tailX+4,below?box.y:box.y+h);ctx.lineTo(item.x,below?box.y-6:box.y+h+6);ctx.fill();
    ctx.fillStyle='#365342';lines.forEach((line,index)=>ctx.fillText(line,box.x+10,box.y+19+index*16));
  }
  ctx.restore();
}
