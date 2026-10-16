import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdtemp, readFile, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve, dirname } from 'node:path';
import { WorldStore } from '../world-store.js';
import { canStand, isBuildCell, move, tileKey } from '../../../courtyard/world.js';

test('materials and buildings persist together; concurrent edits serialize and invalid edits leave the save intact',async()=>{
  const directory=await mkdtemp(join(tmpdir(),'dungeon-world-'));
  try{
    const store=await new WorldStore(directory).load();
    const [a,b]=await Promise.all([store.createMaterial('花砖','9'.repeat(256),'甲'),store.createMaterial('蓝砖','c'.repeat(256),'乙')]);
    await Promise.all([store.setTile({col:12,row:21,material:a.id,solid:true}),store.setTile({col:17,row:21,material:b.id,solid:false})]);
    const saved=await new WorldStore(directory).load();assert.equal(saved.data.materials.length,2);assert.equal(saved.data.tiles.length,2);
    const before=await readFile(store.path,'utf8');
    await assert.rejects(store.createMaterial('空白','0'.repeat(256),'甲'));
    await assert.rejects(store.setTile({col:15,row:21,material:a.id,solid:true}));
    await assert.rejects(store.setTile({col:12,row:21,material:'missing-texture',solid:true}));
    assert.equal(await readFile(store.path,'utf8'),before);
    await store.setTile({col:12,row:21,material:null,solid:false});
    const after=await new WorldStore(directory).load();assert.equal(after.data.tiles.length,1);assert.equal(after.data.materials.length,2);
    assert.equal(JSON.parse(await readFile(store.path+'.bak','utf8')).tiles.length,2);
    await writeFile(store.path,'{broken');await assert.rejects(new WorldStore(directory).load());
  }finally{assert.equal(dirname(resolve(directory)),resolve(tmpdir()));await rm(directory,{recursive:true,force:true});}
});

test('build regions preserve the bridge and road; wall and floor collisions agree with movement',()=>{
  assert.equal(isBuildCell(15,21),false);assert.equal(isBuildCell(12,21),true);assert.equal(isBuildCell(12,19),false);
  const tiles=new Map([[tileKey(12,21),{col:12,row:21,material:'stone',solid:true}]]);
  assert.equal(canStand(400,688,tiles),false);assert.equal(canStand(426,688,tiles),true);
  assert.equal(move({x:427,y:688},-1,0,tiles).x,427);
  tiles.get('12,21').solid=false;assert.equal(canStand(400,688,tiles),true);
  assert.equal(canStand(300,610),false);assert.equal(canStand(480,610),true);
});
