export function createAccounts({endpoint,onUser,onSession,onProtection,notify}){
  const $=id=>document.getElementById(id);let user=null,mode='login',pendingSession=false,working=false;
  async function request(path,body){
    const response=await fetch(endpoint()+'/api/account/'+path,{method:body===undefined?'GET':'POST',credentials:'include',headers:body===undefined?{}:{'Content-Type':'application/json'},body:body===undefined?undefined:JSON.stringify(body),signal:AbortSignal.timeout(20000)});
    const data=await response.json();if(!response.ok)throw Error(data.error||'操作失败，请稍后重试。');return data;
  }
  function setUser(value){user=value;onUser(user);$('accountButton').textContent=user?'我的账号':'登录';$('signInButton').textContent=user?'我的账号':'登录 / 注册';$('enterButton').textContent=user?'进入大厅':'游客进入';$('nickname').hidden=!!user;$('nickname').required=!user;$('welcomeName').textContent=user?user.nickname:'';$('welcomeName').hidden=!user;}
  function tab(value){
    mode=value;$('authNicknameLabel').hidden=value!=='register';$('authRecoveryLabel').hidden=value!=='recover';$('authConfirmLabel').hidden=value==='login';
    $('authConfirm').required=value!=='login';$('authRecovery').required=value==='recover';$('authPassword').autocomplete=value==='login'?'current-password':'new-password';$('authPassword').minLength=value==='login'?1:12;
    $('authPassword').placeholder=value==='login'?'密码':'至少 12 个字符';
    $('authSubmit').textContent=value==='login'?'登录并进入':value==='register'?'创建账号':'重设密码';$('authMessage').textContent='';
    for(const button of document.querySelectorAll('[data-auth-mode]')){button.classList.toggle('active',button.dataset.authMode===value);button.setAttribute('aria-pressed',String(button.dataset.authMode===value));}
  }
  function panel(){
    $('accountAuth').hidden=!!user;$('accountProfile').hidden=!user;$('recoveryPanel').hidden=true;
    $('accountTitle').textContent=user?'我的账号':'登录';
    if(user){$('accountUsername').textContent=user.username;$('profileNickname').value=user.nickname;}
  }
  function recovery(data){
    setUser(data.user);pendingSession=true;
    $('accountAuth').hidden=true;$('accountProfile').hidden=true;$('recoveryPanel').hidden=false;$('accountTitle').textContent='保存找回码';$('recoveryCode').value=data.recoveryCode;
  }
  async function enterSession(){pendingSession=false;$('recoveryCode').value='';$('accountDialog').close();await onSession();}
  async function run(button,action,message){if(working)return;working=true;button.disabled=true;$(message).textContent='';try{await action();}catch(error){$(message).textContent=error.message;}finally{working=false;button.disabled=false;}}
  $('accountForm').addEventListener('submit',event=>{
    event.preventDefault();run($('authSubmit'),async()=>{
      if(mode!=='login'&&$('authPassword').value!==$('authConfirm').value)throw Error('两次密码不一致。');
      const data=await request(mode,{username:$('authUsername').value,password:$('authPassword').value,nickname:$('authNickname').value,recoveryCode:$('authRecovery').value});
      $('authPassword').value='';$('authConfirm').value='';$('authRecovery').value='';
      if(data.recoveryCode)recovery(data);else{setUser(data.user);await enterSession();}
    },'authMessage');
  });
  for(const button of document.querySelectorAll('[data-auth-mode]'))button.addEventListener('click',()=>tab(button.dataset.authMode));
  $('profileForm').addEventListener('submit',event=>{event.preventDefault();run($('saveProfile'),async()=>{const data=await request('profile',{nickname:$('profileNickname').value});setUser(data.user);notify('昵称已更新');},'profileMessage');});
  $('passwordForm').addEventListener('submit',event=>{event.preventDefault();run($('changePassword'),async()=>{
    if($('newPassword').value!==$('newPasswordConfirm').value)throw Error('两次新密码不一致。');
    const data=await request('password',{oldPassword:$('oldPassword').value,password:$('newPassword').value});$('passwordForm').reset();recovery(data);
  },'profileMessage');});
  $('allowDemolition').addEventListener('change',()=>{const value=$('allowDemolition').checked;$('allowDemolition').disabled=true;onProtection(value);});
  $('logoutButton').addEventListener('click',()=>run($('logoutButton'),async()=>{await request('logout',{});setUser(null);$('accountDialog').close();await onSession(false);notify('已退出账号');},'profileMessage'));
  $('accountEnter').addEventListener('click',()=>enterSession());
  $('recoveryDone').addEventListener('click',()=>enterSession());
  $('copyRecovery').addEventListener('click',async()=>{try{await navigator.clipboard.writeText($('recoveryCode').value);notify('找回码已复制，请妥善保存');}catch{$('recoveryCode').select();}});
  $('accountDialog').addEventListener('cancel',event=>{if(pendingSession){event.preventDefault();notify('请先保存找回码，再点进入大厅');}});
  $('accountDialog').addEventListener('close',()=>{if(pendingSession)$('accountDialog').showModal();});
  tab('login');
  return {
    get user(){return user;},
    async load(){try{const data=await request('me');setUser(data.user);}catch{setUser(null);}},
    open(){if(!pendingSession)panel();$('profileMessage').textContent='';if(!$('accountDialog').open)$('accountDialog').showModal();},
    protection(value){$('allowDemolition').checked=value;$('allowDemolition').disabled=false;},
    expired(){setUser(null);},
  };
}
