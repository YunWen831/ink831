(() => {
 'use strict';
 const $ = id => document.getElementById(id);
 const KEY='yunwen-word-study-v1', CUSTOM='yunwen-word-study-custom-v1';
 const read=(key,fallback)=>{try{return JSON.parse(localStorage.getItem(key))??fallback}catch{return fallback}};
 let state=read(KEY,{}), custom=read(CUSTOM,[]), books=[], all=[], pool=[], batch=[], queue=[], current=null, answered=false, batchNo=0, batchCompleted=0, cursor=0, currentMode='guided';
 const shuffle=a=>{a=[...a];for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]]}return a};
 const key=w=>`${w.source}::${w.en.toLowerCase()}`;
 const stage=w=>Math.min(3,Math.max(0,Number(state[key(w)])||0));
 const save=()=>localStorage.setItem(KEY,JSON.stringify(state));
 const normalize=s=>s.trim().toLowerCase().replace(/[’‘]/g,"'").replace(/\s+/g,' ').replace(/\s*[-–—]\s*/g,'-');
 const aliases={aluminium:['aluminum'],sulfur:['sulphur'],caesium:['cesium'],ethene:['ethylene'],ethyne:['acetylene'],propanone:['acetone'],'acetic acid':['ethanoic acid'],'formic acid':['methanoic acid'],acetaldehyde:['ethanal'],formaldehyde:['methanal'],'sodium bicarbonate':['sodium hydrogen carbonate'],'halogenoalkane':['haloalkane'],'chiral centre':['chiral center']};
 const exact=(input,w)=>[w.en,...(aliases[w.en.toLowerCase()]||[])].some(x=>normalize(input)===normalize(x));
 const speech=word=>{if(!('speechSynthesis' in window))return;window.speechSynthesis.cancel();const u=new SpeechSynthesisUtterance(word);u.lang='en-US';u.rate=.87;window.speechSynthesis.speak(u)};
 function refreshData(){
  const chem=Object.entries(window.CHEMISTRY).flatMap(([source,lines])=>lines.trim().split('\n').map(line=>{const [en,zh]=line.split('|');return {en:en.trim(),zh:zh.trim(),source}}));
  all=[...chem,...books.map(w=>({...w,source:w.book})),...custom.map(w=>({...w,source:'自定义词表'}))];
  const current=$('scope').value, select=$('scope');select.replaceChildren();
  const add=(value,label)=>{const o=document.createElement('option');o.value=value;o.textContent=label;select.append(o)};
  add('all','全部词汇');add('chem','全部化学词汇');for(const source of Object.keys(window.CHEMISTRY))add(source,source);
  add('books','文档词汇 · 全部书籍');for(const book of [...new Set(books.map(w=>w.book))])add(book,`文档 · ${book}`);
  add('自定义词表',`自定义词表 · ${custom.length} 个`);if([...select.options].some(o=>o.value===current))select.value=current;
  const checks=$('scopeChecks'),previous=new Set([...checks.querySelectorAll('input:checked')].map(x=>x.value));checks.replaceChildren();
  for(const source of [...Object.keys(window.CHEMISTRY),...new Set(books.map(w=>w.book)),'自定义词表']){const label=document.createElement('label'),input=document.createElement('input');input.type='checkbox';input.value=source;input.checked=previous.has(source);label.append(input,document.createTextNode(source));checks.append(label)}
 }
 function modeDescription(){const d={guided:'每个新词依次完成认识、英文选中文、中文选英文；之后以拼写复习。答对才会进入下一阶段。', 'en-zh':'显示并朗读英文，选择对应的中文释义。','zh-en':'根据中文释义，选择对应的英文。',spell:'根据中文释义，输入英文单词或词组。',challenge:'跳过学习阶段，直接根据中文拼写英文；挑战不会改变循序学习进度。'};$('modeDescription').textContent=d[$('mode').value]}
 function selected(){const scope=$('scope').value,chosen=[...$('scopeChecks').querySelectorAll('input:checked')].map(x=>x.value);return all.filter(w=>chosen.length?chosen.includes(w.source):scope==='all'||(scope==='chem'&&Object.hasOwn(window.CHEMISTRY,w.source))||(scope==='books'&&!!w.book)||w.source===scope)}
 function start(){pool=selected();if(!pool.length){alert('这个范围还没有词汇，请先添加词表。');return}currentMode=$('mode').value;pool=shuffle(pool);cursor=0;batchNo=0;$('setup').hidden=true;$('practice').hidden=false;$('modeLabel').textContent=$('mode').selectedOptions[0].textContent;$('speakSpellPractice').checked=$('speakSpell').checked;newBatch();window.scrollTo(0,0)}
 function newBatch(){
  if(cursor>=pool.length){pool=shuffle(pool);cursor=0}
  batch=pool.slice(cursor,cursor+20);cursor+=batch.length;batchNo++;batchCompleted=0;
  // Interleave rounds so a word is revisited after the others, not immediately.
  queue=[];const rounds=currentMode==='guided'?3:1;
  for(let r=0;r<rounds;r++){for(const w of batch){const needed=currentMode==='guided'?Math.max(1,3-stage(w)):1;if(r<needed)queue.push(w)}}
  $('batchLabel').textContent=`第 ${batchNo} 组`;nextQuestion();
 }
 function nextQuestion(){if(!queue.length){newBatch();return}current=queue.shift();answered=false;render()}
 function render(){
  const s=currentMode==='guided'?stage(current):currentMode==='en-zh'?1:currentMode==='zh-en'?2:3;
  const isChoice=s===1||s===2, enFirst=s===0||s===1;
  $('progressCount').textContent=`${batchCompleted} / ${batch.length} 个词完成`;$('progressBar').style.width=`${batchCompleted/batch.length*100}%`;
  $('stageLabel').textContent=currentMode==='challenge'?'挑战 · 中文拼写': ['01 认识单词','02 英文选中文','03 中文选英文','04 拼写英文'][s];
  $('sourceLabel').textContent=current.source;$('promptHint').textContent=s===0?'看一看，听一听，然后输入英文':s===1?'选择正确的中文释义':s===2?'选择正确的英文':'根据中文拼写英文';
  $('promptText').textContent=enFirst?current.en:current.zh;$('subtext').textContent=s===0?current.zh:'';
  $('speak').hidden=!(enFirst||(s===3&&$('speakSpellPractice').checked));
  $('choices').replaceChildren();$('choices').hidden=!isChoice;$('answerForm').hidden=isChoice;$('answer').value='';$('answer').disabled=false;$('answerForm').querySelector('button').disabled=false;$('feedback').textContent='';$('feedback').className='feedback';$('next').hidden=true;
  if(isChoice){const field=s===1?'zh':'en';const candidates=shuffle(all.filter(w=>w[field]&&w[field]!==current[field]&&(s===1?w.en.toLowerCase()!==current.en.toLowerCase():w.zh!==current.zh)));const values=[current[field]];for(const w of candidates){if(!values.includes(w[field]))values.push(w[field]);if(values.length===4)break}
   shuffle(values).forEach((value,i)=>{const b=document.createElement('button');b.className='choice';b.type='button';b.textContent=`${String.fromCharCode(65+i)}   ${value}`;b.addEventListener('click',()=>{if(answered)return;const ok=value===current[field];b.classList.add(ok?'correct':'wrong');for(const node of $('choices').children){node.disabled=true;if(node.textContent.slice(4)===current[field])node.classList.add('correct')}check(ok)});$('choices').append(b)});
  }else setTimeout(()=>$('answer').focus(),30);
  if(s===0||s===1||(s===3&&$('speakSpellPractice').checked))speech(current.en);
 }
 function check(ok){
  if(answered)return;answered=true;
  if(ok){if(currentMode==='guided'){state[key(current)]=Math.min(3,stage(current)+1);save()}if(!queue.includes(current))batchCompleted++;$('feedback').textContent='答对了，继续保持。';$('feedback').className='feedback good'}
  else{queue.push(current);$('feedback').textContent=`再记一次：${current.en} · ${current.zh}。这个词会在本组再次出现。`;$('feedback').className='feedback bad'}
  $('answer').disabled=true;$('answerForm').querySelector('button').disabled=true;$('next').hidden=false;$('next').focus();
 }
 $('answerForm').addEventListener('submit',e=>{e.preventDefault();if(!answered&&$('answer').value.trim())check(exact($('answer').value,current))});
 $('next').addEventListener('click',nextQuestion);$('start').addEventListener('click',start);$('leave').addEventListener('click',()=>{$('practice').hidden=true;$('setup').hidden=false;if('speechSynthesis'in window)window.speechSynthesis.cancel();window.scrollTo(0,0)});
 $('speak').addEventListener('click',()=>speech(current.en));$('mode').addEventListener('change',modeDescription);$('speakSpellPractice').addEventListener('change',e=>{$('speakSpell').checked=e.target.checked;if(current)render()});
 $('saveCustom').addEventListener('click',()=>{const lines=$('customInput').value.split(/\r?\n/).map(s=>s.trim()).filter(Boolean),parsed=[];for(const line of lines){const parts=line.split(/\t|\||[,，]/);if(parts.length<2||!parts[0].trim()||!parts.slice(1).join('，').trim()){$('dataMessage').textContent='请检查格式：每行需要英文和中文，例如 apple, 苹果。';return}parsed.push({en:parts[0].trim(),zh:parts.slice(1).join('，').trim()})}custom=parsed;localStorage.setItem(CUSTOM,JSON.stringify(custom));refreshData();$('scope').value='自定义词表';$('dataMessage').textContent=`已保存 ${custom.length} 个词。`});
 $('export').addEventListener('click',()=>{const blob=new Blob([JSON.stringify({version:1,progress:state,custom},null,2)],{type:'application/json'}),a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='word-study-backup.json';a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000)});
 $('import').addEventListener('change',async e=>{try{const data=JSON.parse(await e.target.files[0].text());if(data.version!==1||!data.progress||typeof data.progress!=='object'||!Array.isArray(data.custom)||!data.custom.every(w=>typeof w.en==='string'&&typeof w.zh==='string'))throw Error();state=data.progress;custom=data.custom;save();localStorage.setItem(CUSTOM,JSON.stringify(custom));$('customInput').value=custom.map(w=>`${w.en}, ${w.zh}`).join('\n');refreshData();$('dataMessage').textContent='学习记录和自定义词表已导入。'}catch{$('dataMessage').textContent='导入失败，请选择有效的词间备份文件。'}e.target.value=''});
 $('customInput').value=custom.map(w=>`${w.en}, ${w.zh}`).join('\n');modeDescription();
 fetch('./book-words.json').then(r=>{if(!r.ok)throw Error();return r.json()}).then(data=>{books=data;refreshData()}).catch(()=>{refreshData();$('dataMessage').textContent='文档词表加载失败，请刷新页面。'});
})();
