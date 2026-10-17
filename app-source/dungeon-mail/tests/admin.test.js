import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,writeFile,readFile,rm} from 'node:fs/promises';
import {join,resolve,dirname} from 'node:path';
import {tmpdir} from 'node:os';
import {AccountStore} from '../accounts.js';
import {WorldStore} from '../world-store.js';
test('administrators are bound to external account IDs; bans/recovery revoke sessions and never expose credentials',async()=>{
  const directory=await mkdtemp(join(tmpdir(),'courtyard-admin-'));
  try{
    const store=await new AccountStore(directory).load(),password='Administration QA password!';const ink=await store.register({username:'ink',password,admin:true}),target=await store.register({username:'player',password});
    assert.equal(ink.user.admin,false);assert.equal(store.user(store.find('ink')).admin,false);await writeFile(join(directory,'admins.json'),JSON.stringify({version:1,ids:[ink.user.id]}));await store.load();const hash=store.session(ink.token).hash,other=store.session(target.token).hash;
    assert.ok(store.user(store.find('ink')).admin);assert.throws(()=>store.adminUsers(other),/管理员/);await assert.rejects(store.adminAction(other,ink.user.id,'ban'));assert.ok(store.session(ink.token));
    const list=store.adminUsers(hash);for(const u of list)for(const key of ['passwordHash','salt','recoveryHash','token'])assert.equal(key in u,false);
    await assert.rejects(store.adminAction(hash,ink.user.id,'ban'),/保护/);await assert.rejects(store.adminAction(hash,ink.user.id,'recovery'),/保护/);
    await store.adminAction(hash,target.user.id,'ban',{note:'测试封禁'});assert.equal(store.session(target.token),null);assert.equal(store.valid(other),false);await assert.rejects(store.login({username:'player',password}),/停用/);await assert.rejects(store.recover({username:'player',password,recoveryCode:target.recoveryCode}),/停用/);
    await store.adminAction(hash,target.user.id,'unban');const login=await store.login({username:'player',password});assert.ok(store.session(login.token));await store.adminAction(hash,target.user.id,'logout');assert.equal(store.session(login.token),null);
    const reset=await store.adminAction(hash,target.user.id,'recovery');await assert.rejects(store.login({username:'player',password}),/找回码/);await assert.rejects(store.recover({username:'player',password,recoveryCode:target.recoveryCode}));
    const recovered=await store.recover({username:'player',password:'Recovered new password!',recoveryCode:reset.recoveryCode});assert.ok(store.session(recovered.token));await assert.rejects(store.recover({username:'player',password,recoveryCode:reset.recoveryCode}));
    await store.adminAction(hash,target.user.id,'rename',{nickname:'新的昵称'});assert.equal(store.find('player').nickname,'新的昵称');
    const audit=store.adminAudit(hash);assert.ok(audit.some(e=>e.action==='recovery'));const raw=await readFile(store.path,'utf8');for(const secret of [password,reset.recoveryCode,recovered.token])assert.equal(raw.includes(secret),false);
    const loaded=await new AccountStore(directory).load();assert.ok(loaded.isAdmin(ink.user.id));assert.equal(loaded.find('player').nickname,'新的昵称');
    const world=await new WorldStore(directory).load(),art=await world.createMaterial('作品','ff0000ff'.repeat(256),'画家',target.user.id);
    await assert.rejects(world.deleteMaterial(art.id,ink.user.id));const authorize=()=>{store.requireAdmin(hash);return true;};await world.deleteMaterial(art.id,ink.user.id,false,authorize);assert.ok(world.data.materials[0].deletedAt);await world.deleteMaterial(art.id,ink.user.id,true,authorize);assert.equal(world.data.materials[0].deletedAt,undefined);
    await world.protect(target.user.id,true,authorize);assert.equal(world.data.protection[target.user.id],true);await store.logout(hash);await assert.rejects(world.protect(target.user.id,false,authorize),/管理员/);assert.equal(world.data.protection[target.user.id],true);
  }finally{assert.equal(dirname(resolve(directory)),resolve(tmpdir()));await rm(directory,{recursive:true,force:true});}
});
