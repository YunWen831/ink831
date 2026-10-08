/* ==================================================================
   画像 —— game/ 和 map/ 两个页面共用

   三档，按优先级：
   1. img/ 里有真人照片  → 用照片（只有本地有，img/ 被 .gitignore 排除，永远推不上去）
   2. 没有照片           → 用手画的 SVG 画像（公开版走这条）
   3. 画像也没加载出来   → 退回 emoji（兜底，不会白屏）
   想强制看 emoji 调试：地址后面加 ?emoji

   注意 img/ 是相对「文档」解析的，不是相对这个文件：
     game/index.html → 找 game/img/
     map/index.html  → 找 map/img/
   所以两个目录各要一份 .gitignore 挡照片，只加一处会漏。

   必须用经典 <script src> 引。写成 type="module" 的话 file:// 下会被 CORS
   拦死，本地双击就打不开了 —— 这个页面是要能直接双击运行的。
   函数签名跟抽出来之前一模一样，两边调用点一个字都不用改。
   ================================================================== */
"use strict";

/* ==================== 立绘 ====================
   像素风格：一张表 16×16，一格一个字符，'.' 是背景。
   为什么换掉原来那套：之前是用椭圆和贝塞尔画的写实脸，可它最终只画到
   15px 半径，细节全糊在一起，远看就是个肉色圆点。像素格反而每一格都数得清，
   而且加角色只要照抄一张表改字符，不用再调一堆 path 坐标。

   画法：先铺背景色，再逐格 fillRect。字符没在 pal 里定义就当透明。

   排版的几条规矩（都是渲染出来看过才定的）：
   - 只有 16 行可用：头发 r0-r2、脸 r3-r12、脖子 r13 附近、肩膀 r13-r15。
   - 眼镜只能占两行（上框 + 眼睛），别再补一行下框。三行叠起来缩到 30px
     就是一条横贯整张脸的黑带，看着像眼罩，不像眼镜。
   - 镜框要画成左右两个分开的方框，左右之间留 2 格当鼻梁。连成一整条也是眼罩。
   - 眉毛和眼睛之间隔一行。挨着写，缩小时两条深色会糊成一根粗杠。
   - 嘴巴别做太小，2px 宽在这个尺度上约等于没有。
   ============================================ */
function pix(rows, pal){
  var out = '';
  for (var y=0; y<rows.length; y++){
    var row = rows[y];
    for (var x=0; x<row.length; x++){
      var c = pal[row[x]];
      if (c) out += '<rect x="'+x+'" y="'+y+'" width="1" height="1" fill="'+c+'"/>';
    }
  }
  return out;
}

function svgo(inner, n){
  n = n || 100;
  var h = n/2;
  /* shape-rendering 必须钉死成 crispEdges，不然缩放时浏览器会插值，
     像素格又糊回去了 —— 那这套就白换了 */
  return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 '+n+' '+n+'" ' +
    'shape-rendering="crispEdges">' +
    '<defs><clipPath id="k"><circle cx="'+h+'" cy="'+h+'" r="'+h+'"/></clipPath></defs>' +
    '<g clip-path="url(#k)">' + inner + '</g></svg>';
}

function avatar(rows, pal, bg){
  var w = rows[0].length;
  return svgo('<rect width="'+w+'" height="'+rows.length+'" fill="'+bg+'"/>' + pix(rows, pal), w);
}

var AVATARS = {

  /* 水哥：平头（顶上那行是平的）、粗眉、小眼睛、白 T */
  shui: avatar([
    '....HHHHHHHH....',
    '..HHHHHHHHHHHH..',
    '..HHHHHHHHHHHH..',
    '..HHSSSSSSSSHH..',
    '..HSBBSSSSBBSH..',
    '..HSSSSSSSSSSH..',
    '..HSSEESSEESSH..',
    '..HSSSSSSSSSSH..',
    '...SSSSSSSSSS...',
    '....SSSMMSSS....',
    '....SSSSSSSS....',
    '.....SSSSSS.....',
    '......SSSS......',
    '....WWWWWWWW....',
    '...WWWWWWWWWW...',
    '...WWWWWWWWWW...'
  ], { H:'#17130f', S:'#eec29a', B:'#17130f', E:'#2b2119', M:'#8c4a3f', W:'#dcd9d4' },
     '#4a423c'),

  /* logic：长脸、黑框方眼镜、白 T、厚嘴唇 */
  logic: avatar([
    '.....HHHHHH.....',
    '...HHHHHHHHHH...',
    '..HHHHHHHHHHHH..',
    '..HHSSSSSSSSHH..',
    '...GGGG..GGGG...',
    '...GSEGSSGESG...',
    '...SSSSSSSSSS...',
    '...SSSSSSSSSS...',
    '...SSSSSSSSSS...',
    '.....MMMMMM.....',
    '.....SSSSSS.....',
    '.....SSSSSS.....',
    '......SSSS......',
    '....WWWWWWWW....',
    '...WWWWWWWWWW...',
    '...WWWWWWWWWW...'
  ], { H:'#161210', S:'#f0c69f', G:'#14110f', E:'#241c16', M:'#a25a4d', W:'#f4f4f2' },
     '#33443c'),

  /* 牢李：圆角眼镜（上框比中间那行窄，就显出圆角）、下巴胡茬、咧嘴笑露牙、
     灰夹克开口露一竖条蓝 T */
  laoli: avatar([
    '.....HHHHHH.....',
    '...HHHHHHHHHH...',
    '..HHHHHHHHHHHH..',
    '..HHSSSSSSSSHH..',
    '...GGGG..GGGG...',
    '...GSEGSSGESG...',
    '..BSSSSSSSSSSB..',
    '..BSSSSSSSSSSB..',
    '..BSSMMMMMMSSB..',
    '...BWWWWWWWWB...',
    '.....SSSSSS.....',
    '.....SSSSSS.....',
    '......SSSS......',
    '....KKKCCKKK....',
    '...KKKKCCKKKK...',
    '...KKKKCCKKKK...'
  ], { H:'#17130f', S:'#eec29a', G:'#14110f', E:'#241c16', B:'#c69c78',
       M:'#7d3a33', W:'#ffffff', K:'#b6bbbf', C:'#7fa8cc' },
     '#39424b'),

  /* lg7：细长脸（整个头比人窄两格）、细圆框眼镜、珊瑚色 polo */
  lg7: avatar([
    '.....HHHHHH.....',
    '....HHHHHHHH....',
    '...HHHHHHHHHH...',
    '...HSSSSSSSSH...',
    '....GGG..GGG....',
    '....GEGSSGEG....',
    '...SSSSSSSSSS...',
    '...SSSSSSSSSS...',
    '...SSSSSSSSSS...',
    '.....SSSSSS.....',
    '.....SSMMSS.....',
    '.....SSSSSS.....',
    '......SSSS......',
    '....PPPPPPPP....',
    '...PPPPPPPPPP...',
    '...PPPPPPPPPP...'
  ], { H:'#14100e', S:'#eec29a', G:'#14110f', E:'#241c16', M:'#8a5148', P:'#d9776b' },
     '#4a3134'),

  /* 值周生：白校服、左胳膊一个红袖章 */
  duty: avatar([
    '....HHHHHHHH....',
    '..HHHHHHHHHHHH..',
    '..HHHHHHHHHHHH..',
    '..HHSSSSSSSSHH..',
    '..HBSSSSSSSSBH..',
    '..HSSSSSSSSSSH..',
    '..HSSEESSEESSH..',
    '..HSSSSSSSSSSH..',
    '...SSSSSSSSSS...',
    '....SSSMMSSS....',
    '....SSSSSSSS....',
    '.....SSSSSS.....',
    '......SSSS......',
    '..RRWWWWWWWW....',
    '..RRWWWWWWWWWW..',
    '..RRWWWWWWWWWW..'
  ], { H:'#1b1512', S:'#f0c69f', B:'#1b1512', E:'#241c16', M:'#9c6a5c',
       W:'#e3e7ea', R:'#c0392b' },
     '#2c3a44'),

  /* 教导主任：秃顶（头顶那两行直接用更亮的肤色，就是"发亮"那个意思）、
     两侧剩一圈灰发、圆框眼镜、深蓝西装配红领带 */
  dean: avatar([
    '.....LLLLLL.....',
    '....LLLLLLLL....',
    '..HGSSSSSSSSGH..',
    '..HGSSSSSSSSGH..',
    '...GGGG..GGGG...',
    '...GSEGSSGESG...',
    '...SSSSSSSSSS...',
    '...SSSSSSSSSS...',
    '...SSSSSSSSSS...',
    '.....SSSSSS.....',
    '.....SSMMSS.....',
    '.....SSSSSS.....',
    '......SSSS......',
    '....NNNWWNNN....',
    '...NNNNTTNNNN...',
    '...NNNNTTNNNN...'
  ], { L:'#f2cfa8', H:'#4b423a', S:'#eec29a', G:'#3d3733', E:'#241c16',
       M:'#8a5148', N:'#2f3a4a', W:'#e8e4dc', T:'#8c4a3f' },
     '#33302c'),

  /* 老师：卷发（顶上那行故意留两个缺口，轮廓就毛了）、圆框眼镜、琥珀开衫，
     右下角那点白是捏着的半截粉笔 */
  teacher: avatar([
    '....H.HHHH.H....',
    '..HHHHHHHHHHHH..',
    '.HHHHHHHHHHHHHH.',
    '.HHHSSSSSSSSHHH.',
    '..HHSSSSSSSSHH..',
    '....GGG..GGG....',
    '...GSEGSSGESG...',
    '...SSSSSSSSSS...',
    '...SSSSSSSSSS...',
    '.....SSSSSS.....',
    '.....SSMMSS.....',
    '.....SSSSSS.....',
    '......SSSS......',
    '....OOOOOOOO....',
    '...OOOWWWWOOO...',
    '...OOOOOOOOOW...'
  ], { H:'#2b1f19', S:'#f0c69f', G:'#3d3733', E:'#241c16', M:'#b5544a',
       O:'#c8a86a', W:'#f0ece2' },
     '#4a3a44'),

  /* 同桌：短发、校服，眼睛占满整格，所以显得一脸无辜 */
  deskmate: avatar([
    '.....HHHHHH.....',
    '...HHHHHHHHHH...',
    '..HHHHHHHHHHHH..',
    '..HHSSSSSSSSHH..',
    '..HHSSSSSSSSHH..',
    '...SSSSSSSSSS...',
    '...SEESSSSEES...',
    '...SSSSSSSSSS...',
    '...SSSSSSSSSS...',
    '....SSSMMSSS....',
    '....SSSSSSSS....',
    '.....SSSSSS.....',
    '......SSSS......',
    '....UUUUUUUU....',
    '...UUUUUUUUUU...',
    '...UUUUUUUUUU...'
  ], { H:'#241a14', S:'#f0c69f', E:'#241c16', M:'#9c6a5c', U:'#dfe3e6' },
     '#3b3a46')
};

/* emoji 兜底表。
   原来这段是去查 CHARS[].emoji —— 可 CHARS 是「游戏角色」，带着 hits/spd/special
   那一套玩法字段，不该跟着画像一起被共用，所以在这儿摊平成一张表。
   加新角色时，这里和 AVATARS 都要加。 */
var EMOJI = {
  shui:'🙂', logic:'🤓', laoli:'😌', lg7:'😠',
  duty:'💪', dean:'🧐', teacher:'👩🏫', deskmate:'😶'
};

/* ==================== 头像加载 ====================
   手画的 SVG 光栅化一次，之后当普通图片用。
   没加载出来就退回 emoji，不会白屏。
   ============================================ */
var IMGS = {}, PHOTO = {};
function svgURI(s){ return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(s); }
function faceOf(id){ return PHOTO[id] || IMGS[id]; }

(function loadArt(){
  var emojiOnly = /[?&]emoji\b/.test(location.search);
  Object.keys(AVATARS).forEach(function(k){
    var im = new Image();
    im.onload = function(){ IMGS[k] = im; };
    im.src = svgURI(AVATARS[k]);
  });
  /* 本地有真人照片就用照片（img/ 被 .gitignore 排除，永远推不上去） */
  var photos = { shui:'img/shuige.jpg', logic:'img/logic.jpg', laoli:'img/laoli.png' };
  if (emojiOnly) return;
  Object.keys(photos).forEach(function(k){
    var im = new Image();
    im.onload = function(){ if (im.naturalWidth) PHOTO[k] = im; };
    im.src = photos[k];
  });
})();

/* 画像统一走这里：有图用图，没图退回 emoji */
function drawFace(id, x, y, r, ang){
  var im = faceOf(id);
  cx.save();
  cx.translate(x,y);
  /* 影子 */
  cx.fillStyle = 'rgba(0,0,0,.35)';
  cx.beginPath(); cx.ellipse(0, r*0.75, r*0.95, r*0.42, 0, 0, 7); cx.fill();
  /* 朝向的小尖角 */
  cx.rotate(ang + Math.PI/2);
  cx.fillStyle = 'rgba(245,245,244,.5)';
  cx.beginPath();
  cx.moveTo(0, -r-9); cx.lineTo(-5.5, -r+1); cx.lineTo(5.5, -r+1);
  cx.closePath(); cx.fill();
  cx.rotate(-(ang + Math.PI/2));
  if (im){
    cx.save();
    cx.beginPath(); cx.arc(0,0,r,0,7); cx.clip();
    /* 关掉插值：像素立绘缩小时必须是硬边。插值一开，格子又被磨圆，白换像素风 */
    var sm = cx.imageSmoothingEnabled;
    cx.imageSmoothingEnabled = false;
    cx.drawImage(im, -r, -r, r*2, r*2);
    cx.imageSmoothingEnabled = sm;
    cx.restore();
    cx.strokeStyle = 'rgba(0,0,0,.5)'; cx.lineWidth = 2;
    cx.beginPath(); cx.arc(0,0,r,0,7); cx.stroke();
  } else {
    cx.fillStyle = '#292524';
    cx.beginPath(); cx.arc(0,0,r,0,7); cx.fill();
    var em = EMOJI[id] || '🙂';
    cx.font = Math.round(r*1.5)+'px system-ui,sans-serif';
    cx.textAlign='center'; cx.textBaseline='middle';
    cx.fillText(em, 0, 1);
    cx.textBaseline='alphabetic';
  }
  cx.restore();
}
