import { PRACTICE_LEVEL,MECHANISM_LEVEL } from './parkour-level.js?v=0.14.0';
import { createParkourState, stepParkour, respawn, STEP } from './parkour-physics.js?v=0.14.0';
import { drawBubbles } from './bubbles.js?v=0.14.0';
import { drawRunner } from './parkour-avatar.js?v=0.14.0';
import { drawCourse,drawSky } from './parkour-scene.js?v=0.14.0';
import {unpackState as copy} from './parkour-state.js?v=0.14.0';

export function createPractice(canvas,options){
  const ctx=canvas.getContext('2d'),keys=new Set(),$=id=>document.getElementById(id),poses=new Map();
  let active=false,level=PRACTICE_LEVEL,state=createParkourState(level),last=0,accumulator=0,jump=false,dash=false,reset=false,touchJump=false,width=960,height=640,dpr=1,paused=false;
  let network=null,seq=0,pending=[],outgoing=[],lastSend=0,peers=[],phase='',startsAt=0,clockOffset=0,verified=false,results=[],trail=[];
  let serverFinished=false,followId='',spectatorSignature='';
  const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
  new ResizeObserver(()=>{const box=canvas.getBoundingClientRect();width=box.width;height=box.height;dpr=Math.min(devicePixelRatio||1,2);canvas.width=Math.round(width*dpr);canvas.height=Math.round(height*dpr);}).observe(canvas);
  function clear(){keys.clear();jump=false;dash=false;reset=false;touchJump=false;accumulator=0;}
  const blocked=()=>document.hidden||!options.online()||!!document.querySelector('dialog[open]')||/INPUT|TEXTAREA|SELECT/.test(document.activeElement?.tagName);
  window.addEventListener('keydown',event=>{
    if(!active||blocked()||event.ctrlKey||event.metaKey||event.altKey)return;
    const key=event.key.toLowerCase();
    if(['a','d','w','s','arrowleft','arrowright','arrowup','arrowdown','z','x','r'].includes(key)){
      event.preventDefault();keys.add(key);
      if(!event.repeat){if(key==='z')jump=true;if(key==='x')dash=true;if(key==='r'&&(!network||!state.finished))reset=true;}
    }
  });
  window.addEventListener('keyup',event=>keys.delete(event.key.toLowerCase()));window.addEventListener('blur',clear);document.addEventListener('visibilitychange',clear);
  function button(id,isJump){const element=$(id);element.addEventListener('pointerdown',event=>{event.preventDefault();if(!active)return;element.setPointerCapture(event.pointerId);if(isJump){jump=true;touchJump=true;}else dash=true;canvas.focus({preventScroll:true});});for(const type of ['pointerup','pointercancel','lostpointercapture'])element.addEventListener(type,()=>{if(isJump)touchJump=false;});}
  button('practiceJump',true);button('practiceDash',false);
  $('practiceRestart').addEventListener('click',()=>{if(network)reset=true;else state=createParkourState(level);canvas.focus({preventScroll:true});});
  function practiceCourse(){level=$('practiceCourse').value==='mechanisms'?MECHANISM_LEVEL:PRACTICE_LEVEL;$('practiceCheckpoint').replaceChildren(...level.checkpoints.map((p,i)=>Object.assign(document.createElement('option'),{value:String(i),textContent:p.name})));state=createParkourState(level);clear();canvas.focus({preventScroll:true});}
  $('practiceCourse').addEventListener('change',()=>{if(!network)practiceCourse();});
  $('practiceCheckpoint').addEventListener('change',()=>{if(network)return;state=createParkourState(level,Number($('practiceCheckpoint').value));clear();canvas.focus({preventScroll:true});});
  canvas.addEventListener('pointerdown',()=>canvas.focus({preventScroll:true}));
  $('spectateTarget').addEventListener('change',event=>followId=event.target.value);
  function render(now,elapsed){
    $('practiceCourse').hidden=!!network;
    const watching=network?.kind==='race'&&serverFinished&&phase==='racing',available=watching?peers.filter(p=>p.id!==options.self()&&!p.finished):[];
    if(!available.some(p=>p.id===followId))followId=available[0]?.id||'';
    const target=watching&&available.find(p=>p.id===followId),signature=JSON.stringify(available.map(p=>[p.id,p.name]));
    $('spectateControl').hidden=!watching||!available.length;
    if(signature!==spectatorSignature){spectatorSignature=signature;$('spectateTarget').replaceChildren(...available.map(p=>Object.assign(document.createElement('option'),{value:p.id,textContent:p.name})));}
    $('spectateTarget').value=followId;
    const zoom=width<600?.95:Math.min(1.45,width/760),vw=width/zoom,vh=height/zoom;
    const focus=target||state,cameraX=Math.max(0,Math.min(Math.max(0,level.width-vw),focus.x-vw*.35)),cameraY=Math.max(0,Math.min(Math.max(0,level.height-vh),focus.y-vh*.58));
    ctx.setTransform(dpr,0,0,dpr,0,0);drawSky(ctx,width,height,cameraX);ctx.save();ctx.scale(zoom,zoom);ctx.translate(-cameraX,-cameraY);ctx.imageSmoothingEnabled=false;drawCourse(ctx,level,now,reduced,target?.mechanisms?.crystals||state.crystals,target?.mechanisms||state);
    for(const peer of peers){
      if(peer.id===options.self())continue;const old=poses.get(peer.id)||peer,target={...peer,x:peer.x+Math.max(-10,Math.min(10,peer.vx*.025)),y:peer.y};
      const t=Math.hypot(old.x-peer.x,old.y-peer.y)>96?1:1-Math.exp(-elapsed/.05),pose={...peer,x:old.x+(target.x-old.x)*t,y:old.y+(target.y-old.y)*t};poses.set(peer.id,pose);
      drawRunner(ctx,pose,{color:peer.color,name:peer.name,now,reduced,alpha:.8});
    }
    if(!reduced&&state.dashTime>0){trail.push({...state,at:now});trail=trail.slice(-4);}trail=trail.filter(p=>now-p.at<90);
    for(const p of trail)drawRunner(ctx,p,{color:options.color(),now:p.at,reduced:true,alpha:.12*(1-(now-p.at)/90)});
    drawRunner(ctx,state,{color:options.color(),now,reduced});
    const bubbles=peers.filter(p=>p.id!==options.self()).map(p=>({...p,x:p.x+8,y:p.y+24,...(options.speech(p.id)||{text:'',at:-Infinity})}));
    const speech=options.speech();bubbles.push({...(speech||{text:'',at:-Infinity}),id:options.self(),x:state.x+8,y:state.y+24});drawBubbles(ctx,bubbles,now,{x:cameraX,y:cameraY,w:vw,h:vh},options.self());ctx.restore();
    let title='',subtitle='';
    if(!network&&paused){title='已暂停';subtitle='回到画面继续';}
    else if(network&&phase==='countdown'){title=String(Math.max(1,Math.ceil((startsAt-(Date.now()+clockOffset))/1000)));subtitle='准备出发';}
    else if(state.finished&&!target){title=network?.kind==='verify'?(verified?'验证通过':'抵达，正在确认…'):'抵达！';subtitle=network?.kind==='verify'?'返回编辑，等大家验证完成':`${state.time.toFixed(1)} 秒 · ${state.deaths} 次失误`;}
    if(network&&phase==='results'){title='本轮结束';subtitle=results.map((r,i)=>`${i+1}. ${r.name} ${r.time.toFixed(1)}s`).join('   ')||'本轮无人抵达终点';}
    if(title){ctx.fillStyle='#183247a8';ctx.fillRect(0,0,width,height);ctx.textAlign='center';ctx.fillStyle='#f1edda';ctx.font='600 25px "Microsoft YaHei",sans-serif';ctx.fillText(title,width/2,height/2-12);ctx.font='13px "Microsoft YaHei",sans-serif';subtitle.split('   ').forEach((line,i)=>ctx.fillText(line,width/2,height/2+18+i*22));}
    const time=network?.kind==='race'?Math.max(0,(Date.now()+clockOffset-startsAt)/1000):state.time;
    $('practiceStats').textContent=target?`已抵达 · 观战 ${target.name}`:`${(state.finished?state.time:time).toFixed(1)}s · ${state.deaths} 次失误`;
    $('practiceRestart').disabled=!!network&&state.finished;
    $('practiceStage').textContent=network?.kind==='race'?`${state.checkpoint+1} / ${level.checkpoints.length}`:level.checkpoints[state.checkpoint].name;
    canvas.setAttribute('aria-label',`${network?.kind==='race'?'跑酷竞速':network?'关卡验证':'跑酷练习'}，${state.finished?'已抵达终点':phase==='countdown'?'倒计时':'进行中'}`);
  }
  function frame(now){
    const elapsed=Math.min(.06,Math.max(0,(now-last)/1000));last=now;
    if(active){
      paused=blocked();if(paused)clear();const racing=!network||network.kind==='verify'||phase==='racing';
      if(racing&&(!paused||network)&&options.online()){
        accumulator+=elapsed;const stick=paused?{x:0,y:0}:options.stick();
        const x=paused?0:Math.sign((keys.has('d')||keys.has('arrowright')?1:0)-(keys.has('a')||keys.has('arrowleft')?1:0)+(Math.abs(stick.x)>.2?stick.x:0));
        const y=paused?0:Math.sign((keys.has('s')||keys.has('arrowdown')?1:0)-(keys.has('w')||keys.has('arrowup')?1:0)+(Math.abs(stick.y)>.2?stick.y:0));
        while(accumulator>=STEP){
          const input={x,y,jumpPressed:jump,jumpHeld:!paused&&(touchJump||keys.has('z')),dashPressed:dash,reset};
          if(reset){if(network)state.deaths++;respawn(state,level);}
          if(network&&!state.finished){const flags=(input.jumpHeld?1:0)|(jump?2:0)|(dash?4:0)|(reset?8:0),item={seq:++seq,input};pending.push(item);outgoing.push([seq,x,y,flags]);if(pending.length>240)pending=pending.slice(-240);}
          stepParkour(state,input,STEP,level);jump=false;dash=false;reset=false;accumulator-=STEP;
        }
      }
      if(network&&options.online()&&outgoing.length&&now-lastSend>=33){options.send('parkour:input',{id:network.id,frames:outgoing.splice(0,16)});lastSend=now;}
      render(now,elapsed);
    }requestAnimationFrame(frame);
  }requestAnimationFrame(frame);
  return {
    start(){network=null;serverFinished=false;followId='';practiceCourse();active=true;phase='';trail=[];clear();last=performance.now();canvas.focus({preventScroll:true});},
    run(data){const resuming=active&&network?.id===data.id;network={id:data.id,kind:data.kind,players:new Map(data.players.map(p=>[p.id,p]))};level=data.level;state=copy(data.state);serverFinished=!!data.state.finished;if(!resuming)followId='';seq=data.ack||0;pending=[];outgoing=[];poses.clear();peers=[];phase=data.phase;startsAt=data.startsAt;verified=!!data.verified;active=true;trail=[];if(!resuming)clear();else accumulator=0;last=performance.now();canvas.focus({preventScroll:true});},
    reconcile(data){if(!active||!network||data.id!==network.id)return;serverFinished=!!data.state.finished;phase=data.phase;startsAt=data.startsAt;clockOffset=data.serverNow-Date.now();peers=data.racers.map(([id,x,y,vx,vy,flags,facing,checkpoint])=>({...network.players.get(id),id,x,y,vx,vy,facing,checkpoint,grounded:!!(flags&1),dash:flags&2?1:0,dashTime:flags&4?.1:0,dead:flags&8?.1:0,finished:!!(flags&16),wallSide:flags&32?-1:flags&64?1:0}));for(const [id,packed] of data.mechanismPeers||[]){const peer=peers.find(p=>p.id===id);if(peer)peer.mechanisms=copy(packed);}results=data.results;pending=pending.filter(p=>p.seq>data.ack);state=copy(data.state);for(const p of pending){if(p.input.reset){state.deaths++;respawn(state,level);}stepParkour(state,p.input,STEP,level);}},
    verified(){verified=true;},stop(){active=false;network=null;pending=[];outgoing=[];poses.clear();$('spectateControl').hidden=true;clear();}
  };
}
