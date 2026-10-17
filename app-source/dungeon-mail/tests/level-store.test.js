import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm,writeFile} from 'node:fs/promises';
import {join,resolve,dirname} from 'node:path';
import {tmpdir} from 'node:os';
import {randomUUID,createHash} from 'node:crypto';
import {LevelStore,isVerified,MAP_RULESET} from '../level-store.js';
import {canonicalMap,emptyMap,MAP_COLS} from '../../../courtyard/parkour-map.js';
import {selectionBetween,copySelection,pasteSelection,eraseSelection} from '../../../courtyard/map-edit.js';

test('account map library persists layouts/proofs, isolates users, rejects stale overwrites and never trusts client verification',async()=>{
  const directory=await mkdtemp(join(tmpdir(),'courtyard-levels-'));
  try{
    const a=randomUUID(),b=randomUUID(),store=new LevelStore(directory),cells=canonicalMap(emptyMap());
    const first=await store.save(a,{title:'我的关卡',cells,verified:true,proof:'fake'});assert.equal(first.verified,false);
    await assert.rejects(store.get(b,first.id));await assert.rejects(store.remove(b,first.id,1));assert.deepEqual(await store.list(b),[]);
    const verified=await store.save(a,{id:first.id,version:1,title:'已验证',cells},true);assert.ok(verified.verified);
    const reloaded=new LevelStore(directory);assert.ok((await reloaded.get(a,first.id)).verified);
    await assert.rejects(store.save(a,{id:first.id,version:1,title:'另一设备旧稿',cells}),/新版本/);
    const renamed=await store.save(a,{id:first.id,version:2,title:'只改名字',cells});assert.ok(renamed.verified);
    const next=Array.from(cells);next[10*MAP_COLS+8]='1';const edited=await store.save(a,{id:first.id,version:3,title:'改过地图',cells:next.join('')});assert.equal(edited.verified,false);
    assert.equal(isVerified({...verified,proof:'older-ruleset:abc'}),false);
    const list=await store.list(a);assert.equal('cells' in list[0],false);assert.equal('proof' in list[0],false);
    await assert.rejects(store.remove(a,first.id,1),/新版本/);await store.remove(a,first.id,4);assert.deepEqual(await store.list(a),[]);
    const [one,two]=await Promise.all([store.save(a,{title:'一',cells}),store.save(a,{title:'二',cells})]);assert.notEqual(one.id,two.id);assert.equal((await store.list(a)).length,2);
    assert.throws(()=>store.path('../other-user'));await writeFile(store.path(a),'{broken');await assert.rejects(store.list(a));
  }finally{assert.equal(dirname(resolve(directory)),resolve(tmpdir()));await rm(directory,{recursive:true,force:true});}
});

test('selection copy/paste and erasing clip to editable cells while preserving connectors and crystal limits',()=>{
  let cells=canonicalMap(emptyMap()).split('');cells[10*48+8]='1';cells[10*48+9]='2';cells[11*48+8]='3';cells=cells.join('');
  const selection=selectionBetween({c:9,r:11},{c:8,r:10}),stamp=copySelection(cells,selection);
  assert.deepEqual(stamp.rows,['12','30']);const pasted=pasteSelection(cells,stamp,15,10);assert.equal(pasted.slice(10*48+15,10*48+17),'12');assert.equal(pasted[11*48+15],'3');
  assert.equal(eraseSelection(cells,selection)[10*48+8],'0');const clipped=pasteSelection(cells,stamp,3,21);assert.equal(clipped[21*48+3],'0');assert.equal(clipped[22*48+3],'1');
  assert.equal(selectionBetween({c:-10,r:-10},{c:2,r:1}),null);assert.equal(copySelection(cells,null),null);
  const many=pasteSelection(cells,{width:40,height:2,rows:['3'.repeat(40),'3'.repeat(40)]},4,5);assert.equal([...many].filter(c=>c==='3').length,32);
});
test('previous-version map files and layouts remain loadable while completion proofs require revalidation',async()=>{
  const directory=await mkdtemp(join(tmpdir(),'courtyard-legacy-levels-'));
  try{
    const owner=randomUUID(),store=new LevelStore(directory),cells=canonicalMap(emptyMap());const saved=await store.save(owner,{title:'旧作品',cells},true);
    const previous={...saved,proof:'parkour-1:'+createHash('sha256').update(cells).digest('hex')};delete previous.verified;
    assert.notEqual(MAP_RULESET,'parkour-1');await writeFile(store.path(owner),JSON.stringify({version:1,maps:[previous]}));
    const loaded=await store.get(owner,saved.id);assert.equal(loaded.cells,cells);assert.equal(loaded.verified,false);assert.equal((await store.list(owner))[0].verified,false);
    const verified=await store.save(owner,{id:saved.id,version:1,title:'旧作品',cells},true);assert.ok(verified.verified);assert.equal(verified.cells,cells);
  }finally{assert.equal(dirname(resolve(directory)),resolve(tmpdir()));await rm(directory,{recursive:true,force:true});}
});
