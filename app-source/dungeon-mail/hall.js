import { randomInt, randomUUID } from 'node:crypto';
import { resolve } from 'node:path';
import { Room } from '@colyseus/core';
import { schema, t } from '@colyseus/schema';
import { WORLD, COLORS, move, spawn, isBuildCell, tileKey, TILE_SIZE, BUILD_REACH, overlapsTile } from '../../courtyard/world.js';
import { BUILTIN_MATERIALS } from '../../courtyard/materials.js';
import { WorldStore, cleanText } from './world-store.js';

export const worldStore = await new WorldStore(resolve(process.env.DATA_DIR || 'data')).load();
const Player = schema({
  name:t.string().default(''),x:t.number().default(480),y:t.number().default(414),
  color:t.string().default(COLORS[0]),connected:t.boolean().default(true),ack:t.number().default(0),
  space:t.string().default('lobby'),ready:t.boolean().default(false),
  epoch:t.number().default(0),
},'Player');
const Block = schema({col:t.number(),row:t.number(),material:t.string(),solid:t.boolean()},'Block');
const blockOf = tile => Object.assign(new Block(),tile);
const HallState = schema({players:t.map(Player),tiles:t.map(Block)},'HallState');
let active=false;
const alphabet='ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

export class Courtyard extends Room {
  maxClients=50;
  maxMessagesPerSecond=70;
  patchRate=50;
  autoDispose=false;
  state=new HallState();
  spaces=new Map();
  histories=new Map();
  collisionTiles=new Map();
  reserved=new Set();
  ownsLobby=false;

  onCreate(){
    if(active)throw new Error('大厅暂时已满，请稍后再试');
    active=true;this.ownsLobby=true;this.roomId='courtyard';
    for(const tile of worldStore.data.tiles){const key=tileKey(tile.col,tile.row);this.state.tiles.set(key,blockOf(tile));this.collisionTiles.set(key,tile);}
    this.onMessage('hello',client=>this.content(client));
    this.onMessage('ping',(client,stamp)=>{if(typeof stamp==='number'&&Number.isFinite(stamp))client.send('pong',stamp);});
    this.onMessage('input',(client,data)=>{
      const player=this.state.players.get(client.sessionId);
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
      if(!player||!text)return;
      if(!this.allow(client,'chat',1000)){this.notice(client,'发言稍微慢一点，等一秒再发送。');return;}
      const message={id:randomUUID(),sender:client.sessionId,name:player.name,color:player.color,text,at:Date.now(),space:player.space};
      const history=this.histories.get(player.space)||[];history.push(message);if(history.length>50)history.shift();this.histories.set(player.space,history);
      this.sendSpace(player.space,'chat',message);
    });
    this.onMessage('spaces:list',client=>client.send('spaces',this.roomList()));
    this.onMessage('space:create',(client,data)=>{
      const player=this.state.players.get(client.sessionId);
      if(!player||player.space!=='lobby'||!['parkour','dungeon'].includes(data?.type))return;
      if(!this.allow(client,'space',1200)){this.notice(client,'动作太快了，稍等一下再开房间。','space');return;}
      if(this.spaces.size>=12){this.notice(client,'准备房间已满，请加入已有房间。','space');return;}
      const title=cleanText(data.title,18)||`${player.name}的${data.type==='parkour'?'跑酷':'地牢'}小队`;
      let id;do{id=Array.from({length:6},()=>alphabet[randomInt(alphabet.length)]).join('');}while(this.spaces.has(id));
      this.spaces.set(id,{id,title,type:data.type,capacity:4,host:client.sessionId});this.transfer(client,id);
    });
    this.onMessage('space:join',(client,data)=>{
      const player=this.state.players.get(client.sessionId),space=this.spaces.get(data?.id);
      if(!player||player.space!=='lobby')return;
      if(!space){this.notice(client,'这个房间已结束，请刷新房间列表。','space');return;}
      if(this.members(space.id).length>=space.capacity){this.notice(client,'这个房间已经满了。','space');return;}
      this.transfer(client,space.id);
    });
    this.onMessage('space:leave',client=>{const player=this.state.players.get(client.sessionId);if(player&&player.space!=='lobby')this.transfer(client,'lobby');});
    this.onMessage('home',client=>{const player=this.state.players.get(client.sessionId);if(player?.space==='lobby'&&this.allow(client,'home',3000)){Object.assign(player,spawn(0));player.epoch++;}});
    this.onMessage('space:ready',client=>{
      const player=this.state.players.get(client.sessionId);if(!player||player.space==='lobby')return;
      player.ready=!player.ready;this.broadcastRooms();
    });
    this.onMessage('material:create',async(client,data)=>{
      if(!this.state.players.has(client.sessionId))return;
      if(!this.allow(client,'material',2500)){this.notice(client,'保存得太快了，请稍等一下。','material');return;}
      try{
        const material=await worldStore.createMaterial(data?.name,data?.pixels,this.state.players.get(client.sessionId).name);
        this.broadcast('material',{...material,creator:client.sessionId});
      }catch(error){this.notice(client,error.code?'材料暂时保存失败，请稍后再试。':error.message,'material');}
    });
    this.onMessage('build',(client,data)=>this.build(client,data));
  }
  allow(client,key,interval){
    const now=performance.now(),previous=client.userData.times[key]??-Infinity;
    if(now-previous<interval)return false;client.userData.times[key]=now;return true;
  }
  notice(client,text,action=''){client.send('notice',{text,action});}
  members(space){return [...this.state.players.entries()].filter(([,p])=>p.space===space);}
  sendSpace(space,type,message){for(const client of this.clients)if(this.state.players.get(client.sessionId)?.space===space)client.send(type,message);}
  roomList(){return [...this.spaces.values()].map(space=>({...space,count:this.members(space.id).length,ready:this.members(space.id).filter(([,p])=>p.ready).length}));}
  broadcastRooms(){this.broadcast('spaces',this.roomList());}
  content(client){
    const player=this.state.players.get(client.sessionId);if(!player)return;
    client.send('content',{materials:worldStore.data.materials,spaces:this.roomList(),history:this.histories.get(player.space)||[],space:player.space});
  }
  transfer(client,destination){
    const player=this.state.players.get(client.sessionId),old=player.space;
    player.space=destination;player.ready=false;player.epoch++;Object.assign(player,spawn(this.members(destination).length%24));
    client.userData.credit=200;client.userData.creditAt=performance.now();
    this.tidy(old);this.broadcastRooms();this.content(client);
  }
  tidy(id){
    if(id==='lobby')return;
    const members=this.members(id),space=this.spaces.get(id);
    if(!members.length){this.spaces.delete(id);this.histories.delete(id);}
    else if(space&&!this.state.players.has(space.host))space.host=members[0][0];
    else if(space&&!members.some(([key])=>key===space.host))space.host=members[0][0];
  }
  async build(client,data){
    const player=this.state.players.get(client.sessionId);
    if(!player||player.space!=='lobby'){this.notice(client,'请回公共大厅的建筑区施工。','build');return;}
    if(!this.allow(client,'build',200)){this.notice(client,'施工稍微慢一点。','build');return;}
    const {col,row}=data||{},key=tileKey(col,row);
    if(!isBuildCell(col,row)){this.notice(client,'这里是公共通道，请在南侧建筑区施工。','build');return;}
    if(Math.hypot(player.x-(col+.5)*TILE_SIZE,player.y-(row+.5)*TILE_SIZE)>BUILD_REACH){this.notice(client,'离得有点远，走近一些再施工。','build');return;}
    if(this.reserved.has(key)){this.notice(client,'这块位置正在同步，请稍等。','build');return;}
    const old=this.state.tiles.get(key);
    const tile={col,row,material:data.material||null,solid:data.solid===true};
    if(tile.material&&!BUILTIN_MATERIALS.some(m=>m.id===tile.material)&&!worldStore.data.materials.some(m=>m.id===tile.material)){this.notice(client,'请先选择已有材料。','build');return;}
    if(!tile.material&&!old){this.notice(client,'这里还没有方块。','build');return;}
    if(tile.material&&tile.solid&&this.members('lobby').some(([,p])=>overlapsTile(p.x,p.y,col,row))){this.notice(client,'这里站着一位旅人，请换个位置。','build');return;}
    this.reserved.add(key);
    // Reserve solid cells during disk I/O so a player cannot walk into a new wall.
    if(tile.material&&tile.solid)this.collisionTiles.set(key,tile);
    try{
      await worldStore.setTile(tile);
      if(tile.material){this.state.tiles.set(key,blockOf(tile));this.collisionTiles.set(key,tile);}
      else{this.state.tiles.delete(key);this.collisionTiles.delete(key);}
      client.send('build:saved',{key});
    }catch{
      if(old)this.collisionTiles.set(key,old);else this.collisionTiles.delete(key);
      this.notice(client,'建筑保存失败，请稍后再试。','build');
    }finally{this.reserved.delete(key);}
  }
  onAuth(client,options){if(typeof options?.name!=='string'||!cleanText(options.name,12))throw new Error('请先输入用户名');return true;}
  onJoin(client,options){
    const index=this.state.players.size,player=new Player();
    player.name=cleanText(options.name,12);player.color=COLORS[index%COLORS.length];Object.assign(player,spawn(index));
    client.userData={credit:200,creditAt:performance.now(),times:{}};this.state.players.set(client.sessionId,player);
  }
  onDrop(client){const player=this.state.players.get(client.sessionId);if(player)player.connected=false;this.allowReconnection(client,60).catch(()=>{});}
  onReconnect(client){const player=this.state.players.get(client.sessionId);if(player)player.connected=true;client.userData.credit=200;client.userData.creditAt=performance.now();}
  onLeave(client){const player=this.state.players.get(client.sessionId);this.state.players.delete(client.sessionId);if(player)this.tidy(player.space);this.broadcastRooms();}
  onDispose(){if(this.ownsLobby)active=false;}
}
