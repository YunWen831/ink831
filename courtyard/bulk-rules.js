import {isBuildCell} from './world.js';
export function buildRectangle(value){
  if(!value||![value.col1,value.row1,value.col2,value.row2].every(Number.isInteger)||!isBuildCell(value.col1,value.row1)||!isBuildCell(value.col2,value.row2))throw Error('请选择地图内的完整区域。');
  return {col1:Math.min(value.col1,value.col2),row1:Math.min(value.row1,value.row2),col2:Math.max(value.col1,value.col2),row2:Math.max(value.row1,value.row2)};
}
export const inRectangle=(tile,r)=>tile.col>=r.col1&&tile.col<=r.col2&&tile.row>=r.row1&&tile.row<=r.row2;
