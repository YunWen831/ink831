import {readPixelImage,sampleImage} from './image-import.js?v=0.13.0';
import {MURAL_REACH} from './mural-rules.js?v=0.13.0';
export function createMural({send,online,allowed,importBlock,start,finish,toast}){
  const dialog=document.createElement('dialog');dialog.className='modal mural-modal';dialog.id='importDialog';
  dialog.innerHTML='<div class="modal-heading"><h2>导入像素画</h2><button id="importClose" class="close-button" aria-label="关闭">×</button></div><input id="importFile" type="file" accept="image/png,image/jpeg,image/webp,image/gif" aria-label="选择像素画图片"><div class="mural-settings"><label>用途<select id="importMode"><option value="block">一块材料</option><option value="mural">地图大画</option></select></label><label id="importBlockSizeLabel">分辨率<select id="importBlockSize"><option>16</option><option selected>32</option><option>64</option></select></label><label id="importColsLabel" hidden>宽 / 块<input id="importCols" type="number" min="1" max="8" value="4"></label><label id="importRowsLabel" hidden>高 / 块<input id="importRows" type="number" min="1" max="8" value="4"></label></div><canvas id="importPreview" width="128" height="128" aria-label="像素画导入预览"></canvas><input id="importName" maxlength="12" placeholder="作品名称"><p class="muted">保留比例与透明区域。大画按每块 16 × 16 像素拆分为地砖，最多 8 × 8 块。</p><button id="importUse" class="primary-button" disabled>载入画板</button><p id="importMessage" class="form-message" role="status"></p>';
  document.body.append(dialog);const $=id=>dialog.querySelector('#'+id);
  const bar=document.createElement('div');bar.className='mural-placement';bar.hidden=true;bar.innerHTML='<span id="muralHint">点地图选择落点</span><button id="muralConfirm" class="primary-button" disabled>确认放置</button><button id="muralCancel">取消</button>';document.getElementById('arena').append(bar);
  let image=null,sampled=null,stamp=null,locked=false,busy=false,generation=0;
  function redraw(){
    const mural=$('importMode').value==='mural';$('importBlockSizeLabel').hidden=mural;$('importColsLabel').hidden=$('importRowsLabel').hidden=!mural;$('importUse').textContent=mural?'去地图选位置':'载入画板';
    $('importUse').disabled=!image;if(!image)return;
    const cols=Math.max(1,Math.min(8,Number($('importCols').value)||1)),rows=Math.max(1,Math.min(8,Number($('importRows').value)||1));
    sampled=sampleImage(image,mural?cols*16:Number($('importBlockSize').value),mural?rows*16:Number($('importBlockSize').value));const c=$('importPreview');c.width=sampled.canvas.width;c.height=sampled.canvas.height;c.getContext('2d').drawImage(sampled.canvas,0,0);
  }
  $('importFile').onchange=async()=>{try{const loaded=await readPixelImage($('importFile').files[0]);image?.close();image=loaded;$('importMessage').textContent='';redraw();}catch(error){$('importMessage').textContent=error.message;}};
  for(const id of ['importMode','importBlockSize','importCols','importRows'])$(id).oninput=redraw;
  $('importClose').onclick=()=>dialog.close();
  $('importUse').onclick=()=>{if(!sampled||!allowed())return;const name=$('importName').value.trim()||'像素画';if($('importMode').value==='block'){importBlock(sampled.pixels,name);dialog.close();return;}stamp={cols:sampled.canvas.width/16,rows:sampled.canvas.height/16,pixels:sampled.pixels,canvas:sampled.canvas,name,col:0,row:0,hasPoint:false};locked=false;busy=false;bar.hidden=false;bar.querySelector('#muralConfirm').disabled=true;bar.querySelector('#muralHint').textContent='点地图选择落点';dialog.close();start();};
  function cancel(){if(busy)return;generation++;stamp=null;bar.hidden=true;finish();}
  bar.querySelector('#muralCancel').onclick=cancel;
  bar.querySelector('#muralConfirm').onclick=async()=>{
    if(!stamp?.hasPoint||busy||!online()||!allowed())return;
    busy=true;bar.querySelector('#muralConfirm').disabled=true;bar.querySelector('#muralCancel').disabled=true;bar.querySelector('#muralHint').textContent='保存中…';const mine=++generation;
    const {canvas,hasPoint,...data}=stamp,payload=JSON.stringify(data);
    try{send('mural:begin',{length:payload.length});for(let i=0;i<payload.length;i+=2000){if(mine!==generation||!online())throw Error('连接中断，恢复后可重试。');send('mural:chunk',{index:i/2000,text:payload.slice(i,i+2000)});await new Promise(r=>setTimeout(r,40));}send('mural:finish');}catch(error){api.failed(error.message);}
  };
  const api={
    open(){if(!allowed())return;dialog.showModal();redraw();},
    get placing(){return !!stamp;},get stamp(){return stamp;},
    point(cell,lock=false){if(!stamp||busy||locked&&!lock)return;Object.assign(stamp,cell,{hasPoint:true});locked=lock;bar.querySelector('#muralHint').textContent=lock?'检查预览，确认后整批放置':'点击锁定落点';bar.querySelector('#muralConfirm').disabled=!lock;},
    saved(count){busy=false;bar.querySelector('#muralCancel').disabled=false;cancel();toast(`已放置 ${count} 块地砖`);},
    failed(text){generation++;busy=false;bar.querySelector('#muralCancel').disabled=false;bar.querySelector('#muralConfirm').disabled=!stamp?.hasPoint;bar.querySelector('#muralHint').textContent=text;},
    stop(){busy=false;generation++;bar.querySelector('#muralCancel').disabled=false;cancel();},
    reach:MURAL_REACH,
  };return api;
}
