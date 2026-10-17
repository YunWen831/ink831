export const MAP_COLS=48,MAP_ROWS=24,MAP_TILE=24,MAP_SIZE=MAP_COLS*MAP_ROWS;
export const MAP_WIDTH=MAP_COLS*MAP_TILE,MAP_HEIGHT=MAP_ROWS*MAP_TILE;
export function emptyMap(){return Array.from({length:MAP_SIZE},(_,i)=>Math.floor(i/MAP_COLS)===22?'1':'0').join('');}
export function canonicalMap(cells){
  if(typeof cells!=='string'||cells.length!==MAP_SIZE||!/^[0-3]+$/.test(cells))throw Error('地图格式不正确');
  let crystals=0;
  return Array.from(cells,(cell,i)=>{const col=i%MAP_COLS,row=Math.floor(i/MAP_COLS);return col<4||col>=MAP_COLS-4?(row>=22?'1':'0'):row<2?'0':cell==='3'&&++crystals>32?'0':cell;}).join('');
}
export function editableCell(col,row){return Number.isInteger(col)&&Number.isInteger(row)&&col>=4&&col<MAP_COLS-4&&row>=2&&row<MAP_ROWS;}
export function mapLevel(cells,name='我的关卡'){
  cells=canonicalMap(cells);const solids=[],hazards=[],crystals=[];
  for(let row=0;row<MAP_ROWS;row++)for(let col=0;col<MAP_COLS;col++){
    const kind=cells[row*MAP_COLS+col],x=col*MAP_TILE,y=row*MAP_TILE;
    if(kind==='1'){const previous=solids.at(-1);if(previous&&previous.y===y&&previous.x+previous.w===x)previous.w+=24;else solids.push({x,y,w:24,h:24});}
    if(kind==='2')hazards.push({x:x+2,y:y+10,w:20,h:14});
    if(kind==='3')crystals.push({x:x+12,y:y+12});
  }
  return {width:MAP_WIDTH,height:MAP_HEIGHT,solids,hazards,crystals,checkpoints:[{x:48,y:504,name,trigger:{x:0,y:-200,w:96,h:MAP_HEIGHT+200}}],goal:{x:1080,y:480,w:24,h:48},signs:[]};
}
export function composeMaps(drafts){
  if(drafts.length<2||drafts.length>4)throw Error('需要 2～4 张已验证的地图');
  const level={width:MAP_WIDTH*drafts.length,height:MAP_HEIGHT,solids:[],hazards:[],crystals:[],checkpoints:[],goal:null,signs:[]};
  drafts.forEach((draft,index)=>{
    const part=mapLevel(draft.cells,`${index+1} · ${draft.title||draft.name}`),offset=index*MAP_WIDTH;
    for(const key of ['solids','hazards','crystals'])level[key].push(...part[key].map(r=>({...r,x:r.x+offset})));
    level.checkpoints.push(...part.checkpoints.map(p=>({...p,x:p.x+offset,trigger:{...p.trigger,x:p.trigger.x+offset}})));
    level.signs.push({x:offset+80,y:445,text:`${index+1} / ${drafts.length} · ${draft.title||draft.name}`});
    level.goal={...part.goal,x:part.goal.x+offset};
  });return level;
}
