import {setupExtra,inputExtra,tickExtra,privateExtra,snapshotExtra} from './party-extra.js';
import {EXTRA_GAMES} from '../../courtyard/party-rules.js';
import {randomUUID} from 'node:crypto';
import {PARTY_GAMES,PARTY_BASES,PARTY_MODES,validPartyMode,mineRisk,roundPoints,partySchedule} from '../../courtyard/party-rules.js';
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v)),distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
export class PartyMatch{
  constructor(members,{send=()=>{},connected=()=>true,host=()=>members[0]?.id,random=Math.random,schedule=null,mode='random'}={}){
    if(members.length<2||members.length>4||new Set(members.map(p=>p.id)).size!==members.length)throw Error('需要 2～4 位玩家');
    if(!validPartyMode(mode))throw Error('无效的小游戏');
    this.id=randomUUID();this.send=send;this.connected=connected;this.host=host;this.random=random;this.mode=mode;this.schedule=schedule||(mode==='random'?partySchedule(random):[mode]);this.roundCount=this.schedule.length;this.votes=new Map();this.events=[];this.eventSeq=0;this.round=0;this.phase='intro';this.left=5;this.time=0;this.last=performance.now();this.broadcastAt=0;this.pause=0;this.reason='';this.history=[];
    this.players=members.map((p,i)=>({...p,index:i,total:0,points:0,value:0,x:0,y:0,vx:0,vy:0,seq:0,cool:0,shield:0,out:0,input:{x:0,y:0,at:-10},carry:null,boards:2}));this.setup();
  }
  get game(){return this.schedule[this.round];}
  setup(){
    this.extra=null;this.items=[];this.leaks=[];this.bumpers=[];this.water=8;this.spawnAt=0;this.bonusAt=0;this.bigAt=0;this.turn=0;this.minePot=0;this.mineEvent='大家上车！';this.reason='';this.radius=235;this.events=[];
    for(const p of this.players){const a=p.index*Math.PI*2/this.players.length;p.x=this.game==='delivery'?PARTY_BASES[p.index].x:480+Math.cos(a)*130;p.y=this.game==='delivery'?PARTY_BASES[p.index].y:300+Math.sin(a)*130;Object.assign(p,{vx:0,vy:0,value:0,points:0,cool:0,out:0,shield:1.5,carry:null,boards:2,cashed:false,choice:'',bank:0,hit:null,stats:{falls:0,delivered:0,bonus:0,repairs:0,pumps:0,bigRepairs:0},input:{x:0,y:0,at:-10}});}
    if(this.game==='delivery')for(let i=0;i<7;i++)this.package();
    if(this.game==='rescue')this.leak();
    if(EXTRA_GAMES.includes(this.game))setupExtra(this);
  }
  package(x=360+this.random()*240,y=215+this.random()*170,value=1+Math.floor(this.random()*3),extra={}){const item={id:randomUUID(),x,y,value,...extra};this.items.push(item);return item;}
  leak(large=false){if(this.leaks.length>=8)return;const cells=Array.from({length:12},(_,i)=>({x:170+i%4*205,y:135+Math.floor(i/4)*120})).filter(cell=>this.leaks.every(l=>distance(cell,l)>65));if(!cells.length)return;const cell=cells[Math.floor(this.random()*cells.length)];this.leaks.push({id:randomUUID(),...cell,progress:0,large});if(large)this.event('large',{...cell,text:'双人漏点！一起修'});}
  event(kind,fields={}){this.events.push({id:++this.eventSeq,at:this.time,kind,...fields});this.events=this.events.filter(e=>this.time-e.at<3).slice(-24);}
  vote(id,data){if(this.phase!=='final'||data?.id!==this.id||!this.players.some(p=>p.id===id)||!this.connected(id)||!validPartyMode(data.mode))return false;this.votes.set(id,data.mode);this.publish();return true;}
  nextMode(){const counts=Object.fromEntries(PARTY_MODES.map(m=>[m,0]));for(const [id,mode] of this.votes)if(this.connected(id))counts[mode]++;const max=Math.max(...Object.values(counts));if(!max)return this.mode;const ties=PARTY_MODES.filter(m=>counts[m]===max),hostVote=this.votes.get(this.host());return ties.includes(hostVote)?hostVote:ties[0];}
  input(id,data){
    const p=this.players.find(p=>p.id===id);if(!p||!this.connected(id)||this.phase!=='playing'||this.pause||data?.id!==this.id||data.round!==this.round||!Number.isSafeInteger(data.seq)||data.seq<=p.seq||data.seq>p.seq+10000||!Number.isFinite(data.x)||!Number.isFinite(data.y)||Math.abs(data.x)>1||Math.abs(data.y)>1)return false;
    p.seq=data.seq;
    if(EXTRA_GAMES.includes(this.game)&&inputExtra(this,p,data))return true;
    if(this.game==='mine'){if(!p.cashed&&!p.choice&&['dig','cash'].includes(data.choice))p.choice=data.choice;return true;}
    const norm=Math.max(1,Math.hypot(data.x,data.y));p.input={x:data.x/norm,y:data.y/norm,action:data.action===true,at:this.time};return true;
  }
  tick(dt){
    const now=performance.now();dt=dt===undefined?clamp((now-this.last)/1000,0,.1):clamp(dt,0,.1);this.last=now;if(this.phase==='final')return;
    const online=this.players.filter(p=>this.connected(p.id)).length;
    if(online<2){this.pause+=dt;if(this.pause>=15){this.phase='final';this.left=0;this.pause=0;this.reason='在线不足两人，本场提前结束。';this.publish();}else if(now-this.broadcastAt>=150)this.publish();return;}
    if(this.pause){this.pause=0;for(const p of this.players)p.input={x:0,y:0,at:-10};}
    const previousPhase=this.phase;this.time+=dt;this.left-=dt;
    if(this.phase==='intro'&&this.left<=0){this.phase='playing';this.left=PARTY_GAMES[this.game].seconds;this.roundStarted=this.time;this.spawnAt=this.time+4;this.bonusAt=this.time+12;this.bigAt=this.time+14;this.event('start');}
    else if(this.phase==='playing'){
      if(EXTRA_GAMES.includes(this.game))tickExtra(this,dt);else if(this.game==='mine')this.mining();else{this.movement(dt);if(this.game==='bump')this.bumping();if(this.game==='delivery')this.deliveries();if(this.game==='rescue')this.repair(dt);}
      if(this.left<=0&&this.phase==='playing')this.finishRound();
    }else if(this.phase==='results'&&this.left<=0){if(this.round===this.roundCount-1){this.phase='final';this.left=0;}else{this.round++;this.phase='intro';this.left=5;this.setup();}}
    if(previousPhase!==this.phase||now-this.broadcastAt>=100)this.publish();
  }
  movement(dt){
    for(const p of this.players){p.cool=Math.max(0,p.cool-dt);p.shield=Math.max(0,p.shield-dt);if(p.out>0){p.out-=dt;if(p.out<=0){const a=p.index*Math.PI*2/this.players.length;p.x=480+Math.cos(a)*120;p.y=300+Math.sin(a)*120;p.vx=p.vy=0;p.shield=1.5;p.hit=null;}continue;}
      const input=this.connected(p.id)&&this.time-p.input.at<.3?p.input:{x:0,y:0,action:false};p.pressed=!!input.action&&!p.acting;p.acting=!!input.action;
      if(this.game==='bump'){
        p.vx=(p.vx+input.x*750*dt)*Math.exp(-2.5*dt);p.vy=(p.vy+input.y*750*dt)*Math.exp(-2.5*dt);
        if(input.action&&p.cool<=0){const n=Math.hypot(input.x,input.y)||Math.hypot(p.vx,p.vy)||1,dx=input.x||(!input.y?p.vx:0),dy=input.y||(!input.x?p.vy:0);p.vx+=dx/n*330;p.vy+=dy/n*330;p.cool=1.15;this.event('dash',{actor:p.id,x:p.x,y:p.y});}
        const n=Math.hypot(p.vx,p.vy);if(n>520){p.vx*=520/n;p.vy*=520/n;}p.x+=p.vx*dt;p.y+=p.vy*dt;
      }else{const speed=p.carry?170:220;p.vx=input.x*speed;p.vy=input.y*speed;p.x=clamp(p.x+p.vx*dt,35,925);p.y=clamp(p.y+p.vy*dt,45,555);}
    }
  }
  bumping(){
    for(let i=0;i<this.players.length;i++)for(let j=i+1;j<this.players.length;j++){
      const a=this.players[i],b=this.players[j];if(a.out>0||b.out>0||a.shield||b.shield)continue;let d=distance(a,b);if(d>=32)continue;const nx=d?(a.x-b.x)/d:1,ny=d?(a.y-b.y)/d:0;d=Math.max(d,1);const push=(32-d)/2;a.x+=nx*push;a.y+=ny*push;b.x-=nx*push;b.y-=ny*push;
      const closing=(b.vx-a.vx)*nx+(b.vy-a.vy)*ny;if(closing>0){const force=Math.min(460,closing*.9+50);a.vx+=nx*force;a.vy+=ny*force;b.vx-=nx*force;b.vy-=ny*force;a.hit={id:b.id,at:this.time};b.hit={id:a.id,at:this.time};this.event('hit',{actor:a.id,target:b.id,x:(a.x+b.x)/2,y:(a.y+b.y)/2});}
    }
    this.radius=235-Math.min(25,(this.time-this.roundStarted)*.4);
    this.bumpers=this.time-this.roundStarted<8?[]:[0,Math.PI].map(a=>({x:480+Math.cos(this.time*.32+a)*112,y:300+Math.sin(this.time*.32+a)*88,r:24}));
    for(const p of this.players){if(p.out>0)continue;for(const b of this.bumpers){const d=distance(p,b);if(d<40&&!p.shield){const nx=d?(p.x-b.x)/d:1,ny=d?(p.y-b.y)/d:0;p.x=b.x+nx*40;p.y=b.y+ny*40;p.vx+=nx*100;p.vy+=ny*100;if(!p.bumperAt||this.time-p.bumperAt>.5){this.event('hit',{actor:p.id,x:p.x,y:p.y});p.bumperAt=this.time;}}}
      if(Math.hypot(p.x-480,p.y-300)>this.radius+14){if(p.hit&&this.time-p.hit.at<3){const hitter=this.players.find(q=>q.id===p.hit.id);if(hitter)hitter.value++;}p.out=2;p.stats.falls++;p.vx=p.vy=0;this.event('fall',{actor:p.id,x:p.x,y:p.y,text:'两秒后回来'});}}
  }
  deliveries(){
    this.items=this.items.filter(i=>!i.expires||i.expires>this.time);
    for(const p of this.players){if(p.carry?.expires<=this.time){this.event('expired',{actor:p.id,x:p.x,y:p.y,text:'急件超时'});p.carry=null;}if(p.carry&&distance(p,PARTY_BASES[p.index])<62){p.value+=p.carry.value;p.stats.delivered++;if(p.carry.bonus)p.stats.bonus++;this.event('delivery',{actor:p.id,x:p.x,y:p.y,amount:p.carry.value,text:'送达 +'+p.carry.value});p.carry=null;}
      if(!p.pressed||p.cool>0)continue;p.cool=.25;
      if(p.carry){this.package(p.x,p.y,p.carry.value,{bonus:p.carry.bonus,expires:p.carry.expires});p.carry=null;continue;}
      const item=this.items.filter(i=>distance(p,i)<48).sort((a,b)=>distance(p,a)-distance(p,b))[0];
      if(item){p.carry=item;this.items=this.items.filter(i=>i!==item);this.event('pickup',{actor:p.id,x:p.x,y:p.y});continue;}
      const other=this.players.find(q=>q!==p&&q.carry&&distance(p,q)<45);if(other){this.package(other.x,other.y,other.carry.value,{bonus:other.carry.bonus,expires:other.carry.expires});other.carry=null;this.event('hit',{actor:p.id,target:other.id,x:other.x,y:other.y,text:'包裹掉了'});}
    }
    if(this.time>=this.spawnAt&&this.items.length<8){this.package();this.spawnAt=this.time+2.5;}
    if(this.time>=this.bonusAt&&!this.items.some(i=>i.bonus)&&!this.players.some(p=>p.carry?.bonus)){if(this.items.length>=8)this.items.shift();const item=this.package(this.random()<.5?280:680,220+this.random()*160,6,{bonus:true,expires:this.time+14});this.event('bonus',{x:item.x,y:item.y,text:'金色急件 · 6 分'});this.bonusAt=this.time+22;}
  }
  repair(dt){
    for(const p of this.players){if(distance(p,{x:300,y:520})<65)p.boards=2;
      if(!p.acting)continue;
      if(distance(p,{x:650,y:520})<65&&p.cool<=0){this.water=Math.max(0,this.water-9);p.cool=1.4;p.value++;p.stats.pumps++;this.event('pump',{actor:p.id,x:650,y:520,text:'水位 −9%'});}
    }
    for(const leak of [...this.leaks]){const helpers=this.players.filter(p=>this.connected(p.id)&&p.acting&&p.boards>0&&distance(p,leak)<58),needed=leak.large?2:1;if(helpers.length<needed)continue;leak.progress+=dt;if(leak.progress>=(leak.large?2.6:1.4)){this.leaks=this.leaks.filter(l=>l!==leak);for(const p of helpers.slice(0,needed)){p.boards--;p.value+=3;p.stats.repairs++;if(leak.large)p.stats.bigRepairs++;}this.event('repair',{actor:helpers[0].id,partners:helpers.slice(0,needed).map(p=>p.id),x:leak.x,y:leak.y,text:leak.large?'一起修好了！':'修好了！'});}}
    if(this.time>=this.spawnAt){this.leak();this.spawnAt=this.time+5;}
    if(this.time>=this.bigAt&&!this.leaks.some(l=>l.large)){this.leak(true);this.bigAt=this.time+24;}
    this.water=clamp(this.water+this.leaks.reduce((n,l)=>n+(l.large?1.8:.9),0)*dt,0,100);if(this.water>=100){this.left=0;this.reason='水漫过屋顶，下一次再一起救回来。';}
  }
  mining(){
    if(this.players.every(p=>p.cashed)){this.finishRound();return;}
    const elapsed=this.time-this.roundStarted;if(elapsed<(this.turn+1)*5)return;
    const active=this.players.filter(p=>!p.cashed);for(const p of active)if(p.choice==='cash'){p.bank+=this.minePot;p.value=p.bank;p.cashed=true;this.event('cash',{actor:p.id,text:'安全带回 '+p.bank+' 金币'});}
    const remaining=active.filter(p=>!p.cashed);this.turn++;
    if(!remaining.length){this.mineEvent='全部安全回家';this.finishRound();return;}
    if(mineRisk(this.turn)>0&&this.random()<mineRisk(this.turn)){this.mineEvent='塌方！未存金币掉了';this.event('collapse',{text:this.mineEvent});for(const p of remaining){p.cashed=true;p.value=p.bank;}this.finishRound();return;}
    const amount=3+Math.floor(this.random()*6);this.minePot+=amount;this.mineEvent='发现 '+amount+' 枚金币';this.event('treasure',{amount,text:this.mineEvent});
    for(const p of remaining)p.choice='';if(this.turn>=7){for(const p of remaining){p.bank+=this.minePot;p.value=p.bank;p.cashed=true;}this.mineEvent='终点站，全部结算';this.finishRound();}
  }
  finishRound(){
    if(this.phase!=='playing')return;
    const points=this.game==='rescue'?this.players.map(()=>this.water<100?10:4):roundPoints(this.players.map(p=>p.value));
    this.players.forEach((p,i)=>{p.points=points[i];p.total+=p.points;p.input={x:0,y:0,at:-10};});
    this.history.push({game:this.game,points:[...points],values:this.players.map(p=>p.value),stats:this.players.map(p=>({...p.stats})),water:this.game==='rescue'?this.water:null});this.phase='results';this.left=7;this.event('round');this.publish();
  }
  privateState(id,data){return privateExtra(this,id,data);}
  snapshot(){
    const votes=[...this.votes].filter(([id])=>this.connected(id)).map(([id,mode])=>({id,mode}));
    return {id:this.id,mode:this.mode,round:this.round,roundCount:this.roundCount,time:this.time,game:this.game,phase:this.phase,left:Math.max(0,this.left),paused:this.pause>0,pauseLeft:Math.max(0,15-this.pause),reason:this.reason,
      players:this.players.map(({id,name,color,index,total,points,value,x,y,vx,vy,cool,shield,out,carry,boards,cashed,seq,stats,tileType,tileCount})=>({id,name,color,index,total,points,value,ack:seq,x:Math.round(x*10)/10,y:Math.round(y*10)/10,vx,vy,cool,shield,out,carry:carry?{value:carry.value,bonus:!!carry.bonus,expires:carry.expires}:null,boards,cashed,tileType,tileCount,stats:{...stats},connected:this.connected(id)})),
      items:this.items,leaks:this.leaks,bumpers:this.bumpers,water:this.water,radius:this.radius||235,turn:this.turn,pot:this.minePot,nextRisk:Math.round(mineRisk(this.turn+1)*100),mineEvent:this.mineEvent,history:this.history,
      extra:snapshotExtra(this),events:this.events.filter(e=>this.time-e.at<3),votes,voteCounts:Object.fromEntries(PARTY_MODES.map(mode=>[mode,votes.filter(v=>v.mode===mode).length])),nextMode:this.nextMode()};
  }
  publish(){this.broadcastAt=performance.now();this.send('party:state',this.snapshot());}
}
