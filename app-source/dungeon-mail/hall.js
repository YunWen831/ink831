import {RelayMatch} from './relay-match.js';
import {isRelay,TextUpload} from '../../courtyard/relay-rules.js';
import {MURAL_MAX,MURAL_REACH,splitMural} from '../../courtyard/mural-rules.js';
import {validPartyMode} from '../../courtyard/party-rules.js';
import {PartyMatch} from './party-match.js';
import { randomInt, randomUUID } from 'node:crypto';
import { resolve } from 'node:path';
import { Room } from '@colyseus/core';
import { schema, t } from '@colyseus/schema';
import { WORLD, COLORS, move, spawn, isBuildCell, tileKey, TILE_SIZE, BUILD_REACH, overlapsTile, PARTY } from '../../courtyard/world.js';
import { partyStatus } from '../../courtyard/party.js';
import { CHAT_SWEEP_MS } from '../../courtyard/chat.js';
import { ChatHistory } from './chat-history.js';
import { ParkourMatch } from './parkour-match.js';
import { MaterialUpload } from './material-upload.js';
import { AccountStore,cookieToken,publicUser } from './accounts.js';
import { AvatarStore,AvatarUpload } from './avatars.js';
import { LevelStore } from './level-store.js';
import { emptyMap } from '../../courtyard/parkour-map.js';
import { BUILTIN_MATERIALS } from '../../courtyard/materials.js';
import { WorldStore, cleanText } from './world-store.js';

export const worldStore = await new WorldStore(resolve(process.env.DATA_DIR || 'data')).load();
await worldStore.pruneMaterials();
export const accounts=await new AccountStore(resolve(process.env.DATA_DIR||'data')).load();
export const avatars=new AvatarStore(resolve(process.env.DATA_DIR||'data'));
export const levelStore=new LevelStore(resolve(process.env.DATA_DIR||'data'));
const Player = schema({
  name:t.string().default(''),x:t.number().default(480),y:t.number().default(414),
  color:t.string().default(COLORS[0]),connected:t.boolean().default(true),ack:t.number().default(0),
  space:t.string().default('lobby'),ready:t.boolean().default(false),
  epoch:t.number().default(0),userId:t.string().default(''),
},'Player');
const Block = schema({col:t.number(),row:t.number(),material:t.string(),solid:t.boolean(),ownerId:t.string().default('')},'Block');
const blockOf = tile => Object.assign(new Block(),tile);
const HallState = schema({players:t.map(Player),tiles:t.map(Block)},'HallState');
let active=false,liveHall=null;
export function notifyAdministration({protection,material}){
  if(!liveHall)return;if(material)liveHall.broadcast('material:updated',material);
  if(protection)for(const client of liveHall.clients)if(client.userData?.accountId===protection.id)client.send('building:protection',{allow:protection.allow});
}
const alphabet='ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

export class Courtyard extends Room {
  maxClients=50;
  maxMessagesPerSecond=70;
  patchRate=50;
  autoDispose=false;
  state=new HallState();
  spaces=new Map();
  chatHistory=new ChatHistory();
  collisionTiles=new Map();
  reserved=new Set();
  ownsLobby=false;
  matches=new Map();
  partyMatches=new Map();
  relayMatches=new Map();
  soloWorkshops=new Map();

  onCreate(){
    if(active)throw new Error('大厅暂时已满，请稍后再试');
    active=true;liveHall=this;this.ownsLobby=true;this.roomId='courtyard';
    const register=this.onMessage.bind(this);
    this.onMessage=(type,handler,...args)=>register(type,(client,data)=>{
      if(client.userData?.sessionHash&&!accounts.valid(client.userData.sessionHash)){client.leave(4003);return;}
      return handler(client,data);
    },...args);
    this.sessionSweep=setInterval(()=>{
      for(const client of this.clients){
        const user=client.userData;if(!user?.sessionHash)continue;
        if(!accounts.valid(user.sessionHash)){client.leave(4003);continue;}
        const account=accounts.data.users.find(a=>a.id===user.accountId),player=this.state.players.get(client.sessionId);
        if(account&&player)player.name=account.nickname;
      }
    },1000).unref();
    // One global cutoff also clears cached lobby history while a player is in a party.
    this.chatSweep=setInterval(()=>this.broadcast('chat:prune',{cutoff:this.chatHistory.sweep()}),CHAT_SWEEP_MS).unref();
    this.materialSweep=setInterval(async()=>{try{const change=await worldStore.pruneMaterials();if(change.removed.length||change.retained.length)this.broadcast('materials:pruned',change);}catch{console.error('Material cleanup failed; will retry.');}},30000).unref();
    this.matchTick=setInterval(()=>{for(const match of [...this.matches.values(),...this.soloWorkshops.values(),...this.partyMatches.values(),...this.relayMatches.values()])match.tick();},1000/60).unref();
    for(const tile of worldStore.data.tiles){const key=tileKey(tile.col,tile.row);this.state.tiles.set(key,blockOf(tile));this.collisionTiles.set(key,tile);}
    this.onMessage('hello',client=>{this.content(client);this.ownWorkshop(client)?.open(client.sessionId);});
    this.onMessage('ping',(client,stamp)=>{if(typeof stamp==='number'&&Number.isFinite(stamp))client.send('pong',stamp);});
    this.onMessage('input',(client,data)=>{
      const player=this.state.players.get(client.sessionId);
      if(this.relayMatches.has(player?.space)||this.partyMatches.has(player?.space)||this.matches.has(player?.space)||this.soloWorkshops.has(client.sessionId))return;
      if(!player?.connected||data?.space!==player.space||data.epoch!==player.epoch||!Array.isArray(data.steps)||data.steps.length>6)return;
      const now=performance.now(),user=client.userData;
      user.credit=Math.min(400,user.credit+now-user.creditAt);user.creditAt=now;
      for(const step of data.steps){
        if(!Number.isSafeInteger(step?.seq)||step.seq<=player.ack||step.seq>player.ack+250||!Number.isFinite(step.dx)||!Number.isFinite(step.dy)||Math.abs(step.dx)>1||Math.abs(step.dy)>1)continue;
        player.ack=step.seq;if(user.credit<WORLD.stepMs)continue;user.credit-=WORLD.stepMs;
        const next=move(player,step.dx,step.dy,player.space==='lobby'?this.collisionTiles:undefined);
        player.x=next.x;player.y=next.y;
      }
    });
    this.onMessage('emote',client=>{
      if(!this.allow(client,'wave',1800))return;
      const player=this.state.players.get(client.sessionId);if(player)this.sendSpace(player.space,'emote',{id:client.sessionId});
    });
    this.onMessage('chat',(client,data)=>{
      const player=this.state.players.get(client.sessionId),text=cleanText(data?.text,120);
      if(data?.channel!==undefined&&!['lobby','room'].includes(data.channel))return;
      if(!player||!text)return;
      if(!this.allow(client,'chat',1000)){this.notice(client,'发言稍微慢一点，等一秒再发送。');return;}
      const channel=data?.channel==='lobby'?'lobby':player.space;
      const message={id:randomUUID(),sender:client.sessionId,name:player.name,color:player.color,text,at:Date.now(),space:channel};
      this.chatHistory.add(channel,message);
      if(channel==='lobby')this.broadcast('chat',message);else this.sendSpace(channel,'chat',message);
    });
    this.onMessage('relay:peek',client=>{if(this.allow(client,'relayPeek',300))this.relayMatches.get(this.state.players.get(client.sessionId)?.space)?.publish();});
    this.onMessage('relay:begin',(client,data)=>{
      client.userData.relayUpload=null;const match=this.relayMatches.get(this.state.players.get(client.sessionId)?.space);
      if(!match?.context(client.sessionId,data)){if(match)client.send('relay:state',match.snapshot(client.sessionId));return;}
      if(!this.actionBudget(client,'relayUpload')){this.notice(client,'交稿操作太频繁，请稍后重试。','relay');return;}
      try{client.userData.relayUpload={upload:new TextUpload(data.length),id:data.id,step:data.step,revision:data.revision,submit:data.submit===true};}catch(error){this.notice(client,error.message,'relay');}
    });
    this.onMessage('relay:chunk',(client,data)=>{const pending=client.userData.relayUpload;if(!pending)return;try{pending.upload.append(data?.index,data?.text);}catch(error){client.userData.relayUpload=null;this.notice(client,error.message,'relay');}});
    this.onMessage('relay:finish',client=>{const pending=client.userData.relayUpload;client.userData.relayUpload=null;if(!pending)return;const match=this.relayMatches.get(this.state.players.get(client.sessionId)?.space);try{if(!match?.save(client.sessionId,{...pending,value:JSON.parse(pending.upload.finish())}))throw Error('本页已结束或已提交。');if(pending.submit)match.submit(client.sessionId,pending);const state=match.snapshot(client.sessionId);if(state)client.send('relay:state',state);}catch(error){this.notice(client,error.message,'relay');}});
    this.onMessage('mural:begin',(client,data)=>{client.userData.muralUpload=null;if(!this.requireAccount(client,'mural'))return;if(!this.allow(client,'mural',2500)){this.notice(client,'请稍等两秒再放置下一幅像素画。','mural');return;}try{client.userData.muralUpload=new TextUpload(data?.length,MURAL_MAX);}catch(error){this.notice(client,error.message,'mural');}});
    this.onMessage('mural:chunk',(client,data)=>{const upload=client.userData.muralUpload;if(!upload)return;try{upload.append(data?.index,data?.text);}catch(error){client.userData.muralUpload=null;this.notice(client,error.message,'mural');}});
    this.onMessage('mural:finish',client=>this.placeMural(client));
    this.onMessage('party:input' ,(client,data)=>{const match=this.partyMatches.get(this.state.players.get(client.sessionId)?.space);if(match?.input(client.sessionId,data)&&data?.choice){const personal=match.privateState(client.sessionId,data);if(personal)client.send('party:private',personal);}});
    this.onMessage('party:peek',(client,data)=>{if(!this.allow(client,'partyPeek',150))return;const personal=this.partyMatches.get(this.state.players.get(client.sessionId)?.space)?.privateState(client.sessionId,data);if(personal)client.send('party:private',personal);});
    this.onMessage('party:settings',(client,data)=>{
      const p=this.state.players.get(client.sessionId),space=this.spaces.get(p?.space);
      if(!space||space.type!=='party'||space.host!==client.sessionId||space.phase!=='forming'||!validPartyMode(data?.mode)){this.notice(client,'仅房主可在准备时选择有效玩法。','space');return;}
      if(!this.allow(client,'partySettings',250))return;if(space.mode===data.mode)return;space.mode=data.mode;for(const [,member] of this.members(space.id))member.ready=false;this.broadcastRooms();
    });
    this.onMessage('party:vote',(client,data)=>{if(this.actionBudget(client,'partyVote'))this.partyMatches.get(this.state.players.get(client.sessionId)?.space)?.vote(client.sessionId,data);});
    this.onMessage('spaces:list',client=>client.send('spaces',this.roomList()));
    this.onMessage('space:create',(client,data)=>{
      const player=this.state.players.get(client.sessionId);
      if(!player||player.space!=='lobby'||!['party','parkour','dungeon'].includes(data?.type))return;
      if(!this.allow(client,'space',1200)){this.notice(client,'动作太快了，稍等一下再开房间。','space');return;}
      if(this.spaces.size>=12){this.notice(client,'准备房间已满，请加入已有房间。','space');return;}
      if(data.type==='party'&&!validPartyMode(data.mode??'random')){this.notice(client,'请选择有效的派对玩法。','space');return;}
      const title=cleanText(data.title,18)||`${player.name}的${data.type==='party'?(isRelay(data.mode)?'接龙':'派对'):data.type==='parkour'?'跑酷':'地牢'}小队`;
      let id;do{id=Array.from({length:6},()=>alphabet[randomInt(alphabet.length)]).join('');}while(this.spaces.has(id));
      this.spaces.set(id,{id,title,type:data.type,mode:data.type==='party'?(data.mode??'random'):undefined,capacity:PARTY.max,minPlayers:PARTY.min,phase:'forming',host:client.sessionId});this.transfer(client,id);
    });
    this.onMessage('space:join',(client,data)=>{
      const player=this.state.players.get(client.sessionId),space=this.spaces.get(data?.id);
      if(!player||player.space!=='lobby')return;
      if(!space){this.notice(client,'这个房间已结束，请刷新房间列表。','space');return;}
      if(space.phase!=='forming'){this.notice(client,'这队已就绪，请等房主返回准备。','space');return;}
      if(this.members(space.id).length>=space.capacity){this.notice(client,'这个房间已经满了。','space');return;}
      this.transfer(client,space.id);
    });
    this.onMessage('space:leave',client=>{const player=this.state.players.get(client.sessionId);if(player&&player.space!=='lobby')this.transfer(client,'lobby');});
    this.onMessage('home',client=>{const player=this.state.players.get(client.sessionId);if(player?.space==='lobby'&&this.allow(client,'home',3000)){Object.assign(player,spawn(0,this.collisionTiles));player.epoch++;}});
    this.onMessage('space:ready',client=>{
      const player=this.state.players.get(client.sessionId);if(!player||player.space==='lobby')return;
      if(this.relayMatches.has(player.space)||this.matches.has(player.space)||this.partyMatches.has(player.space))return;
      player.ready=!player.ready;const space=this.spaces.get(player.space);if(space)space.phase='forming';this.broadcastRooms();
    });
    this.onMessage('space:start',client=>{
      const player=this.state.players.get(client.sessionId),space=this.spaces.get(player?.space);
      if(!space||space.host!==client.sessionId){this.notice(client,'由房主开始。','space');return;}
      if(space.type==='party'){
        const previous=this.relayMatches.get(space.id)||this.partyMatches.get(space.id),members=this.members(space.id);
        if(previous&&previous.phase!=='final')return;
        if(members.length<2||members.length>4||members.some(([,p])=>!p.connected)||(!previous&&members.some(([,p])=>!p.ready))){this.notice(client,'需要 2～4 人在线并全部准备。','space');return;}
        const mode=previous instanceof RelayMatch?space.mode:previous?previous.nextMode():(space.mode||'random');
        this.partyMatches.delete(space.id);this.relayMatches.delete(space.id);
        if(isRelay(mode)){
          space.mode=mode;
          const relay=new RelayMatch(members.map(([id,p])=>({id,name:p.name,color:p.color})),{mode,host:()=>space.host,connected:id=>{const p=this.state.players.get(id);return !!p?.connected&&p.space===space.id;},send:(id,type,data)=>{this.clients.find(c=>c.sessionId===id)?.send(type,data);},changed:()=>{space.phase=relay.phase;this.broadcastRooms();}});
          this.relayMatches.set(space.id,relay);space.phase=relay.phase;this.sendSpace(space.id,'space:launch',{});relay.publish();this.broadcastRooms();return;
        }
        const party=new PartyMatch(members.map(([id,p])=>({id,name:p.name,color:p.color})),{mode,host:()=>space.host,send:(type,data)=>{this.sendSpace(space.id,type,data);if(space.phase!==data.phase){space.phase=data.phase;this.broadcastRooms();}},connected:id=>{const p=this.state.players.get(id);return !!p?.connected&&p.space===space.id;}});
        this.partyMatches.set(space.id,party);space.mode=party.mode;space.phase='party';this.sendSpace(space.id,'space:launch',{});party.publish();this.broadcastRooms();return;
      }
      const match=this.matches.get(space.id);
      if(match){if(!match.launch(id=>this.state.players.get(id)?.connected))this.notice(client,'需要 2～4 人在线，并各自通关自己的地图。','space');else this.sendSpace(space.id,'space:launch',{id:space.id,type:space.type,phase:match.phase});this.broadcastRooms();return;}
      if(!partyStatus(this.members(space.id).map(([,p])=>p),space.phase).canStart){this.notice(client,'需要 2～4 人在线并全部准备。','space');return;}
      if(space.type==='parkour'){
        const match=this.createWorkshop(this.members(space.id).map(([id,p])=>({id,name:p.name,color:p.color})));
        this.matches.set(space.id,match);space.phase='building';for(const [id] of this.members(space.id))match.open(id);
      }else space.phase='waiting-for-level';
      this.broadcastRooms();
      this.sendSpace(space.id,'space:launch',{id:space.id,type:space.type,phase:space.phase});
    });
    this.onMessage('material:create',async(client,data)=>{
      if(!this.state.players.has(client.sessionId)||!this.requireAccount(client,'material'))return;
      if(!this.allow(client,'material',2500)){this.notice(client,'保存得太快了，请稍等一下。','material');return;}
      await this.saveMaterial(client,data);
    });
    this.onMessage('material:begin',(client,data)=>{
      client.userData.upload=null;
      if(!this.requireAccount(client,'material'))return;
      if(!this.state.players.has(client.sessionId)||!this.allow(client,'material',2500)){this.notice(client,'保存得太快了，请稍等一下。','material');return;}
      try{client.userData.upload=new MaterialUpload(data?.name,data?.length);}catch(error){client.userData.upload=null;this.notice(client,error.message,'material');}
    });
    this.onMessage('material:chunk',(client,data)=>{
      if(!client.userData.upload)return;
      try{client.userData.upload.append(data?.index,data?.pixels);}catch(error){client.userData.upload=null;this.notice(client,error.message,'material');}
    });
    this.onMessage('material:finish',async client=>{
      const upload=client.userData.upload;client.userData.upload=null;if(!upload)return;
      try{await this.saveMaterial(client,{name:upload.name,pixels:upload.finish()});}catch(error){this.notice(client,error.message,'material');}
    });
    this.onMessage('build',(client,data)=>this.build(client,data));
    this.onMessage('material:delete',(client,data)=>this.manageMaterial(client,data,false));
    this.onMessage('material:restore',(client,data)=>this.manageMaterial(client,data,true));
    this.onMessage('building:protection',async(client,data)=>{
      if(!this.requireAccount(client,'account')||typeof data?.allow!=='boolean')return;
      if(!this.actionBudget(client,'protection')){this.notice(client,'设置操作较多，请稍后重试。','account');return;}
      try{await worldStore.protect(client.userData.accountId,data.allow);for(const c of this.clients)if(c.userData?.accountId===client.userData.accountId)c.send('building:protection',{allow:data.allow});}
      catch{this.notice(client,'建筑设置保存失败，请重试。','account');}
    });
    this.onMessage('avatar:begin',(client,data)=>{
      client.userData.avatarUpload=null;if(!this.requireAccount(client,'avatar'))return;
      if(!this.allow(client,'avatar',3000)){this.notice(client,'请稍等一下再保存人物。','avatar');return;}
      try{client.userData.avatarUpload=new AvatarUpload(data?.length,data?.format);}catch(error){this.notice(client,error.message,'avatar');}
    });
    this.onMessage('avatar:chunk',(client,data)=>{
      const upload=client.userData.avatarUpload;if(!upload)return;
      try{upload.append(data?.index,data?.pixels);}catch(error){client.userData.avatarUpload=null;this.notice(client,error.message,'avatar');}
    });
    this.onMessage('avatar:finish',async client=>{
      const upload=client.userData.avatarUpload;client.userData.avatarUpload=null;
      if(!upload||!this.requireAccount(client,'avatar'))return;
      try{const data=await avatars.save(client.userData.accountId,upload.finish());this.broadcast('avatar',data);}
      catch(error){this.notice(client,error.code?'人物保存失败，请重试。':error.message,'avatar');}
    });
    const ownMatch=client=>this.ownWorkshop(client);
    this.onMessage('levels:list',async client=>{
      if(!this.levelAction(client))return;
      try{client.send('levels:list',{maps:await levelStore.list(client.userData.accountId)});}catch{this.notice(client,'关卡库暂时无法读取，请重试。','levels');}
    });
    this.onMessage('levels:open',async(client,data)=>{
      if(!this.levelAction(client))return;
      try{const record=await levelStore.get(client.userData.accountId,data?.id);if(!accounts.valid(client.userData.sessionHash))return;const match=this.editableWorkshop(client);if(!match?.load(client.sessionId,record))throw Error('请在编辑阶段载入关卡。');}
      catch(error){this.notice(client,error.code?'关卡读取失败，请重试。':error.message,'levels');}
    });
    this.onMessage('levels:new',(client,data)=>{
      if(!this.levelAction(client))return;
      try{const match=this.editableWorkshop(client);if(!match?.load(client.sessionId,{cells:data?.cells??emptyMap(),title:data?.cells?'本机草稿':'新的关卡',verified:false}))this.notice(client,'请在编辑阶段新建关卡。','levels');}
      catch{this.notice(client,'本机草稿已损坏，请新建关卡或载入账号存档。','levels');}
    });
    this.onMessage('levels:save',(client,data)=>this.saveLevel(client,data));
    this.onMessage('levels:delete',async(client,data)=>{
      if(!this.levelAction(client))return;
      try{await levelStore.remove(client.userData.accountId,data?.id,data?.version);for(const match of [...this.matches.values(),...this.soloWorkshops.values()])for(const draft of match.drafts.values())if(draft.cloudId===data.id&&this.state.players.get(draft.id)?.userId===client.userData.accountId){draft.cloudId=null;draft.cloudVersion=0;}const maps=await levelStore.list(client.userData.accountId);for(const c of this.clients)if(c.userData?.accountId===client.userData.accountId){c.send('levels:deleted',{id:data.id});c.send('levels:list',{maps});}}
      catch(error){this.notice(client,error.code?'关卡删除失败，请重试。':error.message,'levels');}
    });
    this.onMessage('parkour:solo:close',client=>{if(this.soloWorkshops.delete(client.sessionId))client.send('parkour:closed',{});});
    this.onMessage('parkour:rebuild',client=>{const p=this.state.players.get(client.sessionId),s=this.spaces.get(p?.space);if(s?.host!==client.sessionId)return;if(this.matches.get(s.id)?.rebuild()){s.phase='building';this.sendSpace(s.id,'space:launch',{});this.broadcastRooms();}});
    this.onMessage('parkour:map',(client,data)=>{
      const match=ownMatch(client);if(!match||match.phase!=='building')return;if(!this.allow(client,'parkourEdit',100)){match.workshop(client.sessionId);return;}
      if(data?.documentId!==match.drafts.get(client.sessionId)?.documentId){match.workshop(client.sessionId);return;}
      try{match.edit(client.sessionId,data?.cells);}catch{this.notice(client,'地图数据无效，请重新编辑。','parkour');}
    });
    this.onMessage('parkour:verify',(client,data)=>{const match=ownMatch(client);if(!match||data?.documentId!==match.drafts.get(client.sessionId)?.documentId||!this.allow(client,'parkourVerify',500))return;if(!match.verify(client.sessionId,data?.revision))this.notice(client,'请先保存最新地图。','parkour');});
    this.onMessage('parkour:input',(client,data)=>ownMatch(client)?.input(client.sessionId,data));
    this.onMessage('parkour:invalidate',(client,data)=>{const match=ownMatch(client);if(data?.documentId===match?.drafts.get(client.sessionId)?.documentId)match.invalidate(client.sessionId);});
    this.onMessage('parkour:edit',client=>ownMatch(client)?.stop(client.sessionId));
    this.onMessage('parkour:reset',client=>{
      const p=this.state.players.get(client.sessionId),s=this.spaces.get(p?.space),match=ownMatch(client);
      if(!s||s.host!==client.sessionId||!match||!['building','results'].includes(match.phase))return;
      this.matches.delete(s.id);s.phase='forming';for(const [,p] of this.members(s.id))p.ready=false;
      this.sendSpace(s.id,'parkour:closed',{});this.broadcastRooms();
    });
  }
  ownWorkshop(client){return this.matches.get(this.state.players.get(client.sessionId)?.space)||this.soloWorkshops.get(client.sessionId);}
  levelAction(client,key='levels'){if(!this.requireAccount(client,'levels'))return false;if(this.actionBudget(client,key))return true;this.notice(client,'关卡操作较多，请稍后重试。','levels');return false;}
  createWorkshop(members,solo=false){
    const match=new ParkourMatch(members,{changed:()=>{if(!solo)this.broadcastRooms();},send:(id,type,data)=>{const target=this.clients.find(c=>c.sessionId===id);if(target)target.send(type,data);},completed:(id,draft)=>{const client=this.clients.find(c=>c.sessionId===id);if(client&&draft.cloudId)this.saveLevel(client,{id:draft.cloudId,version:draft.cloudVersion,title:draft.title,cells:draft.cells,revision:draft.revision,documentId:draft.documentId},true);}});match.solo=solo;return match;
  }
  editableWorkshop(client){
    let match=this.ownWorkshop(client);const p=this.state.players.get(client.sessionId);
    if(!match&&p?.space==='lobby'){match=this.createWorkshop([{id:client.sessionId,name:p.name,color:p.color}],true);this.soloWorkshops.set(client.sessionId,match);}
    return match?.phase==='building'?match:null;
  }
  async saveLevel(client,data,automatic=false){
    if(!this.levelAction(client,'levelsSave'))return;
    const match=this.ownWorkshop(client),draft=match?.drafts.get(client.sessionId);
    if(match?.phase!=='building'||!draft||draft.revision!==data?.revision||draft.cells!==data.cells||draft.documentId!==data.documentId){this.notice(client,'请等地图同步后再保存。','levels');return;}
    const snapshot={...draft};
    try{
      const record=await levelStore.save(client.userData.accountId,{id:data.id,version:data.version,title:data.title,cells:snapshot.cells},snapshot.verified);
      if(draft.documentId===snapshot.documentId){draft.cloudId=record.id;draft.cloudVersion=record.version;draft.title=record.title;}
      client.send('levels:saved',{...record,revision:snapshot.revision,documentId:snapshot.documentId,automatic});
    }catch(error){this.notice(client,(automatic?'验证已通过；云端未更新：':'')+(error.code?'保存失败，请重试。':error.message),'levels');}
  }
  async saveMaterial(client,data){
    const player=this.state.players.get(client.sessionId);if(!player||!this.requireAccount(client,'material'))return;
    try{const material=await worldStore.createMaterial(data?.name,data?.pixels,player.name,client.userData.accountId);this.broadcast('material',{...material,creator:client.sessionId});}
    catch(error){this.notice(client,error.code?'材料暂时保存失败，请稍后再试。':error.message,'material');}
  }
  requireAccount(client,action){if(client.userData?.accountId&&accounts.valid(client.userData.sessionHash))return true;this.notice(client,'请登录后保存作品或施工。',action);return false;}
  async manageMaterial(client,data,restore){
    if(!this.requireAccount(client,'library'))return;
    if(!this.actionBudget(client,'library')){this.notice(client,'画布操作较多，请稍后重试。','library');return;}
    try{const material=await worldStore.deleteMaterial(data?.id,client.userData.accountId,restore);this.broadcast('material:updated',material);}
    catch(error){this.notice(client,error.code?'画布操作失败，请重试。':error.message,'library');}
  }
  actionBudget(client,key){const now=performance.now(),actions=(client.userData[key+'Actions']||[]).filter(at=>now-at<10000);client.userData[key+'Actions']=actions;if(actions.length>=20)return false;actions.push(now);return true;}
  allow(client,key,interval){
    const now=performance.now(),previous=client.userData.times[key]??-Infinity;
    if(now-previous<interval)return false;client.userData.times[key]=now;return true;
  }
  notice(client,text,action=''){client.send('notice',{text,action});}
  members(space){return [...this.state.players.entries()].filter(([,p])=>p.space===space);}
  sendSpace(space,type,message){for(const client of this.clients)if(this.state.players.get(client.sessionId)?.space===space)client.send(type,message);}
  roomList(){return [...this.spaces.values()].map(space=>{const match=this.matches.get(space.id);const party=this.relayMatches.get(space.id)||this.partyMatches.get(space.id);return {...space,...partyStatus(this.members(space.id).map(([,p])=>p),space.phase),...(match?{phase:match.phase,canStart:match.canLaunch(id=>this.state.players.get(id)?.connected),verified:[...match.drafts.values()].filter(d=>d.verified).length}: {}),...(party?{phase:party.phase,canStart:party.phase==='final'&&this.members(space.id).length>=2&&this.members(space.id).every(([,p])=>p.connected)}:{})};});}
  broadcastRooms(){this.broadcast('spaces',this.roomList());}
  async content(client){
    const player=this.state.players.get(client.sessionId);if(!player)return;
    client.send('content',{materials:worldStore.data.materials,spaces:this.roomList(),history:this.chatHistory.read(player.space),lobbyHistory:this.chatHistory.read('lobby'),space:player.space,account:publicUser(accounts.data.users.find(u=>u.id===client.userData.accountId)),allowDemolition:worldStore.data.protection?.[client.userData.accountId]===true});
    const relay=this.relayMatches.get(player.space);if(relay)client.send('relay:state',relay.snapshot(client.sessionId));
    const party=this.partyMatches.get(player.space);if(party)client.send('party:state',party.snapshot());
    for(const id of new Set([...this.state.players.values()].map(p=>p.userId).filter(Boolean))){try{const avatar=await avatars.get(id);if(avatar)client.send('avatar',avatar);}catch{this.notice(client,'一件人物贴图读取失败，请联系站长。');}}
  }
  transfer(client,destination){
    if(this.soloWorkshops.delete(client.sessionId))client.send('parkour:closed',{});
    const player=this.state.players.get(client.sessionId),old=player.space;
    player.space=destination;player.ready=false;player.epoch++;Object.assign(player,spawn(this.members(destination).length%24,destination==='lobby'?this.collisionTiles:undefined));
    client.userData.credit=200;client.userData.creditAt=performance.now();
    this.tidy(old);this.broadcastRooms();this.content(client);
  }
  tidy(id){
    if(id==='lobby')return;
    const members=this.members(id),space=this.spaces.get(id);
    const match=this.matches.get(id);if(match)for(const key of match.drafts.keys())if(!members.some(([id])=>id===key))match.remove(key);
    if(!members.length){this.spaces.delete(id);this.chatHistory.delete(id);this.matches.delete(id);this.partyMatches.delete(id);this.relayMatches.delete(id);}
    else if(space){
      if(!members.some(([key])=>key===space.host))space.host=members[0][0];
      this.partyMatches.get(id)?.publish();this.relayMatches.get(id)?.publish();
      if(!match&&!this.partyMatches.has(id)&&!this.relayMatches.has(id)){space.phase='forming';for(const [,member] of members)member.ready=false;}
    }
  }
  async build(client,data){
    const player=this.state.players.get(client.sessionId);
    if(!player||player.space!=='lobby'){this.notice(client,'请回大厅建造。','build');return;}
    if(!this.requireAccount(client,'build'))return;
    if(!this.allow(client,'build',125))return;
    const {col,row}=data||{},key=tileKey(col,row);
    if(!isBuildCell(col,row)){this.notice(client,'已到地图边界。','build');return;}
    if(Math.hypot(player.x-(col+.5)*TILE_SIZE,player.y-(row+.5)*TILE_SIZE)>BUILD_REACH){this.notice(client,'离得有点远，走近一些再施工。','build');return;}
    if(this.reserved.has(key)){this.notice(client,'这块位置正在同步，请稍等。','build');return;}
    const old=this.state.tiles.get(key);
    if(old&&(!old.ownerId?!accounts.isAdmin(client.userData.accountId):old.ownerId!==client.userData.accountId&&worldStore.data.protection?.[old.ownerId]!==true)){this.notice(client,old.ownerId?'这座建筑未开放他人拆除。':'旧建筑仅管理员可拆除或覆盖。','build');return;}
    const tile={col,row,material:data.material||null,solid:data.solid===true,ownerId:client.userData.accountId};
    if(tile.material&&!BUILTIN_MATERIALS.some(m=>m.id===tile.material)&&!worldStore.data.materials.some(m=>m.id===tile.material&&!m.deletedAt)){this.notice(client,'请先选择已有材料。','build');return;}
    if(!tile.material&&!old){this.notice(client,'这里还没有方块。','build');return;}
    if(tile.material&&tile.solid&&this.members('lobby').some(([,p])=>overlapsTile(p.x,p.y,col,row))){this.notice(client,'这里站着一位旅人，请换个位置。','build');return;}
    this.reserved.add(key);
    // Reserve solid cells during disk I/O so a player cannot walk into a new wall.
    if(tile.material&&tile.solid)this.collisionTiles.set(key,tile);
    try{
      await worldStore.setTile(tile,client.userData.accountId,()=>{accounts.requireAdmin(client.userData.sessionHash);return true;});
      if(tile.material){this.state.tiles.set(key,blockOf(tile));this.collisionTiles.set(key,tile);}
      else{this.state.tiles.delete(key);this.collisionTiles.delete(key);}
      client.send('build:saved',{key});
      if(old&&!old.ownerId)try{await accounts.recordAdminActor(client.userData.accountId,'legacy',tile.material?'legacy-replace':'legacy-demolish',key);}catch{this.notice(client,'建筑已更新，管理记录暂未保存。','build');}
    }catch(error){
      if(old)this.collisionTiles.set(key,old);else this.collisionTiles.delete(key);
      this.notice(client,error.code?'建筑保存失败，请稍后再试。':error.message,'build');
    }finally{this.reserved.delete(key);}
  }
  async placeMural(client){
    const upload=client.userData.muralUpload;client.userData.muralUpload=null;if(!upload||!this.requireAccount(client,'mural'))return;
    const keys=[];let reserved=false;
    try{
      const input=JSON.parse(upload.finish()),parts=splitMural(input),player=this.state.players.get(client.sessionId);
      if(!player||player.space!=='lobby'||!Number.isInteger(input.col)||!Number.isInteger(input.row))throw Error('请在大厅选择放置位置。');
      for(const p of parts){const col=input.col+p.x,row=input.row+p.y,key=tileKey(col,row);if(!isBuildCell(col,row)||Math.hypot(player.x-(col+.5)*TILE_SIZE,player.y-(row+.5)*TILE_SIZE)>MURAL_REACH)throw Error('区域太远或超出边界，请走近后重试。');if(this.reserved.has(key))throw Error('区域正在施工，请稍后重试。');keys.push(key);}
      for(const key of keys)this.reserved.add(key);reserved=true;
      const result=await worldStore.importMural(input,client.userData.accountId,player.name,legacy=>{if(!accounts.valid(client.userData.sessionHash)||this.state.players.get(client.sessionId)?.space!=='lobby')throw Error('登录或位置已变化，请重试。');return legacy?accounts.isAdmin(client.userData.accountId):true;});
      for(const material of result.materials)this.broadcast('material',material);
      for(const tile of result.tiles){this.state.tiles.set(tileKey(tile.col,tile.row),blockOf(tile));this.collisionTiles.set(tileKey(tile.col,tile.row),tile);}
      client.send('mural:saved',{count:result.tiles.length});
    }catch(error){this.notice(client,error.code?'像素画保存失败，请重试。':error.message,'mural');}
    finally{if(reserved)for(const key of keys)this.reserved.delete(key);}
  }
  onAuth(client,options,context){
    if(options?.clientVersion!==14)throw new Error('页面已更新，请刷新后进入');
    const token=cookieToken(context.headers.get('cookie')),session=options.guest?null:accounts.session(token);
    if(token&&!options.guest&&!session)throw new Error('登录已过期，请重新登录');
    if(!session&&!cleanText(options?.name,12))throw new Error('请先输入昵称');
    return session?{userId:session.user.id,name:session.user.nickname,hash:session.hash}:{userId:'',name:cleanText(options.name,12),hash:''};
  }
  async onJoin(client,options,auth){
    const index=this.state.players.size,player=new Player();
    auth=auth||client.auth;player.name=auth.name;player.userId=auth.userId;player.color=COLORS[index%COLORS.length];Object.assign(player,spawn(index,this.collisionTiles));
    client.userData={credit:200,creditAt:performance.now(),times:{},accountId:auth.userId,sessionHash:auth.hash};this.state.players.set(client.sessionId,player);
    if(auth.userId){try{const avatar=await avatars.get(auth.userId);if(avatar)this.broadcast('avatar',avatar);}catch{this.notice(client,'人物贴图暂时无法读取。');}}
  }
  onDrop(client){client.userData.upload=null;client.userData.avatarUpload=null;client.userData.relayUpload=null;client.userData.muralUpload=null;const player=this.state.players.get(client.sessionId);if(player)player.connected=false;this.partyMatches.get(player?.space)?.publish();this.relayMatches.get(player?.space)?.publish();this.broadcastRooms();if(client.userData.sessionHash&&!accounts.valid(client.userData.sessionHash))return;this.allowReconnection(client,60).catch(()=>{});}
  onReconnect(client){if(client.userData.sessionHash&&!accounts.valid(client.userData.sessionHash)){client.leave(4003);return;}const player=this.state.players.get(client.sessionId);if(player)player.connected=true;this.partyMatches.get(player?.space)?.publish();this.relayMatches.get(player?.space)?.publish();client.userData.credit=200;client.userData.creditAt=performance.now();this.broadcastRooms();}
  onLeave(client){const player=this.state.players.get(client.sessionId);this.state.players.delete(client.sessionId);this.soloWorkshops.delete(client.sessionId);if(player)this.tidy(player.space);this.broadcastRooms();}
  onDispose(){clearInterval(this.materialSweep);clearInterval(this.chatSweep);clearInterval(this.matchTick);clearInterval(this.sessionSweep);if(this.ownsLobby){active=false;liveHall=null;}}
}
