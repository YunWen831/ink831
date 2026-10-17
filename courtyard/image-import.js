// Nearest-neighbour sampling keeps crisp pixel art, including transparency.
export async function readPixelImage(file){
  if(!file||file.size>8*1024*1024||!['image/png','image/jpeg','image/webp','image/gif'].includes(file.type))throw Error('请选择 8 MB 以内的 PNG、JPG、WebP 或 GIF 图片。');
  const bitmap=await createImageBitmap(file);
  if(!bitmap.width||!bitmap.height||bitmap.width*bitmap.height>16777216){bitmap.close();throw Error('图片请控制在 1600 万像素以内。');}
  return bitmap;
}
export function sampleImage(image,width,height){
  const canvas=document.createElement('canvas');canvas.width=width;canvas.height=height;const ctx=canvas.getContext('2d');ctx.imageSmoothingEnabled=false;
  // Contain: retain proportions and pad with transparent pixels.
  const scale=Math.min(width/image.width,height/image.height),w=Math.max(1,Math.round(image.width*scale)),h=Math.max(1,Math.round(image.height*scale));
  ctx.drawImage(image,Math.floor((width-w)/2),Math.floor((height-h)/2),w,h);
  const rgba=ctx.getImageData(0,0,width,height).data;return {canvas,pixels:Array.from({length:width*height},(_,i)=>Array.from(rgba.slice(i*4,i*4+4),v=>v.toString(16).padStart(2,'0')).join('')).join('')};
}
