import {WEAPONS,combatReady,canDamage,slide,rayWall,rayPerson} from '../../courtyard/lobby-rules.js';
import {spawn,canStand} from '../../courtyard/world.js';

export class LobbyPlay{
  constructor({players,tiles,forced=()=>false,emit=()=>{},now=()=>Date.now(),random=Math.random}){Object.assign(this,{players,tiles,forced,emit,now,random});this.pickups=[];this.cooldowns=new Map();this.combat=new Map();this.rams=new Map();this.sequence=0;this.seed();}
  seed(){
    for(let i=0;i<18;i++){const kind=['pistol','rifle','knife'][i%3];let p;
      for(let tries=0;tries<80;tries++){const x=i<6?300+(i%3)*164:80+this.random()*3900,y=i<6?510+Math.floor(i/3)*150:80+this.random()*2890;if(canStand(x,y,this.tiles)&&!this.pickups.some(q=>Math.hypot(q.x-x,q.y-y)<30)){p={x,y};break;}}
      p||=spawn(i,this.tiles);this.pickups.push({id:'weapon-'+i,kind,...p,readyAt:0});
    }
  }
  snapshot(){const now=this.now();return this.pickups.filter(p=>p.readyAt<=now&&canStand(p.x,p.y,this.tiles)).map(({id,kind,x,y})=>({id,kind,x,y}));}
  publishPickups(){const value=this.snapshot();this.pickupSignature=JSON.stringify(value);this.emit('lobby:pickups',value);}
  busy(id){const p=this.players.get(id);return p?.hp<=0||(this.combat.get(id)||0)>this.now();}
  active(id){return combatReady(this.players.get(id));}
  reset(p,shield=3000){Object.assign(p,{hp:100,sheltered:false,driving:false,speed:0,weapon:'',ammo:0,reloadUntil:0,respawnAt:0,shieldUntil:this.now()+shield});}
  toggle(id,data){const p=this.players.get(id);if(!this.active(id)||typeof data?.enabled!=='boolean')return false;
    if(data.kind==='pvp'){if(this.busy(id))return false;p.pvp=data.enabled;return true;}
    if(data.kind==='car'){p.driving=data.enabled;p.speed=0;p.epoch++;return true;}return false;
  }
  pickup(id){const p=this.players.get(id);if(!this.active(id)||p.driving)return false;const now=this.now(),item=this.pickups.find(q=>q.readyAt<=now&&Math.hypot(q.x-p.x,q.y-p.y)<44&&canStand(q.x,q.y,this.tiles)&&rayWall(p,Math.atan2(q.y-p.y,q.x-p.x),Math.hypot(q.x-p.x,q.y-p.y),this.tiles)>=Math.hypot(q.x-p.x,q.y-p.y));if(!item)return false;
    p.weapon=item.kind;p.ammo=WEAPONS[item.kind].magazine;p.reloadUntil=0;item.readyAt=now+12000;this.publishPickups();return true;
  }
  reload(id){const p=this.players.get(id),w=WEAPONS[p?.weapon];if(!this.active(id)||p.driving||!w?.magazine||p.reloadUntil||p.ammo>=w.magazine)return false;p.reloadUntil=this.now()+w.reload;return true;}
  attack(id,data){
    const p=this.players.get(id),now=this.now(),w=WEAPONS[p?.weapon];if(!this.active(id)||p.driving||!w||!Number.isFinite(data?.angle)||Math.abs(data.angle)>Math.PI*2||p.reloadUntil||p.shieldUntil>now||!(this.forced()||p.pvp)||(this.cooldowns.get(id)||0)>now)return false;
    if(w.magazine&&p.ammo<=0){this.reload(id);return false;}
    this.cooldowns.set(id,now+w.interval);this.combat.set(id,now+8000);if(w.magazine)p.ammo--;
    let distance=rayWall(p,data.angle,w.range,this.tiles),victim=null;
    for(const [otherId,other]of this.players){if(!canDamage(p,other,this.forced(),now))continue;let hit;
      if(p.weapon==='knife'){const dx=other.x-p.x,dy=other.y-p.y,angle=Math.atan2(dy,dx);if(Math.abs(Math.atan2(Math.sin(angle-data.angle),Math.cos(angle-data.angle)))>Math.PI/3)continue;hit=Math.hypot(dx,dy);if(rayWall(p,angle,hit,this.tiles)<hit)continue;}
      else hit=rayPerson(p,data.angle,other);
      if(hit<=distance){distance=hit;victim=otherId;}
    }
    const event={id:++this.sequence,shooter:id,kind:p.weapon,x:p.x,y:p.y,angle:data.angle,distance,hit:victim||''};
    if(victim)this.hurt(id,victim,w.damage,data.angle);
    this.emit('lobby:shot',event);if(w.magazine&&p.ammo===0)this.reload(id);return true;
  }
  hurt(from,id,amount,angle){const p=this.players.get(id),a=this.players.get(from),now=this.now();if(!canDamage(a,p,this.forced(),now))return false;
    p.hp=Math.max(0,p.hp-amount);this.combat.set(id,now+8000);this.combat.set(from,now+8000);
    if(!p.hp){p.driving=false;p.speed=0;p.weapon='';p.ammo=0;p.reloadUntil=0;p.respawnAt=now+3000;p.epoch++;this.emit('lobby:death',{id,from});}
    else{Object.assign(p,slide(p,Math.cos(angle)*15,Math.sin(angle)*15,this.tiles));p.epoch++;}return true;
  }
  moved(id,previous){const p=this.players.get(id);if(!p?.driving||p.speed<160)return;const now=this.now();
    const dx=p.x-previous.x,dy=p.y-previous.y,length=dx*dx+dy*dy;
    for(const [otherId,other]of this.players){const key=id+':'+otherId;if(!canDamage(p,other,this.forced(),now)||(this.rams.get(key)||0)>now)continue;
      const t=length?Math.max(0,Math.min(1,((other.x-previous.x)*dx+(other.y-previous.y)*dy)/length)):0;
      if(Math.hypot(other.x-previous.x-dx*t,other.y-previous.y-dy*t)>23)continue;
      this.rams.set(key,now+1000);this.hurt(id,otherId,Math.min(45,Math.max(12,Math.round(p.speed/14))),p.heading);p.speed*=.55;
    }
  }
  tick(){const now=this.now();for(const [id,p]of this.players){if(p.space!=='lobby')continue;if(p.respawnAt&&now>=p.respawnAt){this.reset(p);Object.assign(p,spawn(0,this.tiles));p.epoch++;this.combat.delete(id);}if(p.reloadUntil&&now>=p.reloadUntil){p.ammo=WEAPONS[p.weapon]?.magazine||0;p.reloadUntil=0;}}
    for(const item of this.pickups)if(item.readyAt&&now>=item.readyAt)item.readyAt=0;
    if(JSON.stringify(this.snapshot())!==this.pickupSignature)this.publishPickups();
    for(const map of [this.combat,this.cooldowns,this.rams])for(const[key,until]of map)if(until<=now)map.delete(key);
  }
  remove(id){this.combat.delete(id);this.cooldowns.delete(id);for(const key of this.rams.keys())if(key.startsWith(id+':')||key.endsWith(':'+id))this.rams.delete(key);}
}
