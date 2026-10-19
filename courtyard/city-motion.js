import {cityMove,cityDrive,SPEED,free,BODY_RADIUS,MOVE_RADIUS,CAR_RADIUS} from './city-rules.js?v=0.27.0';

const angleDelta=(a,b)=>Math.atan2(Math.sin(a-b),Math.cos(a-b));
const unstickPoint=(model,radius,objects)=>{if(free(model.x,model.y,radius,objects))return;for(let d=6;d<=320;d+=6)for(let i=0;i<24;i++){const a=i*Math.PI/12,x=model.x+Math.cos(a)*d,y=model.y+Math.sin(a)*d;if(free(x,y,radius,objects)){model.x=x;model.y=y;return;}}};
// Render remote entities between authoritative samples. Never use this for hits.
export class CityTimeline{
  constructor(delay=150){this.delay=delay;this.entities=new Map();}
  update(id,pose,at,mode=''){
    let entry=this.entities.get(id);const previous=entry?.frames.at(-1);
    if(!entry||entry.mode!==mode||previous&&Math.hypot(pose.x-previous.x,pose.y-previous.y)>180){entry={mode,frames:[]};this.entities.set(id,entry);}
    if(entry.frames.at(-1)?.at===at)return;
    entry.frames.push({...pose,at});while(entry.frames.length>8)entry.frames.shift();
  }
  sample(id,now){const frames=this.entities.get(id)?.frames;if(!frames?.length)return null;const time=now-this.delay;
    if(time<=frames[0].at)return frames[0];
    for(let i=1;i<frames.length;i++)if(frames[i].at>=time){const a=frames[i-1],b=frames[i],t=(time-a.at)/(b.at-a.at);return{x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t,heading:(a.heading||0)+angleDelta(b.heading||0,a.heading||0)*t};}
    // A short, bounded continuation bridges a delayed packet, then stops.
    const last=frames.at(-1),before=frames.at(-2);if(!before)return last;const ahead=Math.min(50,Math.max(0,time-last.at)),span=Math.max(50,last.at-before.at),scale=Math.max(1,Math.hypot(last.x-before.x,last.y-before.y)/span/.7);
    const next=cityMove(last,(last.x-before.x)/span*ahead/scale,(last.y-before.y)/span*ahead/scale);return{...next,heading:last.heading};
  }
  prune(ids){for(const id of this.entities.keys())if(!ids.has(id))this.entities.delete(id);}
  clear(){this.entities.clear();}
}

// Keep local input continuous; spread small server corrections over time.
export class CityPrediction{
  constructor(){this.clear();}
  clear(){this.model=null;this.error={x:0,y:0,heading:0};this.life='';this.car='';this.id='';}
  reconcile(s,input){const p=s.self,car=s.cars.find(c=>c[0]===p.car),objects=s.objects.map(o=>({kind:o[1],x:o[2],y:o[3],hp:o[4],w:o[5],h:o[6]})),target={x:p.x,y:p.y,heading:car?.[3]??p.heading,speed:car?.[8]??0};
    if(p.hp>0&&!p.escaped){if(p.car)Object.assign(target,cityDrive(target,input,.04,objects));else {const speed=(input.sprint?SPEED.sprint:SPEED.walk)*(p.slow>0?.28:1)*(p.boons?.includes('swift')?1.15:1)*(p.boost>0?1.35:1)*(1+(p.body?.muscle||0)*.06)*(p.ego?.on?1.25:1)*(p.distort?1.2:1);Object.assign(target,cityMove(target,input.x*speed*.04,input.y*speed*.04,objects,MOVE_RADIUS));}}
    const life=String(p.hp>0)+':'+String(p.escaped),reset=!this.model||s.id!==this.id||p.car!==this.car||life!==this.life||Math.hypot(target.x-this.model.x,target.y-this.model.y)>140;
    if(reset){this.model=target;this.error={x:0,y:0,heading:0};}else{const x=target.x-this.model.x,y=target.y-this.model.y;this.error={x:Math.abs(x)<1?0:x,y:Math.abs(y)<1?0:y,heading:angleDelta(target.heading,this.model.heading)};if(p.car)this.model.speed=target.speed;}
    this.id=s.id;this.car=p.car;this.life=life;return this.model;
  }
  advance(dt,input,p,objects){if(!this.model)return null;dt=Math.max(0,Math.min(.05,dt));
    unstickPoint(this.model,p.car?CAR_RADIUS:BODY_RADIUS,objects);
    if(p.hp>0&&!p.escaped){if(p.car)Object.assign(this.model,cityDrive(this.model,input,dt,objects));else {const speed=(input.sprint?SPEED.sprint:SPEED.walk)*(p.slow>0?.28:1)*(p.boons?.includes('swift')?1.15:1)*(p.boost>0?1.35:1)*(1+(p.body?.muscle||0)*.06)*(p.ego?.on?1.25:1)*(p.distort?1.2:1);Object.assign(this.model,cityMove(this.model,input.x*speed*dt,input.y*speed*dt,objects,MOVE_RADIUS));}}
    const factor=1-Math.exp(-dt/((Math.hypot(this.error.x,this.error.y)>60)?.06:.18)),dx=this.error.x*factor,dy=this.error.y*factor;Object.assign(this.model,cityMove(this.model,dx,dy,objects));this.error.x-=dx;this.error.y-=dy;if(p.car){this.model.heading+=this.error.heading*factor;this.error.heading*=1-factor;}
    return this.model;
  }
}
