import { MAP_COLS,MAP_ROWS,canonicalMap,editableCell } from './parkour-map.js?v=0.11.0';
export function selectionBetween(a,b){
  const left=Math.max(4,Math.min(a.c,b.c)),right=Math.min(MAP_COLS-5,Math.max(a.c,b.c));
  const top=Math.max(2,Math.min(a.r,b.r)),bottom=Math.min(MAP_ROWS-1,Math.max(a.r,b.r));
  return left>right||top>bottom?null:{left,top,right,bottom};
}
export function copySelection(cells,selection){
  if(!selection)return null;const {left,top,right,bottom}=selection;
  return {width:right-left+1,height:bottom-top+1,rows:Array.from({length:bottom-top+1},(_,i)=>cells.slice((top+i)*MAP_COLS+left,(top+i)*MAP_COLS+right+1))};
}
export function pasteSelection(cells,stamp,col,row){
  if(!stamp)return cells;const next=Array.from(cells);
  for(let y=0;y<stamp.height;y++)for(let x=0;x<stamp.width;x++)if(editableCell(col+x,row+y))next[(row+y)*MAP_COLS+col+x]=stamp.rows[y][x];
  return canonicalMap(next.join(''));
}
export function eraseSelection(cells,selection){
  if(!selection)return cells;const next=Array.from(cells);
  for(let r=selection.top;r<=selection.bottom;r++)for(let c=selection.left;c<=selection.right;c++)if(editableCell(c,r))next[r*MAP_COLS+c]='0';return canonicalMap(next.join(''));
}
