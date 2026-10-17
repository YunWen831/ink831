const sounds={dash:[220,330],hit:[130,90],fall:[180,110,65],pickup:[440,660],delivery:[523,659,784],repair:[440,554,740],pump:[220,294],treasure:[440,659,880],cash:[523,784],collapse:[160,100,60],bonus:[659,880],large:[220,330],start:[440,660],round:[523,659,784]};
export function createPartyFeedback(button,active){
  let enabled=true,context=null,lastTone=0,effects=[],lastEvent=0,match='';
  const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
  try{enabled=localStorage.getItem('dungeon-mail-party-sound')!=='off';}catch{}
  function label(){button.textContent=enabled?'声音开':'声音关';button.setAttribute('aria-pressed',String(enabled));button.setAttribute('aria-label',enabled?'关闭派对音效':'开启派对音效');}
  function unlock(){if(!active()||!enabled)return;try{const C=window.AudioContext||window.webkitAudioContext;if(C&&!context)context=new C();if(context?.state==='suspended')context.resume().catch(()=>{});}catch{}}
  button.addEventListener('click',()=>{enabled=!enabled;try{localStorage.setItem('dungeon-mail-party-sound',enabled?'on':'off');}catch{}label();if(enabled)unlock();});
  window.addEventListener('pointerdown',unlock);window.addEventListener('keydown',unlock);label();
  function tone(kind){if(!enabled||!context||context.state!=='running'||document.hidden||performance.now()-lastTone<65)return;lastTone=performance.now();
    try{for(const [i,f] of (sounds[kind]||[]).entries()){const oscillator=context.createOscillator(),gain=context.createGain(),at=context.currentTime+i*.065;oscillator.type=['hit','fall','collapse'].includes(kind)?'triangle':'sine';oscillator.frequency.setValueAtTime(f,at);gain.gain.setValueAtTime(.0001,at);gain.gain.exponentialRampToValueAtTime(.045,at+.012);gain.gain.exponentialRampToValueAtTime(.0001,at+.14);oscillator.connect(gain);gain.connect(context.destination);oscillator.start(at);oscillator.stop(at+.15);}}catch{}
  }
  return {
    ingest(data,self){if(match!==data.id){match=data.id;lastEvent=Math.max(0,...(data.events||[]).map(e=>e.id));effects=[];return;}
      for(const e of data.events||[]){if(e.id<=lastEvent)continue;lastEvent=e.id;if(data.time-e.at>1)continue;const own=e.actor===self||e.target===self||e.partners?.includes(self),global=['treasure','collapse','bonus','large','start','round'].includes(e.kind);
        effects.push({...e,x:e.x??480,y:e.y??280,own,born:performance.now()});if(own||global)tone(e.kind);if(own&&['hit','fall'].includes(e.kind)&&!reduced&&enabled)try{navigator.vibrate?.(18);}catch{}
      }effects=effects.slice(-32);
    },
    draw(ctx,now){effects=effects.filter(e=>now-e.born<950);for(const e of effects){const t=(now-e.born)/950,good=['delivery','repair','cash','treasure','round'].includes(e.kind),color=good?'#ffe274':['hit','fall','collapse'].includes(e.kind)?'#ed967b':'#c7f4ee';ctx.save();ctx.globalAlpha=1-t;
        if(e.kind==='repair'){ctx.fillStyle='#bb925a';ctx.fillRect(e.x-24,e.y-10,48,13);ctx.fillRect(e.x-24,e.y+7,48,13);}
        ctx.strokeStyle=color;ctx.lineWidth=3;ctx.beginPath();ctx.arc(e.x,e.y,15+(reduced?0:t*42),0,Math.PI*2);ctx.stroke();
        if(!reduced)for(let i=0;i<8;i++){const a=i*Math.PI/4+e.id*.7,r=t*65,x=e.x+Math.cos(a)*r,y=e.y+Math.sin(a)*r-t*20;ctx.fillStyle=color;if(['delivery','cash','treasure'].includes(e.kind)){ctx.beginPath();ctx.arc(x,y,5,0,Math.PI*2);ctx.fill();ctx.strokeStyle='#c99839';ctx.lineWidth=1;ctx.stroke();}else ctx.fillRect(x-3,y-3,6,6);}
        if(e.text){ctx.font='bold 20px "Microsoft YaHei",sans-serif';ctx.textAlign='center';ctx.fillStyle='#244e44';ctx.fillText(e.text,e.x,e.y-38-(reduced?0:t*32));}ctx.restore();}
    },
    shake(now){return !reduced&&effects.some(e=>e.own&&['hit','fall'].includes(e.kind)&&now-e.born<160)?Math.sin(now*.12)*3:0;},
    clear(){effects=[];match='';lastEvent=0;}
  };
}
