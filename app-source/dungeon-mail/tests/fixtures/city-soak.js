import assert from 'node:assert/strict';import {CityMatch} from '../../city-match.js';import {CITY,EVENTS,free} from '../../../../courtyard/city-rules.js';
let seed=123,random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};const city=new CityMatch({random,send:()=>{}}),peaks={npcs:0,cars:0,loot:0,objects:0,effects:0,trades:0,rams:0};
for(let i=0;i<8;i++)city.add({id:String(i),name:'长期测试'+i});let seq=0;const start=performance.now();
for(let frame=0;frame<36000;frame++){
 if(frame%600===0)city.startEvent(Object.keys(EVENTS)[Math.floor(frame/600)%6]);
 for(const p of city.players.values()){const angle=frame/90+Number(p.id);city.input(p.id,{id:city.id,seq:++seq,x:Math.cos(angle),y:Math.sin(angle),angle:angle%(Math.PI*2),fire:true,interact:frame%11===0});}
 city.tick(.05);for(const key in peaks)peaks[key]=Math.max(peaks[key],city[key].size??city[key].length);
 if(frame%200===0)for(const p of city.players.values()){assert.ok(free(p.x,p.y,11),'player penetrated geometry');assert.ok(p.cash>=0&&Number.isSafeInteger(p.cash));}
}
assert.ok(peaks.npcs<=CITY.npcLimit&&peaks.cars<=CITY.carLimit&&peaks.loot<=CITY.lootLimit&&peaks.objects<=40&&peaks.effects<=36&&peaks.trades<=8&&peaks.rams<=512);for(const p of [...city.players.values()])city.remove(p.id);assert.equal(city.players.size,0);console.log(JSON.stringify({simulatedMinutes:30,players:8,elapsedSeconds:Math.round((performance.now()-start)/100)/10,peaks,memory:process.memoryUsage()}));
