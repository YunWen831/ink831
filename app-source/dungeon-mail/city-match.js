import {randomUUID,randomInt} from 'node:crypto';
import {CITY,SPEED,BODY_RADIUS,MOVE_RADIUS,HIT_RADIUS,CAR_RADIUS,CAR_HIT_RADIUS,GUNS,GOODS,EVENTS,PLACES,BLOCKS,BOONS,SLOT_SYMBOLS,CONTRACT_META,MODIFIERS,RACE,GOOSE_RACERS,BODY_UPGRADES,ABNORMALITIES,DESIRES,clamp,dist,free,cityMove,cityDrive,wallRange,circleHit,nearPlace,BARKS} from '../../courtyard/city-rules.js';

const alive=p=>!!p&&p.hp>0&&!p.escaped;
const hasItem=(p,id)=>typeof id==='string'&&Object.hasOwn(p.inv,id)&&Number.isSafeInteger(p.inv[id])&&p.inv[id]>0;
const round=n=>Math.round(n*10)/10;
export class CityMatch{
  constructor({send=()=>{},connected=()=>true,now=()=>performance.now(),random=()=>randomInt(0,0x40000000)/0x40000000,onResult=()=>{}}={}){
    Object.assign(this,{send,connected,now,random,onResult});this.id=randomUUID();this.players=new Map();this.npcs=[];this.cars=[];this.loot=[];this.objects=[];this.bombs=[];this.bullets=[];this.effects=[];this.feed=[];this.banks=new Map();this.trades=new Map();this.rams=new Map();this.t=0;this.last=now();this.accumulator=0;this.sequence=0;this.publishAt=0;this.nextEvent=22;this.nextMinor=16;this.incidentAt=14;this.events=[];this.publishIndex=0;this.spawnAt=0;this.modifier=MODIFIERS[Math.floor(this.random()*MODIFIERS.length)];this.chaos=0;this.chaosAt=0;this.chaosLevel=0;this.gooseRace=this.newGooseRace(this.t+25);this.helicopter=null;
    for(let i=0;i<10;i++)this.npc(i<2?'police':'civilian');
    for(let i=0;i<10;i++){const p=this.point();this.cars.push({id:this.uid(),...p,heading:0,speed:0,hp:180,owner:'',driver:'',kind:i%3===0?'van':'car',npcDriver:i%4===0,route:0});}
    for(let i=0;i<34;i++)this.scatter(i%9===0?'pistol':i%7===0?'medkit':i%6===0?'banana':'cash',this.point(),i%4?60:120);
    this.say('本局城市规则：'+this.modifier.name+' · '+this.modifier.description);this.say('赛鹅大奖赛 25 秒后开跑','race');
  }
  get event(){return this.primaryEvent();}
  set event(value){this.events=value?[value]:[];}
  uid(){return 'c'+(++this.sequence);}
  maxHp(p){return p?.distort?p.distort.maxHp:100+(p?.body?.vitality||0)*20;}
  armorCap(p){return 100+(p.body?.plating||0)*25;}
  invCap(p){return 12+(p.body?.carry||0)*4;}
  invCount(p){return Object.values(p.inv).reduce((a,b)=>a+b,0);}
  newGooseRace(startsAt){
    return {phase:'betting',startsAt,endsAt:0,resetAt:0,winner:'',winnerName:'',result:[],bets:new Map(),
      geese:GOOSE_RACERS.map(g=>({...g,progress:0,finished:false,finishAt:0,form:.79+this.random()*.42}))};
  }
  stepGooseRace(dt){
    const r=this.gooseRace;if(!r)return;
    if(r.phase==='betting'){
      const left=Math.ceil(r.startsAt-this.t);
      if((left===10||left===5)&&!r['warn'+left]){r['warn'+left]=true;if(this.players.size)this.say('赛鹅大奖赛 '+left+' 秒后开跑','race');}
      if(this.t>=r.startsAt){r.phase='racing';r.endsAt=this.t+16;if(this.players.size)this.say('赛鹅大奖赛开跑！','race');}
      return;
    }
    if(r.phase==='racing'){
      for(const g of r.geese){if(g.finished)continue;const before=g.progress;g.progress+=dt*(.075*g.speed*g.form)*(.82+this.random()*.36);if(g.progress>=1){const over=g.progress-before,frac=over>0?(1-before)/over:1;g.progress=1;g.finished=true;g.finishAt=this.t+dt*frac;}}
      const first=r.geese.filter(g=>g.finished).sort((a,b)=>a.finishAt-b.finishAt)[0];
      if(first||this.t>=r.endsAt){
        const w=first||[...r.geese].sort((a,b)=>b.progress-a.progress)[0];
        w.finished=true;w.progress=1;r.winner=w.id;r.winnerName=w.name;r.phase='result';r.resetAt=this.t+7;
        r.result=[...r.geese].sort((a,b)=>{if(a.finished&&b.finished)return a.finishAt-b.finishAt;if(a.finished)return -1;if(b.finished)return 1;return b.progress-a.progress;}).map((g,i)=>({id:g.id,name:g.name,place:i+1,color:g.color}));
        for(const [id,bet] of r.bets){const p=this.players.get(id);if(!p)continue;if(bet.goose===w.id){const pay=Math.round(bet.amount*bet.odds);this.credit(p,pay);p.stats.raceWins=(p.stats.raceWins||0)+1;p.message='押中 '+w.name+' +'+pay;}else p.message=w.name+' 获胜，押注未中';}
        if(this.players.size)this.say(w.name+' 冲线夺冠！','race');
      }
      return;
    }
    if(r.phase==='result'&&this.t>=r.resetAt){this.gooseRace=this.newGooseRace(this.t+25);if(this.players.size)this.say('赛鹅大奖赛 25 秒后开跑');}
  }
  point(){for(let i=0;i<80;i++){const p={x:40+this.random()*(CITY.width-80),y:40+this.random()*(CITY.height-80)};if(free(p.x,p.y,22))return p;}return{x:60,y:60};}
  spawnPoint(){const spots=PLACES.filter(p=>p.kind==='fixer'||p.kind==='safehouse'||p.kind==='job'||p.kind==='garage'),q=spots[Math.floor(this.random()*spots.length)];return[{x:q.x-25,y:q.y},{x:q.x,y:q.y-25},{x:q.x,y:q.y}].find(p=>free(p.x,p.y,BODY_RADIUS,this.objects))||this.point();}
  freeSpot(x,y,r,max=320){if(free(x,y,r,this.objects))return{x,y};for(let d=6;d<=max;d+=6)for(let i=0;i<24;i++){const a=i*Math.PI/12,nx=x+Math.cos(a)*d,ny=y+Math.sin(a)*d;if(free(nx,ny,r,this.objects))return{x:nx,y:ny};}return null;}
  unstick(q,r){if(free(q.x,q.y,r,this.objects))return false;const spot=this.freeSpot(q.x,q.y,r);if(spot){Object.assign(q,spot);return true;}return false;}
  add(member){if(this.players.has(member.id))return this.players.get(member.id);if(this.players.size>=CITY.capacity)throw Error('都市已满，最多8人');
    const p={...member,...this.spawnPoint(),hp:100,armor:0,cash:0,bank:0,earned:0,wanted:0,heatAt:0,gun:'fists',ammo:0,reserve:0,inv:{},car:'',heading:0,input:{x:0,y:0,angle:0,at:-1},seq:0,actionSeq:0,shotAt:0,reloadAt:0,shield:this.t+10,respawnAt:0,slowUntil:0,progress:null,job:null,contract:null,contracts:[],boons:[],boonChoices:null,mods:{gun:0},body:{vitality:0,plating:0,muscle:0,carry:0},desire:{greed:0,wrath:0,envy:0},whisper:null,ego:null,distort:null,toast:'',whisperAt:0,pearlAt:0,heat:0,shotCrimeAt:0,boostUntil:0,flashUntil:0,policeAt:0,blockAt:0,respawnPoint:null,escaped:false,escapedAt:0,entered:this.t,stats:{jobs:0,robberies:0,kills:0,deaths:0,contracts:0,raceWins:0,heists:0}};
    this.players.set(p.id,p);this.unstick(p,BODY_RADIUS);p.contracts=this.makeContracts(p,3);for(const q of this.players.values())if(q!==p&&!q.contract)q.contracts=this.makeContracts(q,3);this.say(`${p.name} 被投放进城`,'join');return p;
  }
  remove(id){const p=this.players.get(id);if(!p)return;if(p.bounty){p.bounty=null;const h=[...this.players.values()].find(q=>q.contract?.kind==='player'&&q.contract.target===id);if(h){h.contract=null;h.contracts=this.makeContracts(h,3);h.message='猎杀目标离开了城市，委托失败';}}if(p.contract?.kind==='player'){const t=this.players.get(p.contract.target);if(t?.bounty)t.bounty=null;}this.gooseRace?.bets?.delete(id);if(!p.escaped){this.drop(p,true);this.say(`${p.name} 放弃了本次行动`,'leave');}this.exitCar(p);this.players.delete(id);for(const[key,v]of this.trades)if(v.from===id||v.to===id)this.trades.delete(key);}
  makeContracts(p,count=3){
    const types=['delivery','bounty','vehicle','race','heist'],places=PLACES.filter(q=>q.kind!=='escape'&&q.kind!=='fixer'),out=[];
    const quote=base=>Math.round(base*(this.modifier.pay||1));
    for(let i=0;i<count;i++){
      const kind=this.players.size>1&&i===count-1?'player':types[Math.floor(this.random()*types.length)];
      if(kind==='player'){const base=1100+Math.floor(this.random()*260);out.push({id:this.uid(),kind,name:'猎杀 · 玩家悬赏',description:'接单后锁定一名玩家，在 120 秒内击倒目标；目标撑到结束则你失败',base,pay:quote(base)});}
      else if(kind==='delivery'){const to=places[Math.floor(this.random()*places.length)],base=360+dist(p,to)*.16;out.push({id:this.uid(),kind,to:to.id,name:'急送 · '+to.name,description:'把包裹送到'+to.name,base,pay:quote(base)});}
      else if(kind==='bounty'){const at=places[Math.floor(this.random()*places.length)],base=600+Math.floor(this.random()*150);out.push({id:this.uid(),kind,place:at.id,name:'悬赏 · '+at.name,description:'在'+at.name+'附近找到并击倒目标',base,pay:quote(base)});}
      else if(kind==='heist'){const banks=places.filter(q=>q.kind==='bank'),bank=banks[Math.floor(this.random()*banks.length)],base=1800+Math.floor(this.random()*300);out.push({id:this.uid(),kind,place:bank.id,name:'银行劫案 · '+bank.name,description:'取得钥匙卡 → 打开金库 → 送赃款到撤离点',base,pay:quote(base)});}
      else if(kind==='race'){const base=RACE.base+Math.floor(this.random()*220);out.push({id:this.uid(),kind,name:'狂飙 · 三连检查点',description:'驾驶载具，按顺序穿过三个检查点；路线越长，限时越充裕',base,pay:quote(base)});}
      else {const base=500+Math.floor(this.random()*180);out.push({id:this.uid(),kind,name:'偷车 · 任意车行',description:'偷走标记车辆，开到任意车行交货',base,pay:quote(base)});}
    }
    return out;
  }
  rollBoons(p,count=3){const ids=Object.keys(BOONS).filter(id=>!p.boons.includes(id)),out=[];while(out.length<count&&ids.length){const i=Math.floor(this.random()*ids.length);out.push(ids.splice(i,1)[0]);}return out;}
  applyBoon(p,id){if(!Object.hasOwn(BOONS,id)||!p.boonChoices?.includes(id))return false;p.boons.push(id);p.boonChoices=null;p.contracts=this.makeContracts(p,3);p.message=BOONS[id].name+'：'+BOONS[id].description;return true;}
  completeContract(p){const c=p.contract;if(!c)return;this.desire(p,'greed',.5);p.stats.contracts=(p.stats.contracts||0)+1;if(c.kind==='heist')p.stats.heists=(p.stats.heists||0)+1;p.contract=null;p.boonChoices=this.rollBoons(p,p.boons.includes('rich')?4:3);p.contracts=[];p.message='委托完成 · 选择一项强化';this.say(p.name+' 完成委托','contract');}
  cancelProgress(p){if(p.progress?.kind==='car'){const car=this.cars.find(c=>c.id===p.progress.target);if(car&&car.npcWasNpc){car.npcDriver=true;car.npcWasNpc=false;car.speed=85;}}p.progress=null;}
  explode(owner,x,y,damage,radius){this.effect('explosion',{x,y});for(const p of this.players.values())if(alive(p)&&p!==owner&&dist(p,{x,y})<radius)this.hurt(p,damage,owner);for(const n of this.npcs)if(n.hp>0&&n!==owner&&dist(n,{x,y})<radius){n.hp-=damage;if(owner?.id)n.lastHitBy=owner.id;if(n.hp<=0)this.effect('fall',n);}for(const car of this.cars)if(car.hp>0&&dist(car,{x,y})<radius+20)this.carDamage(car,damage,owner);for(const o of this.objects)if((o.kind==='block'||o.kind==='riftcore')&&dist(o,{x,y})<radius+20)o.hp-=damage;}
  slots(p,amount){if(p.car||!nearPlace(p,'casino')){p.message='请到赌场门口下注';return false;}if(![50,100,200,500,1000,2000,5000].includes(amount)||p.cash<amount||p.gambleAt>this.t){p.message='筹码不足或下注太快';return false;}p.gambleAt=this.t+1.2;p.cash-=amount;
    const pick=()=>{const total=SLOT_SYMBOLS.reduce((a,b)=>a+b.weight,0);let r=this.random()*total;for(const s of SLOT_SYMBOLS){r-=s.weight;if(r<=0)return s;}return SLOT_SYMBOLS[0];};
    const reels=[pick(),pick(),pick()],same=reels[0].id===reels[1].id&&reels[1].id===reels[2].id,two=!same&&(reels[0].id===reels[1].id||reels[1].id===reels[2].id||reels[0].id===reels[2].id);
    let pay=0;if(reels.some(s=>s.id==='bomb'))pay=0;else if(same)pay=amount*Math.max(1,Math.round(reels[0].pay*.5));else if(two)pay=Math.round(amount*1.5);
    if(pay)this.credit(p,pay);this.effect('slots',p,{text:reels.map(s=>s.id).join(','),pay});p.message='老虎机 '+reels.map(s=>s.name).join(' · ')+(pay?' · 赢得 '+pay:' · 没有中奖');return true;
  }
  say(text,kind='info'){if(kind==='race'||kind==='join'||kind==='leave')return;if(this.feed.some(e=>e.text===text&&this.t-e.at<10))return;this.feed.push({id:this.uid(),text,kind,at:this.t});this.feed=this.feed.slice(-10);}
  effect(kind,p,fields={}){this.effects.push({id:this.uid(),kind,x:round(p.x),y:round(p.y),at:this.t,...fields});this.effects=this.effects.slice(-36);}
  credit(p,n){p.cash+=Math.floor(n);p.earned+=Math.floor(n);}
  price(id){return Math.ceil((GUNS[id]?.price??GOODS[id]?.price??900)*(this.hasEvent('sale')?.7:1)*(this.modifier.sale||1));}
  hasEvent(kind){return this.events.some(e=>e.kind===kind);}
  primaryEvent(){return this.events.find(e=>e.major)||this.events[0]||null;}
  desire(p,kind,n=1){if(p?.desire)p.desire[kind]=(p.desire[kind]||0)+n;}
  topDesire(p){const d=p?.desire||{greed:0,wrath:0,envy:0};return Object.keys(d).sort((a,b)=>d[b]-d[a])[0]||'wrath';}
  whisperChance(p){const d=p?.desire||{greed:0,wrath:0,envy:0},top=Math.max(d.greed||0,d.wrath||0,d.envy||0);if(top<=0)return 0;const hot=(p.wanted>=5||(p.stats?.kills||0)>=3||top>=3||this.chaos>=80);return hot?.5:.03;}
  rollWhisper(p){if(p.whisperAt&&this.t-p.whisperAt<60)return false;return this.random()<this.whisperChance(p);}
  input(id,d){const p=this.players.get(id);if(!alive(p)||!this.connected(id)||d?.id!==this.id||!Number.isSafeInteger(d.seq)||d.seq<=p.seq||d.seq>p.seq+10000||![d.x,d.y,d.angle].every(Number.isFinite)||Math.abs(d.x)>1||Math.abs(d.y)>1||Math.abs(d.angle)>Math.PI*2)return false;
    p.seq=d.seq;const n=Math.max(1,Math.hypot(d.x,d.y));p.input={x:d.x/n,y:d.y/n,angle:d.angle,fire:d.fire===true,interact:d.interact===true,sprint:d.sprint===true,brake:d.brake===true,at:this.t};return true;
  }
  action(id,d){const p=this.players.get(id);if(!alive(p)||!this.connected(id)||d?.id!==this.id||!Number.isSafeInteger(d.seq)||d.seq<=p.actionSeq||d.seq>p.actionSeq+10000||d.item!==undefined&&(typeof d.item!=='string'||d.item.length>24))return false;p.actionSeq=d.seq;
    const fail=text=>{p.message=text;return false;};
    if(d.kind==='whisper'){
      if(!p.whisper)return false;
      if(d.choice==='accept'){p.ego={desire:p.whisper.desire,on:true,faith:100,lockUntil:0,skillAt:0};p.hp=this.maxHp(p);p.whisper=null;p.shield=this.t+1;p.message='你接受了自己';p.toast='你接受了自己';this.say(p.name+' 绽放了 E.G.O.','event');this.effect('bloom',p);return true;}
      if(d.choice==='reject'){p.distort={desire:p.whisper.desire,maxHp:1400,kills:0,enraged:false,skillAt:0,damage:1};this.exitCar(p);p.hp=1400;p.whisper=null;p.gun='fists';p.ammo=0;p.reserve=0;p.shield=this.t+1;p.message='你放弃了';p.toast='你放弃了';this.say(p.name+' 扭曲了','event');this.effect('distort',p);return true;}
      p.whisper=null;p.hp=0;p.shield=0;this.hurt(p,9999,null);return true;
    }
    if(d.kind==='egoToggle'){
      if(!p.ego)return fail('你还没有听见低语');
      if(p.ego.on){p.ego.on=false;p.message='自我收敛';return true;}
      if(this.t<(p.ego.lockUntil||0))return fail('信念还没有恢复');
      if((p.ego.faith||0)<=0)return fail('信念不足');
      p.ego.on=true;p.message='自我绽放';this.effect('bloom',p);return true;
    }
    if(d.kind==='egoSkill'){
      if(!p.ego?.on)return fail('先开启神备');
      if(this.t<(p.ego.skillAt||0))return fail('技能还在冷却');
      p.ego.skillAt=this.t+12;p.ego.faith=Math.max(0,(p.ego.faith||0)-8);
      if(p.ego.desire==='greed'){this.explode(p,p.x,p.y,55,150);for(let i=0;i<6;i++)this.scatter('cash',{x:p.x+(this.random()-.5)*180,y:p.y+(this.random()-.5)*180},120);p.hp=Math.min(this.maxHp(p),p.hp+25);}
      else if(p.ego.desire==='envy'){const point=cityMove(p,Math.cos(p.input.angle)*150,Math.sin(p.input.angle)*150,this.objects,MOVE_RADIUS);Object.assign(p,point);this.explode(p,p.x,p.y,45,120);p.shield=this.t+1;}
      else this.explode(p,p.x,p.y,70,160);
      p.message='E.G.O. 技能';return true;
    }
    if(d.kind==='distortSkill'){
      if(!p.distort)return fail('你现在不是扭曲状态');
      if(this.t<(p.distort.skillAt||0))return fail('技能还在冷却');
      p.distort.skillAt=this.t+(p.distort.enraged?8:10);
      this.explode(p,p.x,p.y,70*(p.distort.damage||1),160);
      p.hp=Math.min(p.distort.maxHp,p.hp+40);p.message='扭曲爆发';return true;
    }
    if(p.distort)return fail('扭曲状态下无法使用城市服务');
    if(d.kind==='reload')return this.reload(p);
    if(d.kind==='exitCar'){this.exitCar(p);return true;}
    if(d.kind==='acceptContract'){
      if(p.car||!nearPlace(p,'fixer',115))return fail('请到中央广场的 Fixer 接单');if(p.contract)return fail('先完成当前委托');
      const offer=p.contracts.find(c=>c.id===d.item);if(!offer)return fail('委托已刷新');p.contract={...offer};
      if(offer.kind==='bounty'){const at=PLACES.find(q=>q.id===offer.place)||PLACES[0];const target=this.npc('civilian',cityMove(at,70,70));if(target){target.kind='target';target.hp=80;target.armed=true;target.bountyFor=p.id;}}
      if(offer.kind==='vehicle'){let car=this.cars.find(c=>c.hp>0&&!c.driver&&!c.owner&&!c.armored);if(!car){const spot=this.point();car={id:this.uid(),...spot,hp:180,speed:0,heading:0,owner:'',driver:'',kind:'car',npcDriver:false};this.cars.push(car);}car.contractFor=p.id;p.contract.carId=car.id;}
      if(offer.kind==='race'){
        const pool=PLACES.filter(q=>q.kind!=='escape'&&q.kind!=='fixer'&&dist(p,q)>500),picks=[];
        let from=p;
        while(picks.length<RACE.checkpoints&&pool.length){
          const candidates=pool.map(q=>({q,d:dist(from,q)})).sort((a,b)=>b.d-a.d).slice(0,6);
          if(!candidates.length)break;
          const pick=candidates[Math.floor(this.random()*candidates.length)].q;
          picks.push(pick.id);pool.splice(pool.indexOf(pick),1);from=pick;
        }
        p.contract.checkpoints=picks;p.contract.index=0;
        let total=0,prev=p;for(const id of picks){const q=PLACES.find(x=>x.id===id);total+=dist(prev,q);prev=q;}
        p.contract.expires=this.t+Math.max(45,Math.round(total/170));
        p.contract.description='驾驶载具，按顺序穿过三个检查点，限时 '+Math.round(p.contract.expires-this.t)+' 秒';
        const angle=this.random()*Math.PI*2,spot=cityMove(p,Math.cos(angle)*70,Math.sin(angle)*70);
        if(free(spot.x,spot.y,26)){const car={id:this.uid(),...spot,hp:220,speed:0,heading:0,owner:p.id,driver:'',kind:'car',npcDriver:false};this.cars.push(car);p.message='比赛用车停在 Fixer 门口，按 E 上车';}
      }
      if(offer.kind==='player'){
        const targets=[...this.players.values()].filter(q=>q!==p&&alive(q)&&!q.escaped&&!q.bounty&&q.shield<=this.t);
        if(!targets.length){p.contract=null;return fail('现在城里没有可猎杀的目标');}
        const target=targets[Math.floor(this.random()*targets.length)];
        p.contract.target=target.id;p.contract.targetName=target.name;p.contract.expires=this.t+120;p.contract.survival=Math.round(offer.pay*.35);
        target.bounty={amount:offer.pay,hunter:p.name,until:this.t+120};
        target.message=`你被 ${p.name} 悬赏猎杀 · 撑过 120 秒`;
        this.say(`${p.name} 接下了猎杀 ${target.name} 的悬赏`,'bounty');this.effect('bounty',target);
      }
      if(offer.kind==='heist'){
        p.contract.stage=0;p.contract.expires=this.t+280;
        const escapes=PLACES.filter(q=>q.kind==='escape');p.contract.drop=escapes[Math.floor(this.random()*escapes.length)].id;
        this.say(`${p.name} 接下了 ${offer.name}`,'contract');
      }
      p.message=offer.name+' · '+offer.description;return true;
    }
    if(d.kind==='betGoose'){
      const venue=nearPlace(p);if(p.car||venue?.id!=='goose-stadium')return fail('请到赛鹅竞技场下注');
    const race=this.gooseRace;if(!race||race.phase!=='betting')return fail('本场已经封盘，等下一场');
      if(![50,100,200,500,1000,2000,5000].includes(d.amount)||p.cash<d.amount)return fail('筹码不足');if(race.bets.has(p.id))return fail('本场已经下注');
      const goose=race.geese.find(g=>g.id===d.item);if(!goose)return fail('没有这只赛鹅');
      p.cash-=d.amount;race.bets.set(p.id,{goose:goose.id,amount:d.amount,odds:goose.odds});
      p.message='押 '+goose.name+' ¥'+d.amount+' · 赔率 x'+goose.odds;return true;
    }
    if(d.kind==='abandonContract'){
      if(!p.contract)return fail('当前没有委托');const c=p.contract;
      if(c.kind==='player'){const target=this.players.get(c.target);if(target?.bounty)target.bounty=null;}
      if(c.kind==='vehicle'){const car=this.cars.find(q=>q.id===c.carId);if(car)car.contractFor='';}
      if(c.kind==='bounty'){const target=this.npcs.find(q=>q.bountyFor===p.id);if(target){target.bountyFor='';target.armed=false;target.kind='civilian';}}
      p.contract=null;p.progress=null;p.contracts=this.makeContracts(p,3);p.message='已放弃委托';return true;
    }
    if(d.kind==='refreshContracts'){
      if(p.car||!nearPlace(p,'fixer',115))return fail('请到中央广场 Fixer');if(p.contract)return fail('先完成或放弃当前委托');
      p.contracts=this.makeContracts(p,3);p.message='委托板已刷新';return true;
    }
    if(d.kind==='sell'){
      const venue=nearPlace(p);if(p.car||!venue?.black)return fail('只能卖给后巷黑市');
      if(!hasItem(p,d.item)||(!Object.hasOwn(GUNS,d.item)&&!Object.hasOwn(GOODS,d.item)))return fail('这件东西不能回收');if(GUNS[d.item]?.eventOnly)return fail('这件装备不回收');
      if(d.item===p.gun)return fail('先换下当前武器');
      const base=GUNS[d.item]?.price??GOODS[d.item]?.price??0;if(!base)return fail('这件东西不值钱');
      const pay=Math.max(20,Math.round(base*.5*(this.modifier.sale||1)));
      p.inv[d.item]--;if(p.inv[d.item]<=0)delete p.inv[d.item];this.credit(p,pay);p.message='黑市回收 '+ (GUNS[d.item]?.name||GOODS[d.item]?.name||d.item) +' +'+pay;return true;
    }
    if(d.kind==='boon')return this.applyBoon(p,d.item)?true:fail('这项强化不可用');
    if(d.kind==='slots')return this.slots(p,d.amount);
    if(d.kind==='setRespawn'){if(p.car||!nearPlace(p,'safehouse',115))return fail('请到安全屋设置重生点');p.respawnPoint={x:p.x,y:p.y};p.message='重生点已设在这间安全屋';return true;}
    if(d.kind==='clean'){if(p.car||!nearPlace(p,'safehouse',115))return fail('请到安全屋处理通缉');if(p.wanted<=0)return fail('你没有被通缉');const cost=Math.max(300,p.wanted*400);if(p.cash<cost)return fail('现金不足');p.cash-=cost;p.wanted=0;p.heat=0;p.heatAt=this.t;p.message='通缉已清除 -'+cost;return true;}
    if(d.kind==='heal'){const clinic=nearPlace(p,'clinic',110);if(p.car||!clinic)return fail('请步行到诊所');const cost=d.item==='armor'?300:Math.max(60,Math.ceil((this.maxHp(p)-p.hp)*2));if(p.cash<cost)return fail('现金不足');p.cash-=cost;if(d.item==='armor')p.armor=Math.min(this.armorCap(p),p.armor+60);else p.hp=this.maxHp(p);p.message='诊所治疗完成 -'+cost;return true;}
    if(d.kind==='upgrade'){
      const venue=nearPlace(p);if(p.car||!venue?.black)return fail('只能到后巷黑市改装');
      if(d.item!=='gun')return fail('这个改装项目暂不可用');if(p.gun==='fists')return fail('先装备一件枪械');
      const level=p.mods?.gun||0;if(level>=3)return fail('枪械已经满级');
      const cost=Math.ceil([450,950,1700][level]*(this.modifier.sale||1));if(p.cash<cost)return fail('现金不足');
      p.cash-=cost;p.mods.gun=level+1;p.message='枪械改装 Lv.'+p.mods.gun+' · 伤害与装填提升';return true;
    }
    if(d.kind==='body'){
      const venue=nearPlace(p,'cyber',110);if(p.car||!venue)return fail('请步行到义体诊所');
      const upgrade=BODY_UPGRADES[d.item];if(!upgrade)return fail('没有这项身体强化');
      const level=p.body[d.item]||0;if(level>=3)return fail('这项强化已经满级');
      const cost=Math.ceil(upgrade.costs[level]*(this.modifier.sale||1));if(p.cash<cost)return fail('现金不足');
      p.cash-=cost;p.body[d.item]=level+1;
      if(d.item==='vitality')p.hp=Math.min(this.maxHp(p),p.hp+20);
      if(d.item==='plating')p.armor=Math.min(this.armorCap(p),p.armor+25);
      p.message=upgrade.name+' Lv.'+p.body[d.item]+' · '+upgrade.description;return true;
    }
    if(d.kind==='equip'){if(d.item===p.gun)return true;if(d.item==='fists'){if(p.gun!=='fists')p.inv[p.gun]=1;p.gun='fists';p.ammo=0;p.reloadAt=0;return true;}if(!Object.hasOwn(GUNS,d.item)||!hasItem(p,d.item))return fail('背包中没有这件武器');if(p.gun!=='fists')p.inv[p.gun]=1;p.inv[d.item]--;p.gun=d.item;p.ammo=0;p.reloadAt=0;this.reload(p);return true;}
    if(d.kind==='buy'){
      const venue=nearPlace(p);if(p.car||!venue)return fail('请步行到商店门口');
      const black=venue.black===true;
      const valid=venue.kind==='arms'&&(Object.hasOwn(GUNS,d.item)&&d.item!=='fists'&&!GUNS[d.item].blackOnly||d.item==='ammo')||venue.kind==='market'&&Object.hasOwn(GOODS,d.item)||black&&(Object.hasOwn(GUNS,d.item)&&d.item!=='fists'||d.item==='ammo'||Object.hasOwn(GOODS,d.item))||venue.kind==='garage'&&d.item==='car';
      if(!valid)return fail('这家店没有这件商品');if(GUNS[d.item]?.eventOnly)return fail('这件装备不对外出售');this.desire(p,'greed',.5);const cost=Math.ceil(this.price(d.item)*(black&&this.modifier.id!=='blackmarket'?1.35:1));if(p.cash<cost)return fail('随身现金不足');
      if(d.item==='car'){if(this.cars.length>=CITY.carLimit)return fail('城内车辆已满');const spot={x:venue.x+50,y:venue.y};if(!free(spot.x,spot.y,22)||this.cars.some(c=>dist(c,spot)<45))return fail('车行出口被占用');p.cash-=cost;this.cars.push({id:this.uid(),...spot,hp:180,speed:0,heading:0,owner:p.id,driver:'',kind:'car',npcDriver:false});p.message='车辆已停在车行旁';return true;}
      if(Object.hasOwn(GUNS,d.item)){if(d.item===p.gun||p.inv[d.item])return fail('已经拥有这件武器');if(p.gun!=='fists')p.inv[p.gun]=1;p.cash-=cost;p.gun=d.item;p.ammo=GUNS[d.item].mag;p.reserve+=GUNS[d.item].mag*3;p.reloadAt=0;return true;}
      if(this.invCount(p)>=this.invCap(p))return fail('背包已满，先使用或丢下物品');p.cash-=cost;p.inv[d.item]=(p.inv[d.item]||0)+1;return true;
    }
    if(d.kind==='deposit'||d.kind==='withdraw'){if(p.car||!nearPlace(p,'bank'))return fail('请步行到银行门口');const amount=d.amount==='all'?(d.kind==='deposit'?p.cash:p.bank):d.amount;if(!Number.isSafeInteger(amount)||amount<=0)return false;const from=d.kind==='deposit'?'cash':'bank',to=d.kind==='deposit'?'bank':'cash';if(p[from]<amount)return fail('余额不足');p[from]-=amount;p[to]+=amount;return true;}
    if(d.kind==='gamble'){
      if(p.car||!nearPlace(p,'casino'))return fail('请到赌场门口下注');if(![50,100,200,500,1000,2000,5000].includes(d.amount)||!['odd','even'].includes(d.choice)||p.cash<d.amount||p.gambleAt>this.t)return fail('筹码不足或下注太快');
      this.desire(p,'greed',1);p.gambleAt=this.t+.8;p.cash-=d.amount;const roll=1+Math.floor(this.random()*6),win=(roll%2===1)===(d.choice==='odd');if(win)this.credit(p,d.amount*2);p.message=`骰子 ${roll}：${win?'赢得 '+d.amount:'失去 '+d.amount}，均为局内虚拟币`;this.effect('dice',p,{text:String(roll)});return true;
    }
    if(d.kind==='work'||d.kind==='delivery'){if(p.car||!nearPlace(p,'job'))return fail('请步行到打工站');if(p.job)return fail('先完成当前配送');if(d.kind==='work'){p.progress={kind:'work',x:p.x,y:p.y,left:10,total:10};return true;}const options=PLACES.filter(q=>dist(q,p)>600&&q.kind!=='escape'),to=options[Math.floor(this.random()*options.length)];p.job={to:to.id,pay:Math.round(350+dist(p,to)*.2),expires:this.t+300};p.message=`送货到${to.name}，可开车，抵达后按E`;return true;}
    if(d.kind==='robBank'){const bank=nearPlace(p,'bank');if(p.car||!bank)return fail('请步行靠近银行');if(p.contract?.kind==='heist'&&p.contract.stage===0)return fail('先取得钥匙卡');this.desire(p,'greed',1);if(p.contract?.kind==='heist'&&p.contract.place!==bank.id)return fail('这不是委托目标银行');if((this.banks.get(bank.id)||0)>this.t)return fail('金库正在补钞，稍后再来');if(p.gun==='fists')return fail('带一件武器再抢银行');this.crime(p,4);p.progress={kind:'bank',target:bank.id,x:p.x,y:p.y,left:12,total:12,holdGrace:this.t+1.5};this.say(`${bank.name} 警报！`,'crime');this.policeNear(p,2);return true;}
    if(d.kind==='use')return this.use(p,d.item,fail);
    if(d.kind==='drop'){if(!hasItem(p,d.item))return false;p.inv[d.item]--;this.scatter(d.item,p,1);return true;}
    if(d.kind==='gift'){const other=this.players.get(d.target);if(!alive(other)||other===p||dist(p,other)>110||p.cash<100)return fail('走近对方并准备100现金');p.cash-=100;other.cash+=100;other.message=`${p.name} 转交了100现金`;return true;}
    if(d.kind==='offer'){const other=this.players.get(d.target);if(!alive(other)||other===p||dist(p,other)>110||!hasItem(p,d.item)||!Number.isSafeInteger(d.price)||d.price<0||d.price>10000)return fail('交易条件无效');for(const v of this.trades.values())if(v.from===id)return fail('已有一笔待处理交易');const offer={id:this.uid(),from:id,to:other.id,item:d.item,price:d.price,until:this.t+20};this.trades.set(offer.id,offer);return true;}
    if(d.kind==='accept'){const trade=this.trades.get(d.offer),seller=this.players.get(trade?.from);if(!trade||trade.to!==id||trade.until<this.t||!alive(seller)||dist(p,seller)>110||!hasItem(seller,trade.item)||p.cash<trade.price||this.invCount(p)>=this.invCap(p))return fail('交易已失效');p.cash-=trade.price;seller.cash+=trade.price;seller.inv[trade.item]--;p.inv[trade.item]=(p.inv[trade.item]||0)+1;this.trades.delete(trade.id);return true;}
    return false;
  }
  crime(p,n){const gain=Math.max(.1,n);this.desire(p,'wrath',Math.max(.2,n*.35));p.heat=clamp((p.heat||0)+gain,0,40);p.wanted=clamp(Math.ceil(p.heat/8),0,5);p.heatAt=this.t;p.shield=0;this.chaos=clamp(this.chaos+gain*(this.modifier.id==='crackdown'?3:2.5),0,100);this.chaosAt=this.t;}
  reload(p){const gun=GUNS[p.gun];if(!gun.mag||p.ammo>=gun.mag||p.reloadAt||p.reserve<=0)return false;p.reloadAt=this.t+gun.reload*(p.boons.includes('gunsmith')?.7:1)*(1-(p.mods?.gun||0)*.06);return true;}
  exitCar(p){const car=this.cars.find(c=>c.id===p.car);if(car){car.driver='';car.speed=0;const options=[{x:car.x,y:car.y+30},{x:car.x,y:car.y-30},{x:car.x+30,y:car.y}];Object.assign(p,options.find(q=>free(q.x,q.y,BODY_RADIUS,this.objects))||this.freeSpot(car.x,car.y,BODY_RADIUS)||car);}p.car='';}
  use(p,item,fail){if(!Object.hasOwn(GOODS,item)||!p.inv[item])return fail('背包里没有这个道具');let used=true;
    if(item==='medkit')p.hp=Math.min(this.maxHp(p),p.hp+(p.boons.includes('medic')?80:45));
    else if(item==='vest')p.armor=Math.min(this.armorCap(p),p.armor+60);
    else if(item==='armorplate')p.armor=Math.min(this.armorCap(p),p.armor+40);
    else if(item==='ammo')p.reserve=Math.min(240,p.reserve+(p.boons.includes('scavenger')?80:32));
    else if(item==='adrenaline'){p.boostUntil=this.t+8;p.slowUntil=0;p.message='肾上腺素：8 秒加速';}
    else if(item==='bribe'){if(this.npcs.some(n=>n.kind==='police'&&n.hp>0&&dist(n,p)<110))return fail('警察就在旁边，先拉开距离');p.heat=Math.max(0,(p.heat||0)-16);p.wanted=clamp(Math.ceil(p.heat/8),0,5);}
    else if(item==='repair'){const car=this.cars.find(c=>dist(c,p)<70&&c.hp>0);if(!car)return fail('靠近一辆尚未报废的车');car.hp=Math.min(180,car.hp+100);}
    else if(item==='blink'){if(p.car)return fail('先下车再使用');const range=wallRange(p,p.input.angle,260,this.objects),point=cityMove(p,Math.cos(p.input.angle)*Math.max(0,range-22),Math.sin(p.input.angle)*Math.max(0,range-22),this.objects);this.effect('blink',p);Object.assign(p,point);this.cancelProgress(p);}
    else if(item==='grenade'){
      if(p.car)return fail('先下车再使用');const range=wallRange(p,p.input.angle,360,this.objects),x=p.x+Math.cos(p.input.angle)*Math.max(24,range-20),y=p.y+Math.sin(p.input.angle)*Math.max(24,range-20);
      this.bombs.push({id:this.uid(),owner:p.id,kind:'grenade',x,y,at:this.t+1.1,damage:75*(p.boons.includes('demolition')?1.35:1),radius:125});this.effect('toss',p,{x,y});
    }
    else if(item==='molotov'){
      if(p.car)return fail('先下车再使用');const range=wallRange(p,p.input.angle,380,this.objects),x=p.x+Math.cos(p.input.angle)*Math.max(24,range-16),y=p.y+Math.sin(p.input.angle)*Math.max(24,range-16);
      this.objects.push({id:this.uid(),kind:'fire',x,y,hp:1,owner:p.id,until:this.t+7,burnAt:this.t,damage:7*(p.boons.includes('demolition')?1.35:1)});
    }
    else if(item==='smoke'){
      if(p.car)return fail('先下车再使用');const range=wallRange(p,p.input.angle,330,this.objects),x=p.x+Math.cos(p.input.angle)*Math.max(24,range-18),y=p.y+Math.sin(p.input.angle)*Math.max(24,range-18);
      this.objects.push({id:this.uid(),kind:'smoke',x,y,hp:1,owner:p.id,until:this.t+8});this.effect('toss',p,{x,y});p.message='烟雾弹已投出';
    }
    else if(item==='mine'){
      const point=free(p.x,p.y,15,this.objects)?{x:p.x,y:p.y}:null;if(!point)return fail('这里放不下地雷');
      this.objects.push({id:this.uid(),kind:'mine',...point,hp:1,owner:p.id,until:this.t+90,armAt:this.t+1.2});p.message='感应地雷已布置';
    }
    else if(item==='flashbang'){
      if(p.car)return fail('先下车再使用');const x=p.x+Math.cos(p.input.angle)*140,y=p.y+Math.sin(p.input.angle)*140;
      this.effect('flash',{x,y});for(const q of this.players.values())if(alive(q)&&dist(q,{x,y})<420)q.flashUntil=this.t+2;for(const n of this.npcs)if(dist(n,{x,y})<420)n.flashUntil=this.t+2;
    }
    else if(item==='enderpearl'){
      if(p.car)return fail('先下车再使用');if(this.t<(p.pearlAt||0))return fail('末影珍珠还在冷却');p.pearlAt=this.t+8;
      const range=wallRange(p,p.input.angle,360,this.objects),point=cityMove(p,Math.cos(p.input.angle)*Math.max(0,range-18),Math.sin(p.input.angle)*Math.max(0,range-18),this.objects,MOVE_RADIUS);
      this.effect('blink',p);Object.assign(p,point);p.hp=Math.max(1,p.hp-10);this.cancelProgress(p);p.message='末影珍珠传送 -10 生命';
    }
    else if(item==='tnt'){
      if(p.car)return fail('先下车再使用');this.bombs.push({id:this.uid(),owner:p.id,kind:'tnt',x:p.x,y:p.y,at:this.t+3,damage:70,radius:130});p.message='TNT 已放置，3 秒后爆炸';this.effect('toss',p,{x:p.x,y:p.y});
    }
    else if(item==='goldenapple'){p.hp=Math.min(this.maxHp(p),p.hp+50);p.armor=Math.min(this.armorCap(p),p.armor+20);p.message='金苹果：恢复 50 生命 +20 护甲';}
    else if(item==='totem')return fail('不死图腾会在致死时自动消耗');
    else if(this.objects.length<CITY.objectLimit){const offset=item==='perfume'?100:32,point=cityMove(p,Math.cos(p.input.angle)*offset,Math.sin(p.input.angle)*offset,this.objects);if(!free(point.x,point.y,15,this.objects)||PLACES.some(q=>dist(q,point)<55))return fail('这里会堵住服务入口，换个地方');this.objects.push({id:this.uid(),kind:item,...point,hp:item==='barricade'?80:1,owner:p.id,until:this.t+(item==='barricade'?40:15)});}
    else used=false;if(used)p.inv[item]--;return used;
  }
  scatter(kind,p,cash=0,extra={}){if(this.loot.length>=CITY.lootLimit)this.loot.shift();const point=free(p.x,p.y)?p:this.point();this.loot.push({id:this.uid(),kind,x:point.x,y:point.y,cash,until:this.t+180,...extra});}
  drop(p,all=false){const cash=all?p.cash:Math.floor(p.cash*.7);if(cash)this.scatter('cash',p,cash);p.cash-=cash;for(const[k,n]of Object.entries(p.inv))for(let i=0;i<n;i++)this.scatter(k,{x:p.x+(this.random()-.5)*40,y:p.y+(this.random()-.5)*40},1);p.inv={};if(p.gun!=='fists')this.scatter(p.gun,p,1,{ammo:p.ammo,reserve:p.reserve});p.gun='fists';p.ammo=p.reserve=0;}
  hurt(target,damage,attacker=null){
    if(!alive(target)||target.shield>this.t||target.whisper)return false;
    if(target.boons.includes('iron'))damage*=.85;
    if(target.ego?.on)damage*=.7;
    if(target.distort)damage*=.8;
    const absorbed=Math.min(target.armor,Math.ceil(damage*.6));target.armor-=absorbed;target.hp=Math.max(0,target.hp-Math.ceil(damage)+absorbed);
    if(target.ego?.on)target.ego.faith=Math.max(0,(target.ego.faith||0)-damage/20);
    this.cancelProgress(target);target.lastHurt=this.t;this.effect('hit',target,{damage:Math.round(damage),by:attacker?.id||''});
    if(target.distort&&target.hp<=target.distort.maxHp*.5&&!target.distort.enraged){target.distort.enraged=true;target.message='扭曲狂暴';}
    if(!target.hp){
      if((target.inv?.totem||0)>0){target.inv.totem--;if(target.inv.totem<=0)delete target.inv.totem;target.hp=1;target.shield=this.t+2;target.message='不死图腾替你挡下了死亡';target.toast='不死图腾碎裂';this.effect('bloom',target);this.say(target.name+' 的不死图腾碎裂了','event');return true;}
      if(!target.distort&&this.rollWhisper(target)){target.hp=1;target.shield=this.t+3;target.whisperAt=this.t;target.whisper={desire:this.topDesire(target),until:this.t+3};target.message='你听见了低语';this.effect('whisper',target);return true;}
      if(target.distort){
        this.explode(null,target.x,target.y,80,120);this.say(target.name+' 的扭曲被打碎了','event');
        if(attacker?.id){const by=this.players.get(attacker.id);if(by){this.credit(by,1500);by.message='击碎扭曲 +1500';by.toast='击碎扭曲';}}
        for(let i=0;i<6;i++)this.scatter('cash',{x:target.x+(this.random()-.5)*100,y:target.y+(this.random()-.5)*100},220);
        const drops=['mimicry','lamp','smile','justitia','fourthflame'];this.scatter(drops[Math.floor(this.random()*drops.length)],target,1);
        target.distort=null;
      }
      if(attacker?.distort&&this.players.has(target.id)){attacker.distort.kills++;attacker.distort.maxHp=Math.min(2000,attacker.distort.maxHp+150);attacker.hp=Math.min(attacker.distort.maxHp,attacker.hp+200);attacker.distort.damage=Math.min(1.5,(attacker.distort.damage||1)+.05);}
      const lost=Math.floor(target.cash*.7),byName=attacker?.name||(attacker?.kind==='police'?'警察':attacker?.kind==='zombie'?'僵尸':attacker?.kind==='goose'||attacker?.kind==='golden'?'大鹅':attacker?.kind==='target'?'悬赏目标':'环境'),gunName=attacker?.gun?GUNS[attacker.gun]?.name:attacker?.kind==='police'?'警枪':attacker?.kind==='zombie'?'撕咬':attacker?.kind==='goose'||attacker?.kind==='golden'?'鹅嘴':attacker?.kind==='target'?'枪械':'意外';
      target.death={by:byName,byId:attacker?.id||'',gun:gunName,damage:Math.round(damage),lost,x:round(target.x),y:round(target.y),at:round(this.t)};
      const hunter=target.bounty?[...this.players.values()].find(q=>q.contract?.kind==='player'&&q.contract.target===target.id):null;
      if(hunter){if(attacker===hunter)this.completeContract(hunter);else{hunter.contract=null;hunter.contracts=this.makeContracts(hunter,3);hunter.message='目标被别人击杀，委托失败';}}
      target.bounty=null;
      if(target.contract?.kind==='player'){const hunted=this.players.get(target.contract.target);if(hunted?.bounty){hunted.bounty=null;hunted.message='猎杀者倒下了，悬赏解除';}target.contract=null;}
      this.drop(target);this.exitCar(target);target.respawnAt=this.t+4;target.stats.deaths++;target.input={x:0,y:0,at:-1};target.job=null;target.ego=null;target.distort=null;target.whisper=null;
      if(target.contract){target.message='委托失败，回 Fixer 重新接单';target.contract=null;target.contracts=this.makeContracts(target,3);}
      if(attacker?.name)this.say(`${attacker.name} 用 ${GUNS[attacker.gun]?.name||'武器'}击倒了 ${target.name}`,'kill');else this.say(`${target.name} 倒下了`,'kill');
      if(attacker?.stats)attacker.stats.kills++;
      if(attacker?.id&&this.players.has(attacker.id))this.desire(attacker,'envy',1);
    }
    return true;
  }
  npc(kind,at=null){
    if(this.npcs.length>=CITY.npcLimit)return null;
    const p=at||this.point();
    const ab=kind.startsWith('ab_')?ABNORMALITIES[kind.slice(3)]:null;
    const hp=ab?ab.hp:kind==='gooseking'?2400:kind==='police'?90:kind==='convoy'?90:kind==='civilian'?45:kind==='golden'?100:kind==='creeper'?40:kind==='enderman'?80:kind==='skeleton'?60:kind==='slime'?50:kind==='slime_small'?25:60;
    const n={id:this.uid(),kind,...p,hp,maxHp:hp,heading:0,path:[],repath:0,hitAt:0,robbable:0,bark:Math.floor(this.random()*BARKS.length),roam:this.point()};
    if(kind==='zombie'){const roll=this.random();n.variant=roll<.2?'runner':roll<.3?'brute':'walker';n.hp=n.variant==='brute'?160:n.variant==='runner'?65:90;n.maxHp=n.hp;}
    if(ab){n.boss=true;n.r=kind==='ab_bigbird'?40:kind==='ab_mountain'?36:kind==='ab_nothing'?24:kind==='ab_judgebird'?30:18;n.revealed=kind!=='ab_nothing';n.abKind=kind.slice(3);}
    if(kind==='creeper')n.fuseAt=0;
    if(kind==='convoy')n.armed=true;
    this.npcs.push(n);return n;
  }
  policeNear(p,count){const extra=(this.chaos>=70?1:0)+(this.modifier.police?1:0)+(this.modifier.id==='no-law'?-1:0),total=Math.max(1,Math.min(3,count+extra));for(let i=0;i<total;i++){const point=cityMove(p,Math.cos(i*3)*180,Math.sin(i*3)*180);this.npc('police',point);}}
  attack(p){
    if(p.car||p.shotAt>this.t)return;
    if(p.distort){
      p.shotAt=this.t+.45;const angle=p.input.angle,damage=35*(p.distort.damage||1);let hit=null,best=90;
      const consider=q=>{if(q===p||q.hp<=0||q.escaped)return;const d=dist(p,q);if(d<best&&wallRange(p,angle,d,this.objects)>=d){best=d;hit=q;}};
      for(const q of this.players.values())consider(q);for(const q of this.npcs)consider(q);for(const q of this.cars)consider(q);
      this.effect('swing',p,{angle,range:best||90,hit:!!hit,gun:'fists'});
      if(hit){if(this.players.has(hit.id))this.hurt(hit,damage,p);else if(this.npcs.includes(hit)){hit.hp-=damage;hit.lastHitBy=p.id;if(hit.hp<=0)this.effect('fall',hit);}else this.carDamage(hit,damage,p);p.hp=Math.min(p.distort.maxHp,p.hp+damage*.3);}
      return;
    }
    const gun=GUNS[p.gun];
    if(p.reloadAt)return;
    const egoOn=!!p.ego?.on;
    if(gun.mag&&!egoOn&&p.ammo<=0){this.reload(p);return;}
    if(gun.mag&&egoOn&&p.ammo<=0)p.ammo=gun.mag;
    p.shotAt=this.t+gun.interval;p.shield=0;this.cancelProgress(p);
    if(gun.mag&&!egoOn)p.ammo--;
    const angle=p.input.angle,pellets=gun.pellets||1,damage=gun.damage*(p.boons.includes('hunter')?1.18:1)*(p.boons.includes('brawler')&&!gun.mag?1.5:1)*(1+(p.mods?.gun||0)*.15)*(egoOn?1.6:1),maxRange=gun.range*(p.boons.includes('marksman')?1.2:1),hits=new Map();let best=0,reach=0;
    for(let i=0;i<pellets;i++){
      const aim=angle+(pellets>1?(this.random()-.5)*gun.spread*2:0);let range=wallRange(p,aim,maxRange,this.objects),target=null,type='';
      const consider=(q,kind,r)=>{if(q===p||q.hp<=0||q.escaped||kind==='player'&&q.shield>this.t)return;const hit=gun.mag?circleHit(p,aim,q,r):dist(p,q);if(!gun.mag&&(Math.abs(Math.atan2(Math.sin(Math.atan2(q.y-p.y,q.x-p.x)-aim),Math.cos(Math.atan2(q.y-p.y,q.x-p.x)-aim)))>1||wallRange(p,Math.atan2(q.y-p.y,q.x-p.x),hit,this.objects)<hit))return;if(hit<=range){range=hit;target=q;type=kind;}};
      for(const q of this.players.values())consider(q,'player',HIT_RADIUS);for(const q of this.npcs)consider(q,'npc',HIT_RADIUS);for(const q of this.cars)consider(q,'car',CAR_HIT_RADIUS);for(const q of this.objects)if(q.kind==='barricade'||q.kind==='block'||q.kind==='riftcore')consider(q,'object',q.kind==='riftcore'?26:20);
      if(gun.mag&&this.helicopter){const hd=circleHit(p,aim,this.helicopter,34);if(hd<=maxRange&&hd<range){range=hd;target=this.helicopter;type='heli';}}
      if(target){best=Math.max(best,range);const rec=hits.get(target)||{target,type,damage:0};rec.damage+=damage;hits.set(target,rec);}
      reach=Math.max(reach,range);
    }
    this.effect(gun.mag?'shot':'swing',p,{angle,range:best||reach||maxRange,hit:hits.size>0,gun:p.gun});
    for(const hit of hits.values()){
      const target=hit.target;let d=hit.damage;
      if(hit.type==='player'&&gun.wantedBonus&&target.wanted)d*=1+gun.wantedBonus;
      if(hit.type==='player'){if(this.hurt(target,d,p)&&this.t-(p.shotCrimeAt||0)>1.4){this.crime(p,.75);p.shotCrimeAt=this.t;}}
      if(hit.type==='npc'){if(target.kind==='ab_nothing')target.revealed=true;target.hp-=d;target.lastHitBy=p.id;if(target.kind==='civilian'||target.kind==='police')this.crime(p,target.kind==='police'?6:2);
        if(target.hp<=0){if(target.kind==='zombie')this.effect('blood',target);if(target.kind==='golden'){this.credit(p,600*(p.boons.includes('lucky')?1.3:1)*(this.modifier.goose||1));p.message='击倒黄金大鹅 +600';this.say(p.name+' 抓住了黄金大鹅','event');}
          else if(target.bountyFor===p.id&&p.contract?.kind==='bounty')this.completeContract(p);
          else if(target.kind==='convoy'){this.scatter('cash',target,140);this.scatter('ammo',target,1);}
          else if(target.kind==='zombie'||target.kind==='goose')this.credit(p,80*(p.boons.includes('lucky')?1.3:1));else this.scatter('cash',target,60);
          if(p.boons.includes('vampire'))p.hp=Math.min(this.maxHp(p),p.hp+12);this.effect('fall',target);this.desire(p,'wrath',.5);
          if(gun.onKill&&p.ego?.on){p.hp=Math.min(this.maxHp(p),p.hp+gun.onKill.heal);p.boostUntil=this.t+gun.onKill.seconds;p.message='微笑：击杀加速';}
        }
      }
      if(hit.type==='car')this.carDamage(target,d,p);
      if(hit.type==='object')target.hp-=d;
      if(hit.type==='player'&&gun.lifesteal)p.hp=Math.min(this.maxHp(p),p.hp+d*gun.lifesteal);
      if(gun.fire&&(hit.type==='npc'||hit.type==='player'||hit.type==='car')){const x=target.x??p.x,y=target.y??p.y;this.objects.push({id:this.uid(),kind:'fire',x,y,hp:1,owner:p.id,until:this.t+5,burnAt:this.t,damage:6});}
      if(gun.aoe&&hit.type!=='object')this.explode(p,target.x??p.x,target.y??p.y,gun.aoe*.35,gun.aoe);
      if(egoOn&&hit.type==='player'&&!alive(target))p.ego.faith=Math.min(100,(p.ego.faith||0)+15);
      if(hit.type==='heli'){const h=this.helicopter;if(h&&this.helicopter===h){h.hp-=d;this.effect('hit',h,{damage:Math.round(d)});if(h.hp<=0){this.helicopter=null;this.heliDownAt=this.t+45;this.effect('explosion',{x:h.x,y:h.y});for(let i=0;i<8;i++)this.scatter('cash',{x:h.x+(this.random()-.5)*90,y:h.y+(this.random()-.5)*90},180);this.scatter('rifle',{x:h.x,y:h.y},1);this.scatter('medkit',{x:h.x,y:h.y},1);this.credit(p,1500);p.message='击落警方直升机 +1500';this.say(p.name+' 击落了警方直升机','police');}}}
    }
  }
  carDamage(car,amount,attacker=null){if(car.hp<=0)return;car.hp=Math.max(0,car.hp-amount);if(attacker)this.crime(attacker,1);if(!car.hp){if(attacker)this.desire(attacker,'wrath',1);const driver=this.players.get(car.driver);if(driver){this.exitCar(driver);this.hurt(driver,car.armored?45:25,attacker);if(driver.contract?.kind==='vehicle'&&driver.contract.carId===car.id){driver.contract=null;driver.contracts=this.makeContracts(driver,3);driver.message='委托车辆已报废';}}car.driver='';car.npcDriver=false;car.speed=0;this.effect('explosion',car);if(car.armored){for(let i=0;i<8;i++)this.scatter('cash',{x:car.x+(this.random()-.5)*90,y:car.y+(this.random()-.5)*90},160);this.say('装甲运钞车被炸开，现金散落一地');if(car.convoy){this.scatter('ammo',car,1);this.scatter('armorplate',car,1);this.scatter('rifle',car,1);}if(this.hasEvent('truck'))this.events=this.events.filter(e=>e.kind!=='truck');}}}
  interact(p,dt){if(p.car){const venueNow=nearPlace(p,null,75);if(p.input.interact&&p.contract?.kind==='delivery'&&venueNow?.id===p.contract.to)this.completeContract(p);if(p.input.interact&&p.contract?.kind==='vehicle'&&venueNow?.kind==='garage'){const car=this.cars.find(c=>c.id===p.car);if(car?.contractFor===p.id)this.completeContract(p);}this.cancelProgress(p);return;}
    if(p.progress){const task=p.progress;if(dist(p,task)>38){this.cancelProgress(p);return;}if(task.kind==='work'||p.input.interact)task.left-=dt;else if(task.holdGrace>this.t)return;else{this.cancelProgress(p);return;}
      if(task.kind==='bank'&&(this.banks.get(task.target)||0)>this.t){this.cancelProgress(p);return;}
      if(task.left<=0){p.progress=null;if(task.kind==='work'){this.credit(p,260);p.stats.jobs++;p.message='打工完成 +260';}
        if(task.kind==='mine'){const block=this.objects.find(o=>o.id===task.target);if(block){block.hp=0;this.scatter(this.random()<.2?'medkit':'cash',block,this.random()<.5?120:60);this.effect('hit',block,{damage:50});}}
        if(task.kind==='heistKey'){const bank=PLACES.find(q=>q.id===task.target);if(p.contract?.kind==='heist'){p.contract.stage=1;p.message='钥匙卡到手，去金库';this.say(`${p.name} 拿到了 ${bank?.name||'银行'} 的钥匙卡`,'contract');}}
        if(task.kind==='bank'){this.banks.set(task.target,this.t+150);this.credit(p,1600);p.stats.robberies++;this.crime(p,8);this.say(`${p.name} 带走了金库现金`,'crime');if(p.contract?.kind==='heist'&&p.contract.stage===1){p.contract.stage=2;const drop=PLACES.find(q=>q.id===p.contract.drop);p.message='钥匙卡和金库都到手，把赃款送到 '+(drop?.name||'撤离点');this.say(`${p.name} 打开了 ${PLACES.find(q=>q.id===task.target)?.name||'银行'} 金库`,'contract');}}
        if(task.kind==='car'){const car=this.cars.find(c=>c.id===task.target);if(car&&car.hp>0&&!car.driver&&dist(p,car)<65){car.owner=p.id;car.driver=p.id;car.npcDriver=false;p.car=car.id;this.crime(p,4);this.say(p.name+' 抢走了一辆车','crime');}}
        if(task.kind==='mug'){const npc=this.npcs.find(n=>n.id===task.target);if(npc?.hp>0&&dist(p,npc)<90&&npc.robbable<=this.t){npc.robbable=this.t+70;this.credit(p,170);this.crime(p,2);p.message='抢到170现金，警察注意到了你';this.say(p.name+' 抢劫了一名路人','crime');}}
        if(task.kind==='escape'&&p.cash>=CITY.goal){p.escaped=true;p.escapedAt=this.t;p.result={cash:p.cash,bank:p.bank,seconds:Math.round(this.t-p.entered),stats:{...p.stats}};if(p.bounty){p.bounty=null;const h=[...this.players.values()].find(q=>q.contract?.kind==='player'&&q.contract.target===p.id);if(h){h.contract=null;h.contracts=this.makeContracts(h,3);h.message='猎杀目标撤离，委托失败';}}if(p.contract?.kind==='player'){const t=this.players.get(p.contract.target);if(t?.bounty)t.bounty=null;p.contract=null;}this.exitCar(p);this.say(`${p.name} 成功撤离都市`,'extract');this.onResult({name:p.name,userId:p.userId||'',cash:p.result.cash,bank:p.result.bank,total:p.result.cash+p.result.bank,seconds:p.result.seconds,stats:{...p.stats},rule:this.modifier.name,chaos:Math.round(this.chaos)});}}
      return;
    }
    if(!p.input.interact)return;
    const loot=this.loot.filter(q=>dist(q,p)<40).sort((a,b)=>dist(a,p)-dist(b,p))[0];
    if(loot&&(loot.kind==='cash'||Object.hasOwn(GUNS,loot.kind)||this.invCount(p)<this.invCap(p))){if(loot.kind==='cash')this.credit(p,loot.cash*(p.boons.includes('lucky')?1.3:1)*(p.boons.includes('scavenger')?1.1:1)*(this.modifier.cash||1));else if(Object.hasOwn(GUNS,loot.kind)){if(loot.kind===p.gun){p.reserve=Math.min(240,p.reserve+(loot.reserve||16)*(p.boons.includes('scavenger')?2:1));}else{if(p.gun!=='fists')p.inv[p.gun]=1;if(hasItem(p,loot.kind))p.inv[loot.kind]--;p.gun=loot.kind;p.ammo=loot.ammo??GUNS[loot.kind].mag;p.reserve=Math.min(240,p.reserve+(loot.reserve??GUNS[loot.kind].mag*2));p.reloadAt=0;}}else p.inv[loot.kind]=(p.inv[loot.kind]||0)+1;this.loot=this.loot.filter(q=>q!==loot);p.input.interact=false;return;}
    if(loot)p.message='背包已满，无法拾取 '+(GOODS[loot.kind]?.name||loot.kind);
    const block=this.objects.find(o=>o.kind==='block'&&o.hp>0&&dist(o,p)<38);
    if(block){p.progress={kind:'mine',target:block.id,x:p.x,y:p.y,left:1.1,total:1.1};return;}
    const chest=this.objects.find(o=>o.kind==='chest'&&o.hp>0&&dist(o,p)<64);
    if(chest){chest.hp=0;const loots=['totem','enderpearl','goldenapple','tnt','diamondsword'];this.scatter(loots[Math.floor(this.random()*loots.length)],chest,1);this.scatter('cash',chest,600);this.say(p.name+' 打开了方块宝箱','event');p.input.interact=false;return;}
    const core=this.objects.find(o=>o.kind==='riftcore'&&o.hp>0&&dist(o,p)<70);
    if(core){if(this.t<(p.coreAt||0))return;p.coreAt=this.t+.5;core.hp-=60;this.effect('hit',core,{damage:60});p.input.interact=false;return;}
    if(p.distort)return;
    const venue=nearPlace(p,null,75);
    if(p.contract?.kind==='delivery'&&p.contract.to===venue?.id){this.completeContract(p);p.input.interact=false;return;}
    if(p.contract?.kind==='vehicle'&&venue?.kind==='garage'&&p.car){const car=this.cars.find(c=>c.id===p.car);if(car?.contractFor===p.id){this.completeContract(p);p.input.interact=false;return;}}
    if(p.contract?.kind==='heist'&&p.contract.stage===0&&venue?.id===p.contract.place){p.progress={kind:'heistKey',target:p.contract.place,x:p.x,y:p.y,left:4,total:4,holdGrace:this.t+1.5};return;}
    if(p.contract?.kind==='heist'&&p.contract.stage===1&&venue?.id===p.contract.place){if(p.gun==='fists'){p.message='需要一件武器才能开金库';return;}if((this.banks.get(venue.id)||0)>this.t){p.message='金库正在补钞，稍后再来';return;}this.crime(p,4);p.progress={kind:'bank',target:venue.id,x:p.x,y:p.y,left:12,total:12,holdGrace:this.t+1.5};this.say(`${venue.name} 警报！`,'crime');this.policeNear(p,2);return;}
    if(p.contract?.kind==='heist'&&p.contract.stage===2&&venue?.id===p.contract.drop){this.completeContract(p);p.input.interact=false;return;}
    const crate=this.objects.find(o=>o.kind==='airdrop'&&o.hp>0&&dist(o,p)<48);
    if(crate){crate.hp=0;if(p.gun!=='fists')p.inv[p.gun]=1;p.gun='rifle';p.ammo=GUNS.rifle.mag;p.reserve+=GUNS.rifle.mag*3;p.armor=Math.max(p.armor,60);p.inv.medkit=(p.inv.medkit||0)+1;p.message='打开空投：步枪 + 弹药 + 护甲';this.effect('pickup',p);p.input.interact=false;return;}
    if(p.job&&p.job.to===venue?.id){this.credit(p,p.job.pay);p.stats.jobs++;p.message=`送达 +${p.job.pay}`;p.job=null;p.input.interact=false;return;}
    if(venue?.kind==='escape'){if(p.cash<CITY.goal){p.message=`需携带${CITY.goal}现金才可撤离`;return;}p.progress={kind:'escape',x:p.x,y:p.y,left:8,total:8};return;}
    const car=this.cars.find(c=>c.hp>0&&!c.driver&&Math.abs(c.speed)<100&&dist(c,p)<60);if(car){if(car.owner===p.id){car.driver=p.id;car.npcDriver=false;p.car=car.id;}else{car.npcDriver=false;car.speed=0;p.progress={kind:'car',target:car.id,x:p.x,y:p.y,left:2.5,total:2.5};}return;}
    const npc=this.npcs.find(n=>n.hp>0&&n.kind==='civilian'&&n.robbable<=this.t&&dist(n,p)<60);if(npc&&p.gun!=='fists'){p.progress={kind:'mug',target:npc.id,x:p.x,y:p.y,left:2,total:2};npc.holdUntil=this.t+3;return;}
    if(venue?.kind==='job'&&!p.job){p.progress={kind:'work',x:p.x,y:p.y,left:10,total:10};return;}
  }
  path(from,to){
    const W=Math.ceil(CITY.width/128),H=Math.ceil(CITY.height/128),valid=(x,y)=>x>=0&&y>=0&&x<W&&y<H&&free(x*128+64,y*128+64,20,this.objects);
    const nearest=p=>{let best=null,score=Infinity;for(let y=0;y<H;y++)for(let x=0;x<W;x++){if(!valid(x,y))continue;const d=Math.hypot(x*128+64-p.x,y*128+64-p.y);if(d<score){score=d;best=y*W+x;}}return best;};
    const start=nearest(from),goal=nearest(to);if(start===null||goal===null)return[];const queue=[start],previous=new Map([[start,-1]]);
    for(let i=0;i<queue.length&&!previous.has(goal);i++){const current=queue[i],x=current%W,y=Math.floor(current/W);for(const[dx,dy]of [[1,0],[-1,0],[0,1],[0,-1]]){const nx=x+dx,ny=y+dy,next=ny*W+nx;if(valid(nx,ny)&&!previous.has(next)){previous.set(next,current);queue.push(next);}}}
    if(!previous.has(goal))return[];const result=[];for(let k=goal;k!==-1;k=previous.get(k))result.push({x:(k%W)*128+64,y:Math.floor(k/W)*128+64});return result.reverse().slice(0,50);
  }
  inSmoke(q){return this.objects.some(o=>o.kind==='smoke'&&o.until>this.t&&dist(o,q)<95);}
  npcTick(dt){
    const people=[...this.players.values()].filter(alive);
    for(const n of this.npcs){if(n.hp<=0||n.flashUntil>this.t)continue;let target=null;
      if(n.armed){target=people.filter(p=>p.shield<=this.t&&dist(p,n)<720).sort((a,b)=>dist(a,n)-dist(b,n))[0]||n.roam;}
      if(n.kind==='police'){
        const visible=people.filter(p=>{
          if(p.wanted<2||p.shield>this.t||this.inSmoke(p))return false;
          const range=620*(p.boons.includes('ghost')?.75:1)*(this.modifier.police?1.15:1)*(this.hasEvent('blackout')?.55:1),d=dist(p,n);
          return d<range&&wallRange(n,Math.atan2(p.y-n.y,p.x-n.x),d,this.objects)>=d;
        }).sort((a,b)=>dist(a,n)-dist(b,n));
        const wanted=visible[0];
        if(wanted){n.seenId=wanted.id;n.seenX=wanted.x;n.seenY=wanted.y;n.seenAt=this.t;}
        const hostile=this.npcs.filter(q=>q!==n&&q.hp>0&&(q.kind==='zombie'||q.kind==='goose'||q.kind==='gooseking'||q.kind==='convoy'||q.kind.startsWith('ab_')||q.kind==='creeper'||q.kind==='enderman'||q.kind==='skeleton'||q.kind==='slime')).map(q=>({q,d:dist(q,n)})).sort((a,b)=>a.d-b.d)[0];
        if(wanted)target=wanted;
        else if(hostile)target=hostile.q;
        else if(n.seenId){const seen=this.players.get(n.seenId);if(this.t-(n.seenAt||0)<5&&seen&&alive(seen)&&seen.wanted>=2)target={x:n.seenX,y:n.seenY};else n.seenId='';}
      }
      if(n.kind==='zombie'||n.kind==='goose')target=[...people.filter(p=>p.shield<=this.t&&!this.inSmoke(p)),...this.npcs.filter(q=>q!==n&&q.hp>0&&(q.kind==='civilian'||q.kind==='police'))].sort((a,b)=>dist(a,n)-dist(b,n))[0];
      if(n.kind==='gooseking')target=people.filter(p=>p.shield<=this.t&&!this.inSmoke(p)).sort((a,b)=>dist(a,n)-dist(b,n))[0]||n.roam;
      if(n.kind==='creeper'||n.kind==='enderman'||n.kind==='skeleton'||n.kind==='slime'||n.kind==='slime_small'||n.kind.startsWith('ab_'))target=people.filter(p=>p.shield<=this.t&&!this.inSmoke(p)).sort((a,b)=>dist(a,n)-dist(b,n))[0]||n.roam;
      if(n.kind==='ab_judgebird')target=people.filter(p=>p.shield<=this.t).sort((a,b)=>(b.wanted||0)-(a.wanted||0)||dist(a,n)-dist(b,n))[0]||n.roam;
      if(n.kind==='ab_nothing'&&!n.revealed){const close=people.find(p=>dist(p,n)<150);if(close)n.revealed=true;}
      if(n.kind==='ab_mountain'&&(!n.growAt||this.t>=n.growAt)){const food=this.loot.find(l=>dist(l,n)<80);if(food){food.until=0;n.growth=(n.growth||0)+1;n.maxHp=Math.min(2000,n.maxHp+40);n.hp=Math.min(n.maxHp,n.hp+40);this.effect('hit',n,{damage:0});}n.growAt=this.t+2;}
      if(n.kind==='ab_mountain'&&(!n.spawnAt||this.t>=n.spawnAt)){if(this.npcs.length<CITY.npcLimit)this.npc('zombie',{x:n.x+(this.random()-.5)*120,y:n.y+(this.random()-.5)*120});n.spawnAt=this.t+6;}
      const lure=this.objects.find(o=>o.hp>0&&o.until>this.t&&(o.kind==='decoy'||o.kind==='perfume'&&(n.kind==='zombie'||n.kind==='goose'))&&dist(o,n)<500);if(lure)target=lure;
      if(!target||dist(target,n)>950){target=n.roam;if(!target||dist(n,target)<40)n.roam=this.point();target=n.roam;}
      const distance=dist(n,target),angle=Math.atan2(target.y-n.y,target.x-n.x);n.heading=angle;
      if(n.kind==='gooseking'&&(!n.smashAt||n.smashAt<=this.t)){const car=this.cars.find(c=>c.hp>0&&dist(c,n)<95);if(car){this.carDamage(car,90);n.smashAt=this.t+.8;}}
      if(n.kind==='gooseking'&&target.id&&distance<82){if(n.hitAt<=this.t){if(this.players.has(target.id))this.hurt(target,22,n);else target.hp-=20;this.effect('swing',n,{angle,range:distance,hit:true});n.hitAt=this.t+.9;}if(distance<120)continue;}
      if(n.kind==='ab_bigbird'&&target.id&&distance<150){if(n.hitAt<=this.t){this.explode(n,n.x,n.y,50,130);n.hitAt=this.t+2.6;}if(distance<90)continue;}
      if(n.kind==='ab_mountain'&&target.id&&distance<70){if(n.hitAt<=this.t){const dmg=18*(1+(n.growth||0)*.1);if(this.players.has(target.id))this.hurt(target,dmg,n);else target.hp-=dmg;n.hitAt=this.t+.9;}continue;}
      if(n.kind==='ab_judgebird'&&target.id&&distance<95){if(n.hitAt<=this.t){const dmg=20+(target.wanted||0)*6;if(this.players.has(target.id))this.hurt(target,dmg,n);else target.hp-=dmg;n.hitAt=this.t+1.2;this.effect('swing',n,{angle,range:distance,hit:true});}if(distance<60)continue;}
      if(n.kind==='ab_nothing'&&n.revealed&&target.id&&distance<70){if(n.hitAt<=this.t){if(this.players.has(target.id)){this.hurt(target,24,n);n.hp=Math.min(n.maxHp,n.hp+12);}else target.hp-=24;n.hitAt=this.t+.7;}if(distance<50)continue;}
      if(n.kind==='ab_scorched'&&target.id&&distance<38){if(n.hitAt<=this.t){if(this.players.has(target.id))this.hurt(target,14,n);else target.hp-=14;n.hitAt=this.t+.8;}continue;}
      if(n.kind==='creeper'){if(n.fuseAt>0){if(this.t>=n.fuseAt){this.explode(n,n.x,n.y,60,110);n.hp=0;n.rewarded=true;this.scatter('tnt',n,1);this.say('苦力怕爆炸了','event');}continue;}if(target.id&&distance<95){n.fuseAt=this.t+1.5;this.effect('hiss',n);this.say('嘶——','event');continue;}}
      if(n.kind==='enderman'&&(!n.gazeAt||this.t>=n.gazeAt)){const gazer=people.find(p=>{const d=dist(p,n);if(d>600)return false;const a=Math.atan2(n.y-p.y,n.x-p.x),diff=Math.abs(Math.atan2(Math.sin(p.input.angle-a),Math.cos(p.input.angle-a)));return diff<.28;});if(gazer){n.gazeT=(n.gazeT||0)+dt;if(n.gazeT>=.5){n.gazeT=0;n.gazeAt=this.t+3;const behind=cityMove(gazer,Math.cos(gazer.input.angle+Math.PI)*60,Math.sin(gazer.input.angle+Math.PI)*60,this.objects);Object.assign(n,behind);this.hurt(gazer,30,n);this.effect('blink',n);continue;}}else n.gazeT=Math.max(0,(n.gazeT||0)-dt);}
      if(n.kind==='skeleton'&&target.id&&distance<300&&wallRange(n,angle,distance,this.objects)>=distance){if(n.hitAt<=this.t){const aim=angle+(this.random()-.5)*.08;this.bullets.push({id:this.uid(),x:n.x,y:n.y,angle:aim,speed:900,damage:10,owner:n.id,ownerKind:n.kind,ttl:this.t+.8,kind:'armed'});n.hitAt=this.t+1.4;this.effect('shot',n,{angle:aim,range:24,hit:false,gun:'pistol'});}if(distance<250)continue;}
      if((n.kind==='police'||n.armed)&&target.id&&(this.players.has(target.id)||target.kind==='zombie'||target.kind==='goose'||target.kind==='gooseking'||target.kind==='convoy')&&distance<300&&wallRange(n,angle,distance,this.objects)>=distance){if(n.hitAt<=this.t){const police=n.kind==='police',spread=police?Math.min(.14,.035+distance/300*.09):.06,aim=angle+(this.random()-.5)*spread*2;this.bullets.push({id:this.uid(),x:n.x,y:n.y,angle:aim,speed:police?920:1020,damage:police?8:12,owner:n.id,ownerKind:n.kind,ttl:this.t+.7,kind:police?'police':'armed'});this.effect('shot',n,{angle:aim,range:24,hit:false,gun:'pistol'});n.hitAt=this.t+(police?1.3:1.2);}if(distance<120)continue;}
      if((n.kind==='zombie'||n.kind==='goose')&&target.id&&distance<32){if(n.hitAt<=this.t){const bite=n.kind==='goose'?9:n.variant==='brute'?24:n.variant==='runner'?12:16;if(this.players.has(target.id))this.hurt(target,bite,n);else{target.hp-=bite;if(target.hp<=0&&n.kind==='zombie'&&target.kind==='civilian'&&this.hasEvent('zombies')&&this.npcs.length<CITY.npcLimit)this.npc('zombie',{x:target.x,y:target.y});}n.hitAt=this.t+.9;}continue;}
      if((n.robbable>this.t||n.holdUntil>this.t)&&n.kind==='civilian')continue;
      if(n.kind==='skeleton'&&distance<250){const away=Math.atan2(n.y-target.y,n.x-target.x);Object.assign(n,cityMove(n,Math.cos(away)*120*dt,Math.sin(away)*120*dt,this.objects));continue;}
      let waypoint=target;if(wallRange(n,angle,distance,this.objects)<distance){if(n.repath<=this.t){n.path=this.path(n,target);n.repath=this.t+1.3+this.random()*.4;}while(n.path.length&&dist(n,n.path[0])<22)n.path.shift();waypoint=n.path[0]||n.roam;}if(!waypoint)continue;
      const abSpeed=ABNORMALITIES[n.kind.slice(3)]?.speed,abSpeedNow=n.kind==='ab_bigbird'?(this.hasEvent('blackout')?150:110):abSpeed;
      const speed=n.kind==='civilian'?50:n.kind==='goose'?190:n.kind==='gooseking'?130:n.kind==='zombie'?(n.variant==='runner'?175:n.variant==='brute'?85:120):n.kind==='creeper'?95:n.kind==='enderman'?115:n.kind==='skeleton'?90:n.kind==='slime'?80:n.kind==='slime_small'?95:abSpeedNow||145,dx=waypoint.x-n.x,dy=waypoint.y-n.y,len=Math.max(1,Math.hypot(dx,dy));Object.assign(n,cityMove(n,dx/len*speed*dt,dy/len*speed*dt,this.objects));
    }
    for(const n of this.npcs)if(n.hp<=0&&n.kind==='gooseking'&&!n.rewarded){
      n.rewarded=true;
      const by=this.players.get(n.lastHitBy||''),point={x:n.x,y:n.y};
      for(let i=0;i<10;i++)this.scatter('cash',{x:point.x+(this.random()-.5)*130,y:point.y+(this.random()-.5)*130},220);
      this.scatter('lmg',point,1);this.scatter('medkit',point,1);this.scatter('armorplate',point,1);
      if(by){this.credit(by,2200);by.message='击倒鹅王 +2200';}
      this.say('鹅王倒下，金色补给散落一地','event');this.effect('explosion',point);
    }
    for(const n of this.npcs)if(n.hp<=0&&!n.rewarded&&(n.kind.startsWith('ab_')||['creeper','enderman','skeleton','slime','slime_small'].includes(n.kind))){
      n.rewarded=true;const point={x:n.x,y:n.y};
      if(n.kind.startsWith('ab_')){const ab=ABNORMALITIES[n.kind.slice(3)]||{name:'异想体',drop:'medkit'};for(let i=0;i<6;i++)this.scatter('cash',{x:point.x+(this.random()-.5)*100,y:point.y+(this.random()-.5)*100},180);this.scatter(ab.drop,point,1);this.scatter('medkit',point,1);if(n.kind==='ab_scorched'){this.explode(null,point.x,point.y,90,140);for(let i=0;i<3;i++)this.objects.push({id:this.uid(),kind:'fire',x:point.x+(this.random()-.5)*100,y:point.y+(this.random()-.5)*100,hp:1,owner:'',until:this.t+8,damage:6});}const by=this.players.get(n.lastHitBy||'');if(by){this.credit(by,800);by.message='收容 '+ab.name+' +800';by.toast='收容 '+ab.name;}this.say(ab.name+' 被收容','event');this.effect('explosion',point);}
      else if(n.kind==='creeper')this.scatter('tnt',point,1);
      else if(n.kind==='enderman')this.scatter('enderpearl',point,1);
      else if(n.kind==='skeleton')this.scatter('cash',point,100);
      else if(n.kind==='slime'){this.scatter('cash',point,80);if(this.npcs.length<CITY.npcLimit)for(let i=0;i<2;i++)this.npc('slime_small',{x:point.x+(this.random()-.5)*60,y:point.y+(this.random()-.5)*60});}
      else this.scatter('cash',point,80);
    }
    this.npcs=this.npcs.filter(n=>n.hp>0);
  }
  stepBullets(dt){
    for(const b of this.bullets){
      if(b.dead)continue;
      const step=b.speed*dt,wall=wallRange(b,b.angle,step+4,this.objects),travel=Math.min(step,wall);
      let best=travel+1,hit=null,type='';
      const consider=(q,kind,r)=>{if(!q||q.hp<=0)return;if(kind==='player'&&q.shield>this.t)return;if(kind==='npc'&&(q.id===b.owner||q.kind===b.ownerKind))return;if(kind==='car'&&b.ownerKind==='police'&&q.kind==='police')return;const d=circleHit(b,b.angle,q,r);if(d<=travel&&d<best){best=d;hit=q;type=kind;}};
      for(const p of this.players.values())consider(p,'player',HIT_RADIUS);
      for(const n of this.npcs)consider(n,'npc',HIT_RADIUS);
      for(const c of this.cars)consider(c,'car',CAR_HIT_RADIUS);
      if(hit){
        if(type==='player')this.hurt(hit,b.damage,this.npcs.find(n=>n.id===b.owner)||null);
        else if(type==='npc'){hit.hp-=b.damage;hit.lastHitBy=b.owner;if(hit.kind==='zombie')this.effect('blood',hit);this.effect('hit',hit,{damage:b.damage,by:b.owner});if(hit.hp<=0)this.effect('fall',hit);}
        else this.carDamage(hit,b.damage,null);
        b.dead=true;continue;
      }
      b.x+=Math.cos(b.angle)*travel;b.y+=Math.sin(b.angle)*travel;
      if(wall<step||this.t>=b.ttl)b.dead=true;
    }
    this.bullets=this.bullets.filter(b=>!b.dead&&this.t<b.ttl);
  }
  stepPolice(dt){
    for(const p of this.players.values()){
      if(!alive(p)||p.wanted<4)continue;
      const active=this.cars.filter(c=>c.kind==='police'&&c.chase===p.id&&c.hp>0);
      const wantedCars=1;
      if(active.length<wantedCars&&this.t>=(p.policeAt||0)&&this.cars.length<CITY.carLimit+4){
        for(let i=0;i<6;i++){
          const angle=this.random()*Math.PI*2,distance=560+this.random()*260,spot=cityMove(p,Math.cos(angle)*distance,Math.sin(angle)*distance);
          if(!free(spot.x,spot.y,26))continue;
          this.cars.push({id:this.uid(),...spot,hp:240,speed:0,heading:0,owner:'',driver:'',kind:'police',npcDriver:false,chase:p.id,deployed:false,siren:true,policePath:[],repath:0,stuck:0,seenX:p.x,seenY:p.y,seenAt:this.t});
          p.policeAt=this.t+12;this.say('警车正在追捕 '+p.name,'police');break;
        }
      }
      if(p.wanted>=5&&this.t>=(p.blockAt||0)){
        for(let i=0;i<2;i++){
          const spot=cityMove(p,(this.random()-.5)*260,(this.random()-.5)*260);
          if(free(spot.x,spot.y,20))this.objects.push({id:this.uid(),kind:'barricade',...spot,hp:120,owner:'police',until:this.t+28});
        }
        p.blockAt=this.t+22;this.say('警方设置了路障','police');
      }
    }
    for(const c of this.cars){
      if(c.kind!=='police'||!c.chase)continue;
      const target=this.players.get(c.chase);
      if(!target||!alive(target)||target.wanted<3){c.chase='';c.npcDriver=true;c.route=0;c.speed=0;continue;}
      const los=wallRange(c,Math.atan2(target.y-c.y,target.x-c.x),dist(c,target),this.objects)>=dist(c,target);
      if(los){c.seenX=target.x;c.seenY=target.y;c.seenAt=this.t;}
      else if(this.t-(c.seenAt||0)>5){c.chase='';c.npcDriver=true;c.route=0;c.speed=0;this.say('警车跟丢了','police');continue;}
      const aim=los?target:{x:c.seenX,y:c.seenY};
      if(!aim||!Number.isFinite(aim.x)||!Number.isFinite(aim.y)){c.chase='';c.npcDriver=true;c.route=0;c.speed=0;continue;}
      const direct=Math.atan2(aim.y-c.y,aim.x-c.x),distance=dist(c,aim);
      let waypoint=aim,angle=direct;
      if(wallRange(c,direct,distance,this.objects)<distance){
        if(!c.policePath?.length||c.repath<=this.t){c.policePath=this.path(c,aim);c.repath=this.t+1.4;}
        while(c.policePath?.length&&dist(c,c.policePath[0])<30)c.policePath.shift();
        if(c.policePath?.[0]){waypoint=c.policePath[0];angle=Math.atan2(waypoint.y-c.y,waypoint.x-c.x);}
      }else c.policePath=[];
      c.heading+=clamp(Math.atan2(Math.sin(angle-c.heading),Math.cos(angle-c.heading)),-3.4*dt,3.4*dt);
      c.speed=Math.min(285,c.speed+250*dt);
      const before={x:c.x,y:c.y};
      Object.assign(c,cityMove(c,Math.cos(c.heading)*c.speed*dt,Math.sin(c.heading)*c.speed*dt,this.objects,CAR_RADIUS));
      const moved=dist(c,before);
      if(c.speed>80&&moved<c.speed*dt*.35)c.stuck=(c.stuck||0)+dt;else c.stuck=Math.max(0,(c.stuck||0)-dt);
      if(c.stuck>2.4){
        for(let i=0;i<6;i++){const a=this.random()*Math.PI*2,spot=cityMove(aim,Math.cos(a)*520,Math.sin(a)*520);if(free(spot.x,spot.y,28)){Object.assign(c,spot,{speed:0});break;}}
        c.stuck=0;c.policePath=[];c.repath=0;
      }
      if(los&&dist(c,target)<76&&!c.deployed){c.deployed=true;this.policeNear(target,1);this.say('警车截停了 '+target.name,'police');}
      if(los&&dist(c,target)<38&&this.t>=(c.hitAt||0)){this.hurt(target,6,c);c.hitAt=this.t+1.5;c.speed*=.6;}
    }
    const high=[...this.players.values()].find(p=>alive(p)&&p.wanted>=5);
    if(high){
      if((!this.helicopter||this.helicopter.target!==high.id)&&this.t>=(this.heliDownAt||0))this.helicopter={target:high.id,x:high.x+200,y:high.y-180,angle:0,hp:650,maxHp:650};
      if(this.helicopter){this.helicopter.angle+=dt*.55;this.helicopter.x=high.x+Math.cos(this.helicopter.angle)*260;this.helicopter.y=high.y+Math.sin(this.helicopter.angle)*190;}
    }else this.helicopter=null;
  }
  movePlayer(p,dt){
    if(p.distort)p.car='';
    const input=this.connected(p.id)&&this.t-p.input.at<.3?p.input:{x:0,y:0,fire:false,interact:false,angle:p.input.angle};p.inputActive=input;
    this.unstick(p,BODY_RADIUS);
    const old={x:p.x,y:p.y};let speed=(input.sprint?SPEED.sprint:SPEED.walk)*(p.slowUntil>this.t?.28:1)*(p.boons.includes('swift')?1.15:1)*(p.boostUntil>this.t?1.35:1)*(1+(p.body?.muscle||0)*.06)*(p.ego?.on?1.25:1)*(p.distort?1.2:1);
    if(p.car){const car=this.cars.find(c=>c.id===p.car&&c.driver===p.id&&c.hp>0);if(!car){p.car='';return;}const next=cityDrive(car,input,dt,this.objects);Object.assign(car,next);this.unstick(car,CAR_RADIUS);if(next.impact)this.carDamage(car,next.impact);if(p.boons.includes('driver')&&car.speed>30)Object.assign(car,cityMove(car,Math.cos(car.heading)*car.speed*dt*.12,Math.sin(car.heading)*car.speed*dt*.12,this.objects,CAR_RADIUS));p.x=car.x;p.y=car.y;p.heading=car.heading;
      if(car.speed>180){for(const q of [...this.players.values(),...this.npcs]){if(q===p||q.hp<=0||q.escaped||q.car===car.id)continue;const dx=p.x-old.x,dy=p.y-old.y,len=dx*dx+dy*dy,a=len?clamp(((q.x-old.x)*dx+(q.y-old.y)*dy)/len,0,1):0;if(Math.hypot(q.x-old.x-dx*a,q.y-old.y-dy*a)>25)continue;const key=car.id+q.id;if((this.rams.get(key)||0)>this.t)continue;this.rams.set(key,this.t+1);const damage=Math.min(45,Math.round(car.speed/14));if(this.players.has(q.id)){if(this.hurt(q,damage,p))this.crime(p,1.5);}else{q.hp-=damage;if(q.kind==='civilian'||q.kind==='police')this.crime(p,2);}car.speed*=.65;}}
    }else{Object.assign(p,cityMove(p,input.x*speed*dt,input.y*speed*dt,this.objects,MOVE_RADIUS));this.unstick(p,BODY_RADIUS);p.heading=input.angle;if(input.fire)this.attack(p);}
    // A held action is only accepted while fresh input continues to arrive.
    const saved=p.input.interact;p.input.interact=input.interact;this.interact(p,dt);p.input.interact=p.input.interact&&saved;
    for(const o of this.objects)if(o.kind==='banana'&&o.owner!==p.id&&dist(p,o)<28&&o.until>this.t){p.slowUntil=this.t+2;o.until=0;this.effect('slip',p);}
  }
  startEvent(kind,opts={}){
    if(!Object.hasOwn(EVENTS,kind))return null;
    const major=EVENTS[kind].major===true,majors=this.events.filter(e=>e.major).length,minors=this.events.length-majors;
    if(major?majors>=(this.chaos>=80?2:1):minors>=2)return null;
    if(kind==='abnormality'&&this.hasEvent('abnormality'))return null;
    if(kind==='rift'&&this.hasEvent('rift'))return null;
    let point=this.point();const people=[...this.players.values()].filter(alive);
    if((kind==='gooseking'||kind==='artillery')&&people.length){const anchor=people[Math.floor(this.random()*people.length)],angle=this.random()*Math.PI*2,reach=kind==='gooseking'?900:Math.sqrt(this.random())*700;point=cityMove(anchor,Math.cos(angle)*reach,Math.sin(angle)*reach);}
    if(kind==='rift'){const plazas=[{x:2000,y:440},{x:3640,y:1420},{x:840,y:1390}];point=plazas[Math.floor(this.random()*plazas.length)];}
    if(!free(point.x,point.y,44))point=this.point();
    const event={kind,ends:this.t+EVENTS[kind].seconds,x:point.x,y:point.y,major,...opts};
    this.events.push(event);this.say(EVENTS[kind].name+'！','event');
    if(kind==='zombies'){for(let i=0;i<22;i++)this.npc('zombie');this.zombieAt=this.t+8;}
    if(kind==='geese')for(let i=0;i<8;i++)this.npc('goose');
    if(kind==='swat')for(let i=0;i<4;i++){const target=people[i%Math.max(1,people.length)];if(target)this.policeNear(target,1);}
    if(kind==='golden')this.npc('golden',point);
    if(kind==='truck')this.cars.push({id:this.uid(),...point,heading:this.random()*6.28,speed:0,hp:520,owner:'',driver:'',kind:'truck',armored:true,npcDriver:true,route:0});
    if(kind==='airdrop')this.objects.push({id:this.uid(),kind:'airdrop',...point,hp:1,owner:'',until:this.t+EVENTS.airdrop.seconds});
    if(kind==='cash')for(let i=0;i<12;i++){const q=cityMove(point,(this.random()-.5)*220,(this.random()-.5)*220);this.scatter('cash',q,140+Math.floor(this.random()*100));}
    if(kind==='gooseking'){const boss=this.npc('gooseking',point);if(boss){boss.hp=boss.maxHp=2400;boss.boss=true;boss.r=56;event.bossId=boss.id;}}
    if(kind==='artillery'){event.warnEnd=this.t+10;event.barrageEnd=this.t+20;event.radius=620;event.looted=false;event.shellsAt=this.t+10;}
    if(kind==='abnormality'){
      const variants=Object.keys(ABNORMALITIES);event.variant=opts.variant&&ABNORMALITIES[opts.variant]?opts.variant:variants[Math.floor(this.random()*variants.length)];
      event.warnEnd=this.t+10;event.spawned=false;
      this.objects.push({id:this.uid(),kind:'pod',x:point.x,y:point.y,hp:1,until:event.ends,variant:event.variant});
    }
    if(kind==='rift')this.startRift(event);
    if(kind==='convoy'){
      const corners=[{x:520,y:60},{x:CITY.width-520,y:60},{x:CITY.width-520,y:CITY.height-120},{x:520,y:CITY.height-120}];
      const start=Math.floor(this.random()*4),path=[corners[start],corners[(start+1)%4],corners[(start+2)%4]];
      for(let i=0;i<3;i++){const q={x:path[0].x+(this.random()-.5)*140,y:path[0].y+(this.random()-.5)*140};this.cars.push({id:this.uid(),...q,heading:0,speed:0,hp:380,owner:'',driver:'',kind:'truck',armored:true,npcDriver:false,convoy:true,convoyPath:path,convoyIndex:0});}
      for(let i=0;i<5;i++){const n=this.npc('convoy',{x:path[0].x+(this.random()-.5)*220,y:path[0].y+(this.random()-.5)*220});if(n){n.armed=true;n.roam={...path[0]};}}
      const lead=this.cars.find(c=>c.convoy);if(lead){event.x=lead.x;event.y=lead.y;}
    }
    return event;
  }
  startRift(event){
    const cx=event.x,cy=event.y,cell=32,size=10,half=size*cell/2;
    for(let iy=0;iy<size;iy++)for(let ix=0;ix<size;ix++){
      if(this.random()<.14)continue;
      const x=cx-half+ix*cell,y=cy-half+iy*cell;
      this.objects.push({id:this.uid(),kind:'block',x,y,w:cell-2,h:cell-2,hp:50,mat:this.random()<.55?'grass':this.random()<.5?'dirt':'stone',until:event.ends});
    }
    const core={id:this.uid(),kind:'riftcore',x:cx-20,y:cy-20,w:40,h:40,hp:800,until:event.ends};
    this.objects.push(core);
    this.objects.push({id:this.uid(),kind:'chest',x:cx+70,y:cy-16,w:28,h:28,hp:1,until:event.ends});
    event.coreId=core.id;event.expandAt=this.t+90;
    for(let i=0;i<3;i++)this.npc('creeper',cityMove({x:cx,y:cy},(this.random()-.5)*260,(this.random()-.5)*260));
    for(let i=0;i<2;i++)this.npc('enderman',cityMove({x:cx,y:cy},(this.random()-.5)*260,(this.random()-.5)*260));
    for(let i=0;i<2;i++)this.npc('skeleton',cityMove({x:cx,y:cy},(this.random()-.5)*260,(this.random()-.5)*260));
    this.npc('slime',cityMove({x:cx,y:cy},(this.random()-.5)*260,(this.random()-.5)*260));
  }
  incident(){
    const people=[...this.players.values()].filter(alive);if(!people.length)return;
    const roll=this.random();
    if(roll<.38){
      if(this.npcs.length>=CITY.npcLimit-4)return;
      const anchor=people[Math.floor(this.random()*people.length)],point=cityMove(anchor,(this.random()-.5)*520,(this.random()-.5)*520);
      for(let i=0;i<3;i++){const n=this.npc('convoy',cityMove(point,(this.random()-.5)*120,(this.random()-.5)*120));if(n){n.armed=true;n.roam={x:point.x,y:point.y};}}
      this.say('街头火并','event');
    }else if(roll<.7){const point=this.point();this.explode(null,point.x,point.y,45,110);this.say('煤气管道爆炸','event');}
    else{for(let i=0;i<2;i++){const car=this.cars.find(c=>c.hp>0&&Math.abs(c.speed)<100&&!c.driver);if(car){this.carDamage(car,220,null);this.effect('explosion',car);}}this.say('连环车祸','event');}
  }
  step(dt){this.t+=dt;
    this.stepGooseRace(dt);
    this.chaos=Math.max(0,this.chaos-dt*.18);
    const chaosLevel=Math.min(5,Math.ceil(this.chaos/20));
    if(chaosLevel>this.chaosLevel){this.chaosLevel=chaosLevel;this.say('城市混乱度升至 '+chaosLevel+' 级','chaos');if(chaosLevel>=2&&!this.events.some(e=>e.major))this.startEvent(chaosLevel>=4?'swat':chaosLevel>=3?'cash':'bombs');}
    else this.chaosLevel=chaosLevel;
    for(const p of this.players.values()){
      if(p.whisper&&this.t>p.whisper.until){p.whisper=null;p.shield=0;this.hurt(p,9999,null);}
      if(p.ego){if(p.ego.on){p.ego.faith=Math.max(0,(p.ego.faith||0)-3*dt);if(p.ego.faith<=0){p.ego.on=false;p.ego.lockUntil=this.t+10;p.message='信念耗尽';}}else p.ego.faith=Math.min(100,(p.ego.faith||0)+4*dt);}
      if(p.respawnAt&&this.t>=p.respawnAt){Object.assign(p,{...(p.respawnPoint||this.spawnPoint()),armor:p.boons.includes('iron')?20:0,respawnAt:0,shield:this.t+10,wanted:0,heat:0,hp:this.maxHp(p),death:null,progress:null,gun:'fists',input:{x:0,y:0,angle:0,at:-1}});this.unstick(p,BODY_RADIUS);}
      if(!alive(p))continue;if(p.reloadAt&&this.t>=p.reloadAt){const n=Math.min(GUNS[p.gun].mag-p.ammo,p.reserve);p.ammo+=n;p.reserve-=n;p.reloadAt=0;}
      if(p.heat>0&&this.t-p.heatAt>4&&!this.npcs.some(n=>n.kind==='police'&&dist(n,p)<250&&wallRange(n,Math.atan2(p.y-n.y,p.x-n.x),dist(n,p),this.objects)>=dist(n,p))&&!this.cars.some(c=>c.kind==='police'&&c.chase===p.id&&c.hp>0)){p.heat=Math.max(0,p.heat-dt*(p.boons.includes('veteran')?.85:.6));p.wanted=clamp(Math.ceil(p.heat/8),0,5);}
      if(p.job?.expires<this.t){p.job=null;p.message='配送超时，回打工站重新接单';}
      if(p.contract?.kind==='race'){
        if(p.contract.expires<this.t){p.contract=null;p.contracts=this.makeContracts(p,3);p.message='狂飙超时，委托失败';}
        else {const cp=PLACES.find(q=>q.id===p.contract.checkpoints?.[p.contract.index]);if(cp&&dist(p,cp)<95){if(!p.car)p.message='狂飙检查点：必须开车通过';else{p.contract.index++;this.effect('checkpoint',p);if(p.contract.index>=p.contract.checkpoints.length)this.completeContract(p);else p.message='检查点 '+p.contract.index+'/'+p.contract.checkpoints.length+' · 继续';}}}
      }
      if(p.contract?.kind==='heist'&&p.contract.expires<this.t){p.contract=null;p.progress=null;p.contracts=this.makeContracts(p,3);p.message='劫案超时，委托失败';}
      if(p.contract?.kind==='player'){
        const target=this.players.get(p.contract.target);
        if(!target||!alive(target)){p.contract=null;p.message='猎杀目标已经不在了';}
        else if(this.t>=p.contract.expires){const survival=Math.round(p.contract.survival||400);p.contract=null;target.bounty=null;this.credit(target,survival);target.message='你撑过了悬赏 +'+survival;p.message='猎杀超时，委托失败';this.say(`${target.name} 撑过了悬赏`,'bounty');this.effect('checkpoint',target);}
      }
      this.movePlayer(p,dt);
    }
    this.stepPolice(dt);
    if(Math.floor(this.t*10)!==Math.floor((this.t-dt)*10))this.npcTick(.1);
    this.stepBullets(dt);
    const convoyLead=this.cars.find(c=>c.convoy&&c.hp>0);
    for(const car of this.cars)if(car.convoy&&car.hp>0){const to=car.convoyPath[car.convoyIndex];if(!to||dist(car,to)<48){car.convoyIndex++;if(car.convoyIndex>=car.convoyPath.length){car.convoy=false;car.npcDriver=true;car.route=0;continue;}}const target=car.convoyPath[car.convoyIndex]||to;if(!target)continue;car.heading=Math.atan2(target.y-car.y,target.x-car.x);const next=cityMove(car,Math.cos(car.heading)*140*dt,Math.sin(car.heading)*140*dt,this.objects);Object.assign(car,next);car.speed=140;}
    if(convoyLead)for(const n of this.npcs)if(n.kind==='convoy'&&n.hp>0)n.roam={x:convoyLead.x,y:convoyLead.y};
    for(const car of this.cars)if(car.npcDriver&&!car.driver&&car.hp>0){const points=[{x:520,y:60},{x:CITY.width-520,y:60},{x:CITY.width-520,y:CITY.height-120},{x:520,y:CITY.height-120}],to=points[car.route%4];if(dist(to,car)<35){car.route++;continue;}car.heading=Math.atan2(to.y-car.y,to.x-car.x);const next=cityMove(car,Math.cos(car.heading)*85*dt,Math.sin(car.heading)*85*dt,this.objects);Object.assign(car,next);car.speed=85;}
    for(const ev of this.events){
      if(ev.kind==='gooseking'){const boss=this.npcs.find(n=>n.id===ev.bossId&&n.hp>0);if(boss){ev.x=boss.x;ev.y=boss.y;}else ev.ends=Math.min(ev.ends,this.t);}
      else if(ev.kind==='convoy'){const lead=this.cars.find(c=>c.convoy&&c.hp>0);if(lead){ev.x=lead.x;ev.y=lead.y;}else ev.ends=Math.min(ev.ends,this.t);}
      else if(ev.kind==='artillery'){
        if(this.t>=ev.warnEnd&&this.t<ev.barrageEnd&&this.t>=(ev.shellsAt||0)){ev.shellsAt=this.t+.2;const shots=this.chaos>=60?3:2;for(let i=0;i<shots;i++){const angle=this.random()*Math.PI*2,r=Math.sqrt(this.random())*ev.radius;this.bombs.push({id:this.uid(),x:ev.x+Math.cos(angle)*r,y:ev.y+Math.sin(angle)*r,at:this.t+1.5,damage:45,radius:90,kind:'shell'});}}
        if(this.t>=ev.barrageEnd&&!ev.looted){ev.looted=true;ev.ends=Math.min(ev.ends,this.t+12);for(let i=0;i<18;i++){const angle=this.random()*Math.PI*2,r=Math.sqrt(this.random())*ev.radius,q={x:ev.x+Math.cos(angle)*r,y:ev.y+Math.sin(angle)*r};this.scatter(i%5===0?'medkit':i%5===1?'ammo':'cash',q,i%5===2?180:1);}this.scatter('rifle',{x:ev.x,y:ev.y},1);for(let i=0;i<4;i++){const q=cityMove({x:ev.x,y:ev.y},(this.random()-.5)*300,(this.random()-.5)*300);this.objects.push({id:this.uid(),kind:'fire',...q,hp:1,owner:'',until:this.t+14,damage:6});}this.say('炮击停止，废墟里散落着补给','event');}
      }
      else if(ev.kind==='abnormality'){
        if(!ev.spawned&&this.t>=ev.warnEnd){ev.spawned=true;const boss=this.npc('ab_'+ev.variant,{x:ev.x,y:ev.y});if(boss){ev.bossId=boss.id;ev.x=boss.x;ev.y=boss.y;}else ev.ends=this.t;}
        if(ev.spawned){const boss=this.npcs.find(n=>n.id===ev.bossId&&n.hp>0);if(boss){ev.x=boss.x;ev.y=boss.y;}else ev.ends=Math.min(ev.ends,this.t);}
      }
      else if(ev.kind==='rift'){
        const core=this.objects.find(o=>o.id===ev.coreId&&o.hp>0);
        if(core){ev.x=core.x;ev.y=core.y;}
        else if(!ev.rewarded){ev.rewarded=true;ev.ends=Math.min(ev.ends,this.t+8);for(let i=0;i<12;i++)this.scatter(i%4===0?'medkit':i%4===1?'ammo':'cash',{x:ev.x+(this.random()-.5)*220,y:ev.y+(this.random()-.5)*220},220);this.scatter('totem',{x:ev.x,y:ev.y},1);this.scatter('enderpearl',{x:ev.x+30,y:ev.y},1);this.objects=this.objects.filter(o=>o.kind!=='block'&&o.kind!=='riftcore');this.say('方块核心碎裂，裂缝开始坍塌','event');}
        if(ev.expandAt&&this.t>=ev.expandAt){ev.expandAt=0;for(let i=0;i<2;i++)this.npc('creeper',cityMove({x:ev.x,y:ev.y},(this.random()-.5)*300,(this.random()-.5)*300));for(let i=0;i<2;i++)this.npc('enderman',cityMove({x:ev.x,y:ev.y},(this.random()-.5)*300,(this.random()-.5)*300));this.say('方块裂缝在扩大','event');}
      }
    }
    if(this.events.some(e=>this.t>e.ends)){this.events=this.events.filter(e=>this.t<=e.ends);this.say('城市暂时恢复营业');}
    if(this.t>=this.nextEvent){
      const options=Object.keys(EVENTS).filter(k=>EVENTS[k].major);
      if(this.chaos>=30)options.push('gooseking','artillery','convoy');
      if(this.chaos>=45)options.push('abnormality','abnormality','rift');
      if(this.chaos>=65)options.push('gooseking','artillery','convoy','swat');
      const started=this.startEvent(options[Math.floor(this.random()*options.length)]);
      this.nextEvent=this.t+(started?Math.max(20,48-this.chaos*.18):6);
    }
    if(this.t>=this.nextMinor){
      const minors=['cash','sale','airdrop','bombs','geese','golden','truck','blackout'];
      if(this.modifier.cash)minors.push('cash','truck','airdrop');
      if(this.modifier.goose)minors.push('geese','golden');
      if(this.modifier.blackout)minors.push('blackout');
      this.startEvent(minors[Math.floor(this.random()*minors.length)]);
      this.nextMinor=this.t+12+this.random()*14;
    }
    if(this.t>=this.incidentAt){this.incident();this.incidentAt=this.t+16+this.random()*14;}
    if(this.hasEvent('zombies')&&(!this.zombieAt||this.t>=this.zombieAt)){const zcount=this.npcs.filter(n=>n.kind==='zombie').length;if(zcount<28){const people=[...this.players.values()].filter(alive),anchor=people[Math.floor(this.random()*Math.max(1,people.length))];for(let i=0;i<5;i++){const point=anchor?cityMove(anchor,(this.random()-.5)*760,(this.random()-.5)*760):this.point();this.npc('zombie',point);}}this.zombieAt=this.t+8;}
    if(this.hasEvent('bombs')&&(!this.bombAt||this.t>=this.bombAt)){const people=[...this.players.values()].filter(alive);if(people.length){const p=people[Math.floor(this.random()*people.length)];for(let i=0;i<3;i++){const spot=cityMove(p,(this.random()-.5)*600,(this.random()-.5)*600);this.bombs.push({id:this.uid(),...spot,at:this.t+1.8});}}this.bombAt=this.t+1.5;}
    for(const bomb of this.bombs)if(!bomb.done&&this.t>=bomb.at){bomb.done=true;const radius=bomb.radius||80,damage=bomb.damage||45;this.effect('explosion',{x:bomb.x,y:bomb.y});for(const p of this.players.values())if(dist(p,bomb)<radius)this.hurt(p,damage,this.players.get(bomb.owner));for(const n of this.npcs)if(dist(n,bomb)<radius){n.hp-=damage*1.3;if(bomb.owner)n.lastHitBy=bomb.owner;}for(const car of this.cars)if(dist(car,bomb)<radius+10)this.carDamage(car,damage*1.5);}
    for(const o of this.objects)if(o.kind==='fire'&&o.until>this.t&&(!o.burnAt||this.t>=o.burnAt)){o.burnAt=this.t+.6;for(const p of this.players.values())if(dist(p,o)<78)this.hurt(p,o.damage||7,this.players.get(o.owner));for(const n of this.npcs)if(dist(n,o)<78)n.hp-=(o.damage||7)*1.4;}
    for(const o of this.objects)if(o.kind==='mine'&&o.until>this.t&&this.t>=(o.armAt||0)){const owner=this.players.get(o.owner);const target=[...this.players.values()].find(q=>q.id!==o.owner&&alive(q)&&dist(q,o)<62)||this.npcs.find(n=>n.hp>0&&dist(n,o)<58)||this.cars.find(c=>c.hp>0&&dist(c,o)<64);if(target){o.hp=0;this.explode(owner,o.x,o.y,80*(owner?.boons.includes('demolition')?1.35:1),112);}}
    this.bombs=this.bombs.filter(b=>this.t-b.at<.5);this.objects=this.objects.filter(o=>o.until>this.t&&o.hp>0);this.loot=this.loot.filter(l=>l.until>this.t);this.effects=this.effects.filter(e=>this.t-e.at<.65);this.feed=this.feed.filter(e=>this.t-e.at<14);
    for(const[key,value]of this.trades)if(value.until<this.t||!alive(this.players.get(value.from))||!alive(this.players.get(value.to)))this.trades.delete(key);
    for(const[key,until]of this.rams)if(until<this.t)this.rams.delete(key);
    if(this.t>=this.spawnAt){if(this.loot.length<42)this.scatter(this.random()<.18?'medkit':'cash',this.point(),80);if(this.npcs.filter(n=>n.kind==='civilian'||n.kind==='police').length<12)this.npc(this.npcs.filter(n=>n.kind==='police').length<2?'police':'civilian');this.cars=this.cars.filter(c=>c.hp>0||c.driver);if(this.cars.length<10){const spot=this.point();this.cars.push({id:this.uid(),...spot,hp:180,speed:0,heading:0,owner:'',driver:'',kind:'car',npcDriver:false});}this.spawnAt=this.t+6;}
  }
  tick(dt){const stamp=this.now();if(dt===undefined){dt=clamp((stamp-this.last)/1000,0,.2);this.last=stamp;}else dt=clamp(dt,0,.2);this.accumulator=Math.min(.25,this.accumulator+dt);while(this.accumulator>=CITY.step){this.step(CITY.step);this.accumulator-=CITY.step;}this.publish();}
  snapshot(id){const p=this.players.get(id);if(!p)return null;const nearby=q=>dist(p,q)<CITY.view,venue=nearPlace(p,null,110),own={x:round(p.x),y:round(p.y),heading:round(p.heading),hp:p.hp,armor:p.armor,cash:p.cash,bank:p.bank,wanted:p.wanted,gun:p.gun,ammo:p.ammo,reserve:p.reserve,inv:{...p.inv},car:p.car,seq:p.seq,actionSeq:p.actionSeq,shield:Math.max(0,p.shield-this.t),slow:Math.max(0,p.slowUntil-this.t),respawn:Math.max(0,p.respawnAt-this.t),reload:Math.max(0,p.reloadAt-this.t),escaped:p.escaped,escapedAt:round(p.escapedAt||0),result:p.result,message:p.message||'',job:p.job,contract:p.contract?{...p.contract}:null,contracts:p.contracts.map(c=>({...c})),boons:[...p.boons],boonChoices:p.boonChoices?[...p.boonChoices]:null,mods:{...p.mods},body:{...p.body},maxHp:this.maxHp(p),armorCap:this.armorCap(p),invCap:this.invCap(p),heat:round(p.heat||0),boost:Math.max(0,Math.round((p.boostUntil||0)-this.t)),flash:Math.max(0,Math.round((p.flashUntil||0)-this.t)),bounty:p.bounty?{...p.bounty}:null,death:p.death?{...p.death}:null,respawnPoint:p.respawnPoint,near:venue?.id||'',progress:p.progress?{kind:p.progress.kind,left:round(p.progress.left),total:p.progress.total}:null};
    own.whisper=p.whisper?{...p.whisper}:null;own.ego=p.ego?{desire:p.ego.desire,on:p.ego.on,faith:round(p.ego.faith||0),skill:p.ego.skillAt||0}:null;own.distort=p.distort?{desire:p.distort.desire,maxHp:p.distort.maxHp,enraged:p.distort.enraged,kills:p.distort.kills,damage:p.distort.damage}:null;own.desire={...p.desire};own.toast=p.toast||'';
    const bossNpc=this.npcs.find(n=>n.boss&&n.hp>0&&n.kind.startsWith('ab_')),bossPlayer=[...this.players.values()].find(q=>q.distort&&alive(q));
    const boss=bossNpc?{name:ABNORMALITIES[bossNpc.kind.slice(3)]?.name||'异想体',hp:bossNpc.hp,maxHp:bossNpc.maxHp||bossNpc.hp,kind:bossNpc.kind}:bossPlayer?{name:bossPlayer.name+' · 扭曲',hp:bossPlayer.hp,maxHp:bossPlayer.distort.maxHp,kind:'distorted'}:null;
    const race=this.gooseRace;
    return{id:this.id,time:round(this.t),goal:CITY.goal,modifier:this.modifier,chaos:Math.round(this.chaos),chaosLevel:this.chaosLevel,self:own,helicopter:this.helicopter?{...this.helicopter}:null,gooseRace:race?{phase:race.phase,startsIn:Math.max(0,Math.ceil(race.startsAt-this.t)),endsIn:Math.max(0,Math.ceil(race.endsAt-this.t)),winner:race.winner,winnerName:race.winnerName,result:race.result,own:race.bets.get(id)||null,bettors:race.bets.size,geese:race.geese.map(g=>({id:g.id,name:g.name,color:g.color,odds:g.odds,progress:Math.round(g.progress*100)/100,finished:g.finished}))}:null,event:this.primaryEvent()?{...this.primaryEvent()}:null,events:this.events.map(e=>({...e,name:EVENTS[e.kind]?.name||e.kind,hint:EVENTS[e.kind]?.hint||''})),boss,next:Math.ceil(this.nextEvent-this.t),players:[...this.players.values()].filter(nearby).map(q=>({id:q.id,name:q.name,color:q.color,userId:q.userId,x:round(q.x),y:round(q.y),heading:round(q.heading),hp:q.hp,armor:q.armor,wanted:q.wanted,car:q.car,shield:q.shield>this.t,escaped:q.escaped,connected:this.connected(q.id),distorted:!!q.distort,ego:!!q.ego?.on,bounty:q.bounty?.amount||0,hunter:q.bounty?.hunter||''})),
      map:Math.floor(this.t)%2===0?[...this.players.values()].map(q=>[q.id,Math.round(q.x/128)*128,Math.round(q.y/128)*128]):undefined,
      npcs:this.npcs.filter(nearby).map(n=>[n.id,n.kind,round(n.x),round(n.y),Math.max(0,n.hp),round(n.heading),n.bark,n.variant||'',n.revealed?1:0,n.maxHp||n.hp]),
      cars:this.cars.filter(nearby).map(c=>[c.id,round(c.x),round(c.y),round(c.heading),c.hp,c.owner,c.driver,c.kind,round(c.speed),c.contractFor===id?1:0,c.chase||'',c.convoy?1:0]),
      loot:this.loot.filter(nearby).map(l=>[l.id,l.kind,round(l.x),round(l.y),l.kind==='cash'?l.cash:1]),objects:this.objects.filter(nearby).map(o=>[o.id,o.kind,round(o.x),round(o.y),o.hp,o.w||0,o.h||0,o.mat||o.variant||'']),bombs:this.bombs.filter(nearby).map(b=>[b.id,round(b.x),round(b.y),round(b.at),b.kind||'',b.radius||80]),bullets:this.bullets.filter(nearby).map(b=>[b.id,round(b.x),round(b.y),b.angle,b.kind]),effects:this.effects.filter(nearby),feed:this.feed.slice(-5),offers:[...this.trades.values()].filter(v=>v.to===id).map(v=>({...v,name:this.players.get(v.from)?.name})),sent:[...this.trades.values()].filter(v=>v.from===id).map(v=>({...v,name:this.players.get(v.to)?.name})),count:this.players.size};
  }
  publish(){const ids=[...this.players.keys()].filter(id=>this.connected(id));if(!ids.length)return;const id=ids[this.publishIndex++%ids.length];this.send(id,'city:state',this.snapshot(id));}
}
