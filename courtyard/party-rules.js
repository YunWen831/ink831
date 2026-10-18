import {RELAY_MODES} from './relay-rules.js?v=0.15.1';
export const PARTY_GAMES=Object.freeze({
  bump:{name:'滑滑碰碰岛',rule:'空格冲撞，撞落得分；掉落两秒后回来。留意缓慢移动的圆形浮标。',action:'冲撞',metric:'撞落',unit:'人',seconds:65},
  delivery:{name:'快递大乱斗',rule:'空格拿货，送回同色收件箱；空手可拍落货物。金色急件须在倒计时内送达。',action:'拿 / 抢',metric:'运送积分',unit:'分',seconds:70},
  mine:{name:'贪心矿车',rule:'选择继续挖或带钱回家；前两站安全，之后参考下一站风险。塌方仅丢未存金币。',action:'选择',metric:'带回金币',unit:'枚',seconds:42},
  rescue:{name:'抢修漏水屋',rule:'按住空格修漏，木板处补给、水泵处排水。大漏点需两人一起按住修。',action:'修 / 排水',metric:'贡献分',unit:'分',seconds:70},
  floor:{name:'小心那块地板',rule:'先用空格放效果地砖，每人6块；12秒后抢星星。滑行、加速、弹开和传送对所有人有效。',action:'放地砖',metric:'星星',unit:'颗',seconds:70},
  wish:{name:'许愿池有点歪',rule:'秘密选愿望，5秒后同时揭晓。先加减分，再按本轮座次顺序交换；共6次许愿。',action:'许愿',metric:'愿望积分',unit:'分',seconds:48},
  remote:{name:'遥控器在谁手里',rule:'自动拾取星星；每9秒换人掌控遥控器，每次能改变一次全场规则，自己也受影响。',action:'使用遥控器',metric:'星星',unit:'颗',seconds:65},
  buttons:{name:'神秘按钮俱乐部',rule:'每人收到不同的私密提示，聊天交流后秘密选一个按钮；5秒后按本轮顺序结算，共6轮。',action:'选按钮',metric:'按钮积分',unit:'分',seconds:48},
  follow:{name:'跟我做，别全跟',rule:'秘密决定做或不做。恰好指定人数执行，执行者各得4分，旁观者1分；人数不对本轮0分。',action:'选动作',metric:'默契积分',unit:'分',seconds:48},
});
export const PARTY_WIDTH=960,PARTY_HEIGHT=600,PARTY_ROUNDS=5;
export const PARTY_BASES=[{x:100,y:100},{x:860,y:100},{x:100,y:500},{x:860,y:500}];
export function roundPoints(values){return values.map(value=>[10,7,4,2][values.filter(v=>v>value).length]);}
export function partySchedule(random=Math.random){const ids=Object.keys(PARTY_GAMES);for(let i=ids.length-1;i>0;i--){const j=Math.floor(random()*(i+1));[ids[i],ids[j]]=[ids[j],ids[i]];}return ids.slice(0,PARTY_ROUNDS);}
export const PARTY_MODES=['random',...Object.keys(PARTY_GAMES),...Object.keys(RELAY_MODES)];
export const validPartyMode=mode=>PARTY_MODES.includes(mode);
export const partyModeName=mode=>mode==='random'?'随机派对 · 五轮':RELAY_MODES[mode]||PARTY_GAMES[mode]?.name+' · 单项';
export const mineRisk=turn=>turn<=2?0:Math.min(.48,.12+(turn-3)*.09);
export const EXTRA_GAMES=['floor','wish','remote','buttons','follow'];
export const CHOICE_GAMES=['wish','buttons','follow'];
export const FLOOR_TYPES={ice:'滑行',boost:'加速',bounce:'弹开',warp:'传送'};
export const WISHES={gift:'自己 +3',prank:'最高分者 −2',swap:'交换积分',harmony:'一起许愿'};
export const POWERS={ice:'全场变滑',giant:'大家变大',shuffle:'交换位置'};
export const BUTTON_EFFECTS={gift:'按下者 +4',team:'全员 +2',swap:'与最高分者交换',trap:'按下者 −2'};
