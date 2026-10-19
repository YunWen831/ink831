export const CITY = {
  width: 4096,
  height: 3072,
  capacity: 8,
  goal: 10000,
  step: .05,
  view: 1100,
  npcLimit: 56,
  carLimit: 20,
  lootLimit: 100,
  objectLimit: 180,
  bulletLimit: 120
};

export const SPEED = { walk: 190, sprint: 300 };
export const BODY_RADIUS = 12;
export const MOVE_RADIUS = 11;
export const HIT_RADIUS = 13;
export const CAR_RADIUS = 16;
export const CAR_HIT_RADIUS = 18;

export const GUNS = {
  fists: { name: '拳头', price: 0, damage: 12, range: 43, interval: .5, mag: 0, reload: 0 },
  knife: { name: '折叠刀', price: 180, damage: 30, range: 56, interval: .5, mag: 0, reload: 0 },
  pistol: { name: '手枪', price: 650, damage: 22, range: 610, interval: .36, mag: 8, reload: 1.2 },
  shotgun: { name: '霰弹枪', price: 1100, damage: 9, range: 300, interval: .9, mag: 6, reload: 1.9, pellets: 6, spread: .18 },
  smg: { name: '冲锋枪', price: 1250, damage: 9, range: 520, interval: .09, mag: 36, reload: 1.6 },
  rifle: { name: '步枪', price: 1600, damage: 14, range: 850, interval: .15, mag: 24, reload: 1.8 },
  revolver: { name: '左轮', price: 900, damage: 34, range: 720, interval: .55, mag: 6, reload: 1.5, blackOnly: true },
  dmr: { name: '精确步枪', price: 1900, damage: 30, range: 980, interval: .42, mag: 10, reload: 1.9, blackOnly: true },
  lmg: { name: '轻机枪', price: 2500, damage: 11, range: 760, interval: .075, mag: 60, reload: 3.2, blackOnly: true },
  mimicry: { name: '拟态', price: 0, damage: 42, range: 68, interval: .55, mag: 0, reload: 0, eventOnly: true, ego: true, lifesteal: .35 },
  lamp: { name: '灯具', price: 0, damage: 38, range: 76, interval: .9, mag: 0, reload: 0, eventOnly: true, ego: true, aoe: 110 },
  smile: { name: '微笑', price: 0, damage: 40, range: 70, interval: .8, mag: 0, reload: 0, eventOnly: true, ego: true, onKill: { heal: 15, speed: 1.25, seconds: 5 } },
  justitia: { name: '正义', price: 0, damage: 34, range: 86, interval: .65, mag: 0, reload: 0, eventOnly: true, ego: true, wantedBonus: .5 },
  fourthflame: { name: '第四根火柴', price: 0, damage: 18, range: 260, interval: .9, mag: 4, reload: 1.6, eventOnly: true, ego: true, fire: true },
  diamondsword: { name: '钻石剑', price: 0, damage: 45, range: 66, interval: .5, mag: 0, reload: 0, eventOnly: true }
};

// 神备（E.G.O. 绽放）：固定时长 + 冷却，取代原来的信念槽。
export const EGO = { duration: 20, cooldown: 60, damage: 1.75, speed: 1.3, reduce: .65, skillCooldown: 9 };

// 扭曲：降低坦度，让它能被 2–3 人打碎；收容舱可主动自毁。
export const DISTORT = { maxHp: 1000, maxCap: 1500, reduce: .85, lifesteal: .15, killHp: 100, killHeal: 120, killDamage: .04, damageCap: 1.4, explode: 65, skillHeal: 25 };

export const GOODS = {
  medkit: { name: '急救包', price: 120, description: '恢复45生命' },
  ammo: { name: '弹药盒', price: 120, description: '当前枪械补充32发备用弹' },
  vest: { name: '防弹背心', price: 300, description: '补充60护甲' },
  banana: { name: '香蕉皮', price: 90, description: '脚下布置，踩中打滑' },
  decoy: { name: '充气替身', price: 160, description: '吸引附近警察和僵尸' },
  perfume: { name: '僵尸香水', price: 140, description: '让僵尸聚集到投掷位置' },
  blink: { name: '瞬移马桶', price: 260, description: '沿瞄准方向传送到可落脚地面' },
  barricade: { name: '便携路障', price: 100, description: '临时封路，可被打坏' },
  repair: { name: '维修工具', price: 130, description: '修复身边载具' },
  bribe: { name: '可疑信封', price: 300, description: '降低两级通缉' },
  grenade: { name: '手雷', price: 220, description: '朝瞄准方向抛出，范围爆炸' },
  molotov: { name: '燃烧瓶', price: 200, description: '在瞄准位置留下一片火海' },
  smoke: { name: '烟雾弹', price: 180, description: '投出浓烟 8 秒，遮蔽视线' },
  mine: { name: '感应地雷', price: 240, description: '布置在脚下，敌人靠近时爆炸' },
  adrenaline: { name: '肾上腺素', price: 200, description: '8 秒内移动速度 +35%，清除减速' },
  flashbang: { name: '闪光弹', price: 160, description: '震盲附近玩家和 NPC 2 秒' },
  armorplate: { name: '护甲板', price: 260, description: '补充 40 护甲，可与背心叠加' },
  totem: { name: '不死图腾', price: 0, description: '致死伤害时自动消耗，1 生命复活并获得短暂无敌' },
  enderpearl: { name: '末影珍珠', price: 0, description: '朝准星投掷并传送，使用后 8 秒冷却' },
  tnt: { name: 'TNT', price: 0, description: '放置后 3 秒爆炸，大范围伤害' },
  goldenapple: { name: '金苹果', price: 0, description: '恢复 50 生命并获得 20 护甲' }
};

export const EVENTS = {
  bombs: { name: '炸弹雨', hint: '红圈落弹前有预警，离开爆炸范围', seconds: 40 },
  zombies: { name: '僵尸入侵', hint: '击败僵尸可领80奖金，小心枪声引来更多', seconds: 50, major: true },
  blackout: { name: '全城停电', hint: '视野变暗，警察侦测距离缩小；开车时注意路障', seconds: 40 },
  cash: { name: '运钞车翻了', hint: '地图标记处散落现金，所有人都能捡', seconds: 40 },
  sale: { name: '疯狂促销', hint: '所有商店与车行限时七折', seconds: 45 },
  geese: { name: '大鹅接管街道', hint: '暴躁大鹅追人，车辆也拦不住它们的脾气', seconds: 35 },
  golden: { name: '黄金大鹅', hint: '一只值钱的大鹅正在逃窜，抓住它有600奖金', seconds: 35 },
  truck: { name: '装甲运钞车', hint: '运钞车在主干道巡游，打爆它能捡到大笔现金', seconds: 45 },
  airdrop: { name: '空投', hint: '地图标记处落下一箱军火，先到先得', seconds: 35 },
  swat: { name: '特警围捕', hint: '特警队进城，所有通缉玩家都会被重点照顾', seconds: 45, major: true },
  gooseking: { name: '鹅王攻城', hint: '一只巨鹅正在拆街，击倒它夺取金色补给', seconds: 75, major: true },
  artillery: { name: '炮击区', hint: '红圈街区即将被夷平，炮击后废墟里散落补给', seconds: 50, major: true },
  convoy: { name: '武装押运', hint: '装甲车队穿过城区，押运员会开火；打爆它们抢钱抢枪', seconds: 60, major: true },
  abnormality: { name: '收容事故', hint: '收容舱坠毁，异想体正在爬出来；打倒它夺取 E.G.O.', seconds: 90, major: true },
  rift: { name: '方块裂缝', hint: '一整块方块区域砸进城市，里面有怪、箱子和核心', seconds: 120, major: true }
};

export const ABNORMALITIES = {
  nothing: { name: '一无所有', risk: 'ALEPH', hp: 1200, speed: 135, damage: 24, drop: 'mimicry' },
  bigbird: { name: '大鸟', risk: 'WAW', hp: 1600, speed: 105, damage: 26, drop: 'lamp' },
  mountain: { name: '微笑的尸山', risk: 'WAW', hp: 1400, speed: 80, damage: 18, drop: 'smile' },
  judgebird: { name: '审判鸟', risk: 'WAW', hp: 1400, speed: 125, damage: 20, drop: 'justitia' },
  scorched: { name: '焦化少女', risk: 'TETH', hp: 500, speed: 175, damage: 14, drop: 'fourthflame' }
};

export const DESIRES = {
  greed: { name: '贪', accept: '伸出手。', reject: '收回手。', color: '#f2c94c' },
  wrath: { name: '怒', accept: '砸下去。', reject: '收住手。', color: '#e0675e' },
  envy: { name: '嫉', accept: '看清他。', reject: '移开眼。', color: '#b57ae0' }
};

export const ZONES = [
  { id: 'oldtown', name: '旧城区', x: 0, y: 0, w: 1200, h: 2000, tint: '#3b382b', edge: '#b09a6d' },
  { id: 'finance', name: '金融街', x: 1200, y: 0, w: 1700, h: 1000, tint: '#26384a', edge: '#86a8c8' },
  { id: 'commercial', name: '中央商业区', x: 1200, y: 1000, w: 1700, h: 1000, tint: '#4a3a2e', edge: '#e0b06a' },
  { id: 'entertainment', name: '霓虹娱乐区', x: 2900, y: 0, w: 1196, h: 2200, tint: '#3a2b47', edge: '#e57cf0' },
  { id: 'harbor', name: '南港工业区', x: 0, y: 2000, w: 4096, h: 1072, tint: '#25343a', edge: '#8faeb5' }
];

// 每个区自己的街区尺度、道路宽度和建筑语言。
export const DISTRICTS = [
  { id: 'oldtown', x: 105, y: 110, w: 1050, h: 1880, cw: 150, ch: 150, road: 56, style: 'rowhouse', palette: ['#8a6f56', '#9c7e63', '#7a604a', '#a58a6b'], floors: [1, 3] },
  { id: 'finance', x: 1250, y: 90, w: 1620, h: 860, cw: 270, ch: 220, road: 72, style: 'tower', palette: ['#526b7d', '#627e91', '#465c6d', '#718b9c'], floors: [5, 10] },
  { id: 'commercial', x: 1250, y: 1030, w: 1620, h: 940, cw: 190, ch: 180, road: 62, style: 'shop', palette: ['#a9775e', '#c08d6a', '#976a53', '#b98565'], floors: [1, 3] },
  { id: 'entertainment', x: 2960, y: 90, w: 1070, h: 2090, cw: 300, ch: 280, road: 84, style: 'casino', palette: ['#7a4a8a', '#9a5aa8', '#5e386b', '#b16ac1'], floors: [2, 5] },
  { id: 'harbor', x: 90, y: 2090, w: 3920, h: 890, cw: 300, ch: 200, road: 76, style: 'warehouse', palette: ['#6d7468', '#7c8374', '#5f665b', '#8a8b76'], floors: [1, 2] }
];

// 把街区网格均分到整个区，避免最后一行/列留下空白地带。
for (const d of DISTRICTS) {
  const cols = Math.max(1, Math.floor((d.w + d.road) / (d.cw + d.road)));
  const rows = Math.max(1, Math.floor((d.h + d.road) / (d.ch + d.road)));
  d.cw = (d.w - (cols - 1) * d.road) / cols;
  d.ch = (d.h - (rows - 1) * d.road) / rows;
}

export const ROADS = [
  { type: 'avenue', x: 0, y: 48, w: 4096, h: 54 },
  { type: 'avenue', x: 1160, y: 0, w: 80, h: 3072 },
  { type: 'avenue', x: 2890, y: 0, w: 70, h: 3072 },
  { type: 'avenue', x: 0, y: 990, w: 2900, h: 56 },
  { type: 'avenue', x: 0, y: 1990, w: 4096, h: 64 },
  { type: 'ring', x: 1700, y: 1160, w: 700, h: 700 },
  { type: 'dock', x: 900, y: 2400, w: 2300, h: 54 }
];

// 有交互服务的地方会留出广场；建筑绕开这些点生长。
export const PLACES = [
  { id: 'fixer', kind: 'fixer', name: '中央委托台', x: 2048, y: 1500 },
  { id: 'safehouse', kind: 'safehouse', name: '旧城安全屋', x: 300, y: 930 },
  { id: 'containment', kind: 'containment', name: '旧城收容舱', x: 980, y: 1120 },
  { id: 'clinic', kind: 'clinic', name: '巷口诊所', x: 620, y: 1240 },
  { id: 'cyber', kind: 'cyber', name: '义体诊所', x: 2320, y: 1600 },
  { id: 'job-west', kind: 'job', name: '西区快递站', x: 300, y: 1200 },
  { id: 'job-east', kind: 'job', name: '东港打工站', x: 3300, y: 2420 },
  { id: 'job-north', kind: 'job', name: '金融街配送站', x: 1600, y: 300 },
  { id: 'job-south', kind: 'job', name: '南港仓库', x: 1800, y: 2300 },
  { id: 'arms', kind: 'arms', name: '旧城铁皮武器店', x: 900, y: 1500 },
  { id: 'arms-east', kind: 'arms', name: '东区军品店', x: 3400, y: 1600 },
  { id: 'arms-south', kind: 'arms', name: '码头靶场', x: 1300, y: 2200 },
  { id: 'market', kind: 'market', name: '中央夜市', x: 1500, y: 1300 },
  { id: 'market-south', kind: 'market', name: '旧城杂货铺', x: 700, y: 1600 },
  { id: 'market-north', kind: 'market', name: '金融街便利店', x: 2500, y: 400 },
  { id: 'market-east', kind: 'market', name: '霓虹夜市', x: 3600, y: 900 },
  { id: 'black-market', kind: 'market', name: '后巷黑市', x: 3500, y: 500, black: true },
  { id: 'bank-west', kind: 'bank', name: '旧城储蓄所', x: 400, y: 600 },
  { id: 'bank-east', kind: 'bank', name: '娱乐城银行', x: 3500, y: 1200 },
  { id: 'bank-north', kind: 'bank', name: '金融街总行', x: 2000, y: 620 },
  { id: 'bank-south', kind: 'bank', name: '南港金库', x: 2200, y: 2300 },
  { id: 'bank-central', kind: 'bank', name: '中央银行', x: 2450, y: 1300 },
  { id: 'casino', kind: 'casino', name: '好运骰子厅', x: 3200, y: 840 },
  { id: 'casino-south', kind: 'casino', name: '赛鹅俱乐部', x: 3600, y: 1700 },
  { id: 'casino-east', kind: 'casino', name: '东岸赌场', x: 3900, y: 300 },
  { id: 'goose-stadium', kind: 'casino', name: '赛鹅竞技场', x: 3700, y: 1400, goose: true },
  { id: 'garage', kind: 'garage', name: '旧城二手车行', x: 900, y: 800 },
  { id: 'garage-south', kind: 'garage', name: '南港车行', x: 800, y: 2400 },
  { id: 'garage-north', kind: 'garage', name: '金融街车行', x: 1500, y: 700 },
  { id: 'garage-east', kind: 'garage', name: '娱乐城车行', x: 3300, y: 1900 },
  { id: 'escape-west', kind: 'escape', name: '渡轮码头', x: 500, y: 2900 },
  { id: 'escape-east', kind: 'escape', name: '东岸直升机坪', x: 4000, y: 1000 },
  { id: 'escape-south', kind: 'escape', name: '南港长途车站', x: 2500, y: 2820 },
  { id: 'escape-north', kind: 'escape', name: '金融街直升机坪', x: 2800, y: 150 },
  { id: 'escape-east2', kind: 'escape', name: '东港码头', x: 3800, y: 2700 }
];

export const BOONS = {
  swift: { name: '疾风', description: '步行与冲刺速度 +15%', color: '#4de3f2' },
  iron: { name: '铁皮', description: '受伤减免 15%，复活时获得 20 护甲', color: '#8fa6a6' },
  gunsmith: { name: '枪匠', description: '装填时间 -30%', color: '#f2d57d' },
  hunter: { name: '猎手', description: '枪械伤害 +18%', color: '#f39485' },
  lucky: { name: '幸运', description: '现金掉落 +30%', color: '#3ddc84' },
  ghost: { name: '静默', description: '警察发现你的距离 -25%', color: '#c4a0ef' },
  driver: { name: '车神', description: '载具极速 +12%', color: '#84c8e8' },
  veteran: { name: '老练', description: '通缉自然消退速度 +50%', color: '#d6b07a' },
  vampire: { name: '汲取', description: '击杀敌人回复 12 生命', color: '#e0675e' },
  rich: { name: '门路', description: '完成委托时强化多一个选项', color: '#f0c97b' },
  scavenger: { name: '拾荒者', description: '弹药拾取 +80，现金掉落 +10%', color: '#d9b45a' },
  brawler: { name: '拳手', description: '近战伤害 +50%', color: '#e59a5b' },
  demolition: { name: '爆破手', description: '手雷、燃烧瓶、地雷伤害 +35%', color: '#f07cff' },
  medic: { name: '急救员', description: '急救包恢复 80 生命', color: '#e0675e' },
  marksman: { name: '神射手', description: '枪械射程 +20%', color: '#84c8e8' }
};

// 每局随机城市规则：让同一张图每次开局的目标和风险不同。
export const MODIFIERS = [
  { id: 'crackdown', name: '严打周', description: '警察锁定更快，委托与击杀现金 +30%', color: '#f39485', pay: 1.3, police: 1.35 },
  { id: 'cashrain', name: '现金雨', description: '现金掉落 +35%，运钞车和空投更常见', color: '#f2c94c', cash: 1.35 },
  { id: 'blackmarket', name: '黑市繁荣', description: '黑市取消加价，全城商品再打八折', color: '#b57ae0', sale: .8 },
  { id: 'goose', name: '肥鹅之夜', description: '鹅群更暴躁，黄金大鹅奖励翻倍', color: '#f4ecd4', goose: 2 },
  { id: 'blackout', name: '不夜城停电', description: '停电事件更频繁，黑暗里更要小心警察', color: '#8fa6a6' },
  { id: 'no-law', name: '无政府之夜', description: '警察更少，委托奖励 +25%', color: '#e0675e', pay: 1.25 }
];

export const SLOT_SYMBOLS = [
  { id: 'goose', name: '鹅', color: '#f4ecd4', weight: 2, pay: 24 },
  { id: 'coin', name: '金币', color: '#f2c94c', weight: 3, pay: 12 },
  { id: 'dice', name: '骰子', color: '#f07cff', weight: 4, pay: 7 },
  { id: 'cherry', name: '樱桃', color: '#e0675e', weight: 4, pay: 5 },
  { id: 'bomb', name: '炸弹', color: '#6d7a82', weight: 3, pay: 0 }
];

export const GOOSE_RACERS = [
  { id: 'gold', name: '金翅', color: '#f2c94c', speed: 1.03, odds: 3.0 },
  { id: 'iron', name: '铁头', color: '#84c8e8', speed: 1.01, odds: 3.6 },
  { id: 'white', name: '白旋风', color: '#f4ecd4', speed: 1.00, odds: 4.0 },
  { id: 'rage', name: '暴走鹅', color: '#e0675e', speed: .985, odds: 4.6 },
  { id: 'black', name: '黑蹄', color: '#8a93a0', speed: .97, odds: 5.2 },
  { id: 'lucky', name: '幸运星', color: '#7fd6b0', speed: .955, odds: 6.0 }
];

export const BODY_UPGRADES = {
  vitality: { name: '强化心脏', description: '最大生命 +20', costs: [700, 1400, 2400], color: '#e0675e' },
  plating: { name: '皮下装甲', description: '护甲上限 +25', costs: [650, 1300, 2300], color: '#6f9fc4' },
  muscle: { name: '肌肉纤维', description: '移动速度 +6%', costs: [600, 1200, 2200], color: '#f2c94c' },
  carry: { name: '负重骨架', description: '背包容量 +4', costs: [500, 1000, 1800], color: '#7fd6b0' }
};

export const RACE = { checkpoints: 3, seconds: 45, base: 1150 };

export const CONTRACT_META = {
  delivery: { name: '急送', description: '把包裹送到指定地点，路上小心警察', color: '#70dbb1' },
  bounty: { name: '悬赏', description: '找到并击倒标记目标，目标会还击', color: '#f39485' },
  vehicle: { name: '偷车', description: '偷走标记车辆，开到任意车行交货', color: '#84c8e8' },
  race: { name: '狂飙', description: '按顺序穿过三个检查点，限时完成', color: '#f2d57d' },
  player: { name: '猎杀', description: '锁定一名玩家；目标存活到倒计时结束则委托失败', color: '#e0675e' },
  heist: { name: '劫案', description: '三阶段：取得钥匙卡、打开金库、把赃款送到撤离点', color: '#f0c97b' }
};

const hash = (a, b) => {
  let n = Math.imul(a + 1, 73856093) ^ Math.imul(b + 1, 19349663);
  n = Math.imul(n ^ (n >>> 13), 1274126177);
  return ((n ^ (n >>> 16)) >>> 0) / 4294967296;
};

const SPECIALS = [
  { id: 'central-plaza', x: 1700, y: 1160, w: 700, h: 700, color: '#8a8172', style: 'plaza', solid: false },
  { id: 'finance-plaza', x: 1800, y: 260, w: 400, h: 360, color: '#6f7880', style: 'plaza', solid: false },
  { id: 'old-park', x: 690, y: 1260, w: 300, h: 260, color: '#5f7d5c', style: 'park', solid: false },
  { id: 'finance-park', x: 2580, y: 690, w: 250, h: 160, color: '#5f7d5c', style: 'park', solid: false },
  { id: 'ent-plaza', x: 3330, y: 1180, w: 620, h: 480, color: '#6b4d78', style: 'plaza', solid: false },
  { id: 'harbor-water', x: 1050, y: 2460, w: 2100, h: 610, color: '#1d4a5a', style: 'water', solid: true },
  { id: 'harbor-pier-west', x: 420, y: 2520, w: 560, h: 48, color: '#6b6252', style: 'pier', solid: false },
  { id: 'harbor-pier-south', x: 2400, y: 2800, w: 520, h: 48, color: '#6b6252', style: 'pier', solid: false },
  { id: 'harbor-pier-east', x: 3400, y: 2600, w: 560, h: 48, color: '#6b6252', style: 'pier', solid: false }
];

export const BLOCKS = [];

function addBlock(id, x, y, w, h, style, palette, floors, solid = true, extra = {}) {
  const color = palette[Math.floor(hash(x, y) * palette.length)] || '#71808a';
  BLOCKS.push({ id, x, y, w, h, style, color, floors, solid, ...extra });
}

for (const s of SPECIALS) BLOCKS.push({ ...s, floors: 0, palette: [] });
addBlock('old-corner', 105, 110, 290, 300, 'rowhouse', ['#8a6f56', '#9c7e63', '#7a604a'], 2, true, { label: '旧城公寓' });

function placeNear(x, y, r) {
  return PLACES.some(p => Math.hypot(p.x - x, p.y - y) < r);
}
function specialHit(x, y, w, h) {
  return SPECIALS.some(s => x + w > s.x - 8 && x < s.x + s.w + 8 && y + h > s.y - 8 && y < s.y + s.h + 8);
}
function cornerHit(x, y, w, h) {
  return x + w > 105 && x < 395 && y + h > 110 && y < 410;
}

for (const d of DISTRICTS) {
  let row = 0;
  for (let y = d.y; y + d.ch <= d.y + d.h + .01; y += d.ch + d.road, row++) {
    let col = 0;
    for (let x = d.x; x + d.cw <= d.x + d.w + .01; x += d.cw + d.road, col++) {
      const cx = x + d.cw / 2, cy = y + d.ch / 2;
      if (cornerHit(x, y, d.cw, d.ch)) continue;
      const overSpecial = SPECIALS.find(q => x + d.cw > q.x - 8 && x < q.x + q.w + 8 && y + d.ch > q.y - 8 && y < q.y + q.h + 8);
      if (overSpecial) {
        if (overSpecial.style === 'water') continue;
        BLOCKS.push({ id: `${d.id}-edge-${col}-${row}`, x, y, w: d.cw, h: d.ch, color: overSpecial.style === 'park' ? '#5f7d5c' : '#6f6a60', style: overSpecial.style === 'park' ? 'park' : 'plaza', solid: false, floors: 0, palette: [] });
        continue;
      }
      const roll = hash(col + 3, row + 17);
      if (roll < .07) {
        BLOCKS.push({ id: `${d.id}-park-${col}-${row}`, x, y, w: d.cw, h: d.ch, color: '#5f7d5c', style: 'park', solid: false, floors: 0, palette: [] });
        continue;
      }
      if (PLACES.some(p => p.x > x - 52 && p.x < x + d.cw + 52 && p.y > y - 52 && p.y < y + d.ch + 52)) {
        const court = d.style === 'casino' ? '#5d4268' : d.style === 'tower' ? '#58626b' : d.style === 'warehouse' ? '#595d52' : '#76695b';
        BLOCKS.push({ id: `${d.id}-court-${col}-${row}`, x, y, w: d.cw, h: d.ch, color: court, style: 'plaza', solid: false, floors: 0, palette: [] });
        continue;
      }
      const gap = d.style === 'rowhouse' ? 18 : 26;
      const bx = x + gap, by = y + gap, bw = d.cw - gap * 2, bh = d.ch - gap * 2;
      if (d.style === 'rowhouse') {
        const n = 2, gap = 28;
        const hw = Math.max(36, (bw - gap) / 2);
        for (let i = 0; i < n; i++) {
          addBlock(`${d.id}-${col}-${row}-${i}`, bx + i * (hw + gap), by, hw, bh, 'rowhouse', d.palette, 1 + Math.floor(hash(col + i, row) * 3), true);
        }
      } else {
        addBlock(`${d.id}-${col}-${row}`, bx, by, bw, bh, d.style, d.palette, d.floors[0] + Math.floor(hash(col, row) * (d.floors[1] - d.floors[0] + 1)), true);
      }
    }
  }
}

addBlock('harbor-silo-a', 300, 2140, 120, 120, 'silo', ['#7c8374'], 1);
addBlock('harbor-silo-b', 460, 2140, 120, 120, 'silo', ['#6d7468'], 1);
addBlock('harbor-warehouse-a', 850, 2120, 360, 200, 'warehouse', ['#6d7468'], 1);
addBlock('harbor-warehouse-b', 3300, 2140, 420, 220, 'warehouse', ['#7c8374'], 1);
addBlock('harbor-crane', 1520, 2430, 60, 80, 'crane', ['#8a8b76'], 1);
addBlock('harbor-crane2', 2300, 2420, 60, 80, 'crane', ['#8a8b76'], 1);
addBlock('harbor-container-a', 1600, 2320, 180, 44, 'container', ['#a46f51', '#5f7d8f'], 1);
addBlock('harbor-container-b', 1850, 2320, 180, 44, 'container', ['#7f8064'], 1);
addBlock('harbor-container-c', 1600, 2370, 130, 44, 'container', ['#8d5e63'], 1);
addBlock('finance-bank-hq', 1900, 320, 240, 220, 'bankhq', ['#5d7184'], 8, true, { label: '金融街总行' });
addBlock('ent-casino-hq', 3060, 520, 300, 260, 'casino', ['#7a4a8a'], 4, true, { label: '好运骰子厅' });
addBlock('ent-hotel', 3060, 1020, 220, 260, 'hotel', ['#8a6b9a'], 6, true, { label: '霓虹旅馆' });
addBlock('ent-arcade', 3340, 960, 180, 140, 'shop', ['#b16ac1'], 2);
addBlock('ent-goose-stadium', 3450, 1210, 520, 400, 'stadium', ['#8a5a9a'], 2, false, { label: '赛鹅竞技场' });
addBlock('old-safehouse', 230, 760, 150, 130, 'safehouse', ['#9c7e63'], 2, true, { label: '安全屋' });
addBlock('old-clinic', 555, 1060, 130, 140, 'clinic', ['#a58a6b'], 3, true, { label: '巷口诊所' });
addBlock('old-park-shed', 730, 1460, 120, 80, 'shop', ['#8a6f56'], 1);

export const BARKS = ['这路灯是不是在盯着我？', '我只想准点下班！', '你见过会开车的鹅吗？', '隔壁银行又响了。', '今天的外卖有点烫手。', '别抢我，我工资还没发！', '黄金大鹅往码头跑了！', '谁把集装箱堆在路中间？'];

export const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
export const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

export function free(x, y, r = 12, obstacles = []) {
  const onPier = BLOCKS.some(b => b.style === 'pier' && x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h);
  return Number.isFinite(x) && Number.isFinite(y) && x >= r && y >= r && x <= CITY.width - r && y <= CITY.height - r &&
    !BLOCKS.some(b => b.solid !== false && !(onPier && b.style === 'water') && x + r > b.x && x - r < b.x + b.w && y + r > b.y && y - r < b.y + b.h) &&
    !obstacles.some(b => b.hp > 0 && (
      b.kind === 'barricade' && Math.abs(x - b.x) < r + 18 && Math.abs(y - b.y) < r + 18 ||
      b.kind === 'block' && x + r > b.x && x - r < b.x + (b.w || 30) && y + r > b.y && y - r < b.y + (b.h || 30)
    ));
}

export function cityMove(p, dx, dy, obstacles = [], radius = BODY_RADIUS) {
  let { x, y } = p;
  const steps = Math.max(1, Math.ceil(Math.hypot(dx, dy) / 6));
  for (let i = 0; i < steps; i++) {
    if (free(x + dx / steps, y, radius, obstacles)) x += dx / steps;
    if (free(x, y + dy / steps, radius, obstacles)) y += dy / steps;
  }
  return { x, y };
}

export function cityDrive(car, input, dt, obstacles = []) {
  let { heading, speed } = car;
  const power = Math.min(1, Math.hypot(input.x, input.y));
  if (input.brake) {
    speed = Math.max(0, speed - 1100 * dt);
    if (power > .1) {
      const desired = Math.atan2(input.y, input.x), diff = Math.atan2(Math.sin(desired - heading), Math.cos(desired - heading));
      heading += clamp(diff, -4.6 * dt, 4.6 * dt);
    }
  } else if (power > .1) {
    const desired = Math.atan2(input.y, input.x), diff = Math.atan2(Math.sin(desired - heading), Math.cos(desired - heading));
    heading += clamp(diff, -3.5 * dt, 3.5 * dt);
    speed = Math.min(580 * power, speed + 420 * dt);
  } else speed = Math.max(0, speed - 700 * dt);
  const next = cityMove(car, Math.cos(heading) * speed * dt, Math.sin(heading) * speed * dt, obstacles, CAR_RADIUS);
  const crash = dist(next, car) < speed * dt * .4 && speed > 150;
  return { ...next, heading, speed: crash ? speed * .2 : speed, impact: crash ? speed * .025 : 0 };
}

export function wallRange(p, angle, range, obstacles = []) {
  for (let d = 0; d <= range; d += 6) if (!free(p.x + Math.cos(angle) * d, p.y + Math.sin(angle) * d, 1, obstacles)) return d;
  return range;
}

export function circleHit(p, angle, t, r = 15) {
  const dx = t.x - p.x, dy = t.y - p.y;
  const a = dx * Math.cos(angle) + dy * Math.sin(angle), side = dx * dx + dy * dy - a * a;
  return a < 0 || side > r * r ? Infinity : Math.max(0, a - Math.sqrt(Math.max(0, r * r - side)));
}

export function nearPlace(p, kind, range = 95) {
  return PLACES.filter(q => (!kind || q.kind === kind) && dist(p, q) < range).sort((a, b) => dist(p, a) - dist(p, b))[0];
}

export function boonSpeed(p) {
  return p?.boons?.includes('swift') ? 1.15 : 1;
}
export function boonDamage(p) {
  return p?.boons?.includes('hunter') ? 1.18 : 1;
}
export function boonReload(p) {
  return p?.boons?.includes('gunsmith') ? .7 : 1;
}
