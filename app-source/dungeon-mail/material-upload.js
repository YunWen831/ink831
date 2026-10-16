export class MaterialUpload{
  constructor(name,length,now=()=>performance.now()){
    if(typeof name!=='string'||!name.trim()||name.length>40||![8192,32768].includes(length))throw Error('无效的画作尺寸');
    this.name=name;this.length=length;this.parts=[];this.received=0;this.now=now;this.expires=now()+20000;
  }
  append(index,pixels){
    if(this.now()>this.expires||index!==this.parts.length||typeof pixels!=='string'||pixels.length<1||pixels.length>2048||!/^[0-9a-f]+$/.test(pixels)||this.received+pixels.length>this.length)throw Error('画作上传中断，请重新保存');
    this.parts.push(pixels);this.received+=pixels.length;
  }
  finish(){if(this.now()>this.expires||this.received!==this.length)throw Error('画作上传未完成，请重新保存');return this.parts.join('');}
}
