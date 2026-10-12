/* 最终战：三阶段六处封锁，带预兆的点名扫线。 */
'use strict';
var siegeSnapshot=snapshot;
snapshot=function(){var s=siegeSnapshot();s.bossSeals=M.boss?M.boss.seals||2:M.bossRetrySeals||2;return s;};
var siegeReset=resetTransient;
resetTransient=function(){siegeReset();delete M.bossRetrySeals;};
var siegeStart=startBoss;
startBoss=function(hp,seals){var resume=seals||M.bossRetrySeals||2;siegeStart(hp);if(M.boss){M.boss.seals=clamp(resume,1,2);M.boss.sweepCd=3.8;M.boss.sweep=null;}delete M.bossRetrySeals;bossHudDraw(true);checkpoint('战斗开始');};
var siegeHit=bossHit;
bossHit=function(o){
 var b=M.boss,idx=o&&{plat_nw:0,plat_ne:1,plat_s:2}[o.talk];
 if(b&&!b.dead&&b.open>0&&(idx===undefined||idx===b.lit)&&(b.seals||2)>1){
  b.seals=1;b.inv=1.2;b.hurt=.5;b.phase='wave';b.wave=0;b.since=.75;b.open=0;b.lit=-1;M.horrorHit=.45;sfxPick();filmCue('tear');shake(.35);bossHudDraw(true);checkpoint('封锁分支关闭');
  toast('这一阶段的分支已关闭。还需关掉主锁，先躲下一轮点名。',2.8);return true;
 }
 var hp=b&&b.hp,result=siegeHit(o);
 if(b&&M.boss===b&&b.hp<hp){b.seals=2;b.sweep=null;b.sweepCd=2.8;bossHudDraw(true);checkpoint('回声阶段关闭');}
 if(b&&M.boss!==b&&M.bossRetryT>0)M.bossRetrySeals=b.seals||2;
 return result;
};
function sweepHit(b){
 b.lives--;b.inv=1.4+(flagOn('走出循环')?.5:0);b.hurt=.5;M.horrorHit=.45;flashRed();shake(.35);bossHudDraw(true);
 if(b.lives<=0){M.bossRetryHp=b.hp;M.bossRetrySeals=b.seals||2;M.boss=null;M.bossRetryT=1.2;bossHud(false);droneOff();toast('点名线穿过了你。保留已关闭的封锁，从当前阶段重试。',3);}
 else toast('红线落下时要离开那一行。下次先看预警，再换方向。',2.5);
}
var siegeTick=bossTick;
bossTick=function(dt){
 var b=M.boss;if(!b)return;siegeTick(dt);
 if(M.boss!==b){if(M.bossRetryT>0)M.bossRetrySeals=b.seals||2;return;}
 if(b.seals===1)b.rings.forEach(function(r){if(!r.siegeQuick){r.spd=(r.spd||96)*1.1;r.siegeQuick=true;}});
 if(M.cut||M.talk.open||M.book||M.dying||document.hidden)return;
 if(!b.sweep){
  b.sweepCd-=dt;if(b.sweepCd<=0){
   var kind=b.hp===3?'row':b.hp===2?'column':'cross';b.sweep={kind:kind,x:M.p.x,y:M.p.y,t:1.5,fired:false};
   tone(310,.16,{type:'triangle',vol:.035});toast(kind==='row'?'横向点名线来了：离开红色那一行。':kind==='column'?'纵向点名线来了：离开红色那一列。':'交叉点名线来了：斜向离开红色交点。',2);
  }
 }else {
  var sweep=b.sweep;sweep.t-=dt;
  if(sweep.t<=0&&!sweep.fired){
   sweep.fired=true;tone(100,.12,{type:'triangle',vol:.03});
   var hit=(sweep.kind!=='column'&&Math.abs(M.p.y-sweep.y)<17)||(sweep.kind!=='row'&&Math.abs(M.p.x-sweep.x)<17);
   if(hit&&b.inv<=0)sweepHit(b);if(M.boss!==b)return;
  }
  if(sweep.t<-.3){b.sweep=null;b.sweepCd=b.hp===3?5.2:b.hp===2?4.8:4.4;}
 }
};
var siegeHud=bossHudDraw;
bossHudDraw=function(force){siegeHud(force);if(!M.boss)return;var b=M.boss,el=document.getElementById('boss');var p=el.querySelector('.seals');if(!p){p=document.createElement('div');p.className='say seals';el.appendChild(p);}var done=(3-b.hp)*2+(2-(b.seals||2)),text='封锁 '+done+'/6 · 当前阶段还剩 '+(b.seals||2)+' 处';if(p.textContent!==text)p.textContent=text;};
var siegeDraw=drawWanderWorld;
drawWanderWorld=function(){siegeDraw();var b=M.boss;if(!b||!b.sweep)return;var s=b.sweep;cx.save();
 var fired=s.fired;cx.strokeStyle=fired?'rgba(232,113,113,.9)':'rgba(192,88,92,.6)';cx.fillStyle=fired?'rgba(154,42,54,.28)':'rgba(137,62,73,.13)';cx.lineWidth=fired?4:2;
 if(s.kind!=='column'){cx.fillRect(2*TILE,s.y-17,(MAPW-4)*TILE,34);cx.beginPath();cx.moveTo(2*TILE,s.y);cx.lineTo((MAPW-2)*TILE,s.y);cx.stroke();}
 if(s.kind!=='row'){cx.fillRect(s.x-17,2*TILE,34,(MAPH-4)*TILE);cx.beginPath();cx.moveTo(s.x,2*TILE);cx.lineTo(s.x,(MAPH-2)*TILE);cx.stroke();}
 if(!fired){cx.font='bold 12px sans-serif';cx.textAlign='center';cx.fillStyle='#f2b4a3';cx.fillText('点名线 · '+Math.max(0,s.t).toFixed(1)+'秒',s.x,s.y-24);}
 cx.restore();};
TALK.him.nodes.kill6.text='最终战有三阶段、六个封锁点，每阶段要成功关闭两处。\n\n躲开弧线缺口；红色点名线出现后，有1.5秒换行／换列。\n\n等讲桌持续亮起，跑过去按调查。第二阶段同时避开影子，第三阶段碰假灯会扣命。\n\nQ／手机屏息能短暂护身，带旧哨子可以打散靠近的弧线。\n\n已关闭的封锁点会存档，失败继续当前阶段。';
