export const CITY={width:3072,height:2304,capacity:8,goal:5000,step:.05,view:1000,npcLimit:48,carLimit:16,lootLimit:100};
export const GUNS={
  fists:{name:'拳头',price:0,damage:12,range:43,interval:.5,mag:0,reload:0},
  knife:{name:'折叠刀',price:180,damage:30,range:56,interval:.5,mag:0,reload:0},
  pistol:{name:'手枪',price:650,damage:22,range:610,interval:.36,mag:8,reload:1.2},
  rifle:{name:'步枪',price:1600,damage:14,range:850,interval:.15,mag:24,reload:1.8},
};
export const GOODS={
  medkit:{name:'急救包',price:120,description:'恢复45生命'},ammo:{name:'弹药盒',price:120,description:'当前枪械补充32发备用弹'},
  vest:{name:'防弹背心',price:300,description:'补充60护甲'},banana:{name:'香蕉皮',price:90,description:'脚下布置，踩中打滑'},
  decoy:{name:'充气替身',price:160,description:'吸引附近警察和僵尸'},perfume:{name:'僵尸香水',price:140,description:'让僵尸聚集到投掷位置'},
  blink:{name:'瞬移马桶',price:260,description:'沿瞄准方向传送到可落脚地面'},barricade:{name:'便携路障',price:100,description:'临时封路，可打坏'},
  repair:{name:'维修工具',price:130,description:'修复身边载具'},bribe:{name:'可疑信封',price:300,description:'降低两级通缉'},
};
export const EVENTS={bombs:{name:'炸弹雨',hint:'红圈落弹前有预警，离开爆炸范围',seconds:40},zombies:{name:'僵尸入侵',hint:'击败僵尸可领80奖金，小心枪声引来更多',seconds:50},blackout:{name:'全城停电',hint:'视野变暗，开车时注意路障',seconds:40},cash:{name:'运钞车翻了',hint:'地图标记处散落现金，所有人都能捡',seconds:40},sale:{name:'疯狂促销',hint:'所有商店与车行限时七折',seconds:45},geese:{name:'大鹅接管街道',hint:'暴躁大鹅追人，车辆也拦不住它们的脾气',seconds:35}};
export const BLOCKS=[];
for(let row=0;row<4;row++)for(let col=0;col<6;col++){
  const x=col*512+105,y=row*560+110;
  BLOCKS.push({id:`b${col}-${row}`,x,y,w:290,h:300,color:['#6b7890','#976d76','#6e8f8c','#898268'][(col+row)%4],floors:2+(col*7+row)%4});
}
export const PLACES=[
  {id:'job-west',kind:'job',name:'西区快递站',x:80,y:80},{id:'job-east',kind:'job',name:'东区打工站',x:2640,y:1760},
  {id:'arms',kind:'arms',name:'铁皮武器店',x:530,y:80},{id:'arms-east',kind:'arms',name:'东区军品店',x:2580,y:1200},
  {id:'market',kind:'market',name:'怪东西商店',x:1555,y:80},{id:'market-south',kind:'market',name:'深夜杂货铺',x:1050,y:1760},
  {id:'bank-west',kind:'bank',name:'不太安全银行',x:80,y:640},{id:'bank-east',kind:'bank',name:'发财银行',x:2100,y:1760},
  {id:'casino',kind:'casino',name:'好运骰子厅',x:1060,y:640},{id:'casino-south',kind:'casino',name:'赛鹅俱乐部',x:1570,y:1760},
  {id:'garage',kind:'garage',name:'二手车行',x:2070,y:80},{id:'garage-south',kind:'garage',name:'南区车行',x:80,y:1760},
  {id:'escape-west',kind:'escape',name:'渡轮撤离点',x:70,y:2180},{id:'escape-east',kind:'escape',name:'直升机撤离点',x:2990,y:80},
  {id:'escape-south',kind:'escape',name:'长途车站',x:2600,y:2180},
];
export const BARKS=['这路灯是不是在盯着我？','我只想准点下班！','你见过会开车的鹅吗？','隔壁银行又响了。','今天的外卖有点烫手。','别抢我，我工资还没发！'];
export const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
export const dist=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
export function free(x,y,r=12,obstacles=[]){return Number.isFinite(x)&&Number.isFinite(y)&&x>=r&&y>=r&&x<=CITY.width-r&&y<=CITY.height-r&&!BLOCKS.some(b=>x+r>b.x&&x-r<b.x+b.w&&y+r>b.y&&y-r<b.y+b.h)&&!obstacles.some(b=>b.kind==='barricade'&&b.hp>0&&Math.abs(x-b.x)<r+18&&Math.abs(y-b.y)<r+18);}
export function cityMove(p,dx,dy,obstacles=[]){let{x,y}=p;const steps=Math.max(1,Math.ceil(Math.hypot(dx,dy)/6));for(let i=0;i<steps;i++){if(free(x+dx/steps,y,12,obstacles))x+=dx/steps;if(free(x,y+dy/steps,12,obstacles))y+=dy/steps;}return{x,y};}
export function cityDrive(car,input,dt,obstacles=[]){let{heading,speed}=car;const power=Math.min(1,Math.hypot(input.x,input.y));if(power>.1){const desired=Math.atan2(input.y,input.x),diff=Math.atan2(Math.sin(desired-heading),Math.cos(desired-heading));heading+=clamp(diff,-3.5*dt,3.5*dt);speed=Math.min(580*power,speed+420*dt);}else speed=Math.max(0,speed-700*dt);const next=cityMove(car,Math.cos(heading)*speed*dt,Math.sin(heading)*speed*dt,obstacles),crash=dist(next,car)<speed*dt*.4&&speed>150;return{...next,heading,speed:crash?speed*.2:speed,impact:crash?speed*.025:0};}
export function wallRange(p,angle,range,obstacles=[]){for(let d=0;d<=range;d+=6)if(!free(p.x+Math.cos(angle)*d,p.y+Math.sin(angle)*d,1,obstacles))return d;return range;}
export function circleHit(p,angle,t,r=15){const dx=t.x-p.x,dy=t.y-p.y,a=dx*Math.cos(angle)+dy*Math.sin(angle),side=dx*dx+dy*dy-a*a;return a<0||side>r*r?Infinity:Math.max(0,a-Math.sqrt(Math.max(0,r*r-side)));}
export function nearPlace(p,kind,range=95){return PLACES.filter(q=>(!kind||q.kind===kind)&&dist(p,q)<range).sort((a,b)=>dist(p,a)-dist(p,b))[0];}
