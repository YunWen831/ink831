import {test} from 'node:test';
import assert from 'node:assert/strict';
import {MaterialUpload} from '../material-upload.js';
import {decodePixels,validPixels,materialSize,resizePixels} from '../../../courtyard/materials.js';

test('16, 32 and 64 pixel artwork preserves RGBA and resizing keeps pixel edges',()=>{
  const old=decodePixels('9'.repeat(256));assert.equal(old[0],'c58262ff');old[0]='123abcff';old[255]='00000000';
  const large=resizePixels(old,64);assert.equal(large.length,4096);assert.equal(large[3*64+3],'123abcff');assert.equal(large[4095],'00000000');assert.deepEqual(resizePixels(large,16),old);
  for(const size of [16,32,64]){const pixels='ff00ffff'.repeat(size*size);assert.equal(materialSize(pixels),size);assert.equal(decodePixels(pixels).length,size*size);assert.equal(validPixels(pixels),true);assert.equal(validPixels('00000000'.repeat(size*size)),false);}
  assert.equal(validPixels('ff00ffff'.repeat(18*18)),false);assert.equal(validPixels('ff00ffff'.repeat(128*128)),false);
});
test('large material upload is bounded, ordered, complete and expires',()=>{
  let now=0;const payload='00ff00ff'.repeat(4096),upload=new MaterialUpload('绿色',payload.length,()=>now);
  for(let i=0;i<payload.length;i+=2048)upload.append(i/2048,payload.slice(i,i+2048));assert.equal(upload.finish(),payload);
  assert.throws(()=>new MaterialUpload('太大',131072));
  const bad=new MaterialUpload('错误',8192,()=>now);assert.throws(()=>bad.append(1,'f'.repeat(2048)));assert.throws(()=>bad.append(0,'f'.repeat(4096)));assert.throws(()=>bad.append(0,'x'.repeat(2048)));assert.throws(()=>bad.finish());
  bad.append(0,'f'.repeat(2048));now=21000;assert.throws(()=>bad.append(1,'f'.repeat(2048)));assert.throws(()=>bad.finish());
});
