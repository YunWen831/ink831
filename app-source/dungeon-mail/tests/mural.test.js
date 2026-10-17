import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {WorldStore} from '../world-store.js';
import {splitMural} from '../../../courtyard/mural-rules.js';
const owner='11111111-1111-1111-1111-111111111111',other='22222222-2222-2222-2222-222222222222';
const input={cols:2,rows:1,pixels:('ff0000ff'.repeat(16)+'0000ffff'.repeat(16)).repeat(16),col:30,row:30,name:'像素画'};
test('image tiles preserve row order, alpha and dimensions',()=>{const tiles=splitMural(input);assert.equal(tiles[0].pixels,'ff0000ff'.repeat(256));assert.equal(tiles[1].pixels,'0000ffff'.repeat(256));assert.equal(splitMural({...input,pixels:('ff0000ff'.repeat(16)+'00000000'.repeat(16)).repeat(16)}).length,1);assert.throws(()=>splitMural({...input,cols:9}));});
test('mural is atomic, deduplicates materials and respects fresh ownership permissions',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'mural-'));try{const world=await new WorldStore(dir).load();await world.setTile({col:31,row:30,material:'stone',solid:false},other);const before=structuredClone(world.data);await assert.rejects(world.importMural(input,owner,'甲',()=>true),/未开放/);assert.deepEqual(world.data,before);
 await world.protect(other,true);const result=await world.importMural(input,owner,'甲',()=>true);assert.equal(result.tiles.length,2);assert.equal(result.materials.length,2);const again=await world.importMural({...input,col:40},owner,'甲',()=>true);assert.equal(again.materials.length,0);assert.equal(world.data.tiles.length,4);
 await assert.rejects(world.importMural({...input,col:127},owner,'甲',()=>true),/边界/);assert.equal(world.data.tiles.length,4);await assert.rejects(world.importMural(input,owner,'甲',()=>{throw Error('expired');}),/expired/);
 const loaded=await new WorldStore(dir).load();assert.deepEqual(loaded.data,world.data);
 }finally{await rm(dir,{recursive:true,force:true});}
});
