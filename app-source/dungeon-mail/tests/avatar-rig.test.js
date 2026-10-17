import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm,readFile} from 'node:fs/promises';
import {join,resolve,dirname} from 'node:path';
import {tmpdir} from 'node:os';
import {randomUUID} from 'node:crypto';
import {AvatarUpload,AvatarStore} from '../avatars.js';
import {rigTemplate,rigFromFrames,validRig,packRig,unpackRig,RIG_LENGTH,RIG_VIEWS,RIG_PARTS,validAvatarRecord} from '../../../courtyard/avatar-rig.js';
import {avatarTemplate,AVATAR_LENGTH} from '../../../courtyard/avatar-data.js';
import {rigPose} from '../../../courtyard/avatar-motion.js';
test('part uploads are bounded, validated and persisted alongside unchanged legacy characters',async()=>{
  const directory=await mkdtemp(join(tmpdir(),'courtyard-rig-'));
  try{
    const rig=rigTemplate('#cf7459'),text=packRig(rig);assert.ok(validRig(rig));assert.equal(text.length,RIG_LENGTH);assert.ok(RIG_LENGTH<AVATAR_LENGTH/3);assert.deepEqual(unpackRig(text),rig);
    assert.throws(()=>new AvatarUpload(RIG_LENGTH));assert.throws(()=>new AvatarUpload(AVATAR_LENGTH,'parts-v1'));assert.throws(()=>new AvatarUpload(RIG_LENGTH,'arbitrary'));
    const upload=new AvatarUpload(RIG_LENGTH,'parts-v1');assert.throws(()=>upload.append(1,text.slice(0,3072)));assert.throws(()=>upload.finish());for(let i=0;i<text.length;i+=3072)upload.append(i/3072,text.slice(i,i+3072));assert.deepEqual(upload.finish(),rig);assert.throws(()=>upload.append(upload.parts.length,'ff'));
    const bad=structuredClone(rig);bad.views.down.head='bad';assert.equal(validRig(bad),false);assert.equal(validAvatarRecord({rig:bad,frames:avatarTemplate()}),false);
    const empty=structuredClone(rig);for(const p of RIG_PARTS)empty.views.down[p.id]='00000000'.repeat(p.w*p.h);assert.equal(validRig(empty),false);
    const store=new AvatarStore(directory),owner=randomUUID(),legacy=avatarTemplate();await store.save(owner,legacy);assert.deepEqual((await new AvatarStore(directory).get(owner)).frames,legacy);
    const saved=await store.save(owner,rig);assert.deepEqual((await new AvatarStore(directory).get(owner)).rig,rig);assert.equal(saved.userId,owner);assert.equal('frames' in saved,false);assert.ok(validAvatarRecord(saved));assert.deepEqual(JSON.parse(await readFile(store.path(owner),'utf8')).rig,rig);
    assert.ok(validRig(rigFromFrames(legacy)),'old standing artwork can be previewed as parts without changing stored frames');
    const expired=new AvatarUpload(RIG_LENGTH,'parts-v1');expired.expires=0;assert.throws(()=>expired.append(0,text.slice(0,3072)));
  }finally{assert.equal(dirname(resolve(directory)),resolve(tmpdir()));await rm(directory,{recursive:true,force:true});}
});
test('gait bends knees/elbows continuously, mirrors sides and settles into a repeatable idle pose',()=>{
  for(const direction of ['down','up','left','right']){
    const idle=rigPose(direction,0,0);assert.equal(idle.leftLeg.upper,0);assert.equal(idle.rightArm.upper,0);
    const poses=Array.from({length:65},(_,i)=>rigPose(direction,i/64*Math.PI*2,1));
    for(const pose of poses)for(const leg of [pose.leftLeg,pose.rightLeg]){
      assert.ok(Number.isFinite(leg.upper)&&Number.isFinite(leg.lower));if(pose.side){assert.ok(Math.abs(Math.hypot(leg.knee.x-leg.x,leg.knee.y-leg.y)-6)<1e-6);assert.ok(Math.abs(Math.hypot(leg.foot.x-leg.knee.x,leg.foot.y-leg.knee.y)-5)<1e-6);}else assert.ok(Math.abs(leg.upper)<.1,'front-view knees bend in depth, never sideways');
      assert.ok(leg.foot.y<=46&&leg.foot.y>=40);
    }
    for(let i=1;i<poses.length;i++)assert.ok(Math.abs(poses[i].leftLeg.upper-poses[i-1].leftLeg.upper)<.3);
    assert.notEqual(poses[8].leftArm.upper,poses[8].rightArm.upper);assert.notEqual(poses[8].leftLeg.upper,poses[8].leftLeg.lower);
    assert.equal(rigPose(direction,Math.PI,0).bob,idle.bob);assert.equal(idle.mirror,direction==='left');
  }
});
