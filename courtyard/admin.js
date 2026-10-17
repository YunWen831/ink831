import {RECYCLE_MS} from './material-lifecycle.js?v=0.14.0';
import {preview} from './art.js?v=0.14.0';
export function createAdmin({endpoint,user,notify}){
  const $=id=>document.getElementById(id);let users=[],epoch=0,selected=null,owner='',working=false,searchTimer=0;
  const labels={ban:'封禁账号',unban:'解除封禁',logout:'强制下线',recovery:'重置登录',rename:'修改昵称',protection:'建筑权限','material-delete':'删除作品','material-restore':'恢复作品','bulk-demolish':'批量拆除','legacy-demolish':'拆除旧建筑','legacy-replace':'覆盖旧建筑'};
  const el=(tag,text,cls)=>{const n=document.createElement(tag);if(text)n.textContent=text;if(cls)n.className=cls;return n;};
  const button=(text,action)=>{const b=el('button',text,'secondary-button');b.type='button';b.addEventListener('click',action);return b;};
  async function request(path,body){
    if(!user()?.admin)throw Error('需要管理员权限。');const stamp=epoch;
    const response=await fetch(endpoint()+'/api/account/admin/'+path,{method:body===undefined?'GET':'POST',credentials:'include',headers:body===undefined?{}:{'Content-Type':'application/json'},body:body===undefined?undefined:JSON.stringify(body),signal:AbortSignal.timeout(20000)}),data=await response.json();
    if(stamp!==epoch||!user()?.admin)throw Error('登录状态已改变。');if(!response.ok)throw Error(data.error||'操作失败。');return data;
  }
  async function run(fn,message='adminMessage'){if(working)return;working=true;$(message).textContent='';try{await fn();}catch(error){$(message).textContent=error.message;}finally{working=false;}}
  function confirm(item,action,extra={}){
    selected={item,action,...extra};$('adminConfirmTitle').textContent=labels[action];$('adminConfirmTarget').textContent=item.username?'@'+item.username+' · '+item.nickname:item.name;
    const text={ban:'该账号会退出所有设备，并暂停登录。',unban:'恢复该账号的登录权限。',logout:'撤销该账号当前所有登录；本人可以重新登录。',recovery:'撤销所有登录并停用旧密码。新找回码只显示一次，请私下交给本人重设密码。',rename:'修改大厅显示的昵称，登录账号保持原样。',protection:extra.allow?'允许其他玩家拆除或覆盖此账号放置的建筑。':'保护此账号放置的建筑，所有者仍可自行编辑。','material-delete':'作品移入12 小时回收站，已建方块继续保留贴图。','material-restore':'将作品恢复到材料库。'};
    $('adminConfirmText').textContent=text[action];$('adminNoteLabel').hidden=action!=='ban';$('adminNicknameLabel').hidden=action!=='rename';$('adminNote').value='';$('adminNickname').value=item.nickname||'';$('adminConfirmMessage').textContent='';$('adminConfirmButton').disabled=false;$('adminConfirmDialog').showModal();
  }
  async function refresh(){
    const data=await request('users?search='+encodeURIComponent($('adminSearch').value));users=data.users;$('adminUserCount').textContent=users.length+' 个账号';$('adminAccounts').replaceChildren();
    for(const u of users.sort((a,b)=>Number(b.admin)-Number(a.admin)||a.username.localeCompare(b.username))){
      const row=el('div',null,'admin-user');row.dataset.userId=u.id;const title=el('div',null,'admin-user-title');title.append(el('strong',u.nickname),el('span','@'+u.username));
      const status=u.admin?'管理员':u.banned?'已封禁':u.mustRecover?'待重设密码':'正常';title.append(el('small',status+' · '+u.sessions+' 个登录会话'+(u.banReason?' · '+u.banReason:'')));row.append(title);
      const actions=el('div',null,'admin-user-actions');const select=el('select');select.setAttribute('aria-label','管理 '+u.username);select.append(new Option('账号操作',''));
      for(const action of ['rename','logout','recovery',u.banned?'unban':'ban'])if(!u.admin||action==='rename')select.append(new Option(labels[action],action));select.addEventListener('change',()=>{if(select.value)confirm(u,select.value);select.value='';});
      const protection=button(u.allowDemolition?'建筑：可拆':'建筑：受保护',()=>confirm(u,'protection',{allow:!u.allowDemolition}));protection.dataset.adminProtection=u.id;
      actions.append(select,protection,button('画布作品',()=>openMaterials(u.id,u.nickname+'的画布')));row.append(actions);$('adminAccounts').append(row);
    }
    const audit=await request('audit');$('adminAudit').replaceChildren(...audit.events.map(e=>el('p',new Date(e.at).toLocaleString()+' · '+e.actor+' → '+e.target+' · '+(labels[e.action]||e.action)+(e.note?' · '+e.note:''))));
  }
  async function openMaterials(id='',title='全部画布'){
    owner=id;$('adminMaterialsTitle').textContent=title;$('adminMaterialPreview').hidden=true;$('adminMaterialsMessage').textContent='';$('adminMaterialsList').replaceChildren();if(!$('adminMaterialsDialog').open)$('adminMaterialsDialog').showModal();
    try{const data=await request('materials?userId='+encodeURIComponent(id));if(owner!==id)return;
      for(const m of data.materials){const row=el('div',null,'level-row');row.dataset.materialId=m.id;const description=el('div');description.append(el('strong',m.name),el('small',m.ownerName+' · '+(m.deletedAt?'回收站':'材料库')));const show=button('预览',()=>run(async()=>{const d=await request('materials/'+encodeURIComponent(m.id));preview($('adminMaterialPreview'),d.material);$('adminMaterialPreview').hidden=false;},'adminMaterialsMessage'));
        const restore=!!m.deletedAt;const action=button(restore?'恢复':'删除',()=>confirm(m,restore?'material-restore':'material-delete'));if(restore&&Date.now()-m.deletedAt>=RECYCLE_MS)action.disabled=true;row.append(description,show,action);$('adminMaterialsList').append(row);
      }if(!data.materials.length)$('adminMaterialsMessage').textContent='暂无画布。';
    }catch(error){$('adminMaterialsMessage').textContent=error.message;}
  }
  $('adminOpen').addEventListener('click',()=>{if(!user()?.admin)return;$('accountDialog').close();$('adminDialog').showModal();run(refresh);});
  $('adminRefresh').addEventListener('click',()=>run(refresh));$('adminSearch').addEventListener('input',()=>{clearTimeout(searchTimer);searchTimer=setTimeout(()=>run(refresh),240);});$('adminAllMaterials').addEventListener('click',()=>openMaterials());
  $('adminLegacyMaterials').addEventListener('click',()=>openMaterials('legacy','旧画布'));
  $('adminConfirmButton').addEventListener('click',()=>run(async()=>{
    if(!selected)return;const data=selected;$('adminConfirmButton').disabled=true;let result;
    try{
      if(data.action==='protection')result=await request('protection',{id:data.item.id,allow:data.allow});
      else if(data.action.startsWith('material-'))result=await request('materials/action',{id:data.item.id,restore:data.action==='material-restore'});
      else result=await request('users/action',{id:data.item.id,action:data.action,note:$('adminNote').value,nickname:$('adminNickname').value});
      $('adminConfirmDialog').close();selected=null;notify(result.warning||'已完成');
      if(result.recoveryCode){$('adminRecoveryCode').value=result.recoveryCode;$('adminRecoveryTarget').textContent='@'+data.item.username;$('adminRecoveryDialog').showModal();}
      await refresh();if(data.action.startsWith('material-'))await openMaterials(owner,$('adminMaterialsTitle').textContent);
    }finally{$('adminConfirmButton').disabled=false;}
  },'adminConfirmMessage'));
  $('adminRecoveryCopy').addEventListener('click',async()=>{try{await navigator.clipboard.writeText($('adminRecoveryCode').value);notify('找回码已复制');}catch{$('adminRecoveryCode').select();}});
  $('adminRecoveryDialog').addEventListener('close',()=>$('adminRecoveryCode').value='');
  return {roleChanged(){epoch++;$('adminOpen').hidden=!user()?.admin;if(!user()?.admin){for(const id of ['adminDialog','adminMaterialsDialog','adminConfirmDialog','adminRecoveryDialog'])$(id).close();$('adminAccounts').replaceChildren();$('adminAudit').replaceChildren();$('adminRecoveryCode').value='';selected=null;users=[];}}};
}
