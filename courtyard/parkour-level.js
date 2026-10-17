const rect=(x,y,w,h)=>({x,y,w,h});
const checkpoint=(x,y,name)=>({x,y,name,trigger:rect(x-12,y-48,48,80)});
export const PRACTICE_LEVEL={
  width:2880,height:720,
  solids:[
    rect(0,640,300,80),rect(396,640,532,80),rect(168,592,72,48),
    rect(480,568,96,18),rect(600,520,72,18),
    rect(784,396,24,192),rect(904,396,24,244),rect(928,396,320,24),
    rect(1392,396,108,24),rect(1692,396,252,24),
    rect(2112,444,96,24),rect(2328,372,504,24)
  ],
  hazards:[rect(302,687,92,25),rect(932,690,1160,30),rect(2208,690,120,30),rect(2510,360,48,12)],
  checkpoints:[checkpoint(64,616,'起步'),checkpoint(708,616,'蹬墙'),checkpoint(1010,372,'冲刺'),checkpoint(1752,372,'连跳'),checkpoint(2370,348,'终点前')],
  crystals:[{x:1584,y:340},{x:2268,y:360}],
  goal:rect(2720,324,32,48),
  signs:[{x:70,y:550,text:'Z · 跳'},{x:708,y:535,text:'贴墙 · 再跳'},{x:1050,y:320,text:'方向 + X · 冲刺'},{x:1545,y:260,text:'晶石 · 补充冲刺'},{x:1760,y:320,text:'连起来试试'}]
};
export const MECHANISM_LEVEL={
  width:3480,height:720,
  solids:[rect(0,640,3480,80),rect(320,520,120,24)],hazards:[],crystals:[],
  springs:[rect(220,632,24,8)],oneways:[rect(720,592,144,6),rect(768,544,96,6)],
  movers:[{...rect(1200,592,72,8),axis:'x'},{...rect(1400,580,72,8),axis:'y'}],
  crumbles:[rect(1800,592,48,24),rect(1848,592,48,24),rect(1896,592,48,24)],
  switches:[{...rect(2380,622,18,18),group:0}],doors:[{...rect(2490,544,24,96),group:0}],
  winds:[{...rect(2960,496,120,144),dx:0,dy:-1},{...rect(3180,520,120,120),dx:1,dy:0}],
  checkpoints:[checkpoint(64,616,'弹簧'),checkpoint(600,616,'单向平台'),checkpoint(1160,616,'移动平台'),checkpoint(1720,616,'坍塌平台'),checkpoint(2280,616,'开关与门'),checkpoint(2840,616,'风场')],
  goal:rect(3370,592,24,48),
  signs:[{x:70,y:550,text:'从上方落下 · 弹起补冲刺'},{x:610,y:510,text:'穿底落顶 · ↓ + Z 穿下'},{x:1150,y:475,text:'站稳随行 · 起跳离开'},{x:1730,y:525,text:'踩踏后坍塌 · 稍后恢复'},{x:2280,y:510,text:'触碰开关 · 开门 4 秒'},{x:2860,y:450,text:'顺风加速 · 逆风调整'}]
};
