import {emptyMap,canonicalMap} from '../../../../courtyard/parkour-map.js';
export function mechanismMap(){
  const cells=Array.from(emptyMap()),put=(c,r,value)=>cells[r*48+c]=value;
  put(8,22,'4');for(let c=17;c<=19;c++)put(c,22,'5');
  put(20,18,'6');put(23,18,'e');for(let c=25;c<=27;c++)put(c,22,'7');
  put(30,21,'8');put(34,21,'9');put(38,21,'c');put(39,21,'a');
  return canonicalMap(cells.join(''));
}
