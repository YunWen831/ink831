import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdtemp,rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join,resolve,dirname } from 'node:path';
import { randomUUID } from 'node:crypto';
import { WorldStore } from '../world-store.js';
import { AvatarStore,AvatarUpload } from '../avatars.js';
import { avatarTemplate,AVATAR_LENGTH,validAvatar } from '../../../courtyard/avatar-data.js';

test('ownership protects deletion AND replacement, follows the placer, and legacy content cannot be claimed by nickname',async()=>{
  const directory=await mkdtemp(join(tmpdir(),'courtyard-owners-'));
  try{
    const a=randomUUID(),b=randomUUID(),store=await new WorldStore(directory).load();
    const art=await store.createMaterial('同名作品','12ab34ff'.repeat(256),'同名',a);
    await assert.rejects(store.deleteMaterial(art.id,b));
    await store.setTile({col:20,row:20,material:art.id,solid:false},b);
    assert.equal(store.data.tiles[0].ownerId,b);
    for(const material of [null,'wood'])await assert.rejects(store.setTile({col:20,row:20,material,solid:false},a));
    await assert.rejects(store.setTile({col:21,row:20,material:'stone',solid:false},''));
    await store.protect(b,true);await store.setTile({col:20,row:20,material:'wood',solid:false},a);
    assert.equal(store.data.tiles[0].ownerId,a);await store.protect(a,false);
    await assert.rejects(store.setTile({col:20,row:20,material:null,solid:false},b));
    await store.setTile({col:21,row:20,material:art.id,solid:false},a);
    await store.deleteMaterial(art.id,a);assert.ok(store.data.materials[0].deletedAt);assert.equal(store.data.tiles[1].material,art.id);
    await assert.rejects(store.setTile({col:22,row:20,material:art.id,solid:false},a));
    await store.deleteMaterial(art.id,a,true);assert.equal(store.data.materials[0].deletedAt,undefined);
    const legacy=await store.createMaterial('旧作品','9'.repeat(256),'同名');await assert.rejects(store.deleteMaterial(legacy.id,a));
    await store.setTile({col:23,row:20,material:'stone',solid:false});await assert.rejects(store.setTile({col:23,row:20,material:null,solid:false},a));
    const reloaded=await new WorldStore(directory).load();assert.equal(reloaded.data.tiles[0].ownerId,a);assert.equal(reloaded.data.protection[a],false);
    await store.deleteMaterial(art.id,a);await store.transact(data=>{data.materials.find(m=>m.id===art.id).deletedAt=Date.now()-8*86400000;});await assert.rejects(store.deleteMaterial(art.id,a,true));
  }finally{assert.equal(dirname(resolve(directory)),resolve(tmpdir()));await rm(directory,{recursive:true,force:true});}
});

test('character uploads reject partial, misordered and expired data; all direction/frame pixels persist',async()=>{
  const directory=await mkdtemp(join(tmpdir(),'courtyard-avatars-'));
  try{
    const frames=avatarTemplate(),text=frames.join('');assert.equal(text.length,AVATAR_LENGTH);assert.ok(validAvatar(frames));
    const upload=new AvatarUpload(text.length);assert.throws(()=>upload.append(1,text.slice(0,3072)));assert.throws(()=>upload.finish());
    for(let offset=0;offset<text.length;offset+=3072)upload.append(offset/3072,text.slice(offset,offset+3072));
    assert.deepEqual(upload.finish(),frames);const owner=randomUUID(),store=new AvatarStore(directory);const result=await store.save(owner,upload.finish());
    assert.deepEqual((await new AvatarStore(directory).get(owner)).frames,frames);assert.equal(result.userId,owner);
    assert.throws(()=>store.path('../not-an-account'));assert.throws(()=>new AvatarUpload(123));
    const expired=new AvatarUpload(text.length);expired.expires=0;assert.throws(()=>expired.append(0,text.slice(0,3072)));
    assert.equal(validAvatar(Array(12).fill('00000000'.repeat(1536))),false);
  }finally{assert.equal(dirname(resolve(directory)),resolve(tmpdir()));await rm(directory,{recursive:true,force:true});}
});
