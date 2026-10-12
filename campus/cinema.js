/* 镜头、人物演出与纸影。原生 Canvas，无外部视频或持续闪烁。 */
'use strict';
var SOFT_FILM=matchMedia('(prefers-reduced-motion: reduce)').matches;
try{var filmPreference=localStorage.getItem('ink831:softFilm');if(filmPreference!==null)SOFT_FILM=filmPreference==='1';}catch(e){}
var filmStyle=document.createElement('style');filmStyle.textContent=`
 body.in-film #dlg,body.in-film #goal,body.in-film #prog,body.in-film #arrow,body.in-film #hint,body.in-film #where,body.in-film #clock,body.in-film #act,body.in-film #run,body.in-film #btnBook,body.in-film #btnFast,body.in-film #btnSnd,body.in-film #stick,body.in-film #episodeHud,body.in-film #episodeControls,body.in-film #annexBattleAction{display:none!important}
 #filmCaption{position:absolute;inset:0;z-index:11;pointer-events:none;display:none;box-shadow:inset 0 54px #090b0e,inset 0 -108px #090b0e}
 #filmCaption p{position:absolute;left:7%;right:7%;bottom:38px;text-align:center;font-size:clamp(14px,3.7vw,19px);line-height:1.65;color:#f2e5cd;white-space:pre-line;text-shadow:0 2px 4px #000}
 #filmSkip{position:absolute;right:12px;top:12px;pointer-events:auto;padding:9px 13px;border:1px solid #7e898c;background:#172026;color:#e3ddcd;border-radius:4px;font:12px system-ui}
 #softFilm{padding:8px 12px;background:#253036;border:1px solid #778486;border-radius:4px;color:#e8dfcd}
 body.in-boss #goal,body.in-boss #prog,body.in-boss #where,body.in-boss #clock{display:none!important}
 body.in-boss #boss{top:12px!important;width:min(92vw,470px);background:rgba(8,15,21,.92);border:1px solid #5e7376;border-top:3px solid #a96560;padding:10px 12px;box-shadow:0 6px 24px rgba(0,0,0,.35)}
 body.in-boss #boss .nm{color:#d4c5a6;letter-spacing:.17em;opacity:1}body.in-boss #boss .hp{font-size:19px}body.in-boss #boss .say{font-size:12px;line-height:1.6}
 @media(max-height:560px){#filmCaption{box-shadow:inset 0 36px #090b0e,inset 0 -70px #090b0e}#filmCaption p{bottom:14px;font-size:14px}}
`;document.head.appendChild(filmStyle);
var filmCaption=document.createElement('div');filmCaption.id='filmCaption';filmCaption.innerHTML='<p></p><button id="filmSkip" type="button">跳过这段演出</button>';document.body.appendChild(filmCaption);
var filmText=filmCaption.querySelector('p');
function filmBeat(id,secs,caption,x,y,opt){return Object.assign({film:id,secs:secs,caption:caption,focus:{x:x*TILE+16,y:y*TILE+16}},opt||{});}
SCENES.film_yard=[
 filmBeat('yard',2.4,'哨声响起。\n他的脚先转过来，头却还朝着另一边。',15,8,{zoom:1.4,cue:'whistle'}),
 filmBeat('yard',1.2,'这一步，没有落地声。',15,10,{black:.42}),
 filmBeat('yard_empty',2.6,'看台上只剩一件校服。\n里面的人去了哪里？',15,9,{zoom:1.5,cue:'step'})
];
SCENES.film_canteen=[
 filmBeat('tray',2.5,'第三份饭被推向窗口。\n盘子底下，多了一只手。',20,6,{zoom:1.3,cue:'scrape'}),
 filmBeat('canteen_black',1.0,'「够了。」',20,6,{black:.7,cue:'silence'}),
 filmBeat('guests',3.0,'我转过身。\n每张空桌前，都坐着一个背对我的人。',20,17,{zoom:1.15,flash:true,cue:'step'})
];
SCENES.film_awake=[
 filmBeat('awake',2.2,'点名停了。\n讲台下面却又传出一声「到」。',11,3,{zoom:1.35,cue:'knock'}),
 filmBeat('awake_black',.9,'灯灭了。名单还在翻页。',11,3,{black:.7,cue:'silence'}),
 filmBeat('monster',3.3,'它把被划掉的名字，一张张披在身上。',11,3,{zoom:1.35,flash:true,cue:'rise'})
];
SCENES.film_collapse=[
 filmBeat('collapse',2.8,'最后一个回声节点断开。\n它身上的名单开始脱落。',17,12,{zoom:1.25,cue:'tear'}),
 filmBeat('collect',2.5,'lg7 跑了进来。\n他接住的，只是一小块暗下去的样品。',17,13,{zoom:1.15,cue:'step'})
];
SCENES.film_photo=[filmBeat('photo',2.5,'照片里的人转了过来。\n他的脸，和我的一样。',5,6,{zoom:1.35,cue:'scrape'}),filmBeat('photo_shadow',2.2,'我身后的门，慢慢关上了。',12,13,{black:.25})];
SCENES.film_loop=[filmBeat('loop',2.8,'第四道刻痕留下了。\n我停了，门外的影子却又走了一步。',16,15,{zoom:1.15,cue:'step'})];
SCENES.film_seat=[filmBeat('seat',3.0,'那只手松开了椅背。\n空位下面，留下四天前的粉笔灰。',42,20,{zoom:1.3,cue:'tear'})];
SCENES.film_receipt=[filmBeat('receipt',3.0,'送饭前的照片，不能证明所有人都离校。\n水哥终于拿回了完整的小票。',20,6,{zoom:1.3,cue:'scrape'})];
SCENES.film_exit=[filmBeat('exit',3.0,'卷尺收了回来。\n被添上的两条路，在地图上慢慢消失。',37,28,{zoom:1.25,cue:'tear'})];
TALK.annex_whistle.nodes.s.scene='film_yard';
TALK.him.nodes.kill5.scene='film_awake';
TALK.boss_end.nodes.s.scene='film_collapse';
TALK.photo_done.nodes.s.scene='film_photo';TALK.loop_done.nodes.s.scene='film_loop';
TALK.annex_laoli_final.nodes.right.scene='film_seat';TALK.annex_shui_final.nodes.right.scene='film_receipt';TALK.annex_logic_final.nodes.right.scene='film_exit';
var cinemaGoto=gotoNode;
gotoNode=function(id){
 if(M.talk.script===TALK.annex_server&&id==='serve')TALK.annex_server.nodes.serve.scene=!M.talk.replay&&mealRound()===2&&JSON.stringify(mealTray())===JSON.stringify(mealOrder())?'film_canteen':undefined;
 cinemaGoto(id);
};
function filmCue(cue){
 if(M.skippingFilm||!SND)return;
 if(cue==='silence'){droneOff();if(laughEl)laughEl.pause();return;}
 if(cue==='whistle')tone(880,.22,{type:'triangle',vol:.045});
 if(cue==='step')hiss(.18,{freq:250,vol:.05});
 if(cue==='knock'){tone(110,.12,{type:'triangle',vol:.055});hiss(.06,{freq:240,vol:.035});}
 if(cue==='scrape')hiss(.45,{freq:1250,type:'bandpass',vol:.035});
 if(cue==='tear')hiss(.32,{freq:1800,vol:.035});
 if(cue==='rise')tone(70,1.1,{type:'sawtooth',slideTo:160,vol:.025});
}
function clearFilm(){
 M.film=null;M.filmCamera=null;M.filmZoom=1;document.body.classList.remove('in-film');filmCaption.style.display='none';M.renderDirty=true;
}
var cinemaNext=cutNext;
cutNext=function(){
 var from=M.filmCamera?{x:M.filmCamera.x,y:M.filmCamera.y}:{x:M.p.x,y:M.p.y},fromZoom=M.filmZoom||1;
 clearFilm();cinemaNext();if(!M.cut||M.film)return;var b=M.cut.list[M.cut.i];if(!b||!b.film)return;
 M.cardT=0;cardEl.classList.remove('on');clearInput();
 M.film={beat:b,t:0,from:from,fromZoom:fromZoom,duration:b.secs};M.filmCamera={x:from.x,y:from.y};M.filmZoom=fromZoom;
 filmText.textContent=b.caption;filmCaption.style.display='block';document.body.classList.add('in-film');filmCue(b.cue);M.renderDirty=true;
};
var cinemaCutTick=cutTick;
cutTick=function(dt){
 var f=M.film;if(f){f.t=Math.min(f.duration,f.t+dt);var p=Math.min(1,f.t/Math.min(1.2,f.duration)),e=p*p*(3-2*p);
  M.filmCamera={x:f.from.x+(f.beat.focus.x-f.from.x)*e,y:f.from.y+(f.beat.focus.y-f.from.y)*e};M.filmZoom=f.fromZoom+((f.beat.zoom||1.1)-f.fromZoom)*e;M.renderDirty=true;
 }cinemaCutTick(dt);
};
filmCaption.querySelector('button').addEventListener('click',function(e){e.stopPropagation();var cut=M.cut;M.skippingFilm=true;for(var i=0;cut&&M.cut===cut&&i<100;i++)cutNext();M.skippingFilm=false;});
var cinemaReset=resetTransient;
resetTransient=function(){clearFilm();document.body.classList.remove('in-boss');M.horrorHit=0;cinemaReset();};
var cinemaLoad=loadMap;
loadMap=function(id,x,y,dir){if(M.film){M.cut=null;M.cutAfter=null;}clearFilm();M.horrorHit=0;cinemaLoad(id,x,y,dir);document.body.classList.toggle('in-boss',id==='arena'&&M.screen==='play');};
// Angular paper plates, a split face and ink hands replace the old smiley.
function drawHorrorBoss(b,opt){
 opt=opt||{};var t=b.t||0,lv=3-(b.hp||3),rise=opt.rise===undefined?1:opt.rise;
 cx.save();cx.translate(b.cx,b.cy);cx.scale(1,Math.max(.03,rise));
 var sway=SOFT_FILM?Math.sin(t)*2:Math.sin(t*1.7)*4;
 cx.fillStyle='rgba(4,8,13,.58)';cx.beginPath();cx.ellipse(0,15,74+lv*7,24,0,0,7);cx.fill();
 cx.translate(sway,0);cx.fillStyle='#151b21';cx.beginPath();cx.moveTo(-37,17);cx.lineTo(-47,-49);cx.lineTo(-32,-108);cx.lineTo(-11,-139);cx.lineTo(16,-149);cx.lineTo(43,-110);cx.lineTo(57,-43);cx.lineTo(37,21);cx.closePath();cx.fill();
 for(var i=0;i<8;i++){
  var side=i%2?-1:1,y=-30-i*10,x=side*(28+Math.sin(t*.7+i)*9),reach=side*(61+i%3*12);
  cx.strokeStyle=i%3?'#323740':'#7b7c63';cx.lineWidth=4;cx.beginPath();cx.moveTo(x,y);cx.lineTo(reach,y+15+Math.sin(t+i)*4);cx.lineTo(reach+side*9,y+30);cx.stroke();
  for(var j=0;j<3;j++){cx.lineWidth=2;cx.beginPath();cx.moveTo(reach+side*9,y+30);cx.lineTo(reach+side*(12+j*4),y+42+j*2);cx.stroke();}
 }
 var crack=b.hurt>0?Math.sin(t*35)*5:0;
 for(var i=0;i<7;i++){
  var x=-31+(i%3)*23+Math.sin(t*.45+i)*3+crack,y=-119+Math.floor(i/3)*32;
  cx.save();cx.translate(x,y);cx.rotate(Math.sin(t*.4+i)*.1);cx.fillStyle=i%2?'#b9b390':'#d8d1b0';cx.fillRect(-11,-4,22,38);cx.fillStyle='#4b514a';
  for(var j=0;j<4;j++)cx.fillRect(-7,3+j*6,13-j%2*4,2);cx.strokeStyle='#833d40';cx.lineWidth=2;cx.beginPath();cx.moveTo(-9,14);cx.lineTo(8,9);cx.stroke();cx.restore();
 }
 cx.fillStyle='#dedac8';cx.beginPath();cx.moveTo(-21,-124);cx.lineTo(10,-135);cx.lineTo(26,-117);cx.lineTo(18,-83);cx.lineTo(-18,-86);cx.closePath();cx.fill();
 cx.fillStyle='#10181f';cx.fillRect(-17,-112,13,6);cx.fillRect(8,-117,9,7);cx.beginPath();cx.moveTo(-6,-103);cx.lineTo(5,-108);cx.lineTo(12,-80);cx.lineTo(-10,-84);cx.closePath();cx.fill();
 cx.strokeStyle='#8f3c41';cx.lineWidth=2;cx.beginPath();cx.moveTo(2,-133);cx.lineTo(-5,-116);cx.lineTo(2,-105);cx.lineTo(-1,-81);cx.stroke();
 cx.fillStyle=b.phase==='open'?'#d5b967':'#7b8663';cx.beginPath();cx.moveTo(-12,7);cx.lineTo(-19,-22);cx.lineTo(-3,-37);cx.lineTo(17,-21);cx.lineTo(11,9);cx.closePath();cx.fill();
 cx.strokeStyle='#182326';cx.beginPath();cx.moveTo(-10,-18);cx.lineTo(3,-9);cx.lineTo(-3,7);cx.stroke();
 // A short fracture response communicates successful hits without obscuring rings.
 if(b.hurt>0||M.horrorHit>0){cx.strokeStyle='#e0cdb2';cx.lineWidth=2;for(var i=0;i<6;i++){var a=i*Math.PI/3+t*.2;cx.beginPath();cx.moveTo(Math.cos(a)*30,-55+Math.sin(a)*30);cx.lineTo(Math.cos(a)*65,-55+Math.sin(a)*65);cx.stroke();}}
 cx.restore();
}
function bloodHand(x,y,scale,alpha){
 cx.save();cx.translate(x,y);cx.scale(scale,scale);cx.fillStyle='rgba(100,25,37,'+alpha+')';cx.fillRect(-6,-3,13,17);for(var i=0;i<4;i++)cx.fillRect(-7+i*4,-17-i%2*3,3,20);cx.fillRect(-12,0,7,5);cx.fillRect(-3,14,4,20);cx.restore();
}
function drawSampleObject(x,y){cx.save();cx.translate(x,y);cx.fillStyle='#29343c';cx.fillRect(-18,-7,36,7);cx.fillStyle='rgba(166,195,195,.17)';cx.fillRect(-15,-37,30,29);cx.strokeStyle='#819191';cx.lineWidth=2;cx.strokeRect(-15,-37,30,29);cx.fillStyle='#9a945c';cx.beginPath();cx.moveTo(-8,-9);cx.lineTo(-11,-24);cx.lineTo(1,-30);cx.lineTo(11,-22);cx.lineTo(7,-9);cx.closePath();cx.fill();cx.strokeStyle='#283137';cx.beginPath();cx.moveTo(2,-30);cx.lineTo(-3,-18);cx.lineTo(6,-9);cx.stroke();cx.restore();}
var cinemaLabels=drawLabels;
drawLabels=function(){if(!M.film&&M.map!=='arena')cinemaLabels();};
function drawAtmosphereFloor(){
 if(M.map==='arena'){cx.fillStyle='rgba(7,17,26,.68)';cx.fillRect(0,0,MAPW*TILE,MAPH*TILE);cx.strokeStyle='rgba(165,148,106,.14)';cx.lineWidth=1;cx.beginPath();cx.arc(17*TILE+16,12*TILE+16,90,0,7);cx.stroke();}
 else if(M.film){cx.fillStyle='rgba(8,16,24,.27)';cx.fillRect(0,0,MAPW*TILE,MAPH*TILE);}
}
function drawFilmWorld(){
 var f=M.film;if(!f)return;var id=f.beat.film,t=f.t,p=Math.min(1,t/f.duration),x=f.beat.focus.x,y=f.beat.focus.y;
 if(id==='yard'){cx.globalAlpha=.78;drawSprite('deskmate',15*TILE+16,(7+p*3)*TILE,p>.5?'down':'up',t,true,2.5);cx.globalAlpha=1;}
 if(id==='yard_empty'){cx.fillStyle='#3b3e49';cx.fillRect(15*TILE-2,8*TILE,34,39);bloodHand(15*TILE+17,10*TILE,.7,.55);}
 if(id==='tray'){cx.fillStyle='#8d9294';cx.fillRect(20*TILE-20,(7-p*1.4)*TILE,62,9);cx.fillStyle='#d0c4a1';cx.fillRect(20*TILE-8,(7-p*1.4)*TILE-5,33,5);bloodHand(20*TILE+16,7*TILE,.85,Math.min(.9,p));}
 if(id==='guests'){for(var i=0;i<6;i++){var gx=(12+(i%3)*4)*TILE+16,gy=(14+Math.floor(i/3)*4)*TILE;cx.globalAlpha=.72;drawSprite('deskmate',gx,gy+8,'up',0,false,2);cx.globalAlpha=1;drawObj('desk',gx,gy);}bloodHand(20*TILE,5*TILE,2,.7);}
 if(id==='awake'){cx.strokeStyle='#748486';cx.lineWidth=2;for(var i=0;i<4;i++){cx.beginPath();cx.moveTo(x+(i-1.5)*12,y+10);cx.lineTo(x+(i-1.5)*22,y-30-p*45);cx.stroke();}}
 if(id==='monster'||id==='collapse'){drawHorrorBoss({cx:x,cy:y+45,t:M.t,hp:id==='collapse'?1:3,phase:'wave',hurt:0},{rise:id==='collapse'?1-p:Math.min(1,p*2)});}
 if(id==='collect'){drawSprite('lg7',x+(1-p)*150,y+40,'left',t,p<.8,2.2);cx.fillStyle='#756d42';cx.fillRect(x-5,y+33,13,9);}
 if(id==='photo'){cx.globalAlpha=.7;drawSprite(M.me.id,x,y+20,p>.45?'down':'up',0,false,2.8);cx.globalAlpha=1;}
 if(id==='photo_shadow'||id==='loop'){cx.globalAlpha=.4;drawSprite(M.me.id,x+36,y+Math.sin(p*Math.PI)*45,'up',t,true,2.2);cx.globalAlpha=1;}
 if(id==='seat'){bloodHand(x+24,y-12,1.2,1-p*.7);cx.fillStyle='#e0d8bf';for(var i=0;i<9;i++)cx.fillRect(x-15+i*5,y+23+Math.sin(i)*4,3,2);}
 if(id==='receipt'){cx.save();cx.translate(x,y+20);cx.rotate(-.2+p*.3);cx.fillStyle='#d9ceb1';cx.fillRect(-28,-40,56,75);cx.fillStyle='#393c36';for(var i=0;i<5;i++)cx.fillRect(-19,-27+i*10,38,3);cx.strokeStyle='#903843';cx.beginPath();cx.moveTo(-20,13);cx.lineTo(17,9);cx.stroke();cx.restore();}
 if(id==='exit'){cx.strokeStyle='#d8c690';cx.lineWidth=4;cx.beginPath();cx.moveTo(x-110*(1-p),y);cx.lineTo(x+80*(1-p),y);cx.stroke();for(var i=0;i<10;i++){cx.lineWidth=1;cx.beginPath();cx.moveTo(x+(i-5)*12*(1-p),y);cx.lineTo(x+(i-5)*12*(1-p),y-8);cx.stroke();}}
}
var cinemaDraw=drawWanderWorld;
drawWanderWorld=function(){
 cinemaDraw();cx.save();
 if(M.map==='arena'){
  // Darken the room edges rather than covering the playable rings.
  cx.fillStyle='rgba(9,16,23,.62)';cx.fillRect(0,0,MAPW*TILE,2*TILE);cx.fillRect(0,(MAPH-2)*TILE,MAPW*TILE,2*TILE);cx.fillRect(0,0,2*TILE,MAPH*TILE);cx.fillRect((MAPW-2)*TILE,0,2*TILE,MAPH*TILE);
  bloodHand(7*TILE,3*TILE,1.3,.65);bloodHand(27*TILE,3*TILE,1.1,.6);
 }
 if(M.map==='canteen'&&mealRound()>0)bloodHand(19*TILE,4*TILE,1.8,.5);
 if(M.map==='yard'&&M.yardTrial&&M.yardTrial.phase==='stop'&&!flagOn('拿到旧哨子')){cx.globalAlpha=.18;drawSprite(M.me.id,M.p.x+30,M.p.y+22,'down',0,false,2);cx.globalAlpha=1;}
 if(M.map==='floor2'){bloodHand(36*TILE,8*TILE,.8,.35);}
 drawFilmWorld();cx.restore();
};
var cinemaRender=render;
render=function(){cinemaRender();cx.save();cx.setTransform(DPR,0,0,DPR,0,0);var f=M.film;
 if(f){var b=f.beat,t=f.t;if(b.black&&t<b.black){cx.fillStyle='#070a0d';cx.fillRect(0,0,W,H);}if(b.flash&&t>.18&&t<.3){cx.fillStyle=SOFT_FILM?'rgba(106,116,126,.13)':'rgba(208,216,210,.4)';cx.fillRect(0,0,W,H);}
  cx.fillStyle='rgba(8,15,25,.2)';cx.fillRect(0,0,W,H);
 }if(M.horrorHit>0){cx.strokeStyle='rgba(157,58,65,'+Math.min(.5,M.horrorHit)+')';cx.lineWidth=2;cx.beginPath();cx.moveTo(W*.12,H*.18);cx.lineTo(W*.2,H*.38);cx.lineTo(W*.15,H*.5);cx.stroke();}
 cx.restore();};
var cinemaBossHit=bossHit;
bossHit=function(o){var b=M.boss,hp=b&&b.hp,result=cinemaBossHit(o);if(b&&b.hp<hp){M.horrorHit=.45;filmCue('tear');M.renderDirty=true;}return result;};
var cinemaUpdate=update;
update=function(dt){cinemaUpdate(dt);document.body.classList.toggle('in-boss',M.screen==='play'&&M.map==='arena');if(M.screen==='play'&&!M.book&&!document.hidden&&M.horrorHit>0){M.horrorHit=Math.max(0,M.horrorHit-dt);M.renderDirty=true;}};
var cinemaShake=shake;
shake=function(secs){cinemaShake(SOFT_FILM?Math.min(.12,secs||.5):secs);};
var cinemaBook=buildBook;
buildBook=function(){cinemaBook();bookList.insertAdjacentHTML('beforeend','<h3>演出效果</h3><p>关键剧情有镜头、人物动画、短暂黑场与单次闪光；右上角可跳过整段演出。</p><button id="softFilm" type="button">'+(SOFT_FILM?'柔和演出：开启':'柔和演出：关闭')+'</button>');document.getElementById('softFilm').addEventListener('click',function(e){e.stopPropagation();SOFT_FILM=!SOFT_FILM;try{localStorage.setItem('ink831:softFilm',SOFT_FILM?'1':'0');}catch(err){}this.textContent=SOFT_FILM?'柔和演出：开启':'柔和演出：关闭';});};
