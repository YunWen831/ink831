import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdtemp, readFile, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve, dirname } from 'node:path';
import { WorldStore, validateWorld } from '../world-store.js';
import { canStand, isBuildCell, move, tileKey, WORLD, spawn } from '../../../courtyard/world.js';
import { decodePixels, validPixels } from '../../../courtyard/materials.js';
import { partyStatus } from '../../../courtyard/party.js';

test('materials and buildings persist together; concurrent edits serialize and invalid edits leave the save intact',async()=>{
  const directory=await mkdtemp(join(tmpdir(),'dungeon-world-'));
  try{
    const store=await new WorldStore(directory).load();
    const [a,b]=await Promise.all([store.createMaterial('花砖','9'.repeat(256),'甲'),store.createMaterial('蓝砖','c'.repeat(256),'乙')]);
    await Promise.all([store.setTile({col:12,row:21,material:a.id,solid:true}),store.setTile({col:17,row:21,material:b.id,solid:false})]);
    const saved=await new WorldStore(directory).load();assert.equal(saved.data.materials.length,2);assert.equal(saved.data.tiles.length,2);
    const before=await readFile(store.path,'utf8');
    await assert.rejects(store.createMaterial('空白','0'.repeat(256),'甲'));
    await assert.rejects(store.setTile({col:128,row:21,material:a.id,solid:true}));
    await assert.rejects(store.setTile({col:12,row:21,material:'missing-texture',solid:true}));
    assert.equal(await readFile(store.path,'utf8'),before);
    await store.setTile({col:12,row:21,material:null,solid:false});
    const after=await new WorldStore(directory).load();assert.equal(after.data.tiles.length,1);assert.equal(after.data.materials.length,2);
    assert.equal(JSON.parse(await readFile(store.path+'.bak','utf8')).tiles.length,2);
    await writeFile(store.path,'{broken');await assert.rejects(new WorldStore(directory).load());
  }finally{assert.equal(dirname(resolve(directory)),resolve(tmpdir()));await rm(directory,{recursive:true,force:true});}
});

test('the expanded map is fully buildable, including former roads and its edge cells',()=>{
  assert.equal(isBuildCell(15,21),true);assert.equal(isBuildCell(12,21),true);assert.equal(isBuildCell(12,19),true);
  assert.equal(isBuildCell(0,0),true);assert.equal(isBuildCell(127,95),true);assert.equal(isBuildCell(128,95),false);assert.equal(isBuildCell(-1,0),false);
  assert.equal(WORLD.width,4096);assert.equal(WORLD.height,3072);
  const tiles=new Map([[tileKey(12,21),{col:12,row:21,material:'stone',solid:true}]]);
  assert.equal(canStand(400,688,tiles),false);assert.equal(canStand(426,688,tiles),true);
  assert.equal(move({x:427,y:688},-1,0,tiles).x,427);
  tiles.get('12,21').solid=false;assert.equal(canStand(400,688,tiles),true);
  assert.equal(canStand(300,610),true);assert.equal(canStand(480,610),true);assert.equal(canStand(9,10),false);
  const many={version:1,materials:[],tiles:Array.from({length:200},(_,i)=>({col:i%128,row:Math.floor(i/128),material:'stone',solid:false}))};
  assert.equal(validateWorld(many).tiles.length,200);
});

test('legacy colors retain their appearance and custom RGBA colors survive a save and reload',async()=>{
  assert.equal(decodePixels('9'.repeat(256))[0],'c58262ff');
  assert.equal(validPixels('123abcff'.repeat(256)),true);assert.equal(validPixels('00000000'.repeat(256)),false);
  assert.equal(validPixels('ff'.repeat(256)),false);assert.equal(validPixels('x'.repeat(2048)),false);
  const directory=await mkdtemp(join(tmpdir(),'dungeon-rgb-'));
  try{const store=await new WorldStore(directory).load();await store.createMaterial('自选颜色','123abcff'.repeat(256),'甲');const restored=await new WorldStore(directory).load();assert.equal(restored.data.materials[0].pixels,'123abcff'.repeat(256));}
  finally{assert.equal(dirname(resolve(directory)),resolve(tmpdir()));await rm(directory,{recursive:true,force:true});}
});

test('building on the old spawn moves arrivals to free ground without removing tiles',()=>{
  const tiles=new Map([['15,12',{col:15,row:12,material:'stone',solid:true}]]),point=spawn(0,tiles);
  assert.ok(canStand(point.x,point.y,tiles));assert.notDeepEqual(point,{x:480,y:414});assert.equal(tiles.size,1);
});

test('launch rules allow two, three or four ready players and reject solo, extra, offline and unready players',()=>{
  const ready=()=>({ready:true,connected:true});
  for(const count of [2,3,4])assert.equal(partyStatus(Array.from({length:count},ready)).canStart,true);
  for(const count of [0,1,5])assert.equal(partyStatus(Array.from({length:count},ready)).canStart,false);
  assert.equal(partyStatus([ready(),{ready:false,connected:true}]).canStart,false);
  assert.equal(partyStatus([ready(),{ready:true,connected:false}]).canStart,false);
  assert.equal(partyStatus([ready(),ready()],'waiting-for-level').canStart,false);
});
