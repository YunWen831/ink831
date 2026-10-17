import {CHOICE_GAMES,FLOOR_TYPES,WISHES,POWERS,BUTTON_EFFECTS} from '../../courtyard/party-rules.js';
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v)),dist=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
const shuffle=(values,random)=>{const list=[...values];for(let i=list.length-1;i>0;i--){const j=Math.floor(random()*(i+1));[list[i],list[j]]=[list[j],list[i]];}return list;};
const cell=p=>({col:clamp(Math.floor((p.x-96)/64),0,11),row:clamp(Math.floor((p.y-76)/64),0,6)});
const same=(a,b)=>a.col===b.col&&a.row===b.row;
export function setupExtra(g){
  g.extra={stage:CHOICE_GAMES.includes(g.game)?'choose':'build',tiles:[],stars:[],reveal:[],required:1,prompt:'向左走',controller:'',power:'',powerUntil:0,used:false};g.secretButtons=[];g.stepUntil=0;
  for(const p of g.players){p.tileType='ice';p.tileCount=0;p.effectUntil=0;p.tileUntil=0;p.extraChoice='';p.extraTarget='';p.privateClue=null;p.stats.stars=0;p.stats.placed=0;p.stats.successes=0;p.stats.powers=0;}
  if(CHOICE_GAMES.includes(g.game))prepareChoice(g);else for(let i=0;i<5;i++)spawnStar(g);
}
function spawnStar(g){for(let attempt=0;attempt<30;attempt++){const star={id:++g.eventSeq,x:128+Math.floor(g.random()*12)*64,y:108+Math.floor(g.random()*7)*64};if(g.extra.stars.some(s=>dist(s,star)<40))continue;g.extra.stars.push(star);return;}}
function prepareChoice(g){
  g.extra.stage='choose';g.extra.reveal=[];g.stepUntil=0;for(const p of g.players){p.extraChoice='';p.extraTarget='';p.privateClue=null;}
  if(g.game==='buttons'){g.secretButtons=shuffle(Object.keys(BUTTON_EFFECTS),g.random).slice(0,3);for(const p of g.players){const index=(p.index+g.turn)%3;p.privateClue=p.index<3?{button:index,effect:g.secretButtons[index]}:{button:index,effect:Object.keys(BUTTON_EFFECTS).find(effect=>effect!==g.secretButtons[index]),not:true};}}
  if(g.game==='follow'){const count=g.players.filter(p=>g.connected(p.id)).length;g.extra.required=1+Math.floor(g.random()*Math.max(1,count-1));g.extra.prompt=['向左走','举起双手','蹲下来','挥一挥手'][g.turn%4];}
}
export function privateExtra(g,id,data){const p=g.players.find(p=>p.id===id);if(!p||!g.connected(id)||data?.id!==g.id||data.round!==g.round||data.turn!==g.turn)return null;return {id:g.id,round:g.round,turn:g.turn,clue:p.privateClue,choice:p.extraChoice,target:p.extraTarget};}
export function inputExtra(g,p,data){
  if(g.game==='floor'){if(Object.hasOwn(FLOOR_TYPES,data.tileType))p.tileType=data.tileType;return false;}
  if(g.game==='remote'){if(Object.hasOwn(POWERS,data.choice)&&data.turn===g.turn)applyPower(g,p,data.choice);return false;}
  if(!CHOICE_GAMES.includes(g.game))return false;
  if(data.turn!==g.turn||g.extra.stage!=='choose'||p.extraChoice)return true;
  const valid=g.game==='wish'?Object.hasOwn(WISHES,data.choice):g.game==='buttons'?['0','1','2'].includes(data.choice):['do','hold'].includes(data.choice);
  if(valid){p.extraChoice=data.choice;if(g.game==='wish'&&data.choice==='swap'){p.extraTarget=g.players.find(q=>q.id===data.target&&q.id!==p.id&&g.connected(q.id))?.id||g.players.find(q=>q.id!==p.id&&g.connected(q.id))?.id||'';}}
  return true;
}
function applyPower(g,p,power){if(g.extra.controller!==p.id||g.extra.used||!g.connected(p.id))return;g.extra.used=true;p.stats.powers++;g.extra.power=power;g.extra.powerUntil=g.time+5;
  if(power==='shuffle'){const active=g.players.filter(q=>g.connected(q.id));const places=active.map(q=>({x:q.x,y:q.y}));active.forEach((q,i)=>{Object.assign(q,places[(i+1)%places.length]);q.vx=q.vy=0;});}
  g.event('power',{actor:p.id,x:p.x,y:p.y,text:POWERS[power]});
}
function tickMoving(g,dt){const elapsed=g.time-g.roundStarted,e=g.extra;e.stage=g.game==='floor'&&elapsed<12?'build':'collect';
  if(g.game==='remote'){const turn=Math.floor(elapsed/9),active=g.players.filter(p=>g.connected(p.id));if(turn!==g.turn||!e.controller||!g.connected(e.controller)){g.turn=turn;e.controller=active[turn%active.length]?.id||'';e.used=false;}if(e.powerUntil<=g.time)e.power='';}
  for(const p of g.players){p.cool=Math.max(0,p.cool-dt);p.tileUntil=Math.max(0,p.tileUntil-dt);const input=g.connected(p.id)&&g.time-p.input.at<.3?p.input:{x:0,y:0,action:false},pressed=input.action&&!p.acting;p.acting=!!input.action;
    const at=cell(p),tile=e.tiles.find(t=>same(t,at)),slippery=tile?.type==='ice'||(g.game==='remote'&&e.power==='ice'),speed=tile?.type==='boost'?310:205;
    if(slippery){p.vx=(p.vx+input.x*650*dt)*Math.exp(-2.4*dt);p.vy=(p.vy+input.y*650*dt)*Math.exp(-2.4*dt);}else{p.vx=input.x*speed;p.vy=input.y*speed;}
    const r=e.power==='giant'?28:16;p.x=clamp(p.x+p.vx*dt,96+r,864-r);p.y=clamp(p.y+p.vy*dt,76+r,524-r);
    if(g.game==='floor'){
      if(e.stage==='build'&&pressed&&p.cool<=0&&p.tileCount<6&&!e.tiles.some(t=>same(t,cell(p)))){e.tiles.push({...cell(p),type:p.tileType,owner:p.id});p.tileCount++;p.stats.placed++;p.cool=.3;g.event('repair',{actor:p.id,x:p.x,y:p.y,text:FLOOR_TYPES[p.tileType]+'地砖'});}
      if(e.stage==='collect'&&tile&&p.tileUntil<=0){if(tile.type==='warp'){p.x=960-p.x;p.y=600-p.y;p.tileUntil=1.1;g.event('power',{actor:p.id,x:p.x,y:p.y,text:'传送！'});}if(tile.type==='bounce'){const dx=input.x||Math.cos(p.index*2),dy=input.y||Math.sin(p.index*2);p.x=clamp(p.x+dx*85,112,848);p.y=clamp(p.y+dy*85,92,508);p.tileUntil=.8;g.event('hit',{actor:p.id,x:p.x,y:p.y});}}
    }else if(pressed)applyPower(g,p,'ice');
    if(e.stage==='collect'&&g.connected(p.id)){const star=e.stars.find(s=>dist(p,s)<(e.power==='giant'?36:25));if(star){e.stars=e.stars.filter(s=>s!==star);p.value++;p.stats.stars++;g.event('treasure',{actor:p.id,x:star.x,y:star.y,text:'+1 星星'});spawnStar(g);}}
  }
  if(g.game==='remote'&&e.power==='giant')for(let i=0;i<g.players.length;i++)for(let j=i+1;j<g.players.length;j++){const a=g.players[i],b=g.players[j],d=dist(a,b);if(d>0&&d<56){const push=(56-d)/2,dx=(a.x-b.x)/d,dy=(a.y-b.y)/d;a.x=clamp(a.x+dx*push,124,836);b.x=clamp(b.x-dx*push,124,836);a.y=clamp(a.y+dy*push,104,496);b.y=clamp(b.y-dy*push,104,496);}}
}
function resolveChoice(g){const e=g.extra,active=g.players.filter(p=>g.connected(p.id)),before=new Map(g.players.map(p=>[p.id,p.value])),order=[...active].sort((a,b)=>(a.index-g.turn+g.players.length)%g.players.length-(b.index-g.turn+g.players.length)%g.players.length);e.reveal=[];
  const leader=[...active].sort((a,b)=>before.get(b.id)-before.get(a.id)||a.index-b.index)[0];
  if(g.game==='follow'){const count=active.filter(p=>p.extraChoice==='do').length,success=count===e.required;for(const p of active){const did=p.extraChoice==='do',points=success?(did?4:1):0;p.value+=points;if(points)p.stats.successes++;e.reveal.push({id:p.id,name:p.name,choice:did?'执行':'不做',text:'+'+points});}e.message='执行 '+count+' 人 / 需要 '+e.required+' 人 · '+(success?'默契成功':'人数没对上');}
  if(g.game==='wish'){
    const together=active.filter(p=>p.extraChoice==='harmony').length;
    const delta=new Map(active.map(p=>[p.id,0]));for(const p of active){if(p.extraChoice==='gift')delta.set(p.id,delta.get(p.id)+3);if(p.extraChoice==='prank'&&leader)delta.set(leader.id,delta.get(leader.id)-2);if(p.extraChoice==='harmony')delta.set(p.id,delta.get(p.id)+(together>=2?5:1));}for(const p of active)p.value=Math.max(0,before.get(p.id)+delta.get(p.id));
    for(const p of order)if(p.extraChoice==='swap'){const target=active.find(q=>q.id===p.extraTarget);if(target)[p.value,target.value]=[target.value,p.value];}
    for(const p of active){if(p.value>before.get(p.id))p.stats.successes++;e.reveal.push({id:p.id,name:p.name,choice:WISHES[p.extraChoice]||'未许愿',text:(p.value-before.get(p.id)>=0?'+':'')+(p.value-before.get(p.id))});}e.message='先加减分，再按本轮顺序交换';
  }
  if(g.game==='buttons'){
    for(const p of order){const effect=g.secretButtons[Number(p.extraChoice)];if(!['0','1','2'].includes(p.extraChoice))continue;if(effect==='gift')p.value+=4;if(effect==='team')for(const q of active)q.value+=2;if(effect==='trap')p.value=Math.max(0,p.value-2);if(effect==='swap'&&leader&&leader!==p)[p.value,leader.value]=[leader.value,p.value];}
    for(const p of active){if(p.value>before.get(p.id))p.stats.successes++;e.reveal.push({id:p.id,name:p.name,choice:['0','1','2'].includes(p.extraChoice)?['红','蓝','黄'][Number(p.extraChoice)]+'按钮':'未按',text:(p.value-before.get(p.id)>=0?'+':'')+(p.value-before.get(p.id))});}e.effects=[...g.secretButtons];e.message='本轮按钮已揭晓，按本轮顺序结算';
  }
  g.event('treasure');e.stage='reveal';
}
export function tickExtra(g,dt){if(!CHOICE_GAMES.includes(g.game)){tickMoving(g,dt);return;}
  const elapsed=g.time-g.roundStarted,turn=Math.min(5,Math.floor(elapsed/8)),part=elapsed%8;
  if(turn!==g.turn){g.turn=turn;prepareChoice(g);}
  if(part>=5&&g.extra.stage==='choose')resolveChoice(g);
}
export function snapshotExtra(g){if(!g.extra)return null;const {stage,tiles,stars,reveal,required,prompt,controller,power,powerUntil,used,message,effects}=g.extra;const elapsed=Math.max(0,g.time-(g.roundStarted??g.time));return {stage,tiles,stars,reveal,required,prompt,controller,power,powerLeft:Math.max(0,powerUntil-g.time),used,message,effects:stage==='reveal'?effects:undefined,turnLeft:Math.max(0,stage==='choose'?5-elapsed%8:8-elapsed%8),buildLeft:Math.max(0,12-elapsed),order:g.players.map((_,i)=>g.players[(i+g.turn)%g.players.length].name)};}
