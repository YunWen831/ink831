// Index 0 is transparent. Texture data is always exactly 16 × 16 palette indices.
export const PALETTE = ['#00000000','#f5ecd5','#dfcca4','#b69a73','#7f674f','#454e43','#94b274','#647f52','#b9c99b','#c58262','#955c4d','#e2b66a','#83b5ad','#527f87','#a69bbd','#eee2b2'];
const pattern = fn => Array.from({length:256},(_,i)=>fn(i%16,Math.floor(i/16)).toString(16)).join('');
export const BUILTIN_MATERIALS = [
  {id:'stone',name:'奶油石砖',author:'庭院',pixels:pattern((x,y)=>y%8===0||((x+(y>7?8:0))%16===0)?3:y%8===1?1:2)},
  {id:'wood',name:'木纹板',author:'庭院',pixels:pattern((x,y)=>x%8===0?4:y%5===0&&x%8>2?4:x%8===1?2:3)},
  {id:'grass',name:'苔绿方块',author:'庭院',pixels:pattern((x,y)=>(x*13+y*7)%23<3?8:(x+y)%7===0?7:6)},
  {id:'brick',name:'赤陶砖',author:'庭院',pixels:pattern((x,y)=>y%6===0||(x+(Math.floor(y/6)%2?5:0))%10===0?2:9)},
];
export const validPixels = pixels => typeof pixels==='string' && /^[0-9a-f]{256}$/.test(pixels) && /[1-9a-f]/.test(pixels);
