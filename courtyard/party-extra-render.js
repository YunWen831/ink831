import {FLOOR_TYPES,POWERS,BUTTON_EFFECTS} from './party-rules.js?v=0.16.0';
import {rigImage} from './avatar-render.js?v=0.16.0';
export function drawExtra(ctx,state,now,{rect,circle,text,self}){
  const e=state.extra;if(!e)return;
  if(['floor','remote'].includes(state.game)){
    rect(0,0,960,600,state.game==='floor'?'#dbdfc7':e.power==='ice'?'#b5e0e8':e.power==='giant'?'#f5d9ad':'#d8d6ed');
    for(let row=0;row<7;row++)for(let col=0;col<12;col++)rect(96+col*64,76+row*64,63,63,(col+row)%2?'#eef0d9':'#e4e9cf');
    const colors={ice:'#8bd4ed',boost:'#abd36c',bounce:'#efb080',warp:'#bd9ce0'},icons={ice:'冰',boost:'➜',bounce:'↗',warp:'◎'};
    for(const t of e.tiles){rect(97+t.col*64,77+t.row*64,61,61,colors[t.type]);text(icons[t.type],128+t.col*64,119+t.row*64,27,'#345b59');}
    if(state.game==='floor')text(e.stage==='build'?'先放地砖 · '+Math.ceil(e.buildLeft)+'s':'抢星星',480,45,25);
    else text((state.players.find(p=>p.id===e.controller)?.name||'')+' 掌控遥控器'+(e.power?' · '+POWERS[e.power]:''),480,45,24);
    if(e.stage==='collect')for(const star of e.stars){const r=12+Math.sin(now/220+star.id)*1.5;ctx.fillStyle='#f5c64f';ctx.strokeStyle='#ba9445';ctx.lineWidth=2;ctx.beginPath();for(let i=0;i<10;i++){const a=i*Math.PI/5-Math.PI/2,rad=i%2?r*.45:r;const x=star.x+Math.cos(a)*rad,y=star.y+Math.sin(a)*rad;if(!i)ctx.moveTo(x,y);else ctx.lineTo(x,y);}ctx.closePath();ctx.fill();ctx.stroke();}
    return;
  }
  const choose=e.stage==='choose';rect(0,0,960,600,state.game==='wish'?'#d5e4e2':state.game==='buttons'?'#dce3ed':'#e8e0d0');
  text('第 '+(state.turn+1)+' / 6 次 · '+(choose?'秘密选择':'揭晓')+' '+Math.ceil(e.turnLeft)+'s',480,62,24);
  if(state.game==='wish'){circle(480,220,112,'#a4c9c8');circle(480,220,89,'#548d9f');circle(480,220,60,'#82b9bf');text(choose?'写下你的愿望':'愿望生效了',480,225,29,'#fff8de');text('先加减，再按顺序交换',480,350,22);}
  if(state.game==='buttons'){for(let i=0;i<3;i++){const x=260+i*220;rect(x-75,225,150,70,'#72828d');circle(x,225,53,['#d87969','#699ac1','#e5c462'][i]);circle(x-10,214,18,'#ffffff44');text(['红','蓝','黄'][i],x,232,26,'#fffdf0');text(choose?'?':BUTTON_EFFECTS[e.effects?.[i]]||'',x,335,21);}text(choose?'每人掌握不同线索，可聊天交流':'按钮效果已公开',480,135,26);}
  if(state.game==='follow'){text('恰好 '+e.required+' 人',480,160,36);text('「'+e.prompt+'」',480,230,34);if(!choose)text(e.message,480,295,24);}
  for(const p of state.players){const x=480+(p.index-(state.players.length-1)/2)*205,reveal=e.reveal.find(r=>r.id===p.id),did=reveal?.choice==='执行',shift=did&&state.game==='follow'?Math.sin(now/170)*13:0;
    circle(x,455,43,p.id===self()?'#fff0ae':'#ffffff77');ctx.drawImage(rigImage(null,p.color,'down',now/200,did?1:0),x-25+shift,388,50,70);text(p.name+(p.id===self()?' · 你':''),x,490,20);text(p.value+' 分',x,523,23);text(choose?'等待揭晓':(reveal?.choice||'')+' '+(reveal?.text||''),x,560,18);}
}
