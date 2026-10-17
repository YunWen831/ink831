export const RELAY_MODES={relay:'绘画接龙',story:'故事接龙'};
export const isRelay=mode=>Object.hasOwn(RELAY_MODES,mode);
export const relaySteps=(mode,count)=>mode==='story'?count*2:count===3?6:4;
export const relayKind=(mode,step)=>mode==='story'||step%2===0?'text':'drawing';
export function validDrawing(value){
  if(!Array.isArray(value)||value.length>240)return false;
  let points=0;
  for(const s of value){
    if(!Array.isArray(s)||s.length!==3||!/^#[0-9a-f]{6}$/.test(s[0])||![2,5,10,20].includes(s[1])||!Array.isArray(s[2])||s[2].length<2||s[2].length%2)return false;
    points+=s[2].length/2;if(points>6000)return false;
    for(let i=0;i<s[2].length;i++)if(!Number.isInteger(s[2][i])||s[2][i]<0||s[2][i]>(i%2?420:640))return false;
  }
  return true;
}
export const RELAY_UPLOAD_MAX=80000;
export class TextUpload{
  constructor(length,max=RELAY_UPLOAD_MAX,now=()=>performance.now()){
    if(!Number.isSafeInteger(length)||length<1||length>max)throw Error('上传尺寸无效。');
    this.length=length;this.parts=[];this.received=0;this.now=now;this.expires=now()+30000;
  }
  append(index,text){if(this.now()>this.expires||index!==this.parts.length||typeof text!=='string'||!text.length||text.length>2000||this.received+text.length>this.length)throw Error('上传中断，请重试。');this.parts.push(text);this.received+=text.length;}
  finish(){if(this.now()>this.expires||this.received!==this.length)throw Error('上传未完成。');return this.parts.join('');}
}
