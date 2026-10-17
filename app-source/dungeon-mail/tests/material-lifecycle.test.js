import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {randomUUID} from 'node:crypto';
import {WorldStore} from '../world-store.js';
import {RECYCLE_MS,isLibraryMaterial} from '../../../courtyard/material-lifecycle.js';
const owner='11111111-1111-1111-1111-111111111111';
test('12-hour expiry permanently removes canvases but keeps textures used by buildings',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'art-expiry-'));try{
  const world=await new WorldStore(dir).load(),a=await world.createMaterial('空画布','ff0000ff'.repeat(256),'甲',owner),b=await world.createMaterial('已建画布','00ff00ff'.repeat(256),'甲',owner);
  await world.setTile({col:30,row:30,material:b.id,solid:false},owner);for(const m of [a,b])await world.deleteMaterial(m.id,owner);
  const deadline=Math.max(...world.data.materials.map(m=>m.deletedAt))+RECYCLE_MS;
  assert.equal((await world.pruneMaterials(deadline-10)).removed.length,0);const result=await world.pruneMaterials(deadline);assert.deepEqual(result.removed,[a.id]);assert.equal(result.retained[0].id,b.id);assert.equal(isLibraryMaterial(result.retained[0]),false);assert.equal(result.retained[0].deletedAt,undefined);
  await assert.rejects(world.deleteMaterial(b.id,owner,true),/永久/);await assert.rejects(world.setTile({col:31,row:30,material:b.id,solid:false},owner),/删除/);assert.equal(world.data.tiles[0].material,b.id);
  await world.setTile({col:30,row:30,material:null,solid:false},owner);await world.pruneMaterials(deadline+1);assert.equal(world.data.materials.length,0);
  assert.equal((await new WorldStore(dir).load()).data.materials.length,0);
 }finally{await rm(dir,{recursive:true,force:true});}
});
test('map image textures do not consume library quota or become selectable, and unused parts are collected',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'art-hidden-'));try{
  const world=await new WorldStore(dir).load();await world.transact(data=>{data.materials=Array.from({length:128},()=>({id:randomUUID(),name:'手画',pixels:'ff0000ff'.repeat(256),author:'甲',ownerId:owner}));});
  const result=await world.importMural({cols:1,rows:1,col:30,row:30,pixels:'ff0000ff'.repeat(256)},owner,'甲',()=>true);assert.equal(result.materials.length,1);assert.equal(result.materials[0].mural,true);assert.equal(world.data.materials.filter(isLibraryMaterial).length,128);
  await assert.rejects(world.deleteMaterial(result.materials[0].id,owner),/不存在/);await assert.rejects(world.setTile({col:31,row:30,material:result.materials[0].id,solid:false},owner),/删除/);
  await world.setTile({col:30,row:30,material:null,solid:false},owner);await world.pruneMaterials();assert.equal(world.data.materials.length,128);
 }finally{await rm(dir,{recursive:true,force:true});}
});
