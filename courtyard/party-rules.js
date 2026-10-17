export const PARTY_GAMES=Object.freeze({
  bump:{name:'滑滑碰碰岛',rule:'移动靠近，按空格冲撞。撞落得分，掉下去两秒后回来。',action:'冲撞',seconds:65},
  delivery:{name:'快递大乱斗',rule:'空格拿包裹，送回同色收件箱。空手时也能拍落别人的包裹。',action:'拿 / 抢',seconds:70},
  mine:{name:'贪心矿车',rule:'每站选择继续挖或带钱回家。回家保住金币，塌方会失去未存金币。',action:'选择',seconds:42},
  rescue:{name:'抢修漏水屋',rule:'靠近漏点按住空格修补；下方补木板，蓝色水泵按空格排水。一起撑过倒计时。',action:'修 / 排水',seconds:70},
});
export const PARTY_WIDTH=960,PARTY_HEIGHT=600,PARTY_ROUNDS=5;
export const PARTY_BASES=[{x:100,y:100},{x:860,y:100},{x:100,y:500},{x:860,y:500}];
export function roundPoints(values){return values.map(value=>[10,7,4,2][values.filter(v=>v>value).length]);}
export function partySchedule(random=Math.random){const ids=Object.keys(PARTY_GAMES);for(let i=ids.length-1;i>0;i--){const j=Math.floor(random()*(i+1));[ids[i],ids[j]]=[ids[j],ids[i]];}return [...ids,ids[0]];}
