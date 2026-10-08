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

function svgo(inner){
  return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">' +
    '<defs><clipPath id="k"><circle cx="50" cy="50" r="50"/></clipPath></defs>' +
    '<g clip-path="url(#k)">' + inner + '</g></svg>';
}

var AVATARS = {

  /* 水哥：脸圆、眉毛粗、眼睛小、平头 —— 一脸憨厚 */
  shui: svgo(
    '<rect width="100" height="100" fill="#4a423c"/>' +
    '<path d="M4 100 Q6 74 30 69 L70 69 Q94 74 96 100 Z" fill="#dcd9d4"/>' +
    '<rect x="41" y="56" width="18" height="18" rx="7" fill="#cf9f76"/>' +
    '<ellipse cx="19" cy="47" rx="5" ry="7.5" fill="#e0b085"/>' +
    '<ellipse cx="81" cy="47" rx="5" ry="7.5" fill="#e0b085"/>' +
    '<ellipse cx="50" cy="43" rx="31" ry="30" fill="#eec29a"/>' +
    '<path d="M19 42 Q18 10 50 10 Q82 10 81 42 Q79 29 66 25 Q54 21 38 25 Q21 29 19 42 Z" fill="#17130f"/>' +
    '<rect x="29" y="37.5" width="16" height="4.4" rx="2.2" fill="#17130f"/>' +
    '<rect x="55" y="37.5" width="16" height="4.4" rx="2.2" fill="#17130f"/>' +
    '<ellipse cx="37" cy="49" rx="5.4" ry="3.5" fill="#2b2119"/>' +
    '<ellipse cx="63" cy="49" rx="5.4" ry="3.5" fill="#2b2119"/>' +
    '<circle cx="38.8" cy="47.7" r="1.3" fill="#ffffff" opacity="0.72"/>' +
    '<circle cx="64.8" cy="47.7" r="1.3" fill="#ffffff" opacity="0.72"/>' +
    '<path d="M50 50 Q46.5 58 51 59.5" stroke="#d09b73" stroke-width="2.8" fill="none" stroke-linecap="round"/>' +
    '<ellipse cx="50" cy="64.5" rx="5.5" ry="3.4" fill="#8c4a3f"/>'),

  /* logic：脸长、黑框方眼镜、白 T、厚嘴唇 */
  logic: svgo(
    '<rect width="100" height="100" fill="#33443c"/>' +
    '<path d="M4 100 Q6 74 30 69 L70 69 Q94 74 96 100 Z" fill="#f4f4f2"/>' +
    '<rect x="42" y="56" width="16" height="18" rx="6" fill="#cf9f76"/>' +
    '<ellipse cx="22" cy="48" rx="4.5" ry="7" fill="#e0b085"/>' +
    '<ellipse cx="78" cy="48" rx="4.5" ry="7" fill="#e0b085"/>' +
    '<ellipse cx="50" cy="43" rx="26" ry="31" fill="#f0c69f"/>' +
    '<path d="M24 40 Q23 9 50 9 Q77 9 76 40 Q74 27 61 23 Q50 20 39 23 Q26 27 24 40 Z" fill="#161210"/>' +
    '<rect x="30" y="36" width="15" height="4.5" rx="2.2" fill="#161210"/>' +
    '<rect x="55" y="36" width="15" height="4.5" rx="2.2" fill="#161210"/>' +
    '<ellipse cx="37.5" cy="47" rx="4.4" ry="2.9" fill="#241c16"/>' +
    '<ellipse cx="62.5" cy="47" rx="4.4" ry="2.9" fill="#241c16"/>' +
    '<circle cx="39.1" cy="45.9" r="1.15" fill="#ffffff" opacity="0.72"/>' +
    '<circle cx="64.1" cy="45.9" r="1.15" fill="#ffffff" opacity="0.72"/>' +
    '<path d="M50 49 Q47 57 51 58" stroke="#d09b73" stroke-width="2.6" fill="none" stroke-linecap="round"/>' +
    '<path d="M41 65 Q50 61 59 65 Q50 70.5 41 65 Z" fill="#a25a4d"/>' +
    '<g fill="none" stroke="#14110f" stroke-width="3.2">' +
      '<rect x="28" y="41" width="20" height="14" rx="3.5"/>' +
      '<rect x="52" y="41" width="20" height="14" rx="3.5"/>' +
      '<path d="M48 47 h4"/><path d="M28 46 l-7 -2.5"/><path d="M72 46 l7 -2.5"/>' +
    '</g>'),

  /* 牢李：圆角眼镜、下巴胡茬、咧嘴笑露牙、灰夹克配蓝 T */
  laoli: svgo(
    '<rect width="100" height="100" fill="#39424b"/>' +
    '<path d="M2 100 Q5 73 30 68 L70 68 Q95 73 98 100 Z" fill="#b6bbbf"/>' +
    '<path d="M40 70 L60 70 L57 100 L43 100 Z" fill="#7fa8cc"/>' +
    '<rect x="41" y="55" width="18" height="18" rx="7" fill="#cf9f76"/>' +
    '<ellipse cx="21" cy="47" rx="5" ry="7.5" fill="#e0b085"/>' +
    '<ellipse cx="79" cy="47" rx="5" ry="7.5" fill="#e0b085"/>' +
    '<ellipse cx="50" cy="43" rx="28.5" ry="30" fill="#eec29a"/>' +
    '<path d="M33 56 Q50 74 67 56 Q66 68 50 70 Q34 68 33 56 Z" fill="#c69c78" opacity="0.5"/>' +
    '<path d="M21 40 Q20 9 50 9 Q80 9 79 40 Q77 27 64 23 Q52 20 36 23 Q23 27 21 40 Z" fill="#17130f"/>' +
    '<rect x="29" y="36" width="16" height="4.6" rx="2.3" fill="#17130f"/>' +
    '<rect x="55" y="36" width="16" height="4.6" rx="2.3" fill="#17130f"/>' +
    '<ellipse cx="37" cy="47" rx="4.6" ry="3" fill="#241c16"/>' +
    '<ellipse cx="63" cy="47" rx="4.6" ry="3" fill="#241c16"/>' +
    '<circle cx="38.6" cy="45.8" r="1.2" fill="#ffffff" opacity="0.72"/>' +
    '<circle cx="64.6" cy="45.8" r="1.2" fill="#ffffff" opacity="0.72"/>' +
    '<path d="M50 49 Q47 56 51 57.5" stroke="#d09b73" stroke-width="2.6" fill="none" stroke-linecap="round"/>' +
    '<path d="M38 62 Q50 75 62 62 Z" fill="#7d3a33"/>' +
    '<path d="M41 63.5 h18 l-1.8 3.2 h-14.4 Z" fill="#ffffff"/>' +
    '<g fill="none" stroke="#14110f" stroke-width="3.2">' +
      '<rect x="27" y="41" width="21" height="14.5" rx="5"/>' +
      '<rect x="52" y="41" width="21" height="14.5" rx="5"/>' +
      '<path d="M48 47 h4"/><path d="M27 46 l-6.5 -2.5"/><path d="M73 46 l6.5 -2.5"/>' +
    '</g>'),

  /* lg7：细长脸、细圆框眼镜、珊瑚色 polo、抱着蓝皮《无机化学》 */
  lg7: svgo(
    '<rect width="100" height="100" fill="#4a3134"/>' +
    '<path d="M2 100 Q5 73 30 68 L70 68 Q95 73 98 100 Z" fill="#d9776b"/>' +
    '<path d="M40 69 L50 81 L60 69 L55 67 L50 72 L45 67 Z" fill="#c4675c"/>' +
    '<g transform="rotate(-13 62 90)">' +
      '<rect x="47" y="78" width="30" height="23" rx="2" fill="#2f6bb5"/>' +
      '<rect x="49" y="81" width="26" height="4.5" rx="1" fill="#ffffff" opacity="0.92"/>' +
      '<rect x="49" y="88" width="17" height="2.6" rx="1" fill="#ffffff" opacity="0.6"/>' +
    '</g>' +
    '<rect x="42" y="54" width="16" height="18" rx="6" fill="#cf9f76"/>' +
    '<ellipse cx="24" cy="47" rx="4.5" ry="7" fill="#e0b085"/>' +
    '<ellipse cx="76" cy="47" rx="4.5" ry="7" fill="#e0b085"/>' +
    '<ellipse cx="50" cy="42" rx="25" ry="31" fill="#eec29a"/>' +
    '<path d="M26 40 Q25 8 50 8 Q75 8 74 40 Q73 26 60 22 Q47 19 36 25 Q28 29 26 40 Z" fill="#14100e"/>' +
    '<rect x="31" y="35" width="14" height="4" rx="2" fill="#14100e"/>' +
    '<rect x="55" y="35" width="14" height="4" rx="2" fill="#14100e"/>' +
    '<ellipse cx="38" cy="46" rx="4" ry="2.7" fill="#241c16"/>' +
    '<ellipse cx="62" cy="46" rx="4" ry="2.7" fill="#241c16"/>' +
    '<path d="M50 48 Q47 56 51 57" stroke="#d09b73" stroke-width="2.6" fill="none" stroke-linecap="round"/>' +
    '<path d="M43.5 64 h13" stroke="#8a5148" stroke-width="3.2" stroke-linecap="round"/>' +
    '<g fill="none" stroke="#3d3733" stroke-width="2.2">' +
      '<circle cx="38" cy="46" r="10.5"/><circle cx="62" cy="46" r="10.5"/>' +
      '<path d="M48.5 46 h3"/><path d="M27.5 44 l-5 -2"/><path d="M72.5 44 l5 -2"/>' +
    '</g>'),

  /* 值周生：白校服、红袖章、手里一块记录板 */
  duty: svgo(
    '<rect width="100" height="100" fill="#2c3a44"/>' +
    '<path d="M4 100 Q6 74 30 69 L70 69 Q94 74 96 100 Z" fill="#e3e7ea"/>' +
    '<path d="M42 69 L50 80 L58 69 Z" fill="#c6ccd1"/>' +
    '<g transform="rotate(13 78 84)">' +
      '<rect x="60" y="70" width="35" height="27" rx="3" fill="#d9bb8d"/>' +
      '<rect x="64" y="77" width="27" height="3" fill="#9a8055"/>' +
      '<rect x="64" y="84" width="18" height="3" fill="#9a8055"/>' +
    '</g>' +
    '<rect x="42" y="55" width="16" height="18" rx="6" fill="#cf9f76"/>' +
    '<ellipse cx="22" cy="48" rx="4.5" ry="7" fill="#e0b085"/>' +
    '<ellipse cx="78" cy="48" rx="4.5" ry="7" fill="#e0b085"/>' +
    '<ellipse cx="50" cy="43" rx="26" ry="30" fill="#f0c69f"/>' +
    '<path d="M24 40 Q23 10 50 10 Q77 10 76 40 Q74 27 61 23 Q50 20 39 23 Q26 27 24 40 Z" fill="#1b1512"/>' +
    '<rect x="30" y="36" width="15" height="4.2" rx="2" fill="#1b1512"/>' +
    '<rect x="55" y="36" width="15" height="4.2" rx="2" fill="#1b1512"/>' +
    '<ellipse cx="37.5" cy="47" rx="4.4" ry="2.9" fill="#241c16"/>' +
    '<ellipse cx="62.5" cy="47" rx="4.4" ry="2.9" fill="#241c16"/>' +
    '<circle cx="39.1" cy="45.9" r="1.1" fill="#ffffff" opacity="0.72"/>' +
    '<circle cx="64.1" cy="45.9" r="1.1" fill="#ffffff" opacity="0.72"/>' +
    '<path d="M50 49 Q47 57 51 58" stroke="#d09b73" stroke-width="2.6" fill="none" stroke-linecap="round"/>' +
    '<path d="M43 64 h14" stroke="#9c6a5c" stroke-width="3" stroke-linecap="round"/>' +
    '<g transform="rotate(-9 17 79)">' +
      '<rect x="5" y="72" width="25" height="14" rx="3" fill="#c0392b"/>' +
      '<rect x="8" y="78" width="19" height="2.6" fill="#e8c9a0"/>' +
    '</g>'),

  /* 教导主任：秃顶、圆框眼镜、深蓝西装、手电 */
  dean: svgo(
    '<rect width="100" height="100" fill="#33302c"/>' +
    '<path d="M4 100 Q6 74 30 69 L70 69 Q94 74 96 100 Z" fill="#2f3a4a"/>' +
    '<path d="M42 69 L50 82 L58 69 Z" fill="#e8e4dc"/>' +
    '<path d="M47 71 L50 82 L53 71 Z" fill="#8c4a3f"/>' +
    '<g transform="rotate(-16 80 82)">' +
      '<rect x="72" y="70" width="11" height="26" rx="4" fill="#4a4640"/>' +
      '<rect x="70" y="64" width="15" height="9" rx="3" fill="#d8d2c6"/>' +
    '</g>' +
    '<rect x="42" y="55" width="16" height="18" rx="6" fill="#cf9f76"/>' +
    '<ellipse cx="22" cy="48" rx="4.5" ry="7" fill="#e0b085"/>' +
    '<ellipse cx="78" cy="48" rx="4.5" ry="7" fill="#e0b085"/>' +
    '<ellipse cx="50" cy="43" rx="25" ry="30" fill="#eec29a"/>' +
    '<path d="M26 47 Q26 23 50 22 Q74 23 74 47 Q70 31 50 30 Q30 31 26 47 Z" fill="#f2cfa8"/>' +
    '<path d="M25 52 Q22 40 27 34 Q28 46 30 53 Z" fill="#4b423a"/>' +
    '<path d="M75 52 Q78 40 73 34 Q72 46 70 53 Z" fill="#4b423a"/>' +
    '<rect x="31" y="34" width="14" height="4" rx="2" fill="#3a332c"/>' +
    '<rect x="55" y="34" width="14" height="4" rx="2" fill="#3a332c"/>' +
    '<ellipse cx="38" cy="46" rx="4" ry="2.7" fill="#241c16"/>' +
    '<ellipse cx="62" cy="46" rx="4" ry="2.7" fill="#241c16"/>' +
    '<path d="M50 48 Q47 56 51 57" stroke="#d09b73" stroke-width="2.6" fill="none" stroke-linecap="round"/>' +
    '<path d="M42 64 Q50 60 58 64" stroke="#8a5148" stroke-width="3" fill="none" stroke-linecap="round"/>' +
    '<g fill="none" stroke="#3d3733" stroke-width="2.2">' +
      '<circle cx="38" cy="46" r="10"/><circle cx="62" cy="46" r="10"/>' +
      '<path d="M48 46 h4"/><path d="M28 44 l-5 -2"/><path d="M72 44 l5 -2"/>' +
    '</g>'),

  /* 老师：卷发、琥珀开衫、手里捏着半截粉笔 */
  teacher: svgo(
    '<rect width="100" height="100" fill="#4a3a44"/>' +
    '<path d="M4 100 Q6 74 30 69 L70 69 Q94 74 96 100 Z" fill="#c8a86a"/>' +
    '<path d="M42 69 L50 79 L58 69 Z" fill="#f0ece2"/>' +
    '<g transform="rotate(22 82 80)">' +
      '<rect x="77" y="72" width="9" height="19" rx="4.5" fill="#f2efe6"/>' +
    '</g>' +
    '<rect x="42" y="55" width="16" height="18" rx="6" fill="#cf9f76"/>' +
    '<ellipse cx="22" cy="48" rx="4.5" ry="7" fill="#e0b085"/>' +
    '<ellipse cx="78" cy="48" rx="4.5" ry="7" fill="#e0b085"/>' +
    '<ellipse cx="50" cy="43" rx="25" ry="30" fill="#f0c69f"/>' +
    '<g fill="#2b1f19">' +
      '<circle cx="50" cy="15" r="12"/><circle cx="33" cy="20" r="11"/><circle cx="67" cy="20" r="11"/>' +
      '<circle cx="23" cy="33" r="10"/><circle cx="77" cy="33" r="10"/>' +
      '<circle cx="21" cy="48" r="9"/><circle cx="79" cy="48" r="9"/>' +
    '</g>' +
    '<path d="M29 38 Q31 25 50 23 Q69 25 71 38 Q63 31 50 31 Q37 31 29 38 Z" fill="#2b1f19"/>' +
    '<rect x="31" y="35" width="13" height="3.7" rx="1.8" fill="#2b1f19"/>' +
    '<rect x="56" y="35" width="13" height="3.7" rx="1.8" fill="#2b1f19"/>' +
    '<ellipse cx="38" cy="46" rx="4.2" ry="2.8" fill="#241c16"/>' +
    '<ellipse cx="62" cy="46" rx="4.2" ry="2.8" fill="#241c16"/>' +
    '<circle cx="39.6" cy="45" r="1.1" fill="#ffffff" opacity="0.72"/>' +
    '<circle cx="63.6" cy="45" r="1.1" fill="#ffffff" opacity="0.72"/>' +
    '<path d="M50 48 Q47 56 51 57" stroke="#d09b73" stroke-width="2.6" fill="none" stroke-linecap="round"/>' +
    '<path d="M44 63 Q50 67 56 63" stroke="#b5544a" stroke-width="3" fill="none" stroke-linecap="round"/>' +
    '<g fill="none" stroke="#3d3733" stroke-width="2">' +
      '<circle cx="38" cy="46" r="9.5"/><circle cx="62" cy="46" r="9.5"/>' +
      '<path d="M47.5 46 h5"/><path d="M28.5 44 l-5 -2"/><path d="M71.5 44 l5 -2"/>' +
    '</g>'),

  /* 同桌：坐在你旁边那位，短发、校服、一脸无辜 */
  deskmate: svgo(
    '<rect width="100" height="100" fill="#3b3a46"/>' +
    '<path d="M4 100 Q6 74 30 69 L70 69 Q94 74 96 100 Z" fill="#dfe3e6"/>' +
    '<path d="M42 69 L50 80 L58 69 Z" fill="#b9c0c5"/>' +
    '<rect x="42" y="55" width="16" height="18" rx="6" fill="#cf9f76"/>' +
    '<ellipse cx="22" cy="48" rx="4.5" ry="7" fill="#e0b085"/>' +
    '<ellipse cx="78" cy="48" rx="4.5" ry="7" fill="#e0b085"/>' +
    '<ellipse cx="50" cy="43" rx="26" ry="30" fill="#f0c69f"/>' +
    '<path d="M24 42 Q23 12 50 12 Q77 12 76 42 Q73 28 60 24 Q50 21 40 24 Q27 28 24 42 Z" fill="#241a14"/>' +
    '<rect x="30" y="36" width="15" height="4.2" rx="2" fill="#241a14"/>' +
    '<rect x="55" y="36" width="15" height="4.2" rx="2" fill="#241a14"/>' +
    '<ellipse cx="37.5" cy="47" rx="4.2" ry="2.8" fill="#241c16"/>' +
    '<ellipse cx="62.5" cy="47" rx="4.2" ry="2.8" fill="#241c16"/>' +
    '<circle cx="39" cy="46" r="1.1" fill="#ffffff" opacity="0.72"/>' +
    '<circle cx="64" cy="46" r="1.1" fill="#ffffff" opacity="0.72"/>' +
    '<path d="M50 49 Q47 57 51 58" stroke="#d09b73" stroke-width="2.6" fill="none" stroke-linecap="round"/>' +
    '<path d="M44 64 Q50 67.5 56 64" stroke="#9c6a5c" stroke-width="2.8" fill="none" stroke-linecap="round"/>')
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
    cx.drawImage(im, -r, -r, r*2, r*2);
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
