import { PRACTICE_LEVEL as level } from './parkour-level.js?v=0.4.0';
import { createParkourState, stepParkour, respawn, STEP, BODY } from './parkour-physics.js?v=0.4.0';
import { drawBubbles } from './bubbles.js?v=0.4.0';

export function createPractice(canvas,options){
  const ctx=canvas.getContext('2d'),keys=new Set(),$=id=>document.getElementById(id);
  let active=false,state=createParkourState(level),last=0,accumulator=0,jump=false,dash=false,touchJump=false,width=960,height=640,dpr=1,paused=false;
  const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
  new ResizeObserver(()=>{const box=canvas.getBoundingClientRect();width=box.width;height=box.height;dpr=Math.min(devicePixelRatio||1,2);canvas.width=Math.round(width*dpr);canvas.height=Math.round(height*dpr);}).observe(canvas);
  function clear(){keys.clear();jump=false;dash=false;touchJump=false;accumulator=0;}
  const blocked=()=>document.hidden||!options.online()||!!document.querySelector('dialog[open]')||/INPUT|TEXTAREA|SELECT/.test(document.activeElement?.tagName);
  window.addEventListener('keydown',event=>{
    if(!active||blocked()||event.ctrlKey||event.metaKey||event.altKey)return;
    const key=event.key.toLowerCase();
    if(['a','d','w','s','arrowleft','arrowright','arrowup','arrowdown',' ','z','shift','x','r'].includes(key)){
      event.preventDefault();keys.add(key);
      if(!event.repeat){if(key===' '||key==='z')jump=true;if(key==='shift'||key==='x')dash=true;if(key==='r'){respawn(state,level);clear();}}
    }
  });
  window.addEventListener('keyup',event=>keys.delete(event.key.toLowerCase()));
  window.addEventListener('blur',clear);document.addEventListener('visibilitychange',clear);
  function button(id,isJump){
    const element=$(id);
    element.addEventListener('pointerdown',event=>{event.preventDefault();if(!active)return;element.setPointerCapture(event.pointerId);if(isJump){jump=true;touchJump=true;}else dash=true;canvas.focus({preventScroll:true});});
    for(const type of ['pointerup','pointercancel','lostpointercapture'])element.addEventListener(type,()=>{if(isJump)touchJump=false;});
  }
  button('practiceJump',true);button('practiceDash',false);
  $('practiceRestart').addEventListener('click',()=>{state=createParkourState(level);clear();canvas.focus({preventScroll:true});});
  $('practiceCheckpoint').addEventListener('change',()=>{state=createParkourState(level,Number($('practiceCheckpoint').value));clear();canvas.focus({preventScroll:true});});
  canvas.addEventListener('pointerdown',()=>canvas.focus({preventScroll:true}));
  function render(now){
    const zoom=width<600?.85:Math.min(1.25,width/850),vw=width/zoom,vh=height/zoom;
    const cameraX=Math.max(0,Math.min(Math.max(0,level.width-vw),state.x-vw*.35));
    const cameraY=Math.max(0,Math.min(Math.max(0,level.height-vh),state.y-vh*.58));
    ctx.setTransform(dpr,0,0,dpr,0,0);
    const sky=ctx.createLinearGradient(0,0,0,height);sky.addColorStop(0,'#1e334d');sky.addColorStop(1,'#8badad');ctx.fillStyle=sky;ctx.fillRect(0,0,width,height);
    for(let layer=0;layer<2;layer++){
      ctx.fillStyle=layer?'#6b919b77':'#b7cac447';ctx.beginPath();ctx.moveTo(0,height);
      for(let i=-1;i<8;i++){const x=i*230-(cameraX*(layer?.12:.06)%230);ctx.lineTo(x,height*(layer?.7:.5));ctx.lineTo(x+110,height*(layer?.34:.16)+(i%2)*38);}
      ctx.lineTo(width,height);ctx.fill();
    }
    ctx.save();ctx.scale(zoom,zoom);ctx.translate(-cameraX,-cameraY);ctx.imageSmoothingEnabled=false;
    for(const r of level.solids){
      ctx.fillStyle='#354f60';ctx.fillRect(r.x,r.y,r.w,r.h);ctx.fillStyle='#97bab6';ctx.fillRect(r.x,r.y,r.w,5);ctx.fillStyle='#bed4c4';ctx.fillRect(r.x,r.y,r.w,2);
      ctx.strokeStyle='#496979';ctx.lineWidth=1;for(let x=r.x+24;x<r.x+r.w;x+=24){ctx.beginPath();ctx.moveTo(x,r.y+6);ctx.lineTo(x,r.y+r.h);ctx.stroke();}
    }
    for(const r of level.hazards){ctx.fillStyle='#e3a9a5';for(let x=r.x;x<r.x+r.w;x+=12){ctx.beginPath();ctx.moveTo(x,r.y+r.h);ctx.lineTo(x+6,r.y);ctx.lineTo(Math.min(x+12,r.x+r.w),r.y+r.h);ctx.fill();}}
    for(let i=0;i<level.checkpoints.length;i++){const c=level.checkpoints[i];ctx.fillStyle='#d3ded0';ctx.fillRect(c.x+5,c.y-18,2,42);ctx.fillStyle=i<=state.checkpoint?'#edce8d':'#738e9a';ctx.beginPath();ctx.moveTo(c.x+7,c.y-18);ctx.lineTo(c.x+27,c.y-12);ctx.lineTo(c.x+7,c.y-5);ctx.fill();}
    level.crystals.forEach((c,i)=>{ctx.save();ctx.globalAlpha=state.crystals[i]>.0?.22:1;ctx.translate(c.x,c.y+(reduced?0:Math.sin(now/330)*3));ctx.fillStyle='#a6eed4';ctx.beginPath();ctx.moveTo(0,-12);ctx.lineTo(9,0);ctx.lineTo(0,12);ctx.lineTo(-9,0);ctx.fill();ctx.strokeStyle='#e2fff0';ctx.stroke();ctx.restore();});
    ctx.fillStyle='#e4c58e';ctx.fillRect(level.goal.x,level.goal.y,4,48);ctx.fillRect(level.goal.x+4,level.goal.y,27,19);
    ctx.font='12px "Microsoft YaHei",sans-serif';ctx.textAlign='left';ctx.fillStyle='#e0ebdf';for(const sign of level.signs)ctx.fillText(sign.text,sign.x,sign.y);
    if(state.dead<=0){
      if(!reduced&&state.dashTime>0){ctx.fillStyle='#a6eed450';ctx.fillRect(state.x-state.vx*.025,state.y-state.vy*.025,BODY.w,BODY.h);}
      const x=Math.round(state.x),y=Math.round(state.y),swing=reduced?0:state.grounded?Math.sin(state.x*.15)*3:2;
      ctx.fillStyle='#273c50';ctx.fillRect(x+2,y+17+swing,5,7);ctx.fillRect(x+9,y+17-swing,5,7);
      ctx.fillStyle=options.color()||'#cf9981';ctx.fillRect(x,y+7,16,12);ctx.fillStyle=state.dash?'#d1ede0':'#b4bac9';ctx.fillRect(x-1,y-2,18,9);ctx.fillStyle='#efd3ac';ctx.fillRect(x+2,y+1,12,9);ctx.fillStyle='#2b424f';ctx.fillRect(x+(state.facing>0?11:3),y+3,2,3);
      ctx.fillStyle=state.dash?'#c1efdb':'#d7abb0';ctx.fillRect(x-3,y+10,22,3);
      const speech=options.speech();if(speech)drawBubbles(ctx,[{...speech,id:'self',x:x+8,y:y+24}],now,{x:cameraX,y:cameraY,w:vw,h:vh},'self');
    }
    ctx.restore();
    if(paused||state.finished){ctx.fillStyle='#183247a8';ctx.fillRect(0,0,width,height);ctx.textAlign='center';ctx.fillStyle='#f1edda';ctx.font='600 25px "Microsoft YaHei",sans-serif';ctx.fillText(state.finished?'抵达！':'已暂停',width/2,height/2-12);ctx.font='14px "Microsoft YaHei",sans-serif';ctx.fillText(state.finished?`${state.time.toFixed(1)} 秒 · ${state.deaths} 次重试`:'回到画面继续',width/2,height/2+18);}
    $('practiceStats').textContent=`${state.time.toFixed(1)}s · ${state.deaths} 次重试`;
    $('practiceStage').textContent=level.checkpoints[state.checkpoint].name;
    canvas.setAttribute('aria-label',`跑酷练习，${level.checkpoints[state.checkpoint].name}，${state.finished?'已抵达终点':paused?'已暂停':'进行中'}`);
  }
  function frame(now){
    if(active){
      paused=blocked();const elapsed=Math.min(.06,Math.max(0,(now-last)/1000));last=now;
      if(paused){clear();}else{
        accumulator+=elapsed;const stick=options.stick();
        const x=(keys.has('d')||keys.has('arrowright')?1:0)-(keys.has('a')||keys.has('arrowleft')?1:0)+stick.x;
        const y=(keys.has('s')||keys.has('arrowdown')?1:0)-(keys.has('w')||keys.has('arrowup')?1:0)+stick.y;
        while(accumulator>=STEP){stepParkour(state,{x,y,jumpPressed:jump,jumpHeld:touchJump||keys.has(' ')||keys.has('z'),dashPressed:dash},STEP,level);jump=false;dash=false;accumulator-=STEP;}
      }
      render(now);
    }else last=now;
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
  return {start(){state=createParkourState(level);active=true;clear();last=performance.now();canvas.focus({preventScroll:true});},stop(){active=false;clear();}};
}
