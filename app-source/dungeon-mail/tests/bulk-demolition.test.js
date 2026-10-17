import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {WorldStore} from '../world-store.js';
const a='11111111-1111-1111-1111-111111111111',b='22222222-2222-2222-2222-222222222222';
test('administrator regional demolition bypasses all ownership and protection, preserves canvases and other cells',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'demolition-'));try{const world=await new WorldStore(dir).load(),art=await world.createMaterial('作品','ff0000ff'.repeat(256),'甲',a);await world.setTile({col:30,row:30,material:art.id,solid:true},a);await world.setTile({col:31,row:30,material:'wood',solid:false},b);await world.setTile({col:32,row:30,material:'stone',solid:true});await world.setTile({col:33,row:30,material:'stone',solid:false},a);
 const preview=world.previewDemolition({col1:32,row1:30,col2:30,row2:30});assert.equal(preview.count,3);let calls=0;const removed=await world.demolishRegion(preview.rect,preview.digest,()=>{calls++;});assert.equal(calls,1);assert.equal(removed.length,3);assert.equal(world.data.tiles.length,1);assert.equal(world.data.tiles[0].col,33);assert.equal(world.data.materials[0].id,art.id);assert.equal((await new WorldStore(dir).load()).data.tiles.length,1);
 }finally{await rm(dir,{recursive:true,force:true});}
});
test('preview conflicts and queued role revocation cancel the entire demolition',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'demolition-conflict-'));try{const world=await new WorldStore(dir).load();const rect={col1:30,row1:30,col2:31,row2:30};await world.setTile({col:30,row:30,material:'stone',solid:false},a);const preview=world.previewDemolition(rect);await world.setTile({col:31,row:30,material:'wood',solid:false},b);await assert.rejects(world.demolishRegion(rect,preview.digest,()=>{}),/已变化/);assert.equal(world.data.tiles.length,2);
 const current=world.previewDemolition(rect);let live=true;const queued=world.transact(()=>{live=false;});const deletion=world.demolishRegion(current.rect,current.digest,()=>{if(!live)throw Error('需要管理员权限');});await queued;await assert.rejects(deletion,/管理员/);assert.equal(world.data.tiles.length,2);assert.throws(()=>world.previewDemolition({...rect,col1:-1}));
 }finally{await rm(dir,{recursive:true,force:true});}
});
