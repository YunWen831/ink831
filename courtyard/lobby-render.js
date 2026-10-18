export function drawCar(ctx,p){
  ctx.save();ctx.rotate(p.heading||0);ctx.fillStyle='#203b46';for(const x of [-18,10])for(const y of [-19,12])ctx.fillRect(x,y,11,7);
  ctx.fillStyle=p.color;ctx.fillRect(-26,-15,53,30);ctx.fillStyle='#f5ead1';ctx.fillRect(16,-13,9,26);ctx.fillStyle='#3e6874';ctx.fillRect(-8,-12,20,24);ctx.fillStyle='#bce2e7';ctx.fillRect(6,-11,6,22);ctx.fillStyle='#ffe9a3';ctx.fillRect(25,-12,4,6);ctx.fillRect(25,6,4,6);ctx.fillStyle='#e8715b';ctx.fillRect(-28,-11,3,5);ctx.fillRect(-28,6,3,5);ctx.restore();
}
