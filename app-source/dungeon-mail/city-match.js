import {randomUUID,randomInt} from 'node:crypto';
import {CITY,SPEED,BODY_RADIUS,GUNS,GOODS,EVENTS,PLACES,BLOCKS,clamp,dist,free,cityMove,cityDrive,wallRange,circleHit,nearPlace,BARKS} from '../../courtyard/city-rules.js';

const alive=p=>!!p&&p.hp>0&&!p.escaped;
const hasItem=(p,id)=>typeof id==='string'&&Object.hasOwn(p.inv,id)&&Number.isSafeInteger(p.inv[id])&&p.inv[id]>0;
const round=n=>Math.round(n*10)/10;
export class CityMatch{
  constructor({send=()=>{},connected=()=>true,now=()=>performance.now(),random=()=>randomInt(0,0x40000000)/0x40000000}={}){
    Object.assign(this,{send,connected,now,random});this.id=randomUUID();this.players=new Map();this.npcs=[];this.cars=[];this.loot=[];this.objects=[];this.bombs=[];this.effects=[];this.feed=[];this.banks=new Map();this.trades=new Map();this.rams=new Map();this.t=0;this.last=now();this.accumulator=0;this.sequence=0;this.publishAt=0;this.nextEvent=90;this.event=null;this.spawnAt=0;
    for(let i=0;i<10;i++)this.npc(i<2?'police':'civilian');
    for(let i=0;i<10;i++){const p=this.point();this.cars.push({id:this.uid(),...p,heading:0,speed:0,hp:180,owner:'',driver:'',kind:i%3===0?'van':'car',npcDriver:i%4===0,route:0});}
    for(let i=0;i<34;i++)this.scatter(i%9===0?'pistol':i%7===0?'medkit':i%6===0?'banana':'cash',this.point(),i%4?60:120);
  }
  uid(){return 'c'+(++this.sequence);}
  point(){for(let i=0;i<80;i++){const p={x:40+this.random()*(CITY.width-80),y:40+this.random()*(CITY.height-80)};if(free(p.x,p.y,22))return p;}return{x:60,y:60};}
  spawnPoint(){const spots=PLACES.filter(p=>p.kind==='job'||p.kind==='garage'),q=spots[Math.floor(this.random()*spots.length)];return[{x:q.x-25,y:q.y},{x:q.x,y:q.y-25},{x:q.x,y:q.y}].find(p=>free(p.x,p.y,BODY_RADIUS,this.objects))||this.point();}
  add(member){if(this.players.has(member.id))return this.players.get(member.id);if(this.players.size>=CITY.capacity)throw Error('都市已满，最多8人');
    const p={...member,...this.spawnPoint(),hp:100,armor:0,cash:0,bank:0,earned:0,wanted:0,heatAt:0,gun:'fists',ammo:0,reserve:0,inv:{},car:'',heading:0,input:{x:0,y:0,angle:0,at:-1},seq:0,actionSeq:0,shotAt:0,reloadAt:0,shield:this.t+10,respawnAt:0,slowUntil:0,progress:null,job:null,escaped:false,entered:this.t,stats:{jobs:0,robberies:0,kills:0,deaths:0}};
    this.players.set(p.id,p);this.say(`${p.name} 被投放进城`);return p;
  }
  remove(id){const p=this.players.get(id);if(!p)return;if(!p.escaped){this.drop(p,true);this.say(`${p.name} 放弃了本次行动`);}this.exitCar(p);this.players.delete(id);for(const[key,v]of this.trades)if(v.from===id||v.to===id)this.trades.delete(key);}
  say(text){this.feed.push({id:this.uid(),text,at:this.t});this.feed=this.feed.slice(-10);}
  effect(kind,p,fields={}){this.effects.push({id:this.uid(),kind,x:round(p.x),y:round(p.y),at:this.t,...fields});this.effects=this.effects.slice(-36);}
  credit(p,n){p.cash+=Math.floor(n);p.earned+=Math.floor(n);}
  price(id){return Math.ceil((GUNS[id]?.price??GOODS[id]?.price??900)*(this.event?.kind==='sale'?.7:1));}
  input(id,d){const p=this.players.get(id);if(!alive(p)||!this.connected(id)||d?.id!==this.id||!Number.isSafeInteger(d.seq)||d.seq<=p.seq||d.seq>p.seq+10000||![d.x,d.y,d.angle].every(Number.isFinite)||Math.abs(d.x)>1||Math.abs(d.y)>1||Math.abs(d.angle)>Math.PI*2)return false;
    p.seq=d.seq;const n=Math.max(1,Math.hypot(d.x,d.y));p.input={x:d.x/n,y:d.y/n,angle:d.angle,fire:d.fire===true,interact:d.interact===true,sprint:d.sprint===true,at:this.t};return true;
  }
  action(id,d){const p=this.players.get(id);if(!alive(p)||!this.connected(id)||d?.id!==this.id||!Number.isSafeInteger(d.seq)||d.seq<=p.actionSeq||d.seq>p.actionSeq+10000||d.item!==undefined&&(typeof d.item!=='string'||d.item.length>24))return false;p.actionSeq=d.seq;
    const fail=text=>{p.message=text;return false;};
    if(d.kind==='reload')return this.reload(p);
    if(d.kind==='exitCar'){this.exitCar(p);return true;}
    if(d.kind==='equip'){if(d.item===p.gun)return true;if(d.item==='fists'){if(p.gun!=='fists')p.inv[p.gun]=1;p.gun='fists';p.ammo=0;p.reloadAt=0;return true;}if(!Object.hasOwn(GUNS,d.item)||!hasItem(p,d.item))return fail('背包中没有这件武器');if(p.gun!=='fists')p.inv[p.gun]=1;p.inv[d.item]--;p.gun=d.item;p.ammo=0;p.reloadAt=0;this.reload(p);return true;}
    if(d.kind==='buy'){
      const venue=nearPlace(p);if(p.car||!venue)return fail('请步行到商店门口');
      const valid=venue.kind==='arms'&&(Object.hasOwn(GUNS,d.item)&&d.item!=='fists'||d.item==='ammo')||venue.kind==='market'&&Object.hasOwn(GOODS,d.item)||venue.kind==='garage'&&d.item==='car';
      if(!valid)return fail('这家店没有这件商品');const cost=this.price(d.item);if(p.cash<cost)return fail('随身现金不足');
      if(d.item==='car'){if(this.cars.length>=CITY.carLimit)return fail('城内车辆已满');const spot={x:venue.x+50,y:venue.y};if(!free(spot.x,spot.y,22)||this.cars.some(c=>dist(c,spot)<45))return fail('车行出口被占用');p.cash-=cost;this.cars.push({id:this.uid(),...spot,hp:180,speed:0,heading:0,owner:p.id,driver:'',kind:'car',npcDriver:false});p.message='车辆已停在车行旁';return true;}
      if(Object.hasOwn(GUNS,d.item)){if(d.item===p.gun||p.inv[d.item])return fail('已经拥有这件武器');if(p.gun!=='fists')p.inv[p.gun]=1;p.cash-=cost;p.gun=d.item;p.ammo=GUNS[d.item].mag;p.reserve+=GUNS[d.item].mag*3;p.reloadAt=0;return true;}
      if(Object.values(p.inv).reduce((a,b)=>a+b,0)>=12)return fail('背包已满，先使用或丢下物品');p.cash-=cost;p.inv[d.item]=(p.inv[d.item]||0)+1;return true;
    }
    if(d.kind==='deposit'||d.kind==='withdraw'){if(p.car||!nearPlace(p,'bank'))return fail('请步行到银行门口');const amount=d.amount==='all'?(d.kind==='deposit'?p.cash:p.bank):d.amount;if(!Number.isSafeInteger(amount)||amount<=0)return false;const from=d.kind==='deposit'?'cash':'bank',to=d.kind==='deposit'?'bank':'cash';if(p[from]<amount)return fail('余额不足');p[from]-=amount;p[to]+=amount;return true;}
    if(d.kind==='gamble'){
      if(p.car||!nearPlace(p,'casino'))return fail('请到赌场门口下注');if(![50,200,500].includes(d.amount)||!['odd','even'].includes(d.choice)||p.cash<d.amount||p.gambleAt>this.t)return fail('筹码不足或下注太快');
      p.gambleAt=this.t+.8;p.cash-=d.amount;const roll=1+Math.floor(this.random()*6),win=(roll%2===1)===(d.choice==='odd');if(win)this.credit(p,d.amount*2);p.message=`骰子 ${roll}：${win?'赢得 '+d.amount:'失去 '+d.amount}，均为局内虚拟币`;this.effect('dice',p,{text:String(roll)});return true;
    }
    if(d.kind==='work'||d.kind==='delivery'){if(p.car||!nearPlace(p,'job'))return fail('请步行到打工站');if(p.job)return fail('先完成当前配送');if(d.kind==='work'){p.progress={kind:'work',x:p.x,y:p.y,left:10,total:10};return true;}const options=PLACES.filter(q=>dist(q,p)>600&&q.kind!=='escape'),to=options[Math.floor(this.random()*options.length)];p.job={to:to.id,pay:Math.round(350+dist(p,to)*.2),expires:this.t+300};p.message=`送货到${to.name}，可开车，抵达后按E`;return true;}
    if(d.kind==='robBank'){const bank=nearPlace(p,'bank');if(p.car||!bank)return fail('请步行靠近银行');if((this.banks.get(bank.id)||0)>this.t)return fail('金库正在补钞，稍后再来');if(p.gun==='fists')return fail('带一件武器再抢银行');this.crime(p,3);p.progress={kind:'bank',target:bank.id,x:p.x,y:p.y,left:12,total:12,holdGrace:this.t+1.5};this.say(`${bank.name} 警报！`);this.policeNear(p,2);return true;}
    if(d.kind==='use')return this.use(p,d.item,fail);
    if(d.kind==='drop'){if(!hasItem(p,d.item))return false;p.inv[d.item]--;this.scatter(d.item,p,1);return true;}
    if(d.kind==='gift'){const other=this.players.get(d.target);if(!alive(other)||other===p||dist(p,other)>110||p.cash<100)return fail('走近对方并准备100现金');p.cash-=100;other.cash+=100;other.message=`${p.name} 转交了100现金`;return true;}
    if(d.kind==='offer'){const other=this.players.get(d.target);if(!alive(other)||other===p||dist(p,other)>110||!hasItem(p,d.item)||!Number.isSafeInteger(d.price)||d.price<0||d.price>10000)return fail('交易条件无效');for(const v of this.trades.values())if(v.from===id)return fail('已有一笔待处理交易');const offer={id:this.uid(),from:id,to:other.id,item:d.item,price:d.price,until:this.t+20};this.trades.set(offer.id,offer);return true;}
    if(d.kind==='accept'){const trade=this.trades.get(d.offer),seller=this.players.get(trade?.from);if(!trade||trade.to!==id||trade.until<this.t||!alive(seller)||dist(p,seller)>110||!hasItem(seller,trade.item)||p.cash<trade.price||Object.values(p.inv).reduce((a,b)=>a+b,0)>=12)return fail('交易已失效');p.cash-=trade.price;seller.cash+=trade.price;seller.inv[trade.item]--;p.inv[trade.item]=(p.inv[trade.item]||0)+1;this.trades.delete(trade.id);return true;}
    return false;
  }
  crime(p,n){p.wanted=clamp(p.wanted+n,0,5);p.heatAt=this.t;p.shield=0;}
  reload(p){const gun=GUNS[p.gun];if(!gun.mag||p.ammo>=gun.mag||p.reloadAt||p.reserve<=0)return false;p.reloadAt=this.t+gun.reload;return true;}
  exitCar(p){const car=this.cars.find(c=>c.id===p.car);if(car){car.driver='';car.speed=0;const options=[{x:car.x,y:car.y+30},{x:car.x,y:car.y-30},{x:car.x+30,y:car.y}];Object.assign(p,options.find(q=>free(q.x,q.y,BODY_RADIUS,this.objects))||car);}p.car='';}
  use(p,item,fail){if(!Object.hasOwn(GOODS,item)||!p.inv[item])return fail('背包里没有这个道具');let used=true;
    if(item==='medkit')p.hp=Math.min(100,p.hp+45);
    else if(item==='vest')p.armor=60;
    else if(item==='ammo')p.reserve=Math.min(240,p.reserve+32);
    else if(item==='bribe'){if(this.npcs.some(n=>n.kind==='police'&&n.hp>0&&dist(n,p)<110))return fail('警察就在旁边，先拉开距离');p.wanted=Math.max(0,p.wanted-2);}
    else if(item==='repair'){const car=this.cars.find(c=>dist(c,p)<70&&c.hp>0);if(!car)return fail('靠近一辆尚未报废的车');car.hp=Math.min(180,car.hp+100);}
    else if(item==='blink'){if(p.car)return fail('先下车再使用');const range=wallRange(p,p.input.angle,260,this.objects),point=cityMove(p,Math.cos(p.input.angle)*Math.max(0,range-22),Math.sin(p.input.angle)*Math.max(0,range-22),this.objects);this.effect('blink',p);Object.assign(p,point);p.progress=null;}
    else if(this.objects.length<40){const offset=item==='perfume'?100:32,point=cityMove(p,Math.cos(p.input.angle)*offset,Math.sin(p.input.angle)*offset,this.objects);if(!free(point.x,point.y,15,this.objects)||PLACES.some(q=>dist(q,point)<55))return fail('这里会堵住服务入口，换个地方');this.objects.push({id:this.uid(),kind:item,...point,hp:item==='barricade'?80:1,owner:p.id,until:this.t+(item==='barricade'?40:15)});}
    else used=false;if(used)p.inv[item]--;return used;
  }
  scatter(kind,p,cash=0,extra={}){if(this.loot.length>=CITY.lootLimit)this.loot.shift();const point=free(p.x,p.y)?p:this.point();this.loot.push({id:this.uid(),kind,x:point.x,y:point.y,cash,until:this.t+180,...extra});}
  drop(p,all=false){const cash=all?p.cash:Math.floor(p.cash*.7);if(cash)this.scatter('cash',p,cash);p.cash-=cash;for(const[k,n]of Object.entries(p.inv))for(let i=0;i<n;i++)this.scatter(k,{x:p.x+(this.random()-.5)*40,y:p.y+(this.random()-.5)*40},1);p.inv={};if(p.gun!=='fists')this.scatter(p.gun,p,1,{ammo:p.ammo,reserve:p.reserve});p.gun='fists';p.ammo=p.reserve=0;}
  hurt(target,damage,attacker=null){if(!alive(target)||target.shield>this.t)return false;const absorbed=Math.min(target.armor,Math.ceil(damage*.6));target.armor-=absorbed;target.hp=Math.max(0,target.hp-damage+absorbed);target.progress=null;target.lastHurt=this.t;this.effect('hit',target);
    if(!target.hp){this.drop(target);this.exitCar(target);target.respawnAt=this.t+4;target.stats.deaths++;target.input={x:0,y:0,at:-1};target.job=null;this.say(`${target.name} 倒下，随身物品掉落`);if(attacker?.stats)attacker.stats.kills++;}return true;
  }
  npc(kind,at=null){if(this.npcs.length>=CITY.npcLimit)return;const p=at||this.point();this.npcs.push({id:this.uid(),kind,...p,hp:kind==='police'?90:kind==='civilian'?45:60,heading:0,path:[],repath:0,hitAt:0,robbable:0,bark:Math.floor(this.random()*BARKS.length),roam:this.point()});}
  policeNear(p,count){for(let i=0;i<count;i++){const point=cityMove(p,Math.cos(i*3)*180,Math.sin(i*3)*180);this.npc('police',point);}}
  attack(p){const gun=GUNS[p.gun];if(p.car||p.reloadAt||p.shotAt>this.t)return;if(gun.mag&&p.ammo<=0){this.reload(p);return;}p.shotAt=this.t+gun.interval;p.shield=0;p.progress=null;if(gun.mag)p.ammo--;const angle=p.input.angle;let range=wallRange(p,angle,gun.range,this.objects),target=null,type='';
    const consider=(q,kind,r)=>{if(q===p||q.hp<=0||q.escaped||kind==='player'&&q.shield>this.t)return;const hit=gun.mag?circleHit(p,angle,q,r):dist(p,q);if(!gun.mag&&(Math.abs(Math.atan2(Math.sin(Math.atan2(q.y-p.y,q.x-p.x)-angle),Math.cos(Math.atan2(q.y-p.y,q.x-p.x)-angle)))>1||wallRange(p,Math.atan2(q.y-p.y,q.x-p.x),hit,this.objects)<hit))return;if(hit<=range){range=hit;target=q;type=kind;}};
    for(const q of this.players.values())consider(q,'player',15);for(const q of this.npcs)consider(q,'npc',14);for(const q of this.cars)consider(q,'car',22);for(const q of this.objects)if(q.kind==='barricade')consider(q,'object',20);
    this.effect(gun.mag?'shot':'swing',p,{angle,range,hit:!!target});if(!target)return;
    if(type==='player'){if(this.hurt(target,gun.damage,p))this.crime(p,2);}
    if(type==='npc'){target.hp-=gun.damage;if(target.kind==='civilian'||target.kind==='police')this.crime(p,target.kind==='police'?2:1);if(target.hp<=0){if(target.kind==='zombie'||target.kind==='goose')this.credit(p,80);else this.scatter('cash',target,60);this.effect('fall',target);}}
    if(type==='car')this.carDamage(target,gun.damage,p);if(type==='object')target.hp-=gun.damage;
  }
  carDamage(car,amount,attacker=null){if(car.hp<=0)return;car.hp=Math.max(0,car.hp-amount);if(attacker)this.crime(attacker,1);if(!car.hp){const driver=this.players.get(car.driver);if(driver){this.exitCar(driver);this.hurt(driver,25,attacker);}car.driver='';car.npcDriver=false;car.speed=0;this.effect('explosion',car);}}
  interact(p,dt){if(p.car){p.progress=null;return;}
    if(p.progress){const task=p.progress;if(dist(p,task)>38){p.progress=null;return;}if(task.kind==='work'||p.input.interact)task.left-=dt;else if(task.holdGrace>this.t)return;else{p.progress=null;return;}
      if(task.kind==='bank'&&(this.banks.get(task.target)||0)>this.t){p.progress=null;return;}
      if(task.left<=0){p.progress=null;if(task.kind==='work'){this.credit(p,260);p.stats.jobs++;p.message='打工完成 +260';}
        if(task.kind==='bank'){this.banks.set(task.target,this.t+150);this.credit(p,1600);p.stats.robberies++;this.crime(p,2);this.say(`${p.name} 带走了金库现金`);}
        if(task.kind==='car'){const car=this.cars.find(c=>c.id===task.target);if(car&&car.hp>0&&!car.driver&&dist(p,car)<65){car.owner=p.id;car.driver=p.id;car.npcDriver=false;p.car=car.id;this.crime(p,2);}}
        if(task.kind==='mug'){const npc=this.npcs.find(n=>n.id===task.target);if(npc?.hp>0&&dist(p,npc)<90&&npc.robbable<=this.t){npc.robbable=this.t+70;this.credit(p,170);this.crime(p,2);p.message='抢到170现金，警察注意到了你';}}
        if(task.kind==='escape'&&p.cash>=CITY.goal){p.escaped=true;p.result={cash:p.cash,bank:p.bank,seconds:Math.round(this.t-p.entered),stats:{...p.stats}};this.exitCar(p);this.say(`${p.name} 成功撤离都市`);}}
      return;
    }
    if(!p.input.interact)return;
    const loot=this.loot.filter(q=>dist(q,p)<40).sort((a,b)=>dist(a,p)-dist(b,p))[0];
    if(loot){if(loot.kind==='cash')this.credit(p,loot.cash);else if(Object.hasOwn(GUNS,loot.kind)){if(loot.kind===p.gun){p.reserve=Math.min(240,p.reserve+(loot.reserve||16));}else{if(p.gun!=='fists')p.inv[p.gun]=1;if(hasItem(p,loot.kind))p.inv[loot.kind]--;p.gun=loot.kind;p.ammo=loot.ammo??GUNS[loot.kind].mag;p.reserve=Math.min(240,p.reserve+(loot.reserve??GUNS[loot.kind].mag*2));p.reloadAt=0;}}else if(Object.values(p.inv).reduce((a,b)=>a+b,0)<12)p.inv[loot.kind]=(p.inv[loot.kind]||0)+1;else return;this.loot=this.loot.filter(q=>q!==loot);p.input.interact=false;return;}
    const venue=nearPlace(p,null,75);if(p.job&&p.job.to===venue?.id){this.credit(p,p.job.pay);p.stats.jobs++;p.message=`送达 +${p.job.pay}`;p.job=null;p.input.interact=false;return;}
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
  npcTick(dt){
    const people=[...this.players.values()].filter(alive);
    for(const n of this.npcs){if(n.hp<=0)continue;let target=null;
      if(n.kind==='police'){
        const wanted=people.filter(p=>p.wanted>0&&p.shield<=this.t).sort((a,b)=>dist(a,n)-dist(b,n))[0];
        const hostile=this.npcs.filter(q=>q!==n&&q.hp>0&&(q.kind==='zombie'||q.kind==='goose')).map(q=>({q,d:dist(q,n)})).sort((a,b)=>a.d-b.d)[0];
        target=wanted&&(!hostile||dist(wanted,n)<=hostile.d+120)?wanted:hostile?.q||wanted;
      }
      if(n.kind==='zombie'||n.kind==='goose')target=[...people.filter(p=>p.shield<=this.t),...this.npcs.filter(q=>q!==n&&q.hp>0&&(q.kind==='civilian'||q.kind==='police'))].sort((a,b)=>dist(a,n)-dist(b,n))[0];
      const lure=this.objects.find(o=>o.hp>0&&o.until>this.t&&(o.kind==='decoy'||o.kind==='perfume'&&(n.kind==='zombie'||n.kind==='goose'))&&dist(o,n)<500);if(lure)target=lure;
      if(!target||dist(target,n)>950){target=n.roam;if(!target||dist(n,target)<40)n.roam=this.point();target=n.roam;}
      const distance=dist(n,target),angle=Math.atan2(target.y-n.y,target.x-n.x);n.heading=angle;
      if(n.kind==='police'&&target.id&&(this.players.has(target.id)||target.kind==='zombie'||target.kind==='goose')&&distance<300&&wallRange(n,angle,distance,this.objects)>=distance){if(n.hitAt<=this.t){if(this.players.has(target.id))this.hurt(target,9);else{target.hp-=12;if(target.hp<=0)this.effect('fall',target);}this.effect('shot',n,{angle,range:distance,hit:true});n.hitAt=this.t+1.2;}if(distance<120)continue;}
      if((n.kind==='zombie'||n.kind==='goose')&&target.id&&distance<32){if(n.hitAt<=this.t){if(this.players.has(target.id))this.hurt(target,n.kind==='goose'?9:13);else target.hp-=12;n.hitAt=this.t+.9;}continue;}
      if((n.robbable>this.t||n.holdUntil>this.t)&&n.kind==='civilian')continue;
      let waypoint=target;if(wallRange(n,angle,distance,this.objects)<distance){if(n.repath<=this.t){n.path=this.path(n,target);n.repath=this.t+1.3+this.random()*.4;}while(n.path.length&&dist(n,n.path[0])<22)n.path.shift();waypoint=n.path[0]||n.roam;}if(!waypoint)continue;
      const speed=n.kind==='civilian'?50:n.kind==='goose'?190:n.kind==='zombie'?100:145,dx=waypoint.x-n.x,dy=waypoint.y-n.y,len=Math.max(1,Math.hypot(dx,dy));Object.assign(n,cityMove(n,dx/len*speed*dt,dy/len*speed*dt,this.objects));
    }
    this.npcs=this.npcs.filter(n=>n.hp>0);
  }
  movePlayer(p,dt){
    const input=this.connected(p.id)&&this.t-p.input.at<.3?p.input:{x:0,y:0,fire:false,interact:false,angle:p.input.angle};p.inputActive=input;
    const old={x:p.x,y:p.y};let speed=(input.sprint?SPEED.sprint:SPEED.walk)*(p.slowUntil>this.t?.28:1);
    if(p.car){const car=this.cars.find(c=>c.id===p.car&&c.driver===p.id&&c.hp>0);if(!car){p.car='';return;}const next=cityDrive(car,input,dt,this.objects);Object.assign(car,next);if(next.impact)this.carDamage(car,next.impact);p.x=car.x;p.y=car.y;p.heading=car.heading;
      if(car.speed>180){for(const q of [...this.players.values(),...this.npcs]){if(q===p||q.hp<=0||q.escaped||q.car===car.id)continue;const dx=p.x-old.x,dy=p.y-old.y,len=dx*dx+dy*dy,a=len?clamp(((q.x-old.x)*dx+(q.y-old.y)*dy)/len,0,1):0;if(Math.hypot(q.x-old.x-dx*a,q.y-old.y-dy*a)>25)continue;const key=car.id+q.id;if((this.rams.get(key)||0)>this.t)continue;this.rams.set(key,this.t+1);const damage=Math.min(45,Math.round(car.speed/14));if(this.players.has(q.id)){if(this.hurt(q,damage,p))this.crime(p,2);}else{q.hp-=damage;if(q.kind==='civilian'||q.kind==='police')this.crime(p,2);}car.speed*=.65;}}
    }else{Object.assign(p,cityMove(p,input.x*speed*dt,input.y*speed*dt,this.objects));p.heading=input.angle;if(input.fire)this.attack(p);}
    // A held action is only accepted while fresh input continues to arrive.
    const saved=p.input.interact;p.input.interact=input.interact;this.interact(p,dt);p.input.interact=p.input.interact&&saved;
    for(const o of this.objects)if(o.kind==='banana'&&o.owner!==p.id&&dist(p,o)<28&&o.until>this.t){p.slowUntil=this.t+2;o.until=0;this.effect('slip',p);}
  }
  startEvent(kind){if(!Object.hasOwn(EVENTS,kind))return;const point=this.point();this.event={kind,ends:this.t+EVENTS[kind].seconds,x:point.x,y:point.y};this.nextEvent=this.event.ends+65;this.say(EVENTS[kind].name+'！');
    if(kind==='zombies')for(let i=0;i<12;i++)this.npc('zombie');if(kind==='geese')for(let i=0;i<8;i++)this.npc('goose');if(kind==='cash')for(let i=0;i<12;i++){const q=cityMove(point,(this.random()-.5)*220,(this.random()-.5)*220);this.scatter('cash',q,140+Math.floor(this.random()*100));}
  }
  step(dt){this.t+=dt;
    for(const p of this.players.values()){
      if(p.respawnAt&&this.t>=p.respawnAt){Object.assign(p,{...this.spawnPoint(),hp:100,armor:0,respawnAt:0,shield:this.t+10,wanted:0,progress:null,gun:'fists',input:{x:0,y:0,angle:0,at:-1}});}
      if(!alive(p))continue;if(p.reloadAt&&this.t>=p.reloadAt){const n=Math.min(GUNS[p.gun].mag-p.ammo,p.reserve);p.ammo+=n;p.reserve-=n;p.reloadAt=0;}
      if(p.wanted&&this.t-p.heatAt>25&&!this.npcs.some(n=>n.kind==='police'&&dist(n,p)<250)){p.wanted--;p.heatAt=this.t;}
      if(p.job?.expires<this.t){p.job=null;p.message='配送超时，回打工站重新接单';}this.movePlayer(p,dt);
    }
    if(Math.floor(this.t*10)!==Math.floor((this.t-dt)*10))this.npcTick(.1);
    for(const car of this.cars)if(car.npcDriver&&!car.driver&&car.hp>0){const points=[{x:520,y:60},{x:CITY.width-520,y:60},{x:CITY.width-520,y:CITY.height-120},{x:520,y:CITY.height-120}],to=points[car.route%4];if(dist(to,car)<35){car.route++;continue;}car.heading=Math.atan2(to.y-car.y,to.x-car.x);const next=cityMove(car,Math.cos(car.heading)*85*dt,Math.sin(car.heading)*85*dt,this.objects);Object.assign(car,next);car.speed=85;}
    if(this.event&&this.t>this.event.ends){this.say('城市暂时恢复营业');this.event=null;}
    if(!this.event&&this.t>=this.nextEvent){const options=Object.keys(EVENTS);this.startEvent(options[Math.floor(this.random()*options.length)]);}
    if(this.event?.kind==='bombs'&&(!this.bombAt||this.t>=this.bombAt)){const people=[...this.players.values()].filter(alive);if(people.length){const p=people[Math.floor(this.random()*people.length)];for(let i=0;i<3;i++){const spot=cityMove(p,(this.random()-.5)*600,(this.random()-.5)*600);this.bombs.push({id:this.uid(),...spot,at:this.t+1.8});}}this.bombAt=this.t+1.5;}
    for(const bomb of this.bombs)if(!bomb.done&&this.t>=bomb.at){bomb.done=true;this.effect('explosion',bomb);for(const p of this.players.values())if(dist(p,bomb)<80)this.hurt(p,45);for(const n of this.npcs)if(dist(n,bomb)<80)n.hp-=60;for(const car of this.cars)if(dist(car,bomb)<90)this.carDamage(car,70);}
    this.bombs=this.bombs.filter(b=>this.t-b.at<.5);this.objects=this.objects.filter(o=>o.until>this.t&&o.hp>0);this.loot=this.loot.filter(l=>l.until>this.t);this.effects=this.effects.filter(e=>this.t-e.at<.65);this.feed=this.feed.filter(e=>this.t-e.at<14);
    for(const[key,value]of this.trades)if(value.until<this.t||!alive(this.players.get(value.from))||!alive(this.players.get(value.to)))this.trades.delete(key);
    for(const[key,until]of this.rams)if(until<this.t)this.rams.delete(key);
    if(this.t>=this.spawnAt){if(this.loot.length<42)this.scatter(this.random()<.18?'medkit':'cash',this.point(),80);if(this.npcs.filter(n=>n.kind==='civilian'||n.kind==='police').length<12)this.npc(this.npcs.filter(n=>n.kind==='police').length<4?'police':'civilian');this.cars=this.cars.filter(c=>c.hp>0||c.driver);if(this.cars.length<10){const spot=this.point();this.cars.push({id:this.uid(),...spot,hp:180,speed:0,heading:0,owner:'',driver:'',kind:'car',npcDriver:false});}this.spawnAt=this.t+6;}
  }
  tick(dt){const stamp=this.now();if(dt===undefined){dt=clamp((stamp-this.last)/1000,0,.2);this.last=stamp;}else dt=clamp(dt,0,.2);this.accumulator=Math.min(.25,this.accumulator+dt);while(this.accumulator>=CITY.step){this.step(CITY.step);this.accumulator-=CITY.step;}if(this.t>=this.publishAt){this.publish();this.publishAt=Math.max(this.publishAt+.125,this.t);}}
  snapshot(id){const p=this.players.get(id);if(!p)return null;const nearby=q=>dist(p,q)<CITY.view,venue=nearPlace(p,null,110),own={x:round(p.x),y:round(p.y),heading:round(p.heading),hp:p.hp,armor:p.armor,cash:p.cash,bank:p.bank,wanted:p.wanted,gun:p.gun,ammo:p.ammo,reserve:p.reserve,inv:{...p.inv},car:p.car,seq:p.seq,actionSeq:p.actionSeq,shield:Math.max(0,p.shield-this.t),slow:Math.max(0,p.slowUntil-this.t),respawn:Math.max(0,p.respawnAt-this.t),reload:Math.max(0,p.reloadAt-this.t),escaped:p.escaped,result:p.result,message:p.message||'',job:p.job,near:venue?.id||'',progress:p.progress?{kind:p.progress.kind,left:round(p.progress.left),total:p.progress.total}:null};
    return{id:this.id,time:round(this.t),goal:CITY.goal,self:own,event:this.event?{...this.event}:null,next:Math.ceil(this.nextEvent-this.t),players:[...this.players.values()].filter(nearby).map(q=>({id:q.id,name:q.name,color:q.color,userId:q.userId,x:round(q.x),y:round(q.y),heading:round(q.heading),hp:q.hp,armor:q.armor,wanted:q.wanted,car:q.car,shield:q.shield>this.t,escaped:q.escaped,connected:this.connected(q.id)})),
      map:Math.floor(this.t)%2===0?[...this.players.values()].map(q=>[q.id,Math.round(q.x/128)*128,Math.round(q.y/128)*128]):undefined,
      npcs:this.npcs.filter(nearby).map(n=>[n.id,n.kind,round(n.x),round(n.y),Math.max(0,n.hp),round(n.heading),n.bark]),
      cars:this.cars.filter(nearby).map(c=>[c.id,round(c.x),round(c.y),round(c.heading),c.hp,c.owner,c.driver,c.kind,round(c.speed)]),
      loot:this.loot.filter(nearby).map(l=>[l.id,l.kind,round(l.x),round(l.y),l.kind==='cash'?l.cash:1]),objects:this.objects.filter(nearby).map(o=>[o.id,o.kind,round(o.x),round(o.y),o.hp]),bombs:this.bombs.filter(nearby).map(b=>[b.id,round(b.x),round(b.y),round(b.at)]),effects:this.effects.filter(nearby),feed:this.feed.slice(-5),offers:[...this.trades.values()].filter(v=>v.to===id).map(v=>({...v,name:this.players.get(v.from)?.name})),sent:[...this.trades.values()].filter(v=>v.from===id).map(v=>({...v,name:this.players.get(v.to)?.name})),count:this.players.size};
  }
  publish(){for(const id of this.players.keys())if(this.connected(id))this.send(id,'city:state',this.snapshot(id));}
}
