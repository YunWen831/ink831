export const PARTY_GAMES=Object.freeze({
  bump:{name:'滑滑碰碰岛',rule:'空格冲撞，撞落得分；掉落两秒后回来。留意缓慢移动的圆形浮标。',action:'冲撞',metric:'撞落',unit:'人',seconds:65},
  delivery:{name:'快递大乱斗',rule:'空格拿货，送回同色收件箱；空手可拍落货物。金色急件须在倒计时内送达。',action:'拿 / 抢',metric:'运送积分',unit:'分',seconds:70},
  mine:{name:'贪心矿车',rule:'选择继续挖或带钱回家；前两站安全，之后参考下一站风险。塌方仅丢未存金币。',action:'选择',metric:'带回金币',unit:'枚',seconds:42},
  rescue:{name:'抢修漏水屋',rule:'按住空格修漏，木板处补给、水泵处排水。大漏点需两人一起按住修。',action:'修 / 排水',metric:'贡献分',unit:'分',seconds:70},
});
export const PARTY_WIDTH=960,PARTY_HEIGHT=600,PARTY_ROUNDS=5;
export const PARTY_BASES=[{x:100,y:100},{x:860,y:100},{x:100,y:500},{x:860,y:500}];
export function roundPoints(values){return values.map(value=>[10,7,4,2][values.filter(v=>v>value).length]);}
export function partySchedule(random=Math.random){const ids=Object.keys(PARTY_GAMES);for(let i=ids.length-1;i>0;i--){const j=Math.floor(random()*(i+1));[ids[i],ids[j]]=[ids[j],ids[i]];}return [...ids,ids[0]];}
export const PARTY_MODES=['random',...Object.keys(PARTY_GAMES)];
export const validPartyMode=mode=>PARTY_MODES.includes(mode);
export const partyModeName=mode=>mode==='random'?'随机派对 · 五轮':PARTY_GAMES[mode]?.name+' · 单项';
export const mineRisk=turn=>turn<=2?0:Math.min(.48,.12+(turn-3)*.09);
