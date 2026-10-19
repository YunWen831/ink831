// 混乱都市的程序化音效：没有音频文件，全部由 WebAudio 合成。
export function createCityAudio() {
  const AC = window.AudioContext || window.webkitAudioContext;
  let ctx = null, master = null, noise = null, muted = false, lastAlarm = 0, engineOsc = null, engineGain = null, engineFilter = null;

  function unlock() {
    try {
      if (!AC) return;
      if (!ctx) {
        ctx = new AC();
        master = ctx.createGain();
        master.gain.value = .32;
        master.connect(ctx.destination);
        const length = Math.floor(ctx.sampleRate * .8);
        noise = ctx.createBuffer(1, length, ctx.sampleRate);
        const data = noise.getChannelData(0);
        for (let i = 0; i < length; i++) data[i] = Math.random() * 2 - 1;
      }
      if (ctx.state === 'suspended') ctx.resume().catch(() => {});
    } catch {}
  }
  function ready() { return ctx && !muted && ctx.state === 'running' ? ctx : null; }
  function envelope(gain, at, volume, duration) {
    gain.gain.setValueAtTime(.0001, at);
    gain.gain.exponentialRampToValueAtTime(Math.max(.0002, volume), at + .006);
    gain.gain.exponentialRampToValueAtTime(.0001, at + duration);
  }
  function tone(from, to, duration, type = 'sine', volume = .08, when = 0) {
    const c = ready(); if (!c) return;
    try {
      const at = c.currentTime + when, oscillator = c.createOscillator(), gain = c.createGain();
      oscillator.type = type;
      oscillator.frequency.setValueAtTime(from, at);
      oscillator.frequency.exponentialRampToValueAtTime(Math.max(20, to), at + duration);
      envelope(gain, at, volume, duration);
      oscillator.connect(gain); gain.connect(master);
      oscillator.start(at); oscillator.stop(at + duration + .02);
    } catch {}
  }
  function burst(duration = .12, volume = .14, cutoff = 1200, type = 'lowpass', when = 0) {
    const c = ready(); if (!c || !noise) return;
    try {
      const at = c.currentTime + when, source = c.createBufferSource(), filter = c.createBiquadFilter(), gain = c.createGain();
      source.buffer = noise;
      filter.type = type;
      filter.frequency.value = cutoff;
      filter.Q.value = type === 'bandpass' ? 1.2 : .7;
      envelope(gain, at, volume, duration);
      source.connect(filter); filter.connect(gain); gain.connect(master);
      source.start(at); source.stop(at + duration + .02);
    } catch {}
  }

  return {
    unlock,
    get muted() { return muted; },
    setMuted(value) { muted = !!value; if (muted && ctx) try { master.gain.value = 0; } catch {} else if (ctx) try { master.gain.value = .32; } catch {} },
    shot(gun = 'pistol', scale = 1) {
      if (gun === 'shotgun') { burst(.3, .3 * scale, 760); tone(96, 42, .28, 'sine', .24 * scale); }
      else if (gun === 'smg') { burst(.055, .11 * scale, 2200, 'bandpass'); tone(250, 130, .05, 'square', .055 * scale); }
      else if (gun === 'revolver') { burst(.14, .24 * scale, 1100, 'bandpass'); tone(145, 55, .2, 'triangle', .17 * scale); }
      else if (gun === 'dmr' || gun === 'rifle') { burst(.17, .23 * scale, 2100, 'bandpass'); tone(190, 62, .16, 'sawtooth', .13 * scale); }
      else if (gun === 'lmg') { burst(.065, .13 * scale, 1500, 'bandpass'); tone(210, 95, .06, 'square', .075 * scale); }
      else if (gun === 'pistol') { burst(.1, .18 * scale, 1700, 'bandpass'); tone(170, 72, .13, 'triangle', .12 * scale); }
      else if (gun === 'knife') burst(.1, .08 * scale, 3200, 'highpass');
      else tone(100, 48, .1, 'sine', .12 * scale);
      burst(.035, .06 * scale, 3800, 'highpass');
    },
    hit(scale = 1) { tone(1040, 1560, .045, 'sine', .055 * scale); burst(.028, .045 * scale, 3400, 'highpass'); },
    hurt() { tone(190, 78, .2, 'square', .1); burst(.14, .12, 520); },
    kill() { tone(150, 54, .28, 'triangle', .1); burst(.2, .12, 700); },
    explosion() { burst(.75, .34, 460); tone(78, 28, .55, 'sine', .25); burst(.24, .16, 1300, 'bandpass', .04); },
    reload() { burst(.035, .08, 2800, 'highpass'); burst(.045, .09, 2400, 'highpass', .2); },
    cash() { tone(880, 880, .07, 'sine', .06); tone(1320, 1320, .1, 'sine', .05, .07); },
    pickup() { tone(660, 660, .06, 'triangle', .06); tone(990, 990, .09, 'triangle', .05, .06); },
    reward() { [523, 659, 784, 1046].forEach((f, i) => tone(f, f, .16, 'sine', .07, i * .08)); },
    alarm() {
      const c = ready(); if (!c || c.currentTime - lastAlarm < .5) return;
      lastAlarm = c.currentTime;
      tone(680, 640, .24, 'square', .055); tone(470, 440, .26, 'square', .05, .28);
    },
    slots(win = false) {
      for (let i = 0; i < 5; i++) burst(.025, .035, 2600, 'highpass', i * .07);
      if (win) [784, 988, 1318].forEach((f, i) => tone(f, f, .18, 'sine', .075, .28 + i * .09));
    },
    checkpoint() { tone(880, 1320, .13, 'sine', .07); },
    bounty() { tone(240, 170, .22, 'square', .07); tone(180, 120, .3, 'square', .05, .2); },
    flash() { tone(1900, 220, .38, 'sine', .11); burst(.24, .1, 3200, 'highpass'); },
    engine(on = false, speed = 0) {
      const c = ready(); if (!c) return;
      try {
        if (!engineOsc) {
          engineOsc = c.createOscillator(); engineFilter = c.createBiquadFilter(); engineGain = c.createGain();
          engineOsc.type = 'sawtooth'; engineOsc.frequency.value = 45;
          engineFilter.type = 'lowpass'; engineFilter.frequency.value = 180;
          engineGain.gain.value = 0;
          engineOsc.connect(engineFilter); engineFilter.connect(engineGain); engineGain.connect(master); engineOsc.start();
        }
        const at = c.currentTime, power = Math.min(1, Math.max(0, speed / 580));
        engineOsc.frequency.setTargetAtTime(42 + power * 74, at, .08);
        engineFilter.frequency.setTargetAtTime(140 + power * 260, at, .08);
        engineGain.gain.setTargetAtTime(on ? .012 + power * .026 : 0, at, .08);
      } catch {}
    },
    zombie() { tone(92, 55, .7, 'sawtooth', .07); tone(64, 42, .9, 'square', .04, .08); burst(.5, .07, 380, 'lowpass', .05); },
    ui() { tone(460, 460, .025, 'sine', .025); }
  };
}
