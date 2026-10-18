import {RELAY_MODES} from './relay-rules.js?v=0.16.0';
import {CLASSIC_SWATCHES} from './materials.js?v=0.16.0';

export function drawPage(canvas,strokes){
  const ctx=canvas.getContext('2d');ctx.fillStyle='#ffffff';ctx.fillRect(0,0,640,420);ctx.lineCap=ctx.lineJoin='round';
  for(const [color,width,points] of strokes){ctx.strokeStyle=ctx.fillStyle=color;ctx.lineWidth=width;ctx.beginPath();ctx.moveTo(points[0],points[1]);for(let i=2;i<points.length;i+=2)ctx.lineTo(points[i],points[i+1]);if(points.length===2){ctx.arc(points[0],points[1],width/2,0,Math.PI*2);ctx.fill();}else ctx.stroke();}
}
export function createRelay({send,self,online,onActive,replay,exit}){
  const root=document.createElement('section');root.id='relayStage';root.className='relay-stage';root.hidden=true;root.setAttribute('aria-label','接龙');document.getElementById('arena').append(root);
  root.innerHTML='<header><strong id="relayTitle"></strong><span id="relayProgress"></span><span id="relayClock"></span><button id="relayExit" class="text-button">回大厅</button></header><div class="relay-body"><p id="relayPrompt"></p><div id="relayPrevious" class="relay-previous"></div><div id="relayEditor"><textarea id="relayText" placeholder="写下你的奇思妙想…"></textarea><div id="relayDrawing"><canvas id="relayCanvas" width="640" height="420" aria-label="接龙画板"></canvas><div class="relay-tools"><input id="relayColor" type="color" value="#ff0000" aria-label="画笔颜色"><select id="relayBrush" aria-label="笔刷粗细"><option value="2">细</option><option value="5" selected>中</option><option value="10">粗</option><option value="20">特粗</option></select><button id="relayErase">橡皮</button><button id="relayUndo">撤销</button><button id="relayClear">清空</button></div><div id="relayPalette" class="relay-palette"></div></div><div class="relay-submit"><span id="relayStatus" role="status"></span><button id="relaySubmit" class="primary-button">交给下一位</button></div></div><div id="relayReveal" hidden><div class="relay-tools"><select id="relayBook" aria-label="选择接龙册"></select><button id="relayDownload">保存接龙册</button><button id="relayPng">保存长图</button><button id="relayAgain" class="primary-button">再来一本</button></div><div id="relayPages"></div></div></div>';
  const $=id=>root.querySelector('#'+id),canvas=$('relayCanvas');let state=null,key='',strokes=[],pointer=null,stroke=null,color='#ff0000',erasing=false,dirty=false,revision=0,busy=false,generation=0,active=false,submitting=false,editVersion=0,canReplay=false,exporting=false,shownBook='',pageObserver=null;const pages=new Map(),pendingPages=new Map();
  function status(text){$('relayStatus').textContent=text;}
  function storageKey(){return 'courtyard-relay-'+self()+'-'+key;}
  function persist(){editVersion++;dirty=true;try{sessionStorage.setItem(storageKey(),JSON.stringify({value:state.kind==='drawing'?strokes:$('relayText').value,revision}));}catch{}}
  function editable(){return active&&state?.phase==='writing'&&!state.draft?.submitted&&online()&&!submitting;}
  function renderDrawing(){drawPage(canvas,strokes);$('relayUndo').disabled=!strokes.length;}
  function pageNode(page){const item=document.createElement('article'),author=document.createElement('small');author.textContent=(state.members.find(p=>p.id===page.author)?.name||'旅人')+(page.skipped?' · 超时草稿':'');item.append(author);if(page.kind==='drawing'){const image=document.createElement('canvas');image.width=640;image.height=420;drawPage(image,page.value);item.append(image);}else{const text=document.createElement('p');text.textContent=page.value||'（这一页留白）';item.append(text);}return item;}
  let pageQueue=Promise.resolve(),lastPageRequest=0;
  function pageKey(book,index){return state.id+':'+book+':'+index;}
  function requestPage(id,book,index,key){
    pageQueue=pageQueue.then(async()=>{const delay=110-(performance.now()-lastPageRequest);if(delay>0)await new Promise(r=>setTimeout(r,delay));if(state?.id!==id||!pendingPages.has(key))return;lastPageRequest=performance.now();send('relay:page',{id,book,page:index});}).catch(()=>{});
  }
  function loadPage(book,index){
    const key=pageKey(book,index);if(pages.has(key))return Promise.resolve(pages.get(key));if(pendingPages.has(key))return pendingPages.get(key).promise;
    let resolve,reject;const promise=new Promise((yes,no)=>{resolve=yes;reject=no;});const timer=setTimeout(()=>{pendingPages.delete(key);reject(Error('页面加载超时，请重试。'));},15000);pendingPages.set(key,{promise,resolve,reject,timer,retries:0});requestPage(state.id,book,index,key);return promise;
  }
  function reveal(){
    if(state?.phase!=='final')return;const id=state.id,book=Number($('relayBook').value)||0,next=id+':'+book;
    if(shownBook===next&&$('relayPages').children.length)return;shownBook=next;pageObserver?.disconnect();$('relayPages').replaceChildren();controls();
    async function fill(slot,index){
      if(slot.dataset.loading==='true'||slot.dataset.loaded==='true')return;slot.dataset.loading='true';slot.setAttribute('aria-busy','true');
      try{const page=await loadPage(book,index);if(state?.id!==id||shownBook!==next||!slot.isConnected)return;const heading=document.createElement('h3');heading.className='relay-page-heading';heading.textContent='第 '+(index+1)+' 棒';slot.replaceChildren(heading,pageNode(page));slot.dataset.loaded='true';pageObserver?.unobserve(slot);}
      catch(error){if(state?.id!==id||shownBook!==next||!slot.isConnected)return;const message=document.createElement('p'),retry=document.createElement('button');message.textContent=error.message;retry.textContent='重新加载';retry.onclick=()=>fill(slot,index);slot.replaceChildren(message,retry);}
      finally{slot.dataset.loading='false';slot.setAttribute('aria-busy','false');}
    }
    const slots=state.books[book].pages.map((page,index)=>{const slot=document.createElement('section');slot.className='relay-page-slot'+(page.kind==='drawing'?' drawing-slot':'');slot.dataset.page=String(index);slot.textContent='第 '+(index+1)+' 棒 · 加载中…';$('relayPages').append(slot);return slot;});
    if('IntersectionObserver' in window){pageObserver=new IntersectionObserver(entries=>{for(const e of entries)if(e.isIntersecting)fill(e.target,Number(e.target.dataset.page));},{root,rootMargin:'350px 0px'});for(const slot of slots)pageObserver.observe(slot);}else for(const[ index,slot]of slots.entries())fill(slot,index);
  }
  async function loadBook(){const book=Number($('relayBook').value)||0,result={owner:state.books[book].owner,pages:[]};for(let i=0;i<state.books[book].pages.length;i++){result.pages.push(await loadPage(book,i));await new Promise(r=>setTimeout(r,100));}return result;}

  function controls(){const locked=!editable();$('relayText').disabled=locked;$('relaySubmit').disabled=locked||busy;$('relayDrawing').classList.toggle('locked',locked);$('relayAgain').disabled=!canReplay||!online()||exporting;$('relayDownload').disabled=$('relayPng').disabled=exporting;$('relayBook').disabled=exporting;}
  async function upload(submit=false){
    if(!state||busy||!editable()||(!dirty&&!submit))return;
    const value=state.kind==='drawing'?strokes:$('relayText').value;if(submit&&!value.length){status('先写一点或画一点吧。');return;}
    const payload=JSON.stringify(value);if(payload.length>80000){status('画面笔画已满，请撤销一些后重试。');return;}
    busy=true;submitting=submit;const sentVersion=editVersion,mine=++generation,request={id:state.id,step:state.step,revision:++revision,length:payload.length,submit};status(submit?'正在交稿…':'同步草稿…');controls();
    try{send('relay:begin',request);for(let offset=0;offset<payload.length;offset+=2000){if(mine!==generation||!online())throw Error('连接恢复后可重新提交。');send('relay:chunk',{index:offset/2000,text:payload.slice(offset,offset+2000)});await new Promise(r=>setTimeout(r,40));}send('relay:finish');dirty=editVersion!==sentVersion;}
    catch(error){busy=false;submitting=false;status(error.message);controls();}
  }
  $('relayExit').onclick=exit;$('relayAgain').onclick=replay;$('relayBook').onchange=()=>{root.scrollTop=0;reveal();};$('relaySubmit').onclick=()=>upload(true);
  $('relayText').oninput=persist;
  for(const hex of CLASSIC_SWATCHES){const b=document.createElement('button');b.style.background=hex;b.setAttribute('aria-label','画笔 '+hex);b.onclick=()=>{color=hex;$('relayColor').value=hex;erasing=false;$('relayErase').setAttribute('aria-pressed','false');};$('relayPalette').append(b);}
  $('relayColor').oninput=e=>{color=e.target.value;erasing=false;$('relayErase').setAttribute('aria-pressed','false');};
  $('relayErase').onclick=()=>{erasing=!erasing;$('relayErase').setAttribute('aria-pressed',String(erasing));};
  $('relayUndo').onclick=()=>{if(!editable())return;strokes.pop();renderDrawing();persist();};$('relayClear').onclick=()=>{if(!editable())return;strokes=[];renderDrawing();persist();};
  function point(e){const r=canvas.getBoundingClientRect();return [Math.max(0,Math.min(640,Math.round((e.clientX-r.left)*640/r.width))),Math.max(0,Math.min(420,Math.round((e.clientY-r.top)*420/r.height)))];}
  canvas.onpointerdown=e=>{if(!editable())return;e.preventDefault();if(strokes.length>=240||strokes.reduce((n,s)=>n+s[2].length/2,0)>=5999){status('笔画已满，可撤销后继续。');return;}pointer=e.pointerId;canvas.setPointerCapture(pointer);stroke=[erasing?'#ffffff':color,Number($('relayBrush').value),point(e)];strokes.push(stroke);renderDrawing();persist();};
  canvas.onpointermove=e=>{if(pointer!==e.pointerId||!stroke||!editable())return;const p=point(e),last=stroke[2].slice(-2);if(Math.hypot(p[0]-last[0],p[1]-last[1])<2||strokes.reduce((n,s)=>n+s[2].length/2,0)>=6000)return;stroke[2].push(...p);renderDrawing();persist();};
  for(const type of ['pointerup','pointercancel','lostpointercapture'])canvas.addEventListener(type,()=>{pointer=null;stroke=null;});
  function download(blob,name){const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
  async function exportBook(action){if(exporting)return;exporting=true;controls();$('relayPrompt').textContent='正在准备导出…';try{await action(await loadBook());$('relayPrompt').textContent='整本揭晓，往下看。';}catch(error){$('relayPrompt').textContent=error.message;}finally{exporting=false;controls();}}
  $('relayDownload').onclick=()=>exportBook(book=>download(new Blob([JSON.stringify({version:2,mode:state.mode,members:state.members,books:[book]},null,2)],{type:'application/json'}),'接龙册.json'));
  $('relayPng').onclick=()=>exportBook(book=>{const out=document.createElement('canvas');out.width=720;const sections=book.pages.map(p=>{const lines=[];if(p.kind==='text'){let line='';for(const c of p.value||'（留白）'){line+=c;if(line.length>=28){lines.push(line);line='';}}if(line)lines.push(line);}return {p,lines,h:p.kind==='drawing'?470:Math.max(100,50+lines.length*28)};});out.height=80+sections.reduce((n,s)=>n+s.h,0);const ctx=out.getContext('2d');ctx.fillStyle='#f8faf1';ctx.fillRect(0,0,out.width,out.height);ctx.fillStyle='#355741';ctx.font='24px sans-serif';ctx.fillText(RELAY_MODES[state.mode],30,45);let y=80;for(const {p,lines,h} of sections){ctx.fillStyle='#355741';ctx.font='16px sans-serif';ctx.fillText(state.members.find(m=>m.id===p.author)?.name||'旅人',30,y+20);if(p.kind==='drawing'){const c=document.createElement('canvas');c.width=640;c.height=420;drawPage(c,p.value);ctx.drawImage(c,40,y+35);}else{ctx.font='22px sans-serif';lines.forEach((line,i)=>ctx.fillText(line,30,y+55+i*28));}y+=h;}out.toBlob(blob=>{if(blob)download(blob,'接龙长图.png');});});
  setInterval(()=>{if(dirty&&pointer===null)upload();},5000);
  return {
    get active(){return active;},
    receive(data){
      if(!data)return;const next=data.id+':'+data.step,changed=next!==key;if(!active){active=true;root.hidden=false;onActive(true);}
      const acknowledged=!busy||changed||(data.draft?.revision||0)>=revision;
      state=data;if(acknowledged){busy=false;submitting=false;}if(changed){generation++;key=next;dirty=false;revision=data.draft?.revision||0;strokes=[];$('relayText').value='';}
      $('relayTitle').textContent=RELAY_MODES[data.mode];$('relayProgress').textContent=data.phase==='final'?'揭晓':`${data.step+1} / ${data.steps} 页`;$('relayClock').textContent=data.phase==='final'?'':data.remaining+' 秒';
      $('relayEditor').hidden=data.phase==='final';$('relayPrevious').hidden=data.phase==='final';$('relayReveal').hidden=data.phase!=='final';
      if(data.phase==='final'){if(changed){pages.clear();shownBook='';root.scrollTop=0;} $('relayPrompt').textContent='整本揭晓，往下看。';const selected=$('relayBook').value;$('relayBook').replaceChildren(...data.books.map((b,i)=>new Option((data.members.find(p=>p.id===b.owner)?.name||'旅人')+'的接龙册',i)));$('relayBook').value=changed?String(Math.max(0,data.books.findIndex(b=>b.owner===self()))):selected||'0';reveal();}
      else{
        $('relayPrompt').textContent=data.mode==='story'?(data.step?'只看上一棒，接着续写一段。':'写下故事的开头。'):data.step===0?'写一个有画面感的题目。':data.kind==='drawing'?'把上一页的话画出来。':'这幅画说了什么？写下你的理解。';
        $('relayText').hidden=data.kind!=='text';$('relayText').maxLength=data.mode==='story'?500:100;$('relayDrawing').hidden=data.kind!=='drawing';
        $('relayPrevious').replaceChildren(...data.previous.slice(-1).map(pageNode));
        if(changed){let value=data.draft?.value;try{const saved=JSON.parse(sessionStorage.getItem(storageKey())||'null');if(!data.draft?.submitted&&saved&&saved.revision>=revision){value=saved.value;dirty=true;revision=Math.max(revision,saved.revision);}}catch{}if(data.kind==='drawing')strokes=Array.isArray(value)?value:[];else $('relayText').value=typeof value==='string'?value:'';renderDrawing();}
        status(data.draft?.submitted?'已交稿，等待大家…':data.draft?'草稿已同步':'');
      }controls();
    },
    ack(data){if(state?.id!==data.id||state.step!==data.step||data.revision<revision)return;busy=false;submitting=false;state.draft={revision:data.revision,submitted:data.submitted};status(data.submitted?'已交稿，等待大家…':'草稿已同步');controls();},
    page(data){if(state?.phase!=='final'||data.id!==state.id)return;const key=pageKey(data.book,data.page),pending=pendingPages.get(key);if(!pending)return;if(data.error?.includes('翻页太快')&&pending.retries++<5){requestPage(data.id,data.book,data.page,key);return;}clearTimeout(pending.timer);pendingPages.delete(key);if(data.error)pending.reject(Error(data.error));else{pages.set(key,data.value);pending.resolve(data.value);}},
    clock(data){if(state?.id!==data.id||state.step!==data.step)return;$('relayClock').textContent=data.remaining+' 秒';if(state.draft?.submitted)status(`已交稿 · ${data.ready} / ${state.members.length} 人完成`);controls();},
    refresh(value){canReplay=!!value;controls();},
    failed(text){generation++;busy=false;submitting=false;dirty=true;status(text);controls();},
    stop(){generation++;pageObserver?.disconnect();shownBook='';for(const p of pendingPages.values()){clearTimeout(p.timer);p.reject(Error('已离开接龙。'));}pendingPages.clear();pages.clear();exporting=false;active=false;state=null;key='';busy=false;root.hidden=true;onActive(false);},
  };
}
