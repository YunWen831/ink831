import {test} from 'node:test';
import assert from 'node:assert/strict';
import {LobbyPlay} from '../lobby-play.js';
import {lobbyMove,CAR,canDamage} from '../../../courtyard/lobby-rules.js';
import {canStand,WORLD} from '../../../courtyard/world.js';

function fixture(){let time=10000,forced=false;const person=(x,y)=>({x,y,space:'lobby',connected:true,pvp:true,hp:100,shieldUntil:0,epoch:0,driving:false,speed:0,heading:0,weapon:'pistol',ammo:8,reloadUntil:0,respawnAt:0});
  const players=new Map([['a',person(400,500)],['b',person(500,500)],['c',person(650,500)]]),tiles=new Map(),events=[];
  const game=new LobbyPlay({players,tiles,forced:()=>forced,now:()=>time,random:()=>.5,emit:(...v)=>events.push(v)});
  return{game,players,tiles,events,a:players.get('a'),b:players.get('b'),advance:ms=>{time+=ms;game.tick();},force:value=>forced=value,now:()=>time};
}
test('mutual PvP, admin override, shields and logical room isolation gate all damage',()=>{
  const f=fixture();f.b.pvp=false;assert.equal(f.game.attack('a',{angle:0}),true);assert.equal(f.b.hp,100);assert.equal(f.players.get('c').hp,80);
  f.force(true);f.advance(400);f.game.attack('a',{angle:0});assert.equal(f.b.hp,80);
  f.b.shieldUntil=f.now()+1000;f.advance(400);f.game.attack('a',{angle:0});assert.equal(f.b.hp,80);
  f.b.space='ROOM';f.advance(1000);f.game.attack('a',{angle:0});assert.equal(f.b.hp,80);
  f.a.connected=false;assert.equal(f.game.attack('a',{angle:0}),false);assert.equal(canDamage(f.a,f.b,true,f.now()),false);
});
test('shots stop at the nearest target and walls, invalid angles and packet flooding cannot bypass cooldown',()=>{
  const f=fixture();assert.equal(f.game.attack('a',{angle:NaN}),false);assert.equal(f.game.attack('a',{angle:1e9}),false);
  f.game.attack('a',{angle:0});assert.equal(f.b.hp,80);assert.equal(f.players.get('c').hp,100);for(let i=0;i<100;i++)f.game.attack('a',{angle:0});assert.equal(f.b.hp,80);assert.equal(f.a.ammo,7);
  f.tiles.set('14,15',{col:14,row:15,solid:true});f.advance(400);f.game.attack('a',{angle:0});assert.equal(f.b.hp,80);
});
test('both guns use distinct magazines, cadence and server timed reload',()=>{
  for(const [weapon,count,interval,reload]of [['pistol',8,350,1200],['rifle',24,150,1800]]){const f=fixture();f.a.weapon=weapon;f.a.ammo=count;
    for(let i=0;i<count;i++){assert.equal(f.game.attack('a',{angle:Math.PI/2}),true);if(i<count-1)f.advance(interval);}
    assert.equal(f.a.ammo,0);assert.equal(f.a.reloadUntil,f.now()+reload);assert.equal(f.game.attack('a',{angle:Math.PI/2}),false);f.advance(reload-1);assert.equal(f.a.ammo,0);f.advance(1);assert.equal(f.a.ammo,count);assert.equal(f.a.reloadUntil,0);
  }
});
test('knife has range, direction, wall occlusion and repeat interval',()=>{
  const f=fixture();f.a.weapon='knife';f.b.x=435;f.game.attack('a',{angle:Math.PI});assert.equal(f.b.hp,100);f.advance(500);f.game.attack('a',{angle:0});assert.equal(f.b.hp,65);f.advance(500);f.tiles.set('13,15',{col:13,row:15,solid:true});f.game.attack('a',{angle:0});assert.equal(f.b.hp,65);
});
test('death blocks actions, respawns without changing preference and protects the new life',()=>{
  const f=fixture();for(let i=0;i<5;i++){f.game.attack('a',{angle:0});if(i<4)f.advance(400);}assert.equal(f.b.hp,0);assert.ok(f.b.respawnAt);assert.equal(f.game.toggle('b',{kind:'car',enabled:true}),false);assert.equal(f.game.attack('b',{angle:0}),false);
  f.advance(2999);assert.equal(f.b.hp,0);f.advance(1);assert.equal(f.b.hp,100);assert.equal(f.b.pvp,true);assert.equal(f.b.weapon,'');assert.equal(canDamage(f.a,f.b,true,f.now()),false);assert.ok(canStand(f.b.x,f.b.y,f.tiles));
});
test('personal toggle cannot escape active combat; forced mode preserves the preference',()=>{
  const f=fixture();f.game.attack('a',{angle:0});assert.equal(f.game.toggle('a',{kind:'pvp',enabled:false}),false);assert.equal(f.game.toggle('b',{kind:'pvp',enabled:false}),false);f.advance(8001);assert.equal(f.game.toggle('a',{kind:'pvp',enabled:false}),true);f.force(true);assert.equal(f.a.pvp,false);f.force(false);assert.equal(f.a.pvp,false);
});
test('pickups validate distance, active lobby, cooldown and reset gun ammo',()=>{
  const f=fixture();f.game.pickups=[{id:'one',kind:'rifle',x:400,y:500,readyAt:0}];assert.equal(f.game.pickup('b'),false);assert.equal(f.game.pickup('a'),true);assert.equal(f.a.weapon,'rifle');assert.equal(f.a.ammo,24);assert.equal(f.game.pickup('a'),false);f.advance(12001);assert.equal(f.game.snapshot().length,1);f.a.driving=true;assert.equal(f.game.pickup('a'),false);
});
test('car accelerates, brakes, turns and cannot tunnel through a one-tile wall at maximum speed',()=>{
  let p={x:400,y:500,hp:100,driving:true,speed:0,heading:0};const tiles=new Map([['16,15',{col:16,row:15,solid:true}]]);
  for(let i=0;i<180;i++){p={...p,...lobbyMove(p,1,0,tiles)};assert.ok(canStand(p.x,p.y,tiles));assert.ok(p.x<=502);assert.ok(p.speed<=CAR.maxSpeed);}
  p={...p,x:400,y:600,speed:CAR.maxSpeed};const heading=lobbyMove(p,0,1,tiles).heading;assert.ok(heading>0&&heading<Math.PI/2);
  for(let i=0;i<60;i++)p={...p,...lobbyMove(p,0,0,tiles)};assert.equal(p.speed,0);
  let car={x:400,y:900,hp:100,driving:true,speed:CAR.maxSpeed,heading:0};for(let i=0;i<50;i++)car={...car,...lobbyMove(car,1,0)};assert.ok(Math.abs(car.x-400-WORLD.speed*3)<.001);
});
test('swept car impact honors consent, shield, speed and per-victim cooldown',()=>{
  const f=fixture();f.a.driving=true;f.a.speed=600;f.a.x=490;f.b.pvp=false;f.game.moved('a',{x:470,y:500});assert.equal(f.b.hp,100);f.force(true);f.game.moved('a',{x:470,y:500});assert.equal(f.b.hp,57);f.game.moved('a',{x:470,y:500});assert.equal(f.b.hp,57);f.advance(1001);f.b.x=500;f.a.speed=600;f.game.moved('a',{x:470,y:500});assert.equal(f.b.hp,14);assert.equal(f.game.attack('a',{angle:0}),false);
});
