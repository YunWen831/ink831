import {AVATAR_DIRECTIONS} from './avatar-data.js?v=0.14.0';
import {pixelCanvas} from './avatar-render.js?v=0.14.0';
export {createAvatarPainter} from './avatar-painter.js?v=0.14.0';
const images=new Map();
export function avatarImage(data,direction='down',frame=0){
  if(!data?.frames)return null;const key=data.userId+':'+data.revision;let frames=images.get(key);
  if(!frames){frames=data.frames.map(text=>pixelCanvas(text,32,48));images.set(key,frames);if(images.size>128)images.delete(images.keys().next().value);}
  return frames[Math.max(0,AVATAR_DIRECTIONS.indexOf(direction))*3+Math.max(0,Math.min(2,frame))];
}
