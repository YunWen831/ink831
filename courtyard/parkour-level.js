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
