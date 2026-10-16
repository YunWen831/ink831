import {randomUUID} from 'node:crypto';
import {canonicalMap,emptyMap,mapLevel,composeMaps} from '../../courtyard/parkour-map.js';
import {createParkourState,stepParkour,respawn,STEP} from '../../courtyard/parkour-physics.js';

const wireState=state=>{
  const packed={};for(const [key,value] of Object.entries(state))if(key!=='crystals')packed[key]=typeof value==='number'?Math.round(value*10000)/10000:value;
  packed.crystalCharges=state.crystals.flatMap((time,index)=>time>0?[[index,Math.round(time*1000)/1000]]:[]);return packed;
};

export class ParkourMatch{
  constructor(members,{send,changed,now=()=>performance.now(),clock=Date.now}={}){
    this.send=send;this.changed=changed;this.now=now;this.clock=clock;this.phase='building';this.drafts=new Map();this.sessions=new Map();this.level=null;this.startedAt=0;this.elapsed=0;this.last=now();this.accumulator=0;this.lastSnapshot=0;
    members.forEach(p=>this.drafts.set(p.id,{id:p.id,name:p.name,color:p.color,cells:canonicalMap(emptyMap()),revision:0,verified:false}));
  }
  status(){return {phase:this.phase,startsAt:this.startedAt,players:[...this.drafts.values()].map(({id,name,color,verified})=>({id,name,color,verified,testing:this.sessions.get(id)?.kind==='verify'})),results:this.results||[]};}
  notify(){this.changed?.();for(const id of this.drafts.keys())this.send(id,'parkour:status',this.status());}
  workshop(id){const draft=this.drafts.get(id);if(draft)this.send(id,'parkour:workshop',{...draft,...this.status()});}
  edit(id,cells){
    if(this.phase!=='building')return false;
    const draft=this.drafts.get(id);if(!draft)return false;
    cells=canonicalMap(cells);
    if(cells!==draft.cells){Object.assign(draft,{cells,revision:draft.revision+1,verified:false});this.sessions.delete(id);}
    this.workshop(id);this.notify();return true;
  }
  newSession(kind,id,level,runId=randomUUID()){
    const run={id:runId,kind,level,state:createParkourState(level),ack:0,received:0,queue:[],input:{},inputAt:this.now(),finishAt:null};this.sessions.set(id,run);return run;
  }
  open(id){
    const run=this.sessions.get(id);
    if(run)this.send(id,'parkour:run',{id:run.id,kind:run.kind,level:run.level,state:wireState(run.state),ack:run.ack,phase:this.phase,startsAt:this.startedAt,players:this.status().players,verified:!!this.drafts.get(id)?.verified});
    else this.workshop(id);
    this.send(id,'parkour:status',this.status());
  }
  verify(id,revision){
    const draft=this.drafts.get(id);if(this.phase!=='building'||!draft||revision!==draft.revision)return false;
    this.newSession('verify',id,mapLevel(draft.cells,draft.name));this.open(id);this.notify();return true;
  }
  stop(id){if(this.phase!=='building')return;this.sessions.delete(id);this.workshop(id);this.notify();}
  invalidate(id){const draft=this.drafts.get(id);if(this.phase==='building'&&draft?.verified){draft.verified=false;this.notify();}}
  canLaunch(online){return ['building','results'].includes(this.phase)&&this.drafts.size>=2&&this.drafts.size<=4&&[...this.drafts.values()].every(d=>d.verified&&online(d.id));}
  launch(online){
    if(!this.canLaunch(online))return false;
    this.level=composeMaps([...this.drafts.values()]);this.phase='countdown';this.startedAt=this.clock()+3000;this.results=[];this.sessions.clear();const id=randomUUID();
    for(const key of this.drafts.keys()){this.newSession('race',key,this.level,id);this.open(key);}
    this.notify();return true;
  }
  input(id,message){
    const run=this.sessions.get(id);if(!run||run.id!==message?.id||!Array.isArray(message.frames)||message.frames.length>16||run.state.finished)return;
    if(run.kind==='race'&&this.phase!=='racing')return;
    for(const frame of message.frames){
      if(!Array.isArray(frame)||frame.length!==4)continue;
      const [seq,x,y,flags]=frame;
      if(!Number.isSafeInteger(seq)||seq<=run.received||seq>run.received+250||![-1,0,1].includes(x)||![-1,0,1].includes(y)||!Number.isInteger(flags)||flags<0||flags>15)continue;
      run.received=seq;if(run.queue.length<60)run.queue.push({seq,x,y,jumpHeld:!!(flags&1),jumpPressed:!!(flags&2),dashPressed:!!(flags&4),reset:!!(flags&8)});
    }
    run.inputAt=this.now();
  }
  remove(id){
    this.drafts.delete(id);this.sessions.delete(id);if(this.phase==='racing')this.checkFinished();this.notify();
  }
  tick(){
    const now=this.now(),elapsed=Math.min(.1,Math.max(0,(now-this.last)/1000));this.last=now;
    if(this.phase==='countdown'&&this.clock()>=this.startedAt){this.phase='racing';this.accumulator=0;this.notify();}
    this.accumulator+=elapsed;
    while(this.accumulator>=STEP){
      this.accumulator-=STEP;
      for(const [id,run] of this.sessions){
        if(run.state.finished||run.kind==='race'&&this.phase!=='racing')continue;
        const frame=run.queue.shift();
        if(frame){run.ack=frame.seq;run.input=frame;}else run.input={...run.input,jumpPressed:false,dashPressed:false,reset:false};
        if(now-run.inputAt>180)run.input={};
        if(run.input.reset){run.state.deaths++;respawn(run.state,run.level);}
        stepParkour(run.state,run.input,STEP,run.level);
        if(run.state.finished){
          if(run.kind==='verify'){
            const draft=this.drafts.get(id);if(draft){draft.verified=true;this.send(id,'parkour:verified',{revision:draft.revision});}this.notify();
          }else{run.finishAt=Math.max(0,(this.clock()-this.startedAt)/1000);this.results.push({id,name:this.drafts.get(id)?.name||'玩家',time:run.finishAt,deaths:run.state.deaths});this.checkFinished();this.notify();}
        }
      }
    }
    if(this.phase==='racing'&&this.clock()-this.startedAt>10*60*1000){this.phase='results';this.notify();}
    if(now-this.lastSnapshot>=50){this.lastSnapshot=now;this.snapshot();}
  }
  checkFinished(){if(this.sessions.size&&[...this.sessions.values()].filter(r=>r.kind==='race').every(r=>r.state.finished)){this.phase='results';}}
  snapshot(){
    const racers=[...this.sessions].filter(([,r])=>r.kind==='race').map(([id,{state:s}])=>[id,Math.round(s.x*100)/100,Math.round(s.y*100)/100,Math.round(s.vx),Math.round(s.vy),(s.grounded?1:0)|(s.dash?2:0)|(s.dashTime>0?4:0)|(s.dead>0?8:0)|(s.finished?16:0)|(s.wallSide<0?32:s.wallSide>0?64:0),s.facing,s.checkpoint]);
    for(const [id,run] of this.sessions)this.send(id,'parkour:state',{id:run.id,state:wireState(run.state),ack:run.ack,phase:this.phase,startsAt:this.startedAt,racers:run.kind==='race'?racers:[],results:this.results||[],serverNow:this.clock()});
  }
}
