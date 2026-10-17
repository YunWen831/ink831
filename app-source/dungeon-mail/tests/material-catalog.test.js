import {test} from 'node:test';import assert from 'node:assert/strict';
import {materialInfo} from '../material-catalog.js';
test('catalog omits full pixels, preserves lifecycle and uses stable content revisions',()=>{
  const m={id:'one',name:'作品',pixels:'ff0000ff'.repeat(4096),ownerId:'owner',deletedAt:1};const info=materialInfo(m);
  assert.equal(info.pixels,undefined);assert.equal(info.thumbnail.length,128);assert.equal(info.deletedAt,1);assert.equal(info.ownerId,'owner');assert.equal(materialInfo(m),info);assert.equal(materialInfo({...m}).rev,info.rev);assert.notEqual(materialInfo({...m,pixels:'00ff00ff'.repeat(4096)}).rev,info.rev);assert.ok(JSON.stringify(info).length<300);
});
test('map-only and retired textures have no library thumbnails, legacy indexed colors remain valid',()=>{
  assert.equal(materialInfo({id:'one',pixels:'1'.repeat(256)}).thumbnail,'f5ecd5ff'.repeat(16));
  for(const flag of ['mural','retired'])assert.equal(materialInfo({id:flag,pixels:'ff0000ff'.repeat(256),[flag]:true}).thumbnail,undefined);
});
