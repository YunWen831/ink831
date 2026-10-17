import {buildRectangle} from './bulk-rules.js?v=0.15.0';
export function createAdminBuild({endpoint,user,allowed,start,finish,toast}){
 const dialog=document.createElement('dialog');dialog.className='modal confirm-modal';dialog.id='bulkDialog';dialog.innerHTML='<div class="modal-heading"><h2>批量拆除</h2><button class="close-button" aria-label="关闭">×</button></div><p id="bulkRegion"></p><p id="bulkCount"></p><p class="muted">选区内的墙块、地砖和导入画均会拆除，包括他人保护和旧建筑。材料画布保留。</p><button id="bulkConfirm" class="primary-button">确认拆除</button><p id="bulkMessage" class="form-message" role="status"></p>';document.body.append(dialog);
 const bar=document.createElement('div');bar.className='mural-placement';bar.hidden=true;bar.innerHTML='<span>拖动框选，或依次点击两个角</span><button>取消</button>';document.getElementById('arena').append(bar);
 const $=id=>dialog.querySelector('#'+id);let active=false,anchor=null,cursor=null,dragging=false,busy=false,ticket=null,generation=0;
 async function request(path,body){if(!user()?.admin||!allowed())throw Error('需要在线管理员在大厅操作。');const res=await fetch(endpoint()+'/api/account/admin/buildings/'+path,{method:'POST',credentials:'include',headers:{'Content-Type':'application/json'},body:JSON.stringify(body),signal:AbortSignal.timeout(15000)}),data=await res.json();if(!res.ok)throw Error(data.error||'操作失败。');return data;}
 function stop(){generation++;active=false;anchor=cursor=null;dragging=false;busy=false;ticket=null;bar.hidden=true;if(dialog.open)dialog.close();finish();}
 async function preview(){
  if(busy||!anchor||!cursor)return;busy=true;const mine=++generation;$('bulkMessage').textContent='正在预览…';$('bulkConfirm').disabled=true;if(!dialog.open)dialog.showModal();
  try{const data=await request('preview',buildRectangle({col1:anchor.col,row1:anchor.row,col2:cursor.col,row2:cursor.row}));if(mine!==generation)return;ticket=data.ticket;const r=data.rect;$('bulkRegion').textContent=`方块坐标 (${r.col1}, ${r.row1}) — (${r.col2}, ${r.row2})`;$('bulkCount').textContent=`共 ${data.count} 块`;$('bulkConfirm').textContent=`拆除 ${data.count} 块`;$('bulkConfirm').disabled=!data.count;$('bulkMessage').textContent=data.count?'':'区域内没有建筑。';}
  catch(error){if(mine===generation)$('bulkMessage').textContent=error.message;}finally{if(mine===generation)busy=false;}
 }
 $('bulkConfirm').onclick=async()=>{if(busy||!ticket)return;busy=true;$('bulkConfirm').disabled=true;$('bulkMessage').textContent='拆除中…';const mine=++generation;try{const data=await request('demolish',{ticket});if(mine!==generation)return;stop();toast(`已拆除 ${data.count} 块${data.warning?'，'+data.warning:''}`);}catch(error){if(mine===generation){ticket=null;$('bulkMessage').textContent=error.message+' 关闭后重新框选。';}}finally{if(mine===generation)busy=false;}};
 dialog.querySelector('.close-button').onclick=stop;dialog.addEventListener('cancel',e=>{e.preventDefault();if(!busy)stop();});bar.querySelector('button').onclick=stop;
 return {get active(){return active;},get rect(){if(!active||!anchor||!cursor)return null;try{return buildRectangle({col1:anchor.col,row1:anchor.row,col2:cursor.col,row2:cursor.row});}catch{return null;}},start(){if(!user()?.admin||!allowed())return;stop();active=true;bar.hidden=false;start();},stop,
  down(cell){if(!active||busy)return;if(!anchor){anchor=cursor=cell;dragging=true;}else{cursor=cell;dragging=false;preview();}},
  move(cell){if(active&&!busy&&anchor)cursor=cell;},up(cell){if(!active||busy||!dragging)return;dragging=false;cursor=cell;if(cell.col!==anchor.col||cell.row!==anchor.row)preview();},
 };
}
