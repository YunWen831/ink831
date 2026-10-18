// Isolated loopback-only test harness. Never imported by the production server.
import {Server as HttpServer} from 'node:http';
import {monitorEventLoopDelay} from 'node:perf_hooks';
import {Server} from '@colyseus/core';
import {Encoder} from '@colyseus/schema';
import {WebSocketTransport} from '@colyseus/ws-transport';
import express from 'express';
import {Courtyard,worldStore,accounts,avatars,levelStore} from '../../hall.js';
Encoder.BUFFER_SIZE=128*1024;
const delay=monitorEventLoopDelay({resolution:10});delay.enable();let started=performance.now(),cpu=process.cpuUsage(),bytes=0,frames=0,maxSnapshot=0,peakRss=0;const windows=[];
class StressHall extends Courtyard{
  onCreate(){super.onCreate();this.onMessage('stress:setup',(client,data)=>{
    const p=this.city?.players.get(client.sessionId);if(!p)return;const i=Number(data.index),group=data.group===true;p.cash=100000;p.shield=0;p.hp=100;p.gun='rifle';p.ammo=24;p.reserve=240;p.wanted=3;p.heatAt=this.city.t;p.progress=null;
    const point=group?{x:520+(i%4)*55,y:570+Math.floor(i/4)*50}:{x:520+(i%3)*1024,y:60+Math.floor(i/3)*560};Object.assign(p,point);
    if(i<4){let c=this.city.cars.find(c=>c.id===p.car);if(!c){c={id:'stress-car-'+i,hp:180,heading:0,speed:0,owner:p.id,driver:p.id,kind:'car'};this.city.cars.push(c);p.car=c.id;}Object.assign(c,point,{hp:180,driver:p.id});}
    if(i===0){this.city.startEvent(data.event||'zombies');while(this.city.npcs.length<48)this.city.npc('zombie',this.city.point());}
  });}
  async onJoin(client,options,auth){const raw=client.raw.bind(client);client.raw=(data,...args)=>{bytes+=data.byteLength;maxSnapshot=Math.max(maxSnapshot,data.byteLength);frames++;return raw(data,...args);};return super.onJoin(client,options,auth);}
}
const app=express();app.get('/metrics',(req,res)=>res.json({windows,memory:process.memoryUsage(),peakRss,maxSnapshot,frames}));const http=new HttpServer(app);
const server=new Server({greet:false,gracefullyShutdown:false,transport:new WebSocketTransport({server:http,maxPayload:4096})});server.define('courtyard',StressHall);await server.listen(Number(process.env.PORT||2587),'127.0.0.1');
setInterval(()=>{const now=performance.now(),elapsed=now-started,usage=process.cpuUsage(cpu),memory=process.memoryUsage();peakRss=Math.max(peakRss,memory.rss);windows.push({seconds:+(elapsed/1000).toFixed(2),cpuOneCorePct:+((usage.user+usage.system)/elapsed/10).toFixed(2),mbps:+(bytes*8/elapsed/1000).toFixed(3),loopP99ms:+(delay.percentile(99)/1e6).toFixed(2),rssMB:+(memory.rss/1048576).toFixed(1),heapMB:+(memory.heapUsed/1048576).toFixed(1)});bytes=0;started=now;cpu=process.cpuUsage();delay.reset();},5000).unref();
process.on('SIGTERM',async()=>{await server.gracefullyShutdown(false);await worldStore.flush();await accounts.flush();await avatars.flush();await levelStore.flush();process.exit(0);});console.log('City stress server ready');
