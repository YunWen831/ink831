// Preserve the original palette indices so already saved artworks keep their colors.
export const PALETTE = ['#00000000','#f5ecd5','#dfcca4','#b69a73','#7f674f','#454e43','#94b274','#647f52','#b9c99b','#c58262','#955c4d','#e2b66a','#83b5ad','#527f87','#a69bbd','#eee2b2'];
const pattern = fn => Array.from({length:256},(_,i)=>fn(i%16,Math.floor(i/16)).toString(16)).join('');
export const BUILTIN_MATERIALS = [
  {id:'stone',name:'奶油石砖',author:'庭院',pixels:pattern((x,y)=>y%8===0||((x+(y>7?8:0))%16===0)?3:y%8===1?1:2)},
  {id:'wood',name:'木纹板',author:'庭院',pixels:pattern((x,y)=>x%8===0?4:y%5===0&&x%8>2?4:x%8===1?2:3)},
  {id:'grass',name:'苔绿方块',author:'庭院',pixels:pattern((x,y)=>(x*13+y*7)%23<3?8:(x+y)%7===0?7:6)},
  {id:'brick',name:'赤陶砖',author:'庭院',pixels:pattern((x,y)=>y%6===0||(x+(Math.floor(y/6)%2?5:0))%10===0?2:9)},
];
const rgbPattern = fn => Array.from({length:256},(_,i)=>fn(i%16,Math.floor(i/16)).replace('#','')+'ff').join('');
BUILTIN_MATERIALS.push(
  {id:'plaster',name:'白墙',author:'庭院',pixels:rgbPattern((x,y)=>(x*7+y*11)%31===0?'#dedbd0':'#f3f0e6')},
  {id:'concrete',name:'灰墙',author:'庭院',pixels:rgbPattern((x,y)=>(x+y*3)%17===0?'#999e9f':'#b4b9b8')},
  {id:'darkwood',name:'深木板',author:'庭院',pixels:rgbPattern((x,y)=>x%8===0?'#352c29':y%5===0?'#5f4438':'#755241')},
  {id:'roof',name:'青瓦',author:'庭院',pixels:rgbPattern((x,y)=>y%5===0?'#263e48':x%6===0?'#6b8b91':'#466771')},
  {id:'glass',name:'蓝玻璃',author:'庭院',pixels:rgbPattern((x,y)=>x===0||y===0?'#607d8b':Math.abs(x-y)<2?'#e0f4f7':'#a0d2df')},
  {id:'paving',name:'石板',author:'庭院',pixels:rgbPattern((x,y)=>x%8===0||y%8===0?'#69726c':(x+y)%9===0?'#c2c8b9':'#a1ab9b')},
  {id:'sand',name:'沙地',author:'庭院',pixels:rgbPattern((x,y)=>(x*3+y*7)%19===0?'#d8b985':'#ead5a7')},
  {id:'water',name:'水面',author:'庭院',pixels:rgbPattern((x,y)=>y%6===0&&x%8<5?'#b5e4e1':'#6eafa9')},
);

export const CLASSIC_SWATCHES = [
  '#000000','#ffffff','#ff0000','#ff8000','#ffff00','#00ff00','#00ffff','#0000ff',
  '#8000ff','#ff00ff','#ff0080','#800000','#804000','#808000','#008000','#008080',
  '#000080','#400080','#800080','#808080','#c0c0c0','#ff8080','#ffbf80','#ffff80',
  '#bfff80','#80ffbf','#80ffff','#80bfff','#8080ff','#bf80ff','#ff80ff','#ff80bf',
];
export const SWATCHES = [
  '#ffffff','#f3f0e6','#ddd9cc','#b9b7ad','#90938e','#656c66','#414944','#202925',
  '#fff1d0','#ead5a7','#ceb087','#ae8b63','#896748','#674936','#49352d','#2c2422',
  '#ffd8cb','#efb29b','#db8c72','#c16d58','#a45143','#813d37','#612d31','#3d242b',
  '#ffe4a0','#f5ca72','#dda947','#ba8b36','#967333','#725931','#53442d','#343128',
  '#e2ecc2','#bbd497','#94b274','#739555','#547943','#3b5d39','#29432f','#1c3026',
  '#d7f0ea','#a9dcd3','#79c1b9','#50a29d','#368380','#286663','#204b4a','#1a3538',
  '#e1edf7','#b5d7ea','#88bbd6','#609aba','#467b9b','#355e7c','#29445e','#202f42',
  '#eee3f1','#d3bfdc','#b49ac5','#9678ae','#795b93','#5f4477','#46345b','#30253f',
];
export function decodePixels(pixels) {
  if (typeof pixels!=='string') return null;
  if (/^[0-9a-f]{256}$/.test(pixels)) return Array.from(pixels,c=>{
    const hex=PALETTE[parseInt(c,16)].slice(1);return hex.length===8?hex:hex+'ff';
  });
  if ([2048,8192,32768].includes(pixels.length)&&/^[0-9a-f]+$/.test(pixels)) return pixels.match(/.{8}/g);
  return null;
}
export const encodePixels = pixels => pixels.join('');
export const MATERIAL_SIZES=[16,32,64];
export function materialSize(pixels){return pixels?.length===256?16:[2048,8192,32768].includes(pixels?.length)?Math.sqrt(pixels.length/8):0;}
export function resizePixels(pixels,size){
  const old=Math.sqrt(pixels.length);if(!MATERIAL_SIZES.includes(old)||!MATERIAL_SIZES.includes(size))throw Error('Unsupported drawing size');
  return Array.from({length:size*size},(_,i)=>pixels[Math.floor(Math.floor(i/size)*old/size)*old+Math.floor(i%size*old/size)]);
}
const validity=new Map();
export const validPixels = pixels => {
  if(typeof pixels!=='string'||!materialSize(pixels))return false;
  if(validity.has(pixels))return validity.get(pixels);
  let valid=false;
  if(pixels.length===256)valid=/^[0-9a-f]{256}$/.test(pixels)&&/[^0]/.test(pixels);
  else if(/^[0-9a-f]+$/.test(pixels))for(let i=6;i<pixels.length;i+=8)if(pixels.slice(i,i+2)!=='00'){valid=true;break;}
  if(validity.size>=256)validity.delete(validity.keys().next().value);validity.set(pixels,valid);return valid;
};
