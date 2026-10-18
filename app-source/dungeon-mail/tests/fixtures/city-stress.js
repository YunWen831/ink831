import assert from 'node:assert/strict';import {Client} from '@colyseus/sdk';
const endpoint='http://127.0.0.1:'+Number(process.env.STRESS_PORT||2587),rooms=[],states=new Map(),pings=[],received=new Map();
const delay=ms=>new Promise(r=>setTimeout(r,ms)),until=async fn=>{const start=Date.now();while(!fn()){if(Date.now()-start>8000)throw Error('Stress join timed out');await delay(20);}};
let pump,events,ping;
try{
 for(let i=0;i<9;i++){const r=await new Client(endpoint).joinOrCreate('courtyard',{name:'压测'+i,clientVersion:18});rooms.push(r);r.onMessage('*',()=>{});r.onMessage('city:state',d=>{states.set(r.sessionId,d);received.set(r.sessionId,(received.get(r.sessionId)||0)+1);});r.onMessage('pong',stamp=>pings.push(Date.now()-stamp));r.send('hello');if(i<8){r.send('city:join');await until(()=>states.has(r.sessionId));}}
 const configure=(group,event)=>rooms.slice(0,8).forEach((r,index)=>r.send('stress:setup',{index,group,event}));configure(false,'zombies');let seq=0,phase=0;
 pump=setInterval(()=>{seq++;for(let i=0;i<8;i++){const r=rooms[i],s=states.get(r.sessionId),angle=(Date.now()/1700+i*.8)%(Math.PI*2);r.send('city:input',{id:s.id,seq,x:Math.cos(angle),y:Math.sin(angle),angle,fire:true,interact:seq%11===0});}const r=rooms[8],p=r.state?.players?.get(r.sessionId);if(p)r.send('input',{space:'lobby',epoch:p.epoch,steps:[{seq,dx:1,dy:0}]});},50);
 ping=setInterval(()=>rooms.forEach(r=>r.send('ping',Date.now())),500);
 events=setInterval(()=>{phase++;configure(phase%2===1,['bombs','geese','blackout','cash','zombies'][phase%5]);},12000);
 await delay(Number(process.env.STRESS_MS||65000));const metrics=await(await fetch(endpoint+'/metrics')).json();assert.equal(states.size,8);assert.ok([...received.values()].every(n=>n>200));assert.ok(pings.length>100);const sorted=pings.sort((a,b)=>a-b),p99=sorted[Math.floor(sorted.length*.99)];assert.ok(p99<150,'loopback ping p99 exceeded 150ms');assert.ok(metrics.windows.slice(1).every(w=>w.mbps<4),'city traffic exceeded reserved 4Mbps');console.log(JSON.stringify({players:8,lobbyObservers:1,snapshots:Object.fromEntries(received),loopbackPingP99ms:p99,...metrics},null,2));
}finally{clearInterval(pump);clearInterval(events);clearInterval(ping);await Promise.all(rooms.filter(r=>r.connection.isOpen).map(r=>r.leave().catch(()=>{})));}
