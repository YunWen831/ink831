import {randomUUID} from 'node:crypto';
import {isRelay,RELAY_MAX,relaySteps,relayKind,validDrawing} from '../../courtyard/relay-rules.js?v=0.16.3';
import {relayOrder} from './relay-order.js';
import {cleanText} from './world-store.js';

export class RelayMatch{
  constructor(members,{mode,send,connected=()=>true,host=()=>members[0]?.id,changed=()=>{},now=()=>performance.now()}={}){
    if(!isRelay(mode)||members.length<2||members.length>RELAY_MAX||new Set(members.map(p=>p.id)).size!==members.length)throw Error('Invalid relay');
    this.id=randomUUID();this.mode=mode;this.members=members;this.send=send;this.connected=connected;this.host=host;this.changed=changed;this.now=now;
    this.steps=relaySteps(mode,members.length);this.books=members.map(p=>({owner:p.id,pages:[]}));this.drafts=new Map();this.step=0;this.phase='writing';this.setDeadline();this.lastClock=-1;
  }
  setDeadline(){this.deadline=this.now()+(relayKind(this.mode,this.step)==='drawing'?180000:this.mode==='story'?90000:60000);}
  book(id){const seat=this.members.findIndex(p=>p.id===id);if(seat<0)return null;if(!this.routes&&this.step===0)this.routes=relayOrder(this.members.length,this.steps);return this.books[this.routes?.[this.step]?.[seat]??(seat-this.step%this.members.length+this.members.length)%this.members.length];}
  context(id,data){return this.phase==='writing'&&this.connected(id)&&!!this.book(id)&&data?.id===this.id&&data.step===this.step;}
  save(id,data){
    if(!this.context(id,data)||!Number.isSafeInteger(data.revision)||data.revision<1||data.revision>100000)return false;
    const old=this.drafts.get(id);if(old?.submitted||data.revision<=(old?.revision||0))return false;
    const kind=relayKind(this.mode,this.step);let value;
    if(kind==='drawing'){if(!validDrawing(data.value)||JSON.stringify(data.value).length>80000)return false;value=structuredClone(data.value);}
    else{if(typeof data.value!=='string'||Array.from(data.value).length>(this.mode==='story'?500:100))return false;value=cleanText(data.value,this.mode==='story'?500:100);}
    this.drafts.set(id,{revision:data.revision,value,submitted:false});return true;
  }
  submit(id,data){
    const draft=this.drafts.get(id);if(!this.context(id,data)||!draft||draft.revision!==data.revision||draft.submitted||!draft.value.length)return false;
    draft.submitted=true;this.lastClock=-1;this.advanceIfReady();return true;
  }
  advanceIfReady(){if(this.members.every(p=>!this.connected(p.id)||this.drafts.get(p.id)?.submitted)&&this.members.filter(p=>this.connected(p.id)).length>=2)this.advance();}
  advance(){
    if(this.phase!=='writing')return;
    for(const p of this.members){const draft=this.drafts.get(p.id);this.book(p.id).pages.push({author:p.id,kind:relayKind(this.mode,this.step),value:draft?.value??(relayKind(this.mode,this.step)==='drawing'?[]:''),skipped:!draft?.submitted});}
    this.step++;this.drafts.clear();if(this.step>=this.steps)this.phase='final';else this.setDeadline();this.publish();this.changed();
  }
  tick(){if(this.phase==='final'){const reveal=this.revealState(),key=JSON.stringify(reveal);if(key!==this.lastRevealClock){this.lastRevealClock=key;for(const p of this.members)if(this.connected(p.id))this.send(p.id,'relay:clock',{id:this.id,step:this.step,phase:'final',reveal});}return;}if(this.phase!=='writing')return;const second=Math.ceil((this.deadline-this.now())/1000);if(second<=0){this.advance();return;}if(second!==this.lastClock){this.lastClock=second;for(const p of this.members)if(this.connected(p.id))this.send(p.id,'relay:clock',{id:this.id,step:this.step,remaining:second,ready:this.members.filter(p=>this.drafts.get(p.id)?.submitted).length,online:this.members.filter(p=>this.connected(p.id)).length});}this.advanceIfReady();}
  snapshot(id){
    if(!this.members.some(p=>p.id===id))return null;
    const base={id:this.id,mode:this.mode,phase:this.phase,step:this.step,steps:this.steps,members:this.members,host:this.host(),remaining:Math.max(0,Math.ceil((this.deadline-this.now())/1000))};
    if(this.phase==='final')return {...base,reveal:this.revealState(),books:this.books.map(b=>({owner:b.owner,pages:b.pages.map(({author,kind,skipped})=>({author,kind,skipped}))}))};
    const pages=this.book(id).pages;return {...base,kind:relayKind(this.mode,this.step),previous:pages.slice(-1),draft:this.drafts.get(id)||null};
  }
  revealDuration(index){const p=this.books[Math.floor(index/this.steps)]?.pages[index%this.steps];return p?.kind==='drawing'?12000:Math.max(10000,Math.min(30000,(p?.value?.length||0)*80));}
  revealState(){
    if(this.phase!=='final')return null;const total=this.books.length*this.steps;
    this.show??={index:0,paused:false,deadline:this.now()+this.revealDuration(0)};
    while(!this.show.paused&&this.show.index<total&&this.now()>=this.show.deadline){this.show.index++;this.show.deadline+=this.revealDuration(this.show.index);}
    return {book:Math.min(this.books.length-1,Math.floor(this.show.index/this.steps)),page:this.show.index%this.steps,paused:this.show.paused,remaining:this.show.index>=total?0:Math.max(0,Math.ceil((this.show.paused?this.show.left:this.show.deadline-this.now())/1000)),done:this.show.index>=total};
  }
  revealControl(id,data){
    if(this.phase!=='final'||data?.id!==this.id||id!==this.host()||!this.connected(id)||!this.members.some(p=>p.id===id)||!['pause','next'].includes(data.action)||this.now()-(this.lastRevealControl??-Infinity)<300)return false;
    if(this.revealState().done)return false;this.lastRevealControl=this.now();
    if(data.action==='pause'){if(this.show.paused){this.show.deadline=this.now()+this.show.left;this.show.paused=false;}else{this.show.left=Math.max(0,this.show.deadline-this.now());this.show.paused=true;}}
    else{this.show.index++;this.show.left=this.revealDuration(this.show.index);this.show.deadline=this.now()+this.show.left;}
    this.publish();return true;
  }
  page(id,data){
    if(data?.action){this.revealControl(id,data);return null;}
    if(this.phase!=='final'||!this.connected(id)||!this.members.some(p=>p.id===id)||data?.id!==this.id||!Number.isInteger(data.book)||!Number.isInteger(data.page))return null;
    const page=this.books[data.book]?.pages[data.page];return page?{id:this.id,book:data.book,page:data.page,value:page}:null;
  }
  publish(){for(const p of this.members)if(this.connected(p.id))this.send(p.id,'relay:state',this.snapshot(p.id));}
}
