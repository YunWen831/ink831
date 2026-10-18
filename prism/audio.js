/* 棱 PRISM · 程序化音频
 * 没有音频文件。底噪 pad 的和弦跟着身上的颜色走；
 * 吃色、穿门、吐息、撞碎都是实时合成。
 */
(function () {
  'use strict';

  var CHORDS = {
    0: [146.83, 220.00, 293.66, 329.63], // D
    1: [174.61, 261.63, 349.23, 440.00], // F
    2: [196.00, 293.66, 392.00, 493.88], // G
    4: [220.00, 261.63, 329.63, 440.00], // Am
    3: [146.83, 220.00, 349.23, 440.00], // Dm
    5: [233.08, 293.66, 349.23, 466.16], // Bb
    6: [164.81, 246.94, 329.63, 415.30], // Em
    7: [261.63, 329.63, 392.00, 523.25]  // C
  };

  function now(ctx) { return ctx.currentTime; }

  function PrismAudio() {
    this.ctx = null;
    this.master = null;
    this.music = null;
    this.sfx = null;
    this.wet = null;
    this.filter = null;
    this.oscs = [];
    this.muted = false;
    this.volume = 0.7;
    this.mask = 0;
    this.paused = false;
    this.started = false;
    this.tempo = 84;
    this.step = 0;
    this.timer = null;
    this.nextNote = 0;
    this.failed = false;
  }

  PrismAudio.prototype.ensure = function () {
    if (this.ctx || this.failed) return !!this.ctx;
    var AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) { this.failed = true; return false; }
    try {
      var ctx = this.ctx = new AC();
      var comp = ctx.createDynamicsCompressor();
      comp.threshold.value = -18;
      comp.knee.value = 18;
      comp.ratio.value = 4;
      comp.attack.value = 0.005;
      comp.release.value = 0.3;
      comp.connect(ctx.destination);

      this.master = ctx.createGain();
      this.master.gain.value = this.muted ? 0 : this.volume;
      this.master.connect(comp);

      this.music = ctx.createGain();
      this.music.gain.value = 0.42;
      this.music.connect(this.master);

      this.sfx = ctx.createGain();
      this.sfx.gain.value = 0.72;
      this.sfx.connect(this.master);

      // 一个很轻的反馈延迟，给门铃声一点空间。
      var delay = ctx.createDelay(0.6);
      delay.delayTime.value = 0.19;
      var fb = ctx.createGain();
      fb.gain.value = 0.22;
      var wet = ctx.createGain();
      wet.gain.value = 0.18;
      this.music.connect(delay);
      delay.connect(fb);
      fb.connect(delay);
      delay.connect(wet);
      wet.connect(this.master);
      this.wet = wet;

      this.filter = ctx.createBiquadFilter();
      this.filter.type = 'lowpass';
      this.filter.frequency.value = 1500;
      this.filter.Q.value = 0.6;
      this.filter.connect(this.music);

      for (var i = 0; i < 3; i++) {
        var osc = ctx.createOscillator();
        osc.type = i === 0 ? 'triangle' : 'sine';
        var g = ctx.createGain();
        g.gain.value = i === 0 ? 0.075 : 0.045;
        osc.connect(g);
        g.connect(this.filter);
        osc.frequency.value = (CHORDS[0][i] || 220) * (i === 1 ? 1.005 : 1);
        osc.start();
        this.oscs.push(osc);
      }

      // 很慢的呼吸，不让 pad 变成一条死线。
      var lfo = ctx.createOscillator();
      var lg = ctx.createGain();
      lfo.frequency.value = 0.06;
      lg.gain.value = 180;
      lfo.connect(lg);
      lg.connect(this.filter.frequency);
      lfo.start();

      this.setColor(this.mask, true);
      return true;
    } catch (e) {
      this.failed = true;
      this.ctx = null;
      return false;
    }
  };

  PrismAudio.prototype.setMuted = function (muted) {
    this.muted = !!muted;
    if (!this.ctx) return;
    var t = now(this.ctx);
    this.master.gain.setTargetAtTime(this.muted ? 0 : this.volume, t, 0.05);
  };

  PrismAudio.prototype.setVolume = function (v) {
    this.volume = Math.max(0, Math.min(1, Number(v) || 0));
    if (!this.ctx) return;
    this.master.gain.setTargetAtTime(this.muted ? 0 : this.volume, now(this.ctx), 0.05);
  };

  PrismAudio.prototype.setColor = function (mask, immediate) {
    this.mask = mask & 7;
    if (!this.ctx) return;
    var chord = CHORDS[this.mask] || CHORDS[0];
    var t = now(this.ctx);
    for (var i = 0; i < this.oscs.length; i++) {
      var freq = (chord[i] || chord[0]) * (i === 1 ? 1.004 : 1);
      if (immediate) this.oscs[i].frequency.setValueAtTime(freq, t);
      else this.oscs[i].frequency.setTargetAtTime(freq, t, 0.16);
    }
    var cutoff = 900 + [0, 520, 440, 760, 300, 620, 540, 1200][this.mask];
    this.filter.frequency.setTargetAtTime(cutoff, t, 0.2);
  };

  PrismAudio.prototype.setTempo = function (tempo) {
    this.tempo = Math.max(50, Math.min(150, tempo || 84));
    if (this.ctx) this.nextNote = Math.max(this.nextNote, this.ctx.currentTime);
  };

  PrismAudio.prototype.start = function () {
    if (!this.ensure()) return;
    if (this.ctx.state === 'suspended') this.ctx.resume();
    this.started = true;
    if (this.timer) return;
    var self = this;
    this.nextNote = this.ctx.currentTime + 0.1;
    this.timer = setInterval(function () { self.schedule(); }, 30);
  };

  PrismAudio.prototype.schedule = function () {
    if (!this.ctx || this.paused) return;
    var ctx = this.ctx;
    var ahead = ctx.currentTime + 0.16;
    var stepDur = 60 / this.tempo / 2;
    while (this.nextNote < ahead) {
      var chord = CHORDS[this.mask] || CHORDS[0];
      var idx = this.step % 8;
      // 稀疏的琶音：每两拍一次，不抢戏。
      if (idx === 0 || idx === 3 || idx === 5) {
        var note = chord[(this.step + (idx === 5 ? 2 : 0)) % chord.length] * 2;
        this.pluck(note, this.nextNote, idx === 0 ? 0.05 : 0.028);
      }
      this.nextNote += stepDur;
      this.step++;
    }
  };

  PrismAudio.prototype.pluck = function (freq, time, gain) {
    if (!this.ctx || this.muted) return;
    var ctx = this.ctx;
    var osc = ctx.createOscillator();
    var g = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(freq, time);
    g.gain.setValueAtTime(0.0001, time);
    g.gain.exponentialRampToValueAtTime(gain, time + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, time + 0.42);
    osc.connect(g);
    g.connect(this.music);
    osc.start(time);
    osc.stop(time + 0.5);
  };

  PrismAudio.prototype.tone = function (freq, dur, gain, type, at) {
    if (!this.ctx || this.muted) return;
    var ctx = this.ctx;
    var t = at === undefined ? ctx.currentTime : at;
    var osc = ctx.createOscillator();
    var g = ctx.createGain();
    osc.type = type || 'sine';
    osc.frequency.setValueAtTime(freq, t);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(gain, t + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(g);
    g.connect(this.sfx);
    osc.start(t);
    osc.stop(t + dur + 0.02);
  };

  PrismAudio.prototype.pickup = function (ch) {
    if (!this.ctx) return;
    var freq = ch === 1 ? 523.25 : ch === 2 ? 659.25 : 783.99;
    this.tone(freq, 0.26, 0.055, 'sine');
    if (ch === 4) this.tone(freq * 1.5, 0.2, 0.025, 'sine');
  };

  PrismAudio.prototype.gate = function (combo, perfect) {
    if (!this.ctx) return;
    var base = 392 * Math.pow(2, Math.min(12, combo) / 24);
    this.tone(base, 0.38, 0.075, 'sine');
    this.tone(base * 1.5, 0.32, 0.04, 'sine');
    if (perfect) {
      this.tone(base * 2, 0.5, 0.035, 'sine');
      this.tone(base * 2.5, 0.44, 0.022, 'sine');
    }
  };

  PrismAudio.prototype.miss = function () {
    if (!this.ctx) return;
    this.tone(196, 0.18, 0.035, 'sine');
  };

  PrismAudio.prototype.crash = function () {
    if (!this.ctx || this.muted) return;
    var ctx = this.ctx, t = ctx.currentTime;
    var len = Math.floor(ctx.sampleRate * 0.36);
    var buf = ctx.createBuffer(1, len, ctx.sampleRate);
    var data = buf.getChannelData(0);
    for (var i = 0; i < len; i++) {
      var e = 1 - i / len;
      data[i] = (Math.random() * 2 - 1) * e * e;
    }
    var src = ctx.createBufferSource();
    src.buffer = buf;
    var bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.setValueAtTime(1100, t);
    bp.frequency.exponentialRampToValueAtTime(180, t + 0.32);
    bp.Q.value = 0.9;
    var g = ctx.createGain();
    g.gain.setValueAtTime(0.16, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.36);
    src.connect(bp); bp.connect(g); g.connect(this.sfx);
    src.start(t);
    this.tone(110, 0.4, 0.08, 'sawtooth');
  };

  PrismAudio.prototype.vent = function () {
    if (!this.ctx || this.muted) return;
    var ctx = this.ctx, t = ctx.currentTime;
    var len = Math.floor(ctx.sampleRate * 0.22);
    var buf = ctx.createBuffer(1, len, ctx.sampleRate);
    var data = buf.getChannelData(0);
    for (var i = 0; i < len; i++) {
      var e = Math.sin(Math.PI * i / len);
      data[i] = (Math.random() * 2 - 1) * e;
    }
    var src = ctx.createBufferSource();
    src.buffer = buf;
    var lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 900;
    var g = ctx.createGain();
    g.gain.value = 0.035;
    src.connect(lp); lp.connect(g); g.connect(this.sfx);
    src.start(t);
  };

  PrismAudio.prototype.complete = function () {
    if (!this.ctx) return;
    var chord = CHORDS[7];
    var t = this.ctx.currentTime;
    for (var i = 0; i < chord.length; i++) {
      this.tone(chord[i] * 2, 0.9, 0.04, 'sine', t + i * 0.08);
    }
  };

  PrismAudio.prototype.pause = function (paused) {
    this.paused = !!paused;
    if (!this.ctx) return;
    var t = this.ctx.currentTime;
    this.music.gain.setTargetAtTime(paused ? 0.13 : 0.42, t, 0.15);
  };

  PrismAudio.prototype.suspend = function () {
    if (this.ctx && this.ctx.state === 'running') this.ctx.suspend().catch(function () {});
  };

  PrismAudio.prototype.resume = function () {
    if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume().catch(function () {});
  };

  window.PrismAudio = PrismAudio;
})();
