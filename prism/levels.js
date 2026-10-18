/* 棱 PRISM · 关卡数据
 *
 * 坐标系：光点沿 +d 自动前进，d 是世界距离（不是时间）。
 * 横截面：x ∈ [-1.7, 1.7]，y ∈ [-1.05, 1.05]。
 *
 * mask 是 RGB 三通道位掩码：R=1, G=2, B=4。
 *   1 红   2 绿   4 蓝
 *   3 黄   5 品红 6 青   7 白
 *
 * 门的通过规则（game.js 实现）：
 *   身上包含门的全部通道即可通过；穿过后门吸走这些通道。
 *   穿门时若身上恰好只有门要求的颜色，判定“完美”。
 *
 * 这里只放数据与两个纯函数（章节构建 / 无尽生成）。
 */
(function () {
  'use strict';

  var R = 1, G = 2, B = 4;

  var MASKS = {
    0: { name: '净', glyph: 0, color: [0.97, 0.95, 0.90], ink: '#23211c' },
    1: { name: '红', glyph: 1, color: [1.00, 0.35, 0.27], ink: '#b62a1d' },
    2: { name: '绿', glyph: 2, color: [0.23, 0.84, 0.48], ink: '#0f7639' },
    4: { name: '蓝', glyph: 3, color: [0.28, 0.53, 1.00], ink: '#1d4aa8' },
    3: { name: '黄', glyph: 4, color: [1.00, 0.82, 0.28], ink: '#9a6800' },
    5: { name: '品红', glyph: 5, color: [0.94, 0.38, 0.75], ink: '#96258f' },
    6: { name: '青', glyph: 6, color: [0.27, 0.84, 0.88], ink: '#0a6d7c' },
    7: { name: '白', glyph: 7, color: [1.00, 0.98, 0.93], ink: '#23211c' }
  };

  // 章节之间的短句。
  var LINES = {
    veil: '一开始，你什么都没有。',
    primaries: '红是温度，绿是生长，蓝是距离。',
    secondaries: '两种光相遇，世界多出一种颜色。',
    white: '所有颜色都在你身上，门却只要白。',
    core: '把自己交出去，才能过去。'
  };

  function chapter(def, gates, motes) {
    gates.sort(function (a, b) { return a.d - b.d; });
    motes.sort(function (a, b) { return a.d - b.d; });
    var end = 0;
    if (gates.length) end = gates[gates.length - 1].d;
    if (motes.length) end = Math.max(end, motes[motes.length - 1].d);
    return {
      id: def.id,
      index: def.index,
      name: def.name,
      line: def.line,
      hint: def.hint,
      speed: def.speed,
      par: def.par,
      key: def.key,
      tempo: def.tempo,
      length: Math.ceil(end + def.tail),
      gates: gates,
      motes: motes
    };
  }

  function gate(d, mask, x, y, r, driftX, freq, phase) {
    return {
      d: d, mask: mask, x: x || 0, y: y || 0, r: r || 0.85,
      driftX: driftX || 0, freq: freq || 0.8, phase: phase || 0
    };
  }

  function mote(d, ch, x, y) {
    return { d: d, ch: ch, x: x, y: y };
  }

  // 三种基础队形，保证相邻色粒之间在 0.8 秒内可达。
  var FORMATIONS = [
    [[-1.15, 0.42], [0.05, -0.52], [1.12, 0.36]],
    [[1.02, 0.52], [-0.02, 0.02], [-1.05, -0.48]],
    [[-0.82, -0.58], [0.92, -0.20], [-0.16, 0.72]],
    [[0.70, -0.62], [-0.90, 0.22], [0.18, 0.76]],
    [[-1.05, 0.02], [0.28, -0.66], [1.02, 0.55]]
  ];

  // 多色门用的紧凑队形：三颗色粒互相靠近，0.7 秒内可以全部吃到。
  var COMPACT = [
    [[-0.45, 0.35], [0.05, -0.30], [0.50, 0.30]],
    [[0.40, 0.38], [-0.35, -0.28], [0.10, 0.45]],
    [[-0.30, -0.35], [0.35, 0.30], [-0.05, 0.48]],
    [[0.20, -0.38], [-0.42, 0.18], [0.38, 0.38]]
  ];

  var GATE_SPOTS = [
    [-0.42, 0.10], [0.46, -0.18], [-0.18, 0.42], [0.62, 0.24],
    [-0.58, -0.34], [0.12, -0.05], [0.34, 0.48], [-0.66, 0.22],
    [0.52, -0.40], [-0.10, -0.44]
  ];

  // ---------------------------------------------------------------------------
  // 01 白：只出现白门。每次都要集齐三色。
  // ---------------------------------------------------------------------------
  var c1g = [], c1m = [];
  for (var i = 0; i < 16; i++) {
    var d1 = 132 + i * 50;
    var spot = GATE_SPOTS[i % GATE_SPOTS.length];
    c1g.push(gate(d1, 7, spot[0], spot[1], 0.96));
    var f = COMPACT[i % COMPACT.length];
    c1m.push(mote(d1 - 38, R, f[0][0], f[0][1]));
    c1m.push(mote(d1 - 26, G, f[1][0], f[1][1]));
    c1m.push(mote(d1 - 14, B, f[2][0], f[2][1]));
  }

  // ---------------------------------------------------------------------------
  // 02 原色：单色门。开始出现诱饵色粒。
  // ---------------------------------------------------------------------------
  var c2g = [], c2m = [];
  var single = [R, G, B];
  for (var j = 0; j < 22; j++) {
    var d2 = 128 + j * 44;
    var spot2 = GATE_SPOTS[(j + 3) % GATE_SPOTS.length];
    var need = single[j % 3];
    c2g.push(gate(d2, need, spot2[0], spot2[1], 0.86));
    var form = FORMATIONS[(j + 2) % FORMATIONS.length];
    var pick = need === R ? 0 : need === G ? 1 : 2;
    c2m.push(mote(d2 - 30, need, form[pick][0], form[pick][1]));
    // 诱饵：另一种颜色，稍微偏离必经路线。
    var decoyCh = single[(j + 1) % 3];
    if (decoyCh === need) decoyCh = single[(j + 2) % 3];
    if (j % 2 === 0) {
      c2m.push(mote(d2 - 16, decoyCh, -form[pick][0] * 0.55, form[pick][1] * 0.8));
    }
  }

  // ---------------------------------------------------------------------------
  // 03 间色：双色门，必须连续吃两粒。
  // ---------------------------------------------------------------------------
  var c3g = [], c3m = [];
  var pairs = [
    [R, G, 3], [G, B, 6], [R, B, 5]
  ];
  for (var k = 0; k < 22; k++) {
    var d3 = 132 + k * 50;
    var p = pairs[k % 3];
    var spot3 = GATE_SPOTS[(k + 6) % GATE_SPOTS.length];
    c3g.push(gate(d3, p[2], spot3[0], spot3[1], 0.84));
    var f3 = COMPACT[(k + 1) % COMPACT.length];
    var ai = p[0] === R ? 0 : p[0] === G ? 1 : 2;
    var bi = p[1] === R ? 0 : p[1] === G ? 1 : 2;
    c3m.push(mote(d3 - 36, p[0], f3[ai][0], f3[ai][1]));
    c3m.push(mote(d3 - 24, p[1], f3[bi][0], f3[bi][1]));
    if (k % 5 === 2) {
      c3m.push(mote(d3 - 10, single[(k + 2) % 3], -f3[bi][0] * 0.7, f3[bi][1] * 0.7));
    }
  }

  // ---------------------------------------------------------------------------
  // 04 白光：白门回归，混合门，开始横向漂移。
  // ---------------------------------------------------------------------------
  var c4g = [], c4m = [];
  var mix = [3, 6, 5, R, G, B];
  for (var n = 0; n < 22; n++) {
    var d4 = 138 + n * 54;
    var spot4 = GATE_SPOTS[(n + 9) % GATE_SPOTS.length];
    var isWhite = n % 4 === 0;
    var mask4 = isWhite ? 7 : mix[n % mix.length];
    var drift = n >= 8 && n % 3 === 0 ? 0.55 : 0;
    c4g.push(gate(d4, mask4, spot4[0], spot4[1], 0.82, drift, 0.9, n * 0.7));
    var f4 = COMPACT[(n + 4) % COMPACT.length];
    if (isWhite) {
      c4m.push(mote(d4 - 38, R, f4[0][0], f4[0][1]));
      c4m.push(mote(d4 - 26, G, f4[1][0], f4[1][1]));
      c4m.push(mote(d4 - 14, B, f4[2][0], f4[2][1]));
    } else {
      var chs = mask4 === 3 ? [R, G] : mask4 === 6 ? [G, B] : mask4 === 5 ? [R, B] : [mask4];
      var ca = chs[0] === R ? 0 : chs[0] === G ? 1 : 2;
      c4m.push(mote(d4 - 38, chs[0], f4[ca][0], f4[ca][1]));
      if (chs.length > 1) {
        var cb = chs[1] === R ? 0 : chs[1] === G ? 1 : 2;
        c4m.push(mote(d4 - 26, chs[1], f4[cb][0], f4[cb][1]));
      } else if (n % 3 === 1) {
        c4m.push(mote(d4 - 10, single[(n + 2) % 3], -f4[ca][0] * 0.65, f4[ca][1] * 0.7));
      }
    }
  }

  // ---------------------------------------------------------------------------
  // 05 棱心：全部机制，窄门，快速漂移。
  // ---------------------------------------------------------------------------
  var c5g = [], c5m = [];
  var allMasks = [7, R, G, B, 3, 6, 5, 7, 3, 5, 6, R, G, B];
  for (var q = 0; q < 22; q++) {
    var d5 = 142 + q * 56;
    var mask5 = allMasks[(q * 5 + 3) % allMasks.length];
    var spot5 = GATE_SPOTS[(q + 2) % GATE_SPOTS.length];
    var r5 = q % 6 === 4 ? 0.72 : 0.80;
    var drift5 = q >= 6 ? (0.35 + (q % 3) * 0.18) : 0;
    c5g.push(gate(d5, mask5, spot5[0], spot5[1], r5, drift5, 1.05, q * 0.9));
    var f5 = COMPACT[(q + 3) % COMPACT.length];
    if (mask5 === 7) {
      c5m.push(mote(d5 - 40, R, f5[0][0], f5[0][1]));
      c5m.push(mote(d5 - 28, G, f5[1][0], f5[1][1]));
      c5m.push(mote(d5 - 16, B, f5[2][0], f5[2][1]));
    } else {
      var c5chs = mask5 === 3 ? [R, G] : mask5 === 6 ? [G, B] : mask5 === 5 ? [R, B] : [mask5];
      var i0 = c5chs[0] === R ? 0 : c5chs[0] === G ? 1 : 2;
      c5m.push(mote(d5 - 40, c5chs[0], f5[i0][0], f5[i0][1]));
      if (c5chs.length > 1) {
        var i1 = c5chs[1] === R ? 0 : c5chs[1] === G ? 1 : 2;
        c5m.push(mote(d5 - 28, c5chs[1], f5[i1][0], f5[i1][1]));
      }
      if (q % 4 === 3) {
        c5m.push(mote(d5 - 12, single[(q + 1) % 3], -f5[i0][0] * 0.6, -f5[i0][1] * 0.7));
      }
    }
  }

  var chapters = [
    chapter({
      id: 'veil', index: 1, name: '白', line: LINES.veil,
      hint: '收集红、绿、蓝，合成白光，穿过白门。',
      speed: 14, par: 60, key: 50, tempo: 80, tail: 90
    }, c1g, c1m),
    chapter({
      id: 'primaries', index: 2, name: '原色', line: LINES.primaries,
      hint: '门只认自己的颜色。多余的色会留在身上。',
      speed: 15.5, par: 63, key: 53, tempo: 84, tail: 90
    }, c2g, c2m),
    chapter({
      id: 'secondaries', index: 3, name: '间色', line: LINES.secondaries,
      hint: '两种光叠在一起。按吐息，可以丢掉最后吃下的颜色。',
      speed: 16, par: 66, key: 48, tempo: 88, tail: 90
    }, c3g, c3m),
    chapter({
      id: 'white', index: 4, name: '白光', line: LINES.white,
      hint: '白门会吸走全部颜色。观察下一道门，再决定留什么。',
      speed: 17, par: 68, key: 55, tempo: 92, tail: 90
    }, c4g, c4m),
    chapter({
      id: 'core', index: 5, name: '棱心', line: LINES.core,
      hint: '门在移动。不要追它，等它经过你的路线。',
      speed: 19, par: 68, key: 51, tempo: 96, tail: 100
    }, c5g, c5m)
  ];

  // ---------------------------------------------------------------------------
  // 无尽棱廊：固定种子、分段生成。门与色粒都从同一套队形来，保证可达。
  // ---------------------------------------------------------------------------
  function mulberry32(a) {
    return function () {
      a |= 0; a = a + 0x6D2B79F5 | 0;
      var t = Math.imul(a ^ a >>> 15, 1 | a);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }

  function popcount(mask) {
    return (mask & 1 ? 1 : 0) + (mask & 2 ? 1 : 0) + (mask & 4 ? 1 : 0);
  }

  function randomMask(rnd, allowWhite) {
    var pool = allowWhite ? [1, 2, 4, 3, 5, 6, 7] : [1, 2, 4, 3, 5, 6];
    return pool[Math.floor(rnd() * pool.length)];
  }

  function generateEndless(seed, startD, count, speed) {
    var rnd = mulberry32(seed >>> 0);
    var gates = [], motes = [];
    var spacing = 58;
    for (var i = 0; i < count; i++) {
      var d = startD + i * spacing;
      var whiteChance = 0.22;
      var mask = randomMask(rnd, rnd() < whiteChance);
      // 连续白门会太累，避免。
      if (mask === 7 && i > 0 && gates[i - 1].mask === 7) mask = randomMask(rnd, false);
      var spot = GATE_SPOTS[Math.floor(rnd() * GATE_SPOTS.length)];
      var drift = i > 8 ? (rnd() < 0.55 ? 0.35 + rnd() * 0.45 : 0) : 0;
      gates.push(gate(d, mask, spot[0] * (0.7 + rnd() * 0.5), spot[1] * (0.7 + rnd() * 0.5),
        i > 20 && rnd() < 0.3 ? 0.72 : 0.82, drift, 0.9 + rnd() * 0.4, rnd() * 6.28));
      var f = COMPACT[Math.floor(rnd() * COMPACT.length)];
      var chs = mask === 7 ? [R, G, B] : mask === 3 ? [R, G] : mask === 6 ? [G, B] : mask === 5 ? [R, B] : [mask];
      for (var c = 0; c < chs.length; c++) {
        var idx = chs[c] === R ? 0 : chs[c] === G ? 1 : 2;
        motes.push(mote(d - 42 + c * 12, chs[c], f[idx][0], f[idx][1]));
      }
      if (rnd() < 0.28) {
        var decoy = randomMask(rnd, false);
        var decoyCh = [R, G, B][Math.floor(rnd() * 3)];
        if (mask & decoyCh) decoyCh = [R, G, B][(decoyCh === R ? 1 : decoyCh === G ? 2 : 0)];
        motes.push(mote(d - 10, decoyCh, -f[0][0] * 0.5, f[0][1] * 0.72));
      }
    }
    return { gates: gates, motes: motes, speed: speed, length: startD + count * spacing + 90 };
  }

  window.PRISM_MASKS = MASKS;
  window.PRISM_LEVELS = chapters;
  window.PrismLevels = {
    R: R, G: G, B: B,
    mulberry32: mulberry32,
    popcount: popcount,
    generateEndless: generateEndless,
    masks: MASKS
  };
})();
