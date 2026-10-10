/* ==================================================================
   角色美术 —— 一套数据喂出两样东西

   1. 立绘 PORTRAIT[id]：32×32，对话框里按 3 倍画成 96px
   2. 走路 SPRITE[id][方向][帧]：16×24，地图上跑的小人

   为什么地图上的人小、对话框里的脸大：
   这是 Undertale / Deltarune 的做法 —— 走路的小人只要能认出"那是个人、
   朝哪边走"，认脸的事交给对话框那张大的。上上版我把脸画成 16×16 缩在
   地图上，一格只有 1.9 个像素，八个人其实是同一张脸换配色，所以认不出。

   身子只画一套：正面、背面、侧面（左边靠镜像）。每个角色只换配色、
   再挑一个发型预设（spr），不用重画 12 张图。
   要加角色，照抄 CHARS 里一条、给个配色和 spr 就完了。
   ================================================================== */
"use strict";

var AV = {
  out:'#14100f',                       // 描边，统一这一个色，缩小时才不脏
  white:'#ffffff'
};

/* ==================== 小工具 ====================
   网格用二维数组，null = 透明。头和身子是算出来的（椭圆、梯形），
   五官是盖小图章 —— 整张 32×32 手写我数不准列，上一版就是数错才发现。
   ============================================ */
function blankGrid(w, h){
  var g = [];
  for (var y=0; y<h; y++){
    var row = [];
    for (var x=0; x<w; x++) row.push(null);
    g.push(row);
  }
  return g;
}
function put(g, x, y, col){
  if (col && y>=0 && y<g.length && x>=0 && x<g[0].length) g[y][x] = col;
}
function ellipse(g, cx, cy, rx, ry, col){
  for (var y=-ry; y<=ry; y++)
    for (var x=-rx; x<=rx; x++)
      if ((x*x)/(rx*rx) + (y*y)/(ry*ry) <= 1) put(g, cx+x, cy+y, col);
}
/* 圆环，1 像素宽 —— 圆框眼镜用 */
function ring(g, cx, cy, r, col){
  for (var y=-r; y<=r; y++)
    for (var x=-r; x<=r; x++){
      var d = Math.sqrt(x*x + y*y);
      if (d >= r-0.5 && d <= r+0.5) put(g, cx+x, cy+y, col);
    }
}
/* 盖图章：'.' 和空格都表示"这一格别动"（不是透明，是别碰） */
function stamp(g, x, y, rows, pal){
  for (var j=0; j<rows.length; j++)
    for (var i=0; i<rows[j].length; i++){
      var ch = rows[j][i];
      if (ch==='.' || ch===' ') continue;
      put(g, x+i, y+j, pal[ch]);
    }
}
/* 描边：所有"空、但四邻里有人"的格子填深色。
   自动描比手描靠谱，轮廓永远干净，改形状也不用重描 */
function addOutline(g, col){
  var snap = g.map(function(r){ return r.slice(); });
  var d = [[1,0],[-1,0],[0,1],[0,-1]];
  for (var y=0; y<g.length; y++)
    for (var x=0; x<g[0].length; x++){
      if (snap[y][x]) continue;
      for (var k=0; k<4; k++){
        var nx = x+d[k][0], ny = y+d[k][1];
        if (ny>=0 && ny<g.length && nx>=0 && nx<g[0].length && snap[ny][nx]){ g[y][x] = col; break; }
      }
    }
}
function gridSVG(g, bg){
  var w = g[0].length, h = g.length;
  /* bg 传 null 就是不要底色（地图上的小人要透出地面） */
  var out = bg ? '<rect width="'+w+'" height="'+h+'" fill="'+bg+'"/>' : '';
  for (var y=0; y<h; y++)
    for (var x=0; x<w; x++)
      if (g[y][x]) out += '<rect x="'+x+'" y="'+y+'" width="1" height="1" fill="'+g[y][x]+'"/>';
  return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 '+w+' '+h+'" ' +
    'shape-rendering="crispEdges">' + out + '</svg>';
}

/* ==================== 五官预设 ====================
   眼睛至少两行高才装得下"上眼睑 + 眼白 + 瞳孔"这三层。
   一行高的眼睛缩小后就是一个点，看不出在看你。
   ============================================ */
var EYES = {
  normal: ['.OOO.', 'OWWWO', '.OWO.'],
  wide:   ['OOOOO', 'OWWWO', 'OWOWO'],   // 眼白多一圈 → 一脸无辜
  squint: ['.....', 'OOOOO', '.OWO.'],
  happy:  ['.....', 'O.O.O', '.OOO.']    // 笑成一条缝
};
var BROWS = {
  thick: ['OOOOOO', 'OOOOOO'],
  thin:  ['OOOOOO'],
  none:  null
};
var MOUTH = {
  neutral: ['..OOOO..', '..OMMO..'],
  thick:   ['.OOOOOO.', 'OMMMMMMO'],
  grin:    ['OMMMMMMO', 'OWWWWWWO'],
  smile:   ['..OOOO..', '.OMMMMO.'],
  small:   ['..OOOO..', '...MM...']
};

/* ==================== 立绘 32×32 ====================
   脸是椭圆（cols 6-26 / rows 4-26），肩膀是往下张开的梯形。
   决定"像不像那个人"的其实就三样：发际线多高、鬓角留到哪、刘海什么形状。
   轮廓是最认人的东西，所以这几个参数别偷懒。
   ============================================ */
var PW = 32, PH = 32, PCX = 16, PCY = 15, PRX = 10, PRY = 11;

function buildPortrait(c){
  var p = c.pal, g = blankGrid(PW, PH);
  /* 脸型可以每人不一样：脸宽脸长是仅次于发型的认人线索。
     不设就用默认，水哥那种圆脸和 lg7 那种细长脸一眼就分开了 */
  var rx = c.faceRX || PRX, ry = c.faceRY || PRY;

  /* 肩膀：越往下越宽 */
  for (var y=27; y<PH; y++){
    var t = (y-27)/(PH-27);
    var half = 6 + Math.round(t*10);
    for (var x=PCX-half; x<PCX+half; x++) put(g, x, y, p.cloth);
  }
  /* 领口：露一截里面那件。蓝 T / 白衬里 / 领带都靠这块区分 */
  if (c.collar) stamp(g, 16 - Math.floor(c.collar[0].length/2), 27, c.collar, p);
  if (c.armband){                                   // 值周生的红袖章
    for (var ay=27; ay<PH; ay++) for (var ax=1; ax<6; ax++) put(g, ax, ay, p.cloth2);
  }

  /* 脖子；再往下一点，免得头和肩膀之间断开 */
  for (var ny=24; ny<29; ny++) for (var nx=13; nx<19; nx++) put(g, nx, ny, p.skin);

  /* 头：先一颗大一圈的深色椭圆、再盖皮肤 —— 等于自带描边 */
  ellipse(g, PCX, PCY, rx+1, ry+1, AV.out);
  ellipse(g, PCX, PCY, rx, ry, p.skin);
  ellipse(g, PCX-rx, PCY+2, 2, 3, p.skin);
  ellipse(g, PCX+rx, PCY+2, 2, 3, p.skin);

  /* 头发：发际线以上的皮肤全刷成发色 */
  for (var hy=0; hy<c.hairLine; hy++)
    for (var hx=0; hx<PW; hx++)
      if (g[hy][hx] === p.skin) g[hy][hx] = p.hair;
  /* 鬓角：脸两侧往下延长 */
  for (var sy=c.hairLine; sy<c.sideburn; sy++)
    for (var sx=0; sx<PW; sx++)
      if (g[sy][sx]===p.skin && (sx<=PCX-rx+2 || sx>=PCX+rx-2)) g[sy][sx] = p.hair;
  /* 刘海：把发际线在中间压几格下去。形状不同，人就不一样 */
  if (c.fringe) stamp(g, 0, c.hairLine-2, c.fringe, p);

  addOutline(g, AV.out);

  /* ---- 五官 ---- */
  if (BROWS[c.brow]) { stamp(g, 8, 13, BROWS[c.brow], p); stamp(g, 18, 13, BROWS[c.brow], p); }
  stamp(g, 9, 16, EYES[c.eyes] || EYES.normal, p);
  stamp(g, 18, 16, EYES[c.eyes] || EYES.normal, p);
  put(g, 15, 20, p.skin2); put(g, 16, 20, p.skin2); put(g, 16, 21, p.skin2);
  stamp(g, 16 - Math.floor(MOUTH[c.mouth][0].length/2), 22, MOUTH[c.mouth], p);

  if (c.glasses === 'round'){
    ring(g, 11, 17, 4, p.frame); ring(g, 20, 17, 4, p.frame);
    put(g, 15, 17, p.frame); put(g, 16, 17, p.frame);
    put(g, 7, 17, p.frame);  put(g, 24, 17, p.frame);
  } else if (c.glasses === 'square'){
    for (var bx=8; bx<=14; bx++){ put(g,bx,15,p.frame); put(g,bx,20,p.frame); }
    for (var bx2=17; bx2<=23; bx2++){ put(g,bx2,15,p.frame); put(g,bx2,20,p.frame); }
    for (var by=15; by<=20; by++){ put(g,8,by,p.frame); put(g,14,by,p.frame);
                                   put(g,17,by,p.frame); put(g,23,by,p.frame); }
    put(g, 15, 15, p.frame); put(g, 16, 15, p.frame);
    put(g, 7, 16, p.frame);  put(g, 24, 16, p.frame);
  }
  if (c.stubble){                                    // 下巴一圈胡茬
    var lo = PCX-rx+1, hi = PCX+rx-1;
    for (var qy=21; qy<=PCY+ry; qy++)
      for (var qx=lo; qx<=hi; qx++)
        if (g[qy][qx]===p.skin && (qx<=lo+2 || qx>=hi-2 || qy>=PCY+ry-1)) g[qy][qx] = p.stubble;
  }
  return gridSVG(g, c.bg);
}

/* ==================== 走路小人 16×24 ====================
   身子（头 + 躯干 + 手）四帧共用，只有腿那 6 行分三套。
   把腿拆出来单独写，是因为走路真正让人看出来的就是腿 —— 头要是也动，
   反而像在抽搐。
   ============================================ */
var SW = 16, SH = 24;

var BODY = {
  down: [
    '.....HHHHHH.....',
    '...HHHHHHHHHH...',
    '..HHHHHHHHHHHH..',
    '..HHHHHHHHHHHH..',
    '..HHSSSSSSSSHH..',
    '..HHSSSSSSSSHH..',
    '..HHSEESSEESHH..',
    '..HHSSSSSSSSHH..',
    '..HSSSSSSSSSSH..',
    '...SSSSSSSSSS...',
    '.....SSSSSS.....',
    '....CCCCCCCC....',
    '...ACCCCCCCCA...',
    '...ACCCCCCCCA...',
    '...ACCCCCCCCA...',
    '...ACCCCCCCCA...',
    '....CCCCCCCC....',
    '....CCCCCCCC....'
  ],
  up: [
    '.....HHHHHH.....',
    '...HHHHHHHHHH...',
    '..HHHHHHHHHHHH..',
    '..HHHHHHHHHHHH..',
    '..HHHHHHHHHHHH..',
    '..HHHHHHHHHHHH..',
    '..HHHHHHHHHHHH..',
    '..HHHHHHHHHHHH..',
    '..HSSSSSSSSSSH..',
    '...SSSSSSSSSS...',
    '.....SSSSSS.....',
    '....CCCCCCCC....',
    '...ACCCCCCCCA...',
    '...ACCCCCCCCA...',
    '...ACCCCCCCCA...',
    '...ACCCCCCCCA...',
    '....CCCCCCCC....',
    '....CCCCCCCC....'
  ],
  side: [
    '.....HHHHHH.....',
    '....HHHHHHHH....',
    '...HHHHHHHHHH...',
    '...HHHHHHHHHH...',
    '...HHSSSSSSSS...',
    '...HHSSSSSSSS...',
    '...HHSSSSSEES...',
    '...HHSSSSSSSS...',
    '....HSSSSSSS....',
    '....SSSSSSSS....',
    '.....SSSSSS.....',
    '....CCCCCCCC....',
    '...CCCCCCCCCA...',
    '...CCCCCCCCCA...',
    '...CCCCCCCCCA...',
    '...CCCCCCCCCA...',
    '....CCCCCCCC....',
    '....CCCCCCCC....'
  ]
};
/* 腿：帧 0 站着，1 / 2 左右脚交替。两帧差别就一格，但配上身子上下抬一格，
   走起来就是这个味儿 —— 再夸张就成跳了 */
/* 脚那一行在走路的帧里是空的 —— 鞋子离地了。再叠上整个人抬一格，
   脚落地的高度刚好和站着那帧对上，就不会一抽一抽的 */
/* 步子做成"张开 / 并拢"交替，而不是原来那种只差一格的挪动 ——
   一格在 16px 的小人身上根本看不出来，得拉到两格才像在走。
   走路的帧脚底那行是空的（鞋离地），再叠上整个人抬一格。 */
var LEGS = {
  down: [
    ['....LL....LL....','....LL....LL....','....LL....LL....','....LL....LL....','...SSS....SSS...','...SSS....SSS...'],
    ['....LL....LL....','...LL.....LL....','...LL.....LL....','..LL.......LL...','..SSS......SSS..','................'],
    ['....LL....LL....','.....LL..LL.....','.....LL..LL.....','.....LL..LL.....','....SSS..SSS....','................']
  ],
  up: [
    ['....LL....LL....','....LL....LL....','....LL....LL....','....LL....LL....','...SSS....SSS...','...SSS....SSS...'],
    ['....LL....LL....','...LL.....LL....','...LL.....LL....','..LL.......LL...','..SSS......SSS..','................'],
    ['....LL....LL....','.....LL..LL.....','.....LL..LL.....','.....LL..LL.....','....SSS..SSS....','................']
  ],
  side: [
    ['....LLL.LLL.....','....LLL.LLL.....','....LLL.LLL.....','....LLL.LLL.....','...SSSS.SSSS....','...SSSS.SSSS....'],
    ['....LLL.LLL.....','...LLL...LLL....','...LLL...LLL....','..LLL.....LLL...','..SSSS...SSSS...','................'],
    ['....LLL.LLL.....','....LLL.LLL.....','.....LL.LL......','.....LL.LL......','....SSS.SSS.....','................']
  ]
};

/* 身子和腿各用一套字符表：身子里的 S 是皮肤，腿里的 S 是鞋。
   挤在一张表里的话，鞋子会跟着变成肉色 —— 分开放就各管各的 */
var BODY_PAL = { H:'hair', S:'skin', C:'cloth', A:'cloth', E:'pupil', W:'white' };
var LEG_PAL  = { L:'pants', S:'shoe' };

function drawRows(g, x0, y0, rows, pal, c){
  for (var y=0; y<rows.length; y++)
    for (var x=0; x<rows[y].length; x++){
      var ch = rows[y][x];
      if (ch === '.') continue;
      var key = pal[ch];
      if (!key) continue;
      put(g, x0+x, y0+y, key === 'white' ? AV.white
            : (key === 'pupil' ? '#241c16' : c.pal[key]));
    }
}

/* ==================== 地图上怎么认出人 ====================
   16×24 的小人上，脸是认不出来的（眼睛就 2 个像素）。能认出来的只有三样：
   轮廓（发型/帽子）、颜色（衣服）、身上挂的东西（袖章）。
   所以每个人至少在这三样里占两样不一样的 —— 光靠换衣服颜色，
   四个人穿同一种浅色的时候就是分不开。

   这些都在"上色之后、描边之前"动，改的是颜色网格，不用重画 12 张图。
   ==================================================== */
function hairVariant(g, c, base){
  var kind = c.spr || 'short';
  if (kind === 'short') return;
  var hc = c.pal.hair, sc = c.pal.skin;
  function hairCols(y){
    var a = [];
    for (var x=0; x<SW; x++) if (g[y][x] === hc) a.push(x);
    return a;
  }
  if (kind === 'long'){
    /* 齐耳往下再拉长：拿第 7 行头发的左右端点，把下面几行的外缘也染上。
       侧面只有后脑那一撮，往脸那边抹就成了络腮胡 */
    var hx = hairCols(7);
    if (!hx.length) return;
    var cols = (base === 'side') ? [hx[0]] : [hx[0], hx[hx.length-1]];
    for (var y=8; y<=11; y++)
      cols.forEach(function(x){
        if (g[y][x] === sc || g[y][x] === null) g[y][x] = hc;
      });
  } else if (kind === 'spiky'){
    /* 头顶那行隔一格抠掉，剩几个尖 */
    var t0 = hairCols(0);
    if (!t0.length) return;
    var L0 = t0[0];
    t0.forEach(function(x){ if ((x - L0) % 2) g[0][x] = null; });
  } else if (kind === 'cap'){
    /* 帽子：头顶两行换成帽色，帽檐再比头宽出一格 */
    var cc = c.pal.cap || hc;
    var brim = hairCols(2);
    for (var cy=0; cy<=2; cy++)
      for (var cxx=0; cxx<SW; cxx++) if (g[cy][cxx] === hc) g[cy][cxx] = cc;
    if (brim.length){
      var bl = brim[0]-1, br = brim[brim.length-1]+1;
      if (bl >= 0) g[2][bl] = cc;
      if (br < SW) g[2][br] = cc;
    }
  } else if (kind === 'bald'){
    /* 秃顶：顶上四行头发全变头皮，只剩两鬓 */
    for (var by=0; by<=3; by++)
      for (var bx=0; bx<SW; bx++) if (g[by][bx] === hc) g[by][bx] = sc;
  }
}
function accVariant(g, c, base){
  if (c.acc === 'armband'){
    /* 红袖章：胳膊那一列中间两格。正面有两只胳膊，侧面只看得见一只 */
    var cols = (base === 'side') ? [12] : [3, 12];
    cols.forEach(function(x){
      for (var y=12; y<=13; y++) if (g[y][x]) g[y][x] = c.pal.cloth2;
    });
  }
}

function buildSprite(c, base, frame, flip){
  var g = blankGrid(SW, SH);
  drawRows(g, 0, 0, BODY[base], BODY_PAL, c);
  var legTop = BODY[base].length;
  drawRows(g, 0, legTop, LEGS[base][frame], LEG_PAL, c);
  /* 认人的那点差别，得赶在抬脚（整张上移一行）之前加，不然行号全错位 */
  hairVariant(g, c, base);
  accVariant(g, c, base);

  /* 走路时整个人抬一格再落下。
     第一版只把上半身抬了、腿留在原地，结果腰上裂开一道横缝，看着像断了。
     连腿一起抬就对了。 */
  if (frame > 0){
    var shifted = blankGrid(SW, SH);
    for (var y=1; y<SH; y++)
      for (var x=0; x<SW; x++) shifted[y-1][x] = g[y][x];
    g = shifted;
  }

  /* 朝左 = 朝右那张左右翻一遍。用 SVG 的 scale(-1,1) 会把画面翻到画布外面去，
     直接翻网格最省事 */
  if (flip){
    for (var fy=0; fy<SH; fy++) g[fy].reverse();
  }

  addOutline(g, AV.out);
  return gridSVG(g, null);
}

/* ==================== 角色 ====================
   spr 是地图上的发型/头部特征：short 平头、long 长一点的、
   spiky 毛躁、cap 戴帽子、bald 秃顶；acc 是身上挂的东西。
   这一列才是"一眼认出谁是谁"的关键，配色是配合它用的 ——
   之前八个人清一色浅衣服，四个人穿白，难怪认不出来。
   ============================================ */
var CHARS = [
  { id:'laoli', name:'牢李', tag:'可靠',
    bg:'#39424b', hairLine:12, sideburn:16, brow:'thick', eyes:'normal',
    mouth:'grin', glasses:'round', stubble:true, spr:'short',
    collar:['...CC...','..CCCC..','..CCCC..'],
    /* 石板灰，不用蓝 —— 蓝的已经有 logic（天蓝）和主任（藏青）了，
       三个人站一块儿本来就分不清，再添一个蓝灰更糊 */
    pal:{ skin:'#eec29a', skin2:'#d9a87f', hair:'#17130f', cloth:'#8b9198',
          cloth2:'#767c83', pants:'#3f4650', shoe:'#2b2b30', frame:'#14110f', stubble:'#c69c78',
          W:AV.white, O:'#17130f', M:'#7d3a33' } },

  { id:'lg7', name:'lg7', tag:'不好相处',
    bg:'#4a3134', faceRX:9,  faceRY:12, hairLine:13, sideburn:18, brow:'thin', eyes:'normal',
    mouth:'smile', glasses:'round', spr:'long',
    collar:['...CC...','..CCCC..','..CCCC..'],
    pal:{ skin:'#eec29a', skin2:'#d9a87f', hair:'#14100e', cloth:'#c05a4e',
          cloth2:'#a84a40', pants:'#3a3535', shoe:'#2b2b30', frame:'#14110f',
          W:AV.white, O:'#17130f', M:'#8a5148' } },

  { id:'shui', name:'水哥', tag:'憨厚老实',
    bg:'#4a423c', faceRX:11, faceRY:10, hairLine:12, sideburn:15, brow:'thick', eyes:'normal',
    mouth:'neutral', spr:'short',
    collar:['..CCCC..','.CCCCCC.','CCCCCCCC'],
    pal:{ skin:'#eec29a', skin2:'#d9a87f', hair:'#17130f', cloth:'#d98a3d',
          cloth2:'#c47a30', pants:'#4a4740', shoe:'#2b2b30', frame:'#14110f',
          W:AV.white, O:'#17130f', M:'#8c4a3f' } },

  { id:'logic', name:'logic', tag:'自认聪明',
    bg:'#33443c', faceRX:9,  faceRY:12, hairLine:14, sideburn:17, brow:'thin', eyes:'normal',
    mouth:'thick', glasses:'square', spr:'spiky',
    collar:['..CCCC..','.CCCCCC.','CCCCCCCC'],
    pal:{ skin:'#f0c69f', skin2:'#dcb088', hair:'#161210', cloth:'#7fa8cc',
          cloth2:'#6b93b8', pants:'#3c3f44', shoe:'#2b2b30', frame:'#14110f',
          W:AV.white, O:'#17130f', M:'#a25a4d' } },

  { id:'duty', name:'值周生', tag:'记你名字',
    bg:'#2c3a44', hairLine:13, sideburn:16, brow:'thin', eyes:'normal',
    mouth:'small', armband:true, spr:'cap', acc:'armband',
    collar:['..CCCC..','.CCCCCC.','CCCCCCCC'],
    pal:{ skin:'#f0c69f', skin2:'#dcb088', hair:'#1b1512', cloth:'#3f7f63',
          cloth2:'#c0392b', cap:'#2f6b52', pants:'#2f3a38', shoe:'#2b2b30', frame:'#14110f',
          W:AV.white, O:'#17130f', M:'#9c6a5c' } },

  { id:'dean', name:'教导主任', tag:'在后门看你',
    bg:'#33302c', hairLine:6, sideburn:20, brow:'thick', eyes:'normal',
    mouth:'smile', glasses:'round', spr:'bald',
    collar:['...CC...','..TTTT..','..TTTT..'],
    pal:{ skin:'#eec29a', skin2:'#d9a87f', hair:'#8a8078', cloth:'#2f3a4a',
          cloth2:'#243044', pants:'#242a34', shoe:'#2b2b30', frame:'#3d3733',
          W:'#e8e4dc', O:'#17130f', M:'#8a5148', T:'#8c4a3f' } },

  { id:'teacher', name:'老师', tag:'捏着半截粉笔',
    bg:'#4a3a44', hairLine:13, sideburn:18, brow:'thin', eyes:'normal',
    mouth:'smile', glasses:'round', spr:'short',
    collar:['..CCCC..','.CWWWWC.','CCCCCCCC'],
    pal:{ skin:'#f0c69f', skin2:'#dcb088', hair:'#2b1f19', cloth:'#a8863f',
          cloth2:'#957635', pants:'#4a4038', shoe:'#2b2b30', frame:'#3d3733',
          W:'#f0ece2', O:'#17130f', M:'#b5544a' } },

  { id:'deskmate', name:'同桌', tag:'一脸无辜',
    bg:'#3b3a46', hairLine:14, sideburn:16, brow:'thin', eyes:'wide',
    mouth:'small', spr:'short',
    collar:['..CCCC..','.CCCCCC.','CCCCCCCC'],
    pal:{ skin:'#f0c69f', skin2:'#dcb088', hair:'#241a14', cloth:'#9b8fc7',
          cloth2:'#8479ad', pants:'#3c4046', shoe:'#2b2b30', frame:'#14110f',
          W:AV.white, O:'#17130f', M:'#9c6a5c' } },

  /* 「他」—— 名册第一行那个名字。配色是灰的：像一张洗淡了的旧照片。
     脸上一根眉毛都没有，眼睛是两条缝，嘴只有一点点 ——
     什么表情都读不出来，比笑或者哭都吓人 */
  { id:'him', name:'他', tag:'照片里那个',
    bg:'#2b2c30', hairLine:15, sideburn:16, brow:'none', eyes:'squint',
    mouth:'small', spr:'short',
    collar:['..CCCC..','.CCCCCC.','CCCCCCCC'],
    pal:{ skin:'#cfc4b8', skin2:'#b3a89c', hair:'#1a1817', cloth:'#b6b1a7',
          cloth2:'#98938a', pants:'#4b4a48', shoe:'#2e2d2c', frame:'#121110',
          W:'#e8e4dd', O:'#15130f', M:'#8d7f74' } }
];

/* ==================== 生成 + 光栅化 ====================
   两个页面都靠这段：SVG 现做，然后 new Image() 光栅化一次当普通图片用。
   img/ 里有真人照片就优先用照片（本地才有，被 .gitignore 排除）。
   ============================================ */
var PORTRAIT = {}, SPRITE = {}, PORTRAIT_IMG = {}, SPRITE_IMG = {}, PHOTO = {};
var DIRS = ['down', 'left', 'right', 'up'];

function svgURI(s){ return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(s); }

CHARS.forEach(function(c){
  PORTRAIT[c.id] = buildPortrait(c);
  SPRITE[c.id] = {};
  DIRS.forEach(function(d){
    /* 左右共用同一张侧面，朝左的翻一遍 —— 省一半活。
       注意左右都必须映射到 side：BODY 里没有 right 这一套 */
    var base = (d === 'left' || d === 'right') ? 'side' : d;
    var flip = (d === 'left');
    SPRITE[c.id][d] = [0,1,2].map(function(f){ return buildSprite(c, base, f, flip); });
  });
});

(function loadArt(){
  if (typeof Image === 'undefined') return;      // 没在浏览器里（比如跑校验脚本）
  var emojiOnly = /[?&]emoji\b/.test(location.search);
  CHARS.forEach(function(c){
    var pim = new Image();
    pim.onload = function(){ PORTRAIT_IMG[c.id] = pim; };
    pim.src = svgURI(PORTRAIT[c.id]);
    DIRS.forEach(function(d){
      SPRITE_IMG[c.id] = SPRITE_IMG[c.id] || {};
      SPRITE_IMG[c.id][d] = [];
      [0,1,2].forEach(function(f){
        var im = new Image();
        im.onload = function(){ SPRITE_IMG[c.id][d][f] = im; };
        im.src = svgURI(SPRITE[c.id][d][f]);
      });
    });
  });
  if (emojiOnly) return;
  /* 真人照片：路径相对文档解析，所以放哪页就找哪页的 img/ */
  var photos = { shui:'img/shuige.jpg', logic:'img/logic.jpg', laoli:'img/laoli.png' };
  Object.keys(photos).forEach(function(k){
    var im = new Image();
    im.onload = function(){ if (im.naturalWidth) PHOTO[k] = im; };
    im.src = photos[k];
  });
})();
