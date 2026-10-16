// Original pixel character. Draw around the unchanged 16×24 physics body.
export function drawRunner(ctx,s,{color='#cc826d',name='',now=0,reduced=false,alpha=1}={}){
  if(s.dead>0)return;
  const dash=s.dashTime>0,run=s.grounded&&Math.abs(s.vx)>20;
  const phase=reduced?0:Math.floor(now/75)%6;
  const stride=run?[0,2,4,1,-3,-2][phase]:0;
  const rising=!s.grounded&&s.vy<-35,falling=!s.grounded&&s.vy>60;
  const wall=!s.grounded&&s.wallSide&&s.vy>=0;
  ctx.save();ctx.globalAlpha=alpha;
  if(name){ctx.textAlign='center';ctx.font='11px "Microsoft YaHei",sans-serif';const w=ctx.measureText(name).width;ctx.fillStyle='#20374cd9';ctx.fillRect(Math.round(s.x+8-w/2-5),Math.round(s.y-22),w+10,16);ctx.fillStyle='#f5edda';ctx.fillText(name,Math.round(s.x+8),Math.round(s.y-10));}
  if(s.grounded){ctx.fillStyle='#15283a30';ctx.beginPath();ctx.ellipse(s.x+8,s.y+25,11,3,0,0,Math.PI*2);ctx.fill();}
  ctx.translate(Math.round(s.x+8),Math.round(s.y+24));ctx.scale(s.facing<0?-1:1,1);
  if(dash&&!reduced){ctx.rotate(Math.max(-.38,Math.min(.38,.22+s.vy/1200)));ctx.translate(2,-1);}
  const p=(color,x,y,w,h)=>{ctx.fillStyle=color;ctx.fillRect(Math.round(x),Math.round(y),w,h);};
  const outline='#203443',boot='#344957',skin='#f5d5ac';
  // Wind-driven scarf, with a pale mint highlight while a dash is available.
  const scarf=s.dash?'#a9eed5':'#ab9fbd',wave=reduced?0:Math.sin(now/110)*2;
  p(outline,-15,-17,12,5);p(scarf,-15,-17,10,3);p(scarf,-20-(dash?5:0),-16+wave,8+(dash?5:0),3);p(s.dash?'#e2ffec':'#cec3d7',-16,-17,9,1);
  // A tucked rear leg and a reaching front leg distinguish jumping/falling.
  const backY=rising?-9:falling?-5:-4-Math.max(0,stride),frontY=rising?-5:falling?-4:-4-Math.max(0,-stride),legX=Math.round(stride*.45);
  p(outline,-6-legX,backY-5,6,8);p(boot,-5-legX,backY-4,4,6);p(outline,-8-legX,backY+1,8,3);p('#81999f',-7-legX,backY+1,5,1);
  p(outline,1+legX,frontY-6,6,9);p(boot,2+legX,frontY-5,4,7);p(outline,2+legX,frontY+1,9,3);p('#a2b4ac',3+legX,frontY+1,6,1);
  // Jacket silhouette, contrasting shirt and a small satchel strap.
  const bob=run&&!reduced&&phase%3===0?-1:0;
  ctx.translate(0,bob);p(outline,-8,-18,16,12);p(color,-7,-17,14,10);p('#ffffff2b',-6,-16,3,8);p('#00000028',4,-15,3,8);p('#eedab3',-1,-16,4,5);p('#41596a',-5,-8,11,2);
  const armY=wall?-22:dash?-19:rising?-21:falling?-15:-15-stride;
  p(outline,5,armY,5,9);p(color,6,armY+1,3,5);p(skin,6,armY+6,4,3);
  p(outline,-10,-15+stride,5,8);p(color,-9,-14+stride,3,4);p('#d9b48e',-9,-10+stride,3,3);
  // Hair, face and the dark hood keep the head readable on light terrain.
  p(outline,-8,-29,16,13);p('#536c61',-7,-28,13,10);p('#7d9980',-5,-29,10,3);p('#a5b894',-4,-28,7,1);
  p(skin,-3,-25,10,8);p('#deaf8c',4,-20,3,2);p('#283e4b',3,-24,2,3);p('#fff2d4',4,-24,1,1);p('#536c61',-6,-25,5,8);
  p(outline,-7,-18,15,4);p(scarf,-6,-18,13,3);p(s.dash?'#e4ffed':'#d4c5d7',-4,-18,8,1);
  ctx.restore();
}
