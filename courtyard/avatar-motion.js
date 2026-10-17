// Texture-independent two-bone gait. Angles are measured from the downward axis.
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
export function legPose(x,y,footX,footY){
  const upper=6,lower=5,dx=footX-x,dy=footY-y,d=clamp(Math.hypot(dx,dy),1,upper+lower-.001),a=Math.atan2(dx,dy),bend=Math.acos(clamp((upper*upper+d*d-lower*lower)/(2*upper*d),-1,1));
  const knee={x:x+Math.sin(a+bend)*upper,y:y+Math.cos(a+bend)*upper};
  const foot={x:x+Math.sin(a)*d,y:y+Math.cos(a)*d};
  return {x,y,upper:-Math.atan2(knee.x-x,knee.y-y),lower:-Math.atan2(foot.x-knee.x,foot.y-knee.y),knee,foot,lowerLength:lower};
}
export function rigPose(direction='down',phase=0,amount=0){
  amount=clamp(amount,0,1);const side=direction==='right'||direction==='left',s=Math.sin(phase),bob=amount*.5*Math.abs(s);
  const limbs={};for(const [name,offset,hipX] of [['left',0,side?14:12],['right',Math.PI,side?19:20]]){
    const stride=Math.sin(phase+offset),lift=Math.max(0,Math.cos(phase+offset));
    if(amount<.001)limbs[name+'Leg']={x:hipX,y:34,upper:0,lower:0,knee:{x:hipX,y:40},foot:{x:hipX,y:44},lowerLength:4};
    else if(side)limbs[name+'Leg']=legPose(hipX,34+bob,hipX+amount*stride*4.3,44-amount*lift*3);
    else {const y=34+bob,upper=amount*stride*.025,lower=-amount*stride*.02,footY=44+amount*stride*1.15-amount*lift*2.1;limbs[name+'Leg']={x:hipX,y,upper,lower,foot:{x:hipX+amount*stride*.35,y:footY},lowerLength:footY-y-6};}
    limbs[name+'Arm']={x:side?(name==='left'?13:22):(name==='left'?7:25),y:24+bob+(side?0:amount*stride*.7),upper:amount*stride*(side?.52:.14),lower:amount*(stride*(side?.52:.14)-.16-.16*lift)};
  }
  return {direction,mirror:direction==='left',side,bob,body:{x:16,y:23+bob,angle:amount*(side?-.035:Math.sin(phase*2)*.018)},head:{x:16+amount*(side?.4:Math.sin(phase)*.25),y:22+bob*.65,angle:amount*(side?-.02:Math.sin(phase)*.012)},...limbs};
}
export function drawRig(ctx,parts,pose){
  ctx.save();if(pose.mirror){ctx.translate(32,0);ctx.scale(-1,1);}ctx.imageSmoothingEnabled=false;
  const limb=(id,arm=false)=>{const p=pose[id],image=parts[id],w=arm?8:10,pivot=arm?4:5,joint=arm?9:7,anchor=arm?3:1,length=joint-anchor;
    ctx.save();ctx.translate(p.x,p.y);ctx.rotate(p.upper);ctx.drawImage(image,0,0,w,joint,-pivot,-anchor,w,joint);ctx.restore();
    ctx.save();ctx.translate(p.x-Math.sin(p.upper)*length,p.y+Math.cos(p.upper)*length);ctx.rotate(p.lower);ctx.drawImage(image,0,joint,w,arm?image.height-joint:4,-pivot,0,w,arm?image.height-joint:p.lowerLength);ctx.restore();
    if(!arm){ctx.save();ctx.translate(p.foot.x,p.foot.y);ctx.drawImage(image,0,11,w,3,-pivot,0,w,3);ctx.restore();}};
  limb('leftLeg');limb('leftArm',true);limb('rightLeg');
  ctx.save();ctx.translate(pose.body.x,pose.body.y);ctx.rotate(pose.body.angle);ctx.drawImage(parts.body,-11,-3);ctx.restore();
  limb('rightArm',true);ctx.save();ctx.translate(pose.head.x,pose.head.y);ctx.rotate(pose.head.angle);ctx.drawImage(parts.head,-10,-20);ctx.restore();ctx.restore();
}
