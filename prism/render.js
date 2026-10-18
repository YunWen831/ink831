/* 棱 PRISM · 手写 WebGL 渲染
 *
 * 管线：
 *   场景 FBO（程序化玻璃长廊 + 加法光晕 + 实体精灵）
 *   → 亮部提取 → 半分辨率横向/纵向模糊（两轮）
 *   → 合成（bloom、径向色散、纸纹、暗角）
 *
 * 没有 Three.js，没有纹理图片。唯一的纹理由 2D Canvas 现场画出：
 * 门心那枚白底徽章（○ ▲ ■ ◆ 的组合符号）。
 */
(function () {
  'use strict';

  var VERT_FULL = [
    'attribute vec2 aPos;',
    'void main() { gl_Position = vec4(aPos, 0.0, 1.0); }'
  ].join('\n');

  var FRAG_BG = [
    'precision highp float;',
    'uniform vec2 uRes;',
    'uniform float uTravel, uSpeed, uTime, uCamX, uCamY, uImpact, uMotion;',
    'uniform vec3 uOrb, uTint;',
    'float hash21(vec2 p) {',
    '  p = fract(p * vec2(123.34, 456.21));',
    '  p += dot(p, p + 45.32);',
    '  return fract(p.x * p.y);',
    '}',
    'float noise(vec2 p) {',
    '  vec2 i = floor(p), f = fract(p);',
    '  f = f * f * (3.0 - 2.0 * f);',
    '  float a = hash21(i), b = hash21(i + vec2(1.0, 0.0));',
    '  float c = hash21(i + vec2(0.0, 1.0)), d = hash21(i + vec2(1.0, 1.0));',
    '  return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);',
    '}',
    'void main() {',
    '  vec2 uv = (gl_FragCoord.xy * 2.0 - uRes) / uRes.y;',
    '  float tanH = 0.57735;',
    '  vec3 rd = normalize(vec3(uv.x * tanH, uv.y * tanH, 1.0));',
    '  vec3 ro = vec3(uCamX, uCamY, 0.0);',
    '  float hx = 2.65, hy = 1.78;',
    '  float t = 1e9;',
    '  float tx = (rd.x > 0.0 ? (hx - ro.x) : (-hx - ro.x)) / rd.x;',
    '  if (tx > 0.0 && abs(ro.y + rd.y * tx) <= hy) t = min(t, tx);',
    '  float ty = (rd.y > 0.0 ? (hy - ro.y) : (-hy - ro.y)) / rd.y;',
    '  if (ty > 0.0 && abs(ro.x + rd.x * ty) <= hx) t = min(t, ty);',
    '  bool lost = t > 1e8;',
    '  if (lost) t = 70.0;',
    '  vec3 p = ro + rd * t;',
    '  float z = p.z + uTravel;',
    '  float dX = abs(abs(p.x) - hx);',
    '  float dY = abs(abs(p.y) - hy);',
    '  float wall = dX < dY ? 0.0 : 1.0;',
    '  vec3 paperA = vec3(0.985, 0.972, 0.940);',
    '  vec3 paperB = vec3(0.925, 0.908, 0.866);',
    '  vec3 col = mix(paperB, paperA, wall);',
    '  float vert = clamp((p.y + hy) / (2.0 * hy), 0.0, 1.0);',
    '  col *= 0.90 + 0.12 * vert;',
    '  float panel = noise(vec2((wall < 0.5 ? p.y : p.x) * 2.4 + 4.0, z * 0.35));',
    '  col *= 0.975 + panel * 0.05;',
    '  float rib = abs(fract(z / 5.5 + 0.5) - 0.5);',
    '  float ribLine = 1.0 - smoothstep(0.0, 0.020, rib);',
    '  float ribGlow = 1.0 - smoothstep(0.0, 0.10, rib);',
    '  vec3 ribTint = 0.5 + 0.5 * cos(6.28318 * (vec3(0.0, 0.33, 0.67) + floor(z / 5.5) * 0.13));',
    '  col = mix(col, ribTint, ribLine * 0.16 + ribGlow * 0.045);',
    '  col = mix(col, vec3(0.70, 0.68, 0.63), ribLine * 0.12);',
    '  float hc = wall < 0.5 ? p.y : p.x;',
    '  float hline = 1.0 - smoothstep(0.0, 0.014, abs(fract(hc * 1.6 + 0.25) - 0.5));',
    '  col = mix(col, vec3(0.72, 0.70, 0.65), hline * 0.24);',
    '  float cell = floor(z / 11.0);',
    '  float tintMix = 0.5 + 0.5 * sin(cell * 1.7);',
    '  vec3 panelTint = mix(vec3(0.99, 0.95, 0.88), vec3(0.89, 0.95, 0.99), tintMix);',
    '  col = mix(col, panelTint, 0.14);',
    '  float band = pow(0.5 + 0.5 * sin(z * 0.34 - uTime * 2.1), 22.0);',
    '  vec3 spectral = 0.5 + 0.5 * cos(6.28318 * (vec3(0.0, 0.33, 0.67) + z * 0.025 + uTime * 0.03));',
    '  col += spectral * band * 0.18 * (1.0 - smoothstep(0.0, 8.0, t));',
    '  float spill = 1.0 - smoothstep(0.0, 0.32, abs(p.y - 0.82));',
    '  col += spectral * spill * 0.045;',
    '  float sparkle = pow(noise(vec2((wall < 0.5 ? p.y : p.x) * 4.2, z * 0.85) + uTime * 0.25), 11.0);',
    '  col += spectral * sparkle * 0.10;',
    '  float corner = wall < 0.5 ? smoothstep(hy - 0.42, hy, abs(p.y)) : smoothstep(hx - 0.42, hx, abs(p.x));',
    '  col += vec3(0.055, 0.052, 0.046) * corner;',
    '  col = mix(col, uOrb, 0.090 * exp(-length(uv) * 1.8));',
    '  float vg = exp(-length(uv) * 2.9);',
    '  col = mix(col, vec3(1.0, 0.992, 0.972), vg * 0.38);',
    '  float halo = pow(0.5 + 0.5 * sin(length(uv) * 18.0 - uTime * 1.6), 10.0) * exp(-length(uv) * 2.0);',
    '  col += spectral * halo * 0.035;',
    '  float fog = exp(-t * 0.018);',
    '  col = mix(vec3(0.978, 0.966, 0.944), col, fog);',
    '  float speedLine = smoothstep(0.88, 1.0, sin(z * 0.9 - uTime * 8.0)) * 0.016 * uSpeed;',
    '  col += vec3(speedLine);',
    '  col += (hash21(gl_FragCoord.xy + uTime * 61.0) - 0.5) * 0.014;',
    '  col *= 1.0 - 0.035 * dot(uv, uv);',
    '  col += vec3(0.05, 0.012, 0.0) * uImpact * exp(-length(uv) * 1.6);',
    '  gl_FragColor = vec4(col, 0.0);',
    '}'
  ].join('\n');

  var VERT_SPRITE = [
    'attribute vec2 aCorner;',
    'attribute vec3 aCenter;',
    'attribute float aSize;',
    'attribute vec3 aColor;',
    'attribute float aAlpha;',
    'attribute float aKind;',
    'attribute float aPhase;',
    'attribute float aGlyph;',
    'uniform vec2 uRes;',
    'uniform float uTravel, uCamX, uCamY, uFocal, uCamDist, uPlayerOffset;',
    'varying vec2 vUv;',
    'varying vec3 vColor;',
    'varying float vAlpha, vKind, vPhase, vGlyph;',
    'void main() {',
    '  float depth = aCenter.z - uTravel + uCamDist;',
    '  vec2 pos;',
    '  if (depth < 0.22) { pos = vec2(-9999.0); vAlpha = 0.0; }',
    '  else {',
    '    float sizePx = aSize * uFocal / depth;',
    '    if (aKind > 2.5 && aKind < 3.5) sizePx = max(sizePx, 24.0);',
    '    vec2 center = vec2(uRes.x * 0.5 + (aCenter.x - uCamX) * uFocal / depth,',
    '                       uRes.y * 0.5 - (aCenter.y - uCamY) * uFocal / depth);',
    '    pos = center + (aCorner - 0.5) * sizePx;',
    '    if (aKind > 4.5) pos.y += uPlayerOffset;',
    '    vAlpha = aAlpha * (1.0 - smoothstep(78.0, 150.0, depth));',
    '  }',
    '  vec2 clip = pos / uRes * 2.0 - 1.0;',
    '  gl_Position = vec4(clip.x, -clip.y, 0.0, 1.0);',
    '  vUv = aCorner;',
    '  vColor = aColor;',
    '  vKind = aKind;',
    '  vPhase = aPhase;',
    '  vGlyph = aGlyph;',
    '}'
  ].join('\n');

  var FRAG_SPRITE = [
    'precision mediump float;',
    'varying vec2 vUv;',
    'varying vec3 vColor;',
    'varying float vAlpha, vKind, vPhase, vGlyph;',
    'uniform sampler2D uAtlas;',
    'uniform float uTime;',
    'void main() {',
    '  vec2 p = vUv * 2.0 - 1.0;',
    '  float r = length(p);',
    '  float a = 0.0;',
    '  vec3 col = vColor;',
    '  if (vKind < 0.5 || (vKind > 5.5 && vKind < 6.5)) {',
    '    a = 1.0 - smoothstep(0.0, 1.0, r); a = a * a * 0.55;',
    '  } else if (vKind < 1.5) {',
    '    float core = 1.0 - smoothstep(0.08, 0.62, r);',
    '    a = 1.0 - smoothstep(0.32, 1.0, r);',
    '    col = mix(vColor, vec3(1.0), core * 0.82);',
    '    float shape = 0.0;',
    '    if (vGlyph > 0.5 && vGlyph < 1.5) {',
    '      float tri = max(abs(p.x) * 0.9 + p.y, -p.y - 0.55);',
    '      shape = 1.0 - smoothstep(0.33, 0.40, tri);',
    '    } else if (vGlyph > 1.5 && vGlyph < 2.5) {',
    '      shape = 1.0 - smoothstep(0.28, 0.34, max(abs(p.x), abs(p.y)));',
    '    } else if (vGlyph > 2.5) {',
    '      shape = 1.0 - smoothstep(0.40, 0.47, abs(p.x) + abs(p.y));',
    '    }',
    '    col = mix(col, vec3(0.10, 0.095, 0.085), shape * 0.78);',
    '    a = max(a, shape * 0.96);',
    '  } else if (vKind < 2.5) {',
    '    float ring = 1.0 - smoothstep(0.0, 0.120, abs(r - 0.78));',
    '    float glow = 1.0 - smoothstep(0.0, 0.24, abs(r - 0.78));',
    '    float aR = 1.0 - smoothstep(0.0, 0.120, abs(r + 0.010 - 0.78));',
    '    float aG = 1.0 - smoothstep(0.0, 0.120, abs(r - 0.78));',
    '    float aB = 1.0 - smoothstep(0.0, 0.120, abs(r - 0.010 - 0.78));',
    '    vec3 body = vec3(vColor.r * aR, vColor.g * aG, vColor.b * aB);',
    '    if (vGlyph > 6.5) {',
    '      col = vec3(0.105, 0.098, 0.088);',
    '      a = ring * 0.96 + glow * 0.10;',
    '      float inner = 1.0 - smoothstep(0.0, 0.030, abs(r - 0.705));',
    '      float outer = 1.0 - smoothstep(0.0, 0.030, abs(r - 0.855));',
    '      col = mix(col, vec3(0.99), inner * 0.85 + outer * 0.45);',
    '    } else {',
    '      a = max(max(aR, aG), aB) + glow * 0.16;',
    '      col = min(vec3(1.0), mix(vColor, vec3(0.12), 0.24) * 0.95 + body * 0.25);',
    '      float edgeIn = 1.0 - smoothstep(0.0, 0.022, abs(r - 0.70));',
    '      float edgeOut = 1.0 - smoothstep(0.0, 0.022, abs(r - 0.86));',
    '      col = mix(col, vec3(0.10), max(edgeIn, edgeOut) * 0.72);',
    '    }',
    '    col = mix(col, vec3(1.0), smoothstep(0.88, 1.0, r) * 0.35);',
    '  } else if (vKind < 3.5) {',
    '    vec2 q = abs(p) - vec2(0.82);',
    '    float box = length(max(q, 0.0)) + min(max(q.x, q.y), 0.0);',
    '    float base = 1.0 - smoothstep(-0.02, 0.02, box);',
    '    float border = 1.0 - smoothstep(0.0, 0.035, abs(box + 0.055));',
    '    vec2 guv = vec2((vGlyph + clamp(vUv.x, 0.04, 0.96)) / 8.0, vUv.y);',
    '    float glyph = texture2D(uAtlas, guv).a;',
    '    vec3 glyphCol = mix(vec3(0.985, 0.972, 0.944), vColor, 0.32);',
    '    col = mix(vec3(0.125, 0.118, 0.106), glyphCol, glyph);',
    '    col = mix(col, vec3(0.985, 0.972, 0.944), border * 0.65);',
    '    a = max(base, border);',
    '  } else if (vKind < 4.5) {',
    '    float ca = cos(vPhase), sa = sin(vPhase);',
    '    vec2 q = vec2(p.x * ca - p.y * sa, p.x * sa + p.y * ca);',
    '    float shard = 1.0 - smoothstep(0.15, 0.95, length(vec2(q.x * 1.9, q.y * 0.38)));',
    '    a = shard * 0.9;',
    '    col = mix(vColor, vec3(1.0), 0.28);',
    '  } else {',
    '    float core = 1.0 - smoothstep(0.0, 0.82, r);',
    '    a = core;',
    '    col = mix(vColor, vec3(1.0), core * 0.92);',
    '  }',
    '  if (a < 0.004) discard;',
    '  gl_FragColor = vec4(col * a, a) * vAlpha;',
    '}'
  ].join('\n');

  var FRAG_BRIGHT = [
    'precision mediump float;',
    'uniform sampler2D uTex;',
    'uniform vec2 uTexel;',
    'void main() {',
    '  vec2 uv = gl_FragCoord.xy * uTexel;',
    '  vec4 c = texture2D(uTex, uv);',
    '  float l = max(c.r, max(c.g, c.b));',
    '  float k = smoothstep(0.22, 0.85, c.a) * smoothstep(0.45, 0.95, l);',
    '  gl_FragColor = vec4(c.rgb * k, 1.0);',
    '}'
  ].join('\n');

  var FRAG_BLUR = [
    'precision mediump float;',
    'uniform sampler2D uTex;',
    'uniform vec2 uTexel;',
    'uniform vec2 uDir;',
    'void main() {',
    '  vec2 uv = gl_FragCoord.xy * uTexel;',
    '  vec2 d = uDir * uTexel;',
    '  vec3 c = texture2D(uTex, uv).rgb * 0.227;',
    '  c += texture2D(uTex, uv + d * 1.384).rgb * 0.316;',
    '  c += texture2D(uTex, uv - d * 1.384).rgb * 0.316;',
    '  c += texture2D(uTex, uv + d * 3.230).rgb * 0.070;',
    '  c += texture2D(uTex, uv - d * 3.230).rgb * 0.070;',
    '  gl_FragColor = vec4(c, 1.0);',
    '}'
  ].join('\n');

  var FRAG_COMP = [
    'precision mediump float;',
    'uniform sampler2D uScene, uBloom;',
    'uniform vec2 uRes;',
    'uniform float uTime, uImpact, uMotion, uFlash;',
    'uniform vec3 uTint;',
    'float hash21(vec2 p) {',
    '  p = fract(p * vec2(123.34, 456.21));',
    '  p += dot(p, p + 45.32);',
    '  return fract(p.x * p.y);',
    '}',
    'void main() {',
    '  vec2 uv = gl_FragCoord.xy / uRes;',
    '  vec2 d = uv - 0.5;',
    '  float ca = (0.0007 + uImpact * 0.0022) * dot(d, d) * 4.0;',
    '  vec3 c;',
    '  c.r = texture2D(uScene, uv + d * ca).r;',
    '  c.g = texture2D(uScene, uv).g;',
    '  c.b = texture2D(uScene, uv - d * ca).b;',
    '  vec3 b = texture2D(uBloom, uv).rgb;',
    '  c += b * 0.58;',
    '  c = c / (1.0 + max(c - 1.0, 0.0) * 0.7);',
    '  c = clamp(c, 0.0, 1.0);',
    '  float l = dot(c, vec3(0.299, 0.587, 0.114));',
    '  c = mix(vec3(l), c, 1.06);',
    '  c = mix(c, c * vec3(1.015, 0.995, 0.96), 0.35);',
    '  c += uTint * 0.012;',
    '  float g = hash21(gl_FragCoord.xy + uTime * 61.0);',
    '  c += (g - 0.5) * 0.018 * uMotion;',
    '  float v = 1.0 - smoothstep(0.18, 0.98, length(d));',
    '  c *= mix(0.94, 1.0, v);',
    '  c += vec3(uFlash) * 0.20;',
    '  gl_FragColor = vec4(c, 1.0);',
    '}'
  ].join('\n');

  function compile(gl, type, src, label) {
    var sh = gl.createShader(type);
    gl.shaderSource(sh, src);
    gl.compileShader(sh);
    if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
      var log = gl.getShaderInfoLog(sh);
      gl.deleteShader(sh);
      throw new Error('shader ' + label + ': ' + log);
    }
    return sh;
  }

  function program(gl, vs, fs, label) {
    var p = gl.createProgram();
    gl.attachShader(p, compile(gl, gl.VERTEX_SHADER, vs, label + '.vs'));
    gl.attachShader(p, compile(gl, gl.FRAGMENT_SHADER, fs, label + '.fs'));
    gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) {
      var log = gl.getProgramInfoLog(p);
      gl.deleteProgram(p);
      throw new Error('link ' + label + ': ' + log);
    }
    return p;
  }

  function uniforms(gl, p) {
    var u = {};
    var n = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS);
    for (var i = 0; i < n; i++) {
      var info = gl.getActiveUniform(p, i);
      if (info) u[info.name] = gl.getUniformLocation(p, info.name);
    }
    return u;
  }

  function makeAtlas() {
    var cell = 64, count = 8;
    var c = document.createElement('canvas');
    c.width = cell * count;
    c.height = cell;
    var x = c.getContext('2d');
    x.fillStyle = '#000';
    x.strokeStyle = '#000';
    x.lineWidth = 7;
    x.lineJoin = 'round';
    x.lineCap = 'round';
    function tri(cx, cy, s) {
      x.beginPath();
      x.moveTo(cx, cy - s);
      x.lineTo(cx + s * 0.94, cy + s * 0.78);
      x.lineTo(cx - s * 0.94, cy + s * 0.78);
      x.closePath();
      x.fill();
    }
    function sq(cx, cy, s) { x.fillRect(cx - s, cy - s, s * 2, s * 2); }
    function dia(cx, cy, s) {
      x.beginPath();
      x.moveTo(cx, cy - s);
      x.lineTo(cx + s, cy);
      x.lineTo(cx, cy + s);
      x.lineTo(cx - s, cy);
      x.closePath();
      x.fill();
    }
    for (var i = 0; i < count; i++) {
      var ox = i * cell, cy = 32;
      x.save();
      x.translate(ox, 0);
      if (i === 0) {
        x.beginPath();
        x.arc(32, 32, 18, 0, Math.PI * 2);
        x.lineWidth = 6;
        x.stroke();
      } else if (i === 1) tri(32, 32, 21);
      else if (i === 2) sq(32, 32, 18);
      else if (i === 3) dia(32, 32, 21);
      else if (i === 4) { tri(21, 32, 15); sq(45, 32, 12); }
      else if (i === 5) { tri(21, 32, 15); dia(46, 32, 13); }
      else if (i === 6) { sq(21, 32, 13); dia(46, 32, 13); }
      else { tri(16, 33, 12); sq(32, 33, 10); dia(48, 33, 12); }
      x.restore();
    }
    return c;
  }

  function PrismRender(canvas) {
    this.canvas = canvas;
    this.gl = null;
    this.ok = false;
    this.error = '';
    this.quality = 'auto';
    this.dpr = 1;
    this.cssW = 1;
    this.cssH = 1;
    this.scale = 0.8;
    this.sceneW = 1;
    this.sceneH = 1;
    this.bloomW = 1;
    this.bloomH = 1;
    this.tanHalf = Math.tan(30 * Math.PI / 180);
    this.camDist = 4.7;
    this.targets = null;
    this.p = {};
    this.u = {};
    this.quad = null;
    this.spriteBuf = null;
    this.atlas = null;
    this.sprites = [];
    this.solid = [];
    this.add = [];
    this.verts = {
      add: new Float32Array(520 * 6 * 13),
      solid: new Float32Array(520 * 6 * 13)
    };
    this.counts = { add: 0, solid: 0 };
    this.info = { version: '', renderer: '', maxTexture: 0 };
  }

  PrismRender.prototype.init = function () {
    var attrs = { alpha: false, antialias: false, depth: false, stencil: false, powerPreference: 'high-performance', preserveDrawingBuffer: /[?&](probe|demo)=/.test(location.search) };
    var gl = null;
    try { gl = this.canvas.getContext('webgl', attrs); } catch (e) {}
    if (!gl) {
      try { gl = this.canvas.getContext('experimental-webgl', attrs); } catch (e2) {}
    }
    if (!gl) {
      this.error = '这个浏览器没有可用的 WebGL。';
      return false;
    }
    this.gl = gl;
    try {
      this.p.bg = program(gl, VERT_FULL, FRAG_BG, 'bg');
      this.p.sprite = program(gl, VERT_SPRITE, FRAG_SPRITE, 'sprite');
      this.p.bright = program(gl, VERT_FULL, FRAG_BRIGHT, 'bright');
      this.p.blur = program(gl, VERT_FULL, FRAG_BLUR, 'blur');
      this.p.comp = program(gl, VERT_FULL, FRAG_COMP, 'composite');
      this.u.bg = uniforms(gl, this.p.bg);
      this.u.sprite = uniforms(gl, this.p.sprite);
      this.u.bright = uniforms(gl, this.p.bright);
      this.u.blur = uniforms(gl, this.p.blur);
      this.u.comp = uniforms(gl, this.p.comp);
    } catch (e) {
      this.error = e && e.message ? e.message : String(e);
      return false;
    }

    var dbg = gl.getExtension('WEBGL_debug_renderer_info');
    this.info.version = gl.getParameter(gl.VERSION) || '';
    this.info.renderer = dbg ? gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL) : '';
    this.info.maxTexture = gl.getParameter(gl.MAX_TEXTURE_SIZE) || 0;

    this.quad = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this.quad);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);

    this.spriteBuf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this.spriteBuf);
    gl.bufferData(gl.ARRAY_BUFFER, this.verts.add.byteLength, gl.DYNAMIC_DRAW);

    this.atlas = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, this.atlas);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, makeAtlas());
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);

    var self = this;
    this.canvas.addEventListener('webglcontextlost', function (ev) {
      ev.preventDefault();
      self.ok = false;
      self.error = '渲染上下文中断。';
    }, false);
    this.canvas.addEventListener('webglcontextrestored', function () {
      self.ok = false;
      self.error = '渲染上下文已恢复，请重新载入。';
    }, false);

    this.ok = true;
    this.resize(this.cssW, this.cssH, this.dpr);
    return true;
  };

  PrismRender.prototype.setQuality = function (q) {
    this.quality = q === 'high' || q === 'low' ? q : 'auto';
    if (this.quality === 'high') this.scale = 1.0;
    else if (this.quality === 'low') this.scale = 0.62;
    else this.scale = 0.80;
    if (this.ok) this.resize(this.cssW, this.cssH, this.dpr);
  };

  PrismRender.prototype.setRenderScale = function (s) {
    s = Math.max(0.52, Math.min(1.0, s));
    if (Math.abs(s - this.scale) < 0.02) return;
    this.scale = s;
    if (this.ok) this.resize(this.cssW, this.cssH, this.dpr);
  };

  PrismRender.prototype.resize = function (cssW, cssH, dpr) {
    this.cssW = Math.max(1, cssW);
    this.cssH = Math.max(1, cssH);
    this.dpr = Math.max(1, Math.min(2, dpr || 1));
    var gl = this.gl;
    if (!gl) return;
    var dprCap = this.quality === 'low' ? 1.0 : this.quality === 'high' ? 1.75 : 1.5;
    var ratio = Math.min(this.dpr, dprCap);
    var maxPixels = 2300000;
    var w = Math.max(2, Math.floor(this.cssW * ratio));
    var h = Math.max(2, Math.floor(this.cssH * ratio));
    var px = w * h;
    if (px > maxPixels) {
      var k = Math.sqrt(maxPixels / px);
      w = Math.max(2, Math.floor(w * k));
      h = Math.max(2, Math.floor(h * k));
    }
    this.canvas.width = w;
    this.canvas.height = h;
    this.canvas.style.width = this.cssW + 'px';
    this.canvas.style.height = this.cssH + 'px';

    this.sceneW = Math.max(2, Math.floor(w * this.scale));
    this.sceneH = Math.max(2, Math.floor(h * this.scale));
    this.bloomW = Math.max(2, Math.floor(this.sceneW / 2));
    this.bloomH = Math.max(2, Math.floor(this.sceneH / 2));

    if (this.targets) this.disposeTargets();
    this.targets = {
      scene: this.makeTarget(this.sceneW, this.sceneH),
      bloomA: this.makeTarget(this.bloomW, this.bloomH),
      bloomB: this.makeTarget(this.bloomW, this.bloomH)
    };
  };

  PrismRender.prototype.makeTarget = function (w, h) {
    var gl = this.gl;
    var tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    var fb = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
    var ok = gl.checkFramebufferStatus(gl.FRAMEBUFFER) === gl.FRAMEBUFFER_COMPLETE;
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    return { tex: tex, fb: fb, w: w, h: h, ok: ok };
  };

  PrismRender.prototype.disposeTargets = function () {
    var gl = this.gl, t = this.targets;
    if (!gl || !t) return;
    ['scene', 'bloomA', 'bloomB'].forEach(function (k) {
      if (t[k]) {
        gl.deleteTexture(t[k].tex);
        gl.deleteFramebuffer(t[k].fb);
      }
    });
    this.targets = null;
  };

  PrismRender.prototype.bindFull = function (prog) {
    var gl = this.gl;
    gl.useProgram(prog);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.quad);
    var loc = gl.getAttribLocation(prog, 'aPos');
    if (loc >= 0) {
      gl.enableVertexAttribArray(loc);
      gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
    }
  };

  PrismRender.prototype.drawFull = function () {
    this.gl.drawArrays(this.gl.TRIANGLE_STRIP, 0, 4);
  };

  PrismRender.prototype.addSprite = function (batch, x, y, d, size, color, alpha, kind, phase, glyph) {
    batch.push({
      x: x, y: y, d: d, size: size,
      r: color[0], g: color[1], b: color[2],
      a: alpha, kind: kind, phase: phase || 0, glyph: glyph || 0
    });
  };

  PrismRender.prototype.clearBatch = function () {
    this.add.length = 0;
    this.solid.length = 0;
  };

  PrismRender.prototype.writeQuad = function (arr, offset, s) {
    var corners = [0, 0, 1, 0, 0, 1, 0, 1, 1, 0, 1, 1];
    var o = offset;
    for (var i = 0; i < 6; i++) {
      arr[o++] = corners[i * 2];
      arr[o++] = corners[i * 2 + 1];
      arr[o++] = s.x; arr[o++] = s.y; arr[o++] = s.d;
      arr[o++] = s.size;
      arr[o++] = s.r; arr[o++] = s.g; arr[o++] = s.b;
      arr[o++] = s.a;
      arr[o++] = s.kind;
      arr[o++] = s.phase;
      arr[o++] = s.glyph;
    }
    return o;
  };

  PrismRender.prototype.fillBatch = function (list, arr) {
    var off = 0;
    for (var i = 0; i < list.length; i++) off = this.writeQuad(arr, off, list[i]);
    return off / 13;
  };

  PrismRender.prototype.drawSprites = function (batch, arr, additive) {
    var gl = this.gl;
    if (!batch.length) return;
    var verts = this.fillBatch(batch, arr);
    gl.useProgram(this.p.sprite);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.spriteBuf);
    gl.bufferSubData(gl.ARRAY_BUFFER, 0, arr.subarray(0, verts * 13));
    var stride = 13 * 4;
    var loc = gl.getAttribLocation(this.p.sprite, 'aCorner');
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, stride, 0);
    loc = gl.getAttribLocation(this.p.sprite, 'aCenter');
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 3, gl.FLOAT, false, stride, 2 * 4);
    loc = gl.getAttribLocation(this.p.sprite, 'aSize');
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 1, gl.FLOAT, false, stride, 5 * 4);
    loc = gl.getAttribLocation(this.p.sprite, 'aColor');
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 3, gl.FLOAT, false, stride, 6 * 4);
    loc = gl.getAttribLocation(this.p.sprite, 'aAlpha');
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 1, gl.FLOAT, false, stride, 9 * 4);
    loc = gl.getAttribLocation(this.p.sprite, 'aKind');
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 1, gl.FLOAT, false, stride, 10 * 4);
    loc = gl.getAttribLocation(this.p.sprite, 'aPhase');
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 1, gl.FLOAT, false, stride, 11 * 4);
    loc = gl.getAttribLocation(this.p.sprite, 'aGlyph');
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 1, gl.FLOAT, false, stride, 12 * 4);
    var u = this.u.sprite;
    gl.uniform2f(u.uRes, this.sceneW, this.sceneH);
    gl.uniform1f(u.uTravel, this._travel);
    gl.uniform1f(u.uCamX, this._camX);
    gl.uniform1f(u.uCamY, this._camY);
    gl.uniform1f(u.uFocal, this.sceneH * 0.5 / this.tanHalf);
    gl.uniform1f(u.uCamDist, this.camDist);
    gl.uniform1f(u.uPlayerOffset, this.sceneH * 0.105);
    gl.uniform1f(u.uTime, this._time);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.atlas);
    gl.uniform1i(u.uAtlas, 0);
    gl.drawArrays(gl.TRIANGLES, 0, verts);
  };

  PrismRender.prototype.render = function (st) {
    var gl = this.gl;
    if (!this.ok || !gl || !this.targets) return false;
    var t = this.targets;
    if (!t.scene.ok || !t.bloomA.ok || !t.bloomB.ok) return false;

    this._travel = st.travel || 0;
    this._camX = st.camX || 0;
    this._camY = st.camY || 0;
    this._time = st.time || 0;

    this.clearBatch();
    this.buildSprites(st);

    // ---- 场景 ----
    gl.bindFramebuffer(gl.FRAMEBUFFER, t.scene.fb);
    gl.viewport(0, 0, this.sceneW, this.sceneH);
    gl.disable(gl.BLEND);
    gl.clearColor(0.97, 0.955, 0.92, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    this.bindFull(this.p.bg);
    var u = this.u.bg;
    gl.uniform2f(u.uRes, this.sceneW, this.sceneH);
    gl.uniform1f(u.uTravel, this._travel);
    gl.uniform1f(u.uSpeed, st.speed || 0);
    gl.uniform1f(u.uTime, this._time);
    gl.uniform1f(u.uCamX, this._camX);
    gl.uniform1f(u.uCamY, this._camY);
    gl.uniform1f(u.uImpact, st.impact || 0);
    gl.uniform1f(u.uMotion, st.motion === false ? 0 : 1);
    gl.uniform3f(u.uOrb, st.orb[0], st.orb[1], st.orb[2]);
    gl.uniform3f(u.uTint, st.tint[0], st.tint[1], st.tint[2]);
    this.drawFull();

    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE);
    this.drawSprites(this.add, this.verts.add, true);
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    this.solid.sort(function (a, b) { return b.d - a.d; });
    this.drawSprites(this.solid, this.verts.solid, false);

    // ---- 亮部 ----
    gl.disable(gl.BLEND);
    gl.bindFramebuffer(gl.FRAMEBUFFER, t.bloomA.fb);
    gl.viewport(0, 0, this.bloomW, this.bloomH);
    this.bindFull(this.p.bright);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, t.scene.tex);
    gl.uniform1i(this.u.bright.uTex, 0);
    gl.uniform2f(this.u.bright.uTexel, 1 / this.bloomW, 1 / this.bloomH);
    this.drawFull();

    // ---- 模糊两轮 ----
    var src = t.bloomA, dst = t.bloomB;
    for (var i = 0; i < 2; i++) {
      gl.bindFramebuffer(gl.FRAMEBUFFER, dst.fb);
      gl.viewport(0, 0, this.bloomW, this.bloomH);
      this.bindFull(this.p.blur);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, src.tex);
      gl.uniform1i(this.u.blur.uTex, 0);
      gl.uniform2f(this.u.blur.uTexel, 1 / this.bloomW, 1 / this.bloomH);
      gl.uniform2f(this.u.blur.uDir, 1, 0);
      this.drawFull();
      var tmp = src; src = dst; dst = tmp;

      gl.bindFramebuffer(gl.FRAMEBUFFER, dst.fb);
      gl.viewport(0, 0, this.bloomW, this.bloomH);
      this.bindFull(this.p.blur);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, src.tex);
      gl.uniform1i(this.u.blur.uTex, 0);
      gl.uniform2f(this.u.blur.uTexel, 1 / this.bloomW, 1 / this.bloomH);
      gl.uniform2f(this.u.blur.uDir, 0, 1);
      this.drawFull();
      tmp = src; src = dst; dst = tmp;
    }
    var bloomTex = src.tex;

    // ---- 合成 ----
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, this.canvas.width, this.canvas.height);
    this.bindFull(this.p.comp);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, t.scene.tex);
    gl.uniform1i(this.u.comp.uScene, 0);
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, bloomTex);
    gl.uniform1i(this.u.comp.uBloom, 1);
    gl.uniform2f(this.u.comp.uRes, this.canvas.width, this.canvas.height);
    gl.uniform1f(this.u.comp.uTime, this._time);
    gl.uniform1f(this.u.comp.uImpact, st.impact || 0);
    gl.uniform1f(this.u.comp.uMotion, st.motion === false ? 0 : 1);
    gl.uniform1f(this.u.comp.uFlash, st.flash || 0);
    gl.uniform3f(this.u.comp.uTint, st.tint[0], st.tint[1], st.tint[2]);
    this.drawFull();
    gl.activeTexture(gl.TEXTURE0);
    return true;
  };

  PrismRender.prototype.buildSprites = function (st) {
    var gl = this.gl;
    var i, g, m, p;
    var orb = st.orb;
    var trail = st.trail || [];

    // 拖尾
    for (i = 0; i < trail.length; i++) {
      var tr = trail[i];
      this.addSprite(this.add, tr.x, tr.y, tr.d, 0.42 + i * 0.03, orb, 0.10 * (1 - i / trail.length), 6, 0, 0);
    }

    // 门
    for (i = 0; i < (st.gates || []).length; i++) {
      g = st.gates[i];
      if (g.d < st.travel - 4 || g.d > st.travel + 150) continue;
      var col = g.color;
      var alpha = g.alpha === undefined ? 1 : g.alpha;
      if (g.glyph !== 7) this.addSprite(this.add, g.x, g.y, g.d, g.r * 3.2, col, 0.30 * alpha, 0, 0, 0);
      this.addSprite(this.solid, g.x, g.y, g.d, g.r * 2.55, col, 0.96 * alpha, 2, 0, 0);
      if (g.d - st.travel < 45) this.addSprite(this.solid, g.x, g.y, g.d, 0.48, col, 0.98 * alpha, 3, 0, g.glyph);
    }

    // 色粒
    for (i = 0; i < (st.motes || []).length; i++) {
      m = st.motes[i];
      if (m.d < st.travel - 3 || m.d > st.travel + 130) continue;
      this.addSprite(this.add, m.x, m.y, m.d, 0.60, m.color, 0.42 * m.alpha, 0, 0, 0);
      this.addSprite(this.solid, m.x, m.y, m.d, 0.30, m.color, 0.98 * m.alpha, 1, 0, m.glyph || 0);
    }

    // 粒子
    for (i = 0; i < (st.particles || []).length; i++) {
      p = st.particles[i];
      this.addSprite(this.add, p.x, p.y, p.d, p.size * 1.5, p.color, p.alpha * 0.35, 0, 0, 0);
      this.addSprite(this.solid, p.x, p.y, p.d, p.size, p.color, p.alpha, p.kind || 4, p.phase || 0, 0);
    }

    // 空气里的玻璃尘
    var decor = st.decor || [];
    for (i = 0; i < decor.length; i++) {
      p = decor[i];
      if (p.d < st.travel - 5 || p.d > st.travel + 125) continue;
      this.addSprite(this.add, p.x, p.y, p.d, p.size * 2.8, p.color, p.alpha * 0.55, 0, 0, 0);
      if (i % 4 === 0) this.addSprite(this.solid, p.x, p.y, p.d, p.size, p.color, p.alpha * 0.9, 4, p.phase, 0);
    }

    // 光球：外晕 + 本体
    this.addSprite(this.add, st.player.x, st.player.y, st.player.d, 0.85, orb, 0.45, 6, 0, 0);
    this.addSprite(this.solid, st.player.x, st.player.y, st.player.d, 0.38, orb, 1.0, 5, 0, 0);
    // 光球上的一点白色高光
    this.addSprite(this.add, st.player.x, st.player.y, st.player.d - 0.01, 0.14, [1, 1, 1], 0.9, 6, 0, 0);
  };

  PrismRender.prototype.dispose = function () {
    if (this.targets) this.disposeTargets();
    var gl = this.gl;
    if (!gl) return;
    if (this.quad) gl.deleteBuffer(this.quad);
    if (this.spriteBuf) gl.deleteBuffer(this.spriteBuf);
    if (this.atlas) gl.deleteTexture(this.atlas);
    ['bg', 'sprite', 'bright', 'blur', 'comp'].forEach(function (k) {
      if (this.p[k]) gl.deleteProgram(this.p[k]);
    }, this);
    this.ok = false;
  };

  window.PrismRender = PrismRender;
})();
