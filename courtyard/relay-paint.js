// Four-connected fill over the rendered page, including soft pen edges.
export function fillPixels(pixels,width,height,x,y,color){
  x=Math.max(0,Math.min(width-1,Math.floor(x)));y=Math.max(0,Math.min(height-1,Math.floor(y)));
  const start=y*width+x,offset=start*4,target=Array.from(pixels.slice(offset,offset+4)),paint=[parseInt(color.slice(1,3),16),parseInt(color.slice(3,5),16),parseInt(color.slice(5,7),16),255];
  if(target.every((v,i)=>v===paint[i]))return false;
  const queue=new Int32Array(width*height),seen=new Uint8Array(width*height);let read=0,write=1;queue[0]=start;seen[start]=1;
  function add(index){if(!seen[index]){seen[index]=1;queue[write++]=index;}}
  while(read<write){const index=queue[read++],at=index*4;if(!target.every((v,i)=>Math.abs(pixels[at+i]-v)<=32))continue;
    pixels.set(paint,at);const col=index%width;if(col>0)add(index-1);if(col<width-1)add(index+1);if(index>=width)add(index-width);if(index<width*(height-1))add(index+width);
  }
  return true;
}
