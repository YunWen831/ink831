import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdtemp,readFile,rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join,resolve,dirname } from 'node:path';
import { AccountStore,cookieToken,sessionCookie,COOKIE_NAME } from '../accounts.js';

test('accounts persist only salted hashes; sessions rotate, revoke and survive reload without changing identity',async()=>{
  const directory=await mkdtemp(join(tmpdir(),'courtyard-accounts-'));
  try{
    const store=await new AccountStore(directory).load(),password='Test-only password 2026!';
    const a=await store.register({username:'Alice_1',nickname:'画家',password});
    assert.equal(a.user.username,'alice_1');assert.equal(store.session(a.token).user.id,a.user.id);
    await assert.rejects(store.register({username:'ALICE_1',password}));
    await assert.rejects(store.login({username:'alice_1',password:'incorrect'}));
    const b=await store.register({username:'bob_2',nickname:'画家',password});assert.notEqual(a.user.id,b.user.id);
    assert.notEqual(store.data.users[0].salt,store.data.users[1].salt);assert.notEqual(store.data.users[0].passwordHash,store.data.users[1].passwordHash);
    const raw=await readFile(store.path,'utf8');for(const secret of [password,a.token,a.recoveryCode])assert.equal(raw.includes(secret),false);
    const loaded=await new AccountStore(directory).load();assert.equal(loaded.session(a.token).user.id,a.user.id);
    await loaded.profile(a.user.id,'改了昵称');assert.equal(loaded.session(a.token).user.nickname,'改了昵称');
    const login=await loaded.login({username:'ALICE_1',password});assert.equal(login.user.id,a.user.id);
    await loaded.logout(loaded.session(login.token).hash);assert.equal(loaded.session(login.token),null);assert.ok(loaded.session(a.token));
    await assert.rejects(loaded.recover({username:'alice_1',password:'new test password!',recoveryCode:b.recoveryCode}));
    const recovered=await loaded.recover({username:'alice_1',password:'new test password!',recoveryCode:a.recoveryCode});
    assert.equal(recovered.user.id,a.user.id);assert.equal(loaded.session(a.token),null);assert.ok(loaded.session(recovered.token));
    await assert.rejects(loaded.recover({username:'alice_1',password:'new test password!',recoveryCode:a.recoveryCode}));
    const changed=await loaded.changePassword(a.user.id,'new test password!','next test password!');assert.equal(loaded.session(recovered.token),null);assert.ok(loaded.session(changed.token));
    assert.ok(loaded.session(b.token));
    assert.equal(cookieToken(sessionCookie(changed.token)),changed.token);assert.equal(cookieToken(COOKIE_NAME+'=bad'),null);
    assert.match(sessionCookie(changed.token),/HttpOnly; SameSite=Strict/);assert.match(sessionCookie(null),/Max-Age=0/);
  }finally{assert.equal(dirname(resolve(directory)),resolve(tmpdir()));await rm(directory,{recursive:true,force:true});}
});
