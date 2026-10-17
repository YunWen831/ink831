export const MURAL_MAX=132000,MURAL_REACH=320;
export function splitMural(data){
  if(!Number.isInteger(data?.cols)||!Number.isInteger(data?.rows)||data.cols<1||data.rows<1||data.cols>8||data.rows>8||typeof data.pixels!=='string'||data.pixels.length!==data.cols*data.rows*256*8||!/^[0-9a-f]+$/.test(data.pixels))throw Error('区域像素画数据无效。');
  const out=[],width=data.cols*16;
  for(let y=0;y<data.rows;y++)for(let x=0;x<data.cols;x++){
    let pixels='';for(let row=0;row<16;row++)pixels+=data.pixels.slice(((y*16+row)*width+x*16)*8,((y*16+row)*width+x*16+16)*8);
    if(pixels.match(/.{8}/g).some(p=>p.slice(6)!=='00'))out.push({x,y,pixels});
  }
  if(!out.length)throw Error('图片全透明，无法放置。');return out;
}
