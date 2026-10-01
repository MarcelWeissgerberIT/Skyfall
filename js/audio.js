// All sound is synthesised at runtime with WebAudio - no sample files.
const store = {
  get(k, d) {
    try {
      const v = localStorage.getItem(k);
      return v === null ? d : v;
    } catch {
      return d;
    }
  },
  set(k, v) {
    try {
      localStorage.setItem(k, v);
    } catch {}
  },
};

export class Sound {
  constructor() {
    this.ctx = null;
    this.on = store.get('skyfall.sound', '1') === '1';
    this.last = {};
    this.intensity = 0;
    this.night = 0;
  }

  init() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume();
      return;
    }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    const ctx = (this.ctx = new AC());
    this.master = ctx.createGain();
    this.master.gain.value = this.on ? 0.8 : 0;
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -14;
    comp.ratio.value = 6;
    this.master.connect(comp).connect(ctx.destination);
    this.sfx = ctx.createGain();
    this.sfx.gain.value = 0.9;
    this.sfx.connect(this.master);
    this.mus = ctx.createGain();
    this.mus.gain.value = 0.22;
    this.mus.connect(this.master);
    const len = ctx.sampleRate;
    this.noise = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = this.noise.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    this.startMusic();
  }

  toggle() {
    this.on = !this.on;
    store.set('skyfall.sound', this.on ? '1' : '0');
    if (this.master) this.master.gain.setTargetAtTime(this.on ? 0.8 : 0, this.ctx.currentTime, 0.05);
  }

  // throttle identical sounds so 40 pellets do not make 40 sounds
  gate(name, ms) {
    const now = performance.now();
    if (this.last[name] && now - this.last[name] < ms) return false;
    this.last[name] = now;
    return true;
  }

  env(g, t, a, peak, dur) {
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + a);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  }

  osc(type, f0, f1, dur, vol, t = 0, dest) {
    const c = this.ctx, now = c.currentTime + t;
    const o = c.createOscillator(), g = c.createGain();
    o.type = type;
    o.frequency.setValueAtTime(f0, now);
    o.frequency.exponentialRampToValueAtTime(Math.max(1, f1), now + dur);
    this.env(g, now, 0.005, vol, dur);
    o.connect(g).connect(dest || this.sfx);
    o.start(now);
    o.stop(now + dur + 0.05);
    return o;
  }

  noiseBurst(dur, vol, type, f0, f1, q = 1, t = 0) {
    const c = this.ctx, now = c.currentTime + t;
    const s = c.createBufferSource();
    s.buffer = this.noise;
    s.playbackRate.value = 0.7 + Math.random() * 0.6;
    const f = c.createBiquadFilter();
    f.type = type;
    f.Q.value = q;
    f.frequency.setValueAtTime(f0, now);
    f.frequency.exponentialRampToValueAtTime(Math.max(20, f1), now + dur);
    const g = c.createGain();
    this.env(g, now, 0.004, vol, dur);
    s.connect(f).connect(g).connect(this.sfx);
    s.start(now, Math.random() * 0.5);
    s.stop(now + dur + 0.05);
  }

  play(name) {
    if (!this.ctx || !this.on) return;
    switch (name) {
      case 'shotgun':
        if (!this.gate(name, 60)) return;
        this.noiseBurst(0.32, 0.9, 'lowpass', 3200, 300, 0.7);
        this.osc('sine', 140, 40, 0.18, 0.8);
        break;
      case 'smg':
        if (!this.gate(name, 45)) return;
        this.noiseBurst(0.07, 0.45, 'bandpass', 2400, 900, 1.2);
        this.osc('square', 220, 90, 0.04, 0.12);
        break;
      case 'pistol':
        if (!this.gate(name, 60)) return;
        this.noiseBurst(0.14, 0.55, 'lowpass', 2600, 400);
        this.osc('sine', 180, 60, 0.1, 0.4);
        break;
      case 'plasma':
        if (!this.gate(name, 50)) return;
        this.osc('sawtooth', 1400, 180, 0.16, 0.18);
        this.osc('sine', 700, 1400, 0.1, 0.15);
        break;
      case 'enemyShot':
        if (!this.gate(name, 90)) return;
        this.osc('sine', 500, 1200, 0.18, 0.12);
        this.osc('triangle', 260, 520, 0.18, 0.08);
        break;
      case 'hit':
        if (!this.gate(name, 40)) return;
        this.osc('square', 320, 140, 0.05, 0.08);
        break;
      case 'splat':
        if (!this.gate(name, 50)) return;
        this.noiseBurst(0.22, 0.5, 'bandpass', 1500, 250, 2.5);
        this.osc('triangle', 520, 70, 0.28, 0.25);
        break;
      case 'boom':
        if (!this.gate(name, 70)) return;
        this.noiseBurst(1.1, 1.0, 'lowpass', 1400, 60, 0.6);
        this.osc('sine', 90, 25, 0.8, 1.0);
        break;
      case 'bigboom':
        this.noiseBurst(2.2, 1.0, 'lowpass', 1800, 40, 0.5);
        this.osc('sine', 70, 18, 1.6, 1.0);
        this.noiseBurst(0.6, 0.6, 'highpass', 4000, 1500, 0.5, 0.05);
        break;
      case 'whistle':
        if (!this.gate(name, 200)) return;
        this.osc('sine', 2200, 300, 1.3, 0.07);
        break;
      case 'pickup':
        this.osc('triangle', 660, 660, 0.09, 0.25);
        this.osc('triangle', 990, 990, 0.14, 0.25, 0.08);
        break;
      case 'power':
        [523, 659, 784, 1046].forEach((f, i) => this.osc('square', f, f, 0.1, 0.12, i * 0.06));
        break;
      case 'hurt':
        if (!this.gate(name, 150)) return;
        this.osc('sine', 240, 70, 0.25, 0.6);
        this.noiseBurst(0.15, 0.3, 'lowpass', 900, 200);
        break;
      case 'beam':
        if (!this.gate(name, 400)) return;
        {
          const o = this.osc('sine', 300, 900, 1.6, 0.1);
          const l = this.ctx.createOscillator(), lg = this.ctx.createGain();
          l.frequency.value = 9;
          lg.gain.value = 40;
          l.connect(lg).connect(o.frequency);
          l.start();
          l.stop(this.ctx.currentTime + 1.7);
        }
        break;
      case 'throw':
        this.noiseBurst(0.3, 0.25, 'bandpass', 600, 2400, 1.5);
        break;
      case 'empty':
        if (!this.gate(name, 400)) return;
        this.osc('square', 1200, 1100, 0.03, 0.1);
        break;
      case 'moo':
        if (!this.gate(name, 800)) return;
        {
          const o = this.osc('sawtooth', 150, 105, 1.0, 0.25);
          void o;
          this.noiseBurst(0.9, 0.05, 'bandpass', 600, 400, 4);
        }
        break;
      case 'scream':
        if (!this.gate(name, 500)) return;
        {
          const o = this.osc('sine', 800, 1300, 0.7, 0.07);
          const l = this.ctx.createOscillator(), lg = this.ctx.createGain();
          l.frequency.value = 14;
          lg.gain.value = 90;
          l.connect(lg).connect(o.frequency);
          l.start();
          l.stop(this.ctx.currentTime + 0.8);
        }
        break;
      case 'sting':
        [196, 233, 277].forEach((f, i) => this.osc('sawtooth', f, f * 0.98, 0.9, 0.08, i * 0.07));
        this.osc('sine', 98, 96, 1.2, 0.3);
        break;
      case 'radio':
        this.noiseBurst(0.12, 0.12, 'bandpass', 2000, 2000, 3);
        this.osc('square', 1000, 1000, 0.06, 0.04, 0.12);
        break;
      case 'click':
        this.osc('square', 900, 600, 0.04, 0.1);
        break;
      case 'honk':
        // a proper two-tone American car horn
        this.osc('square', 392, 392, 0.32, 0.16);
        this.osc('square', 494, 494, 0.32, 0.13);
        this.osc('sawtooth', 196, 196, 0.32, 0.08);
        break;
      case 'boost':
        this.noiseBurst(0.9, 0.7, 'bandpass', 400, 3000, 1.2);
        this.osc('sawtooth', 120, 480, 0.8, 0.2);
        break;
      case 'splash':
        this.noiseBurst(1.2, 0.5, 'highpass', 1500, 4000, 0.7);
        break;
      case 'thud':
        if (!this.gate(name, 60)) return;
        this.osc('sine', 160, 60, 0.12, 0.35);
        this.noiseBurst(0.08, 0.25, 'lowpass', 1200, 300);
        break;
      case 'bark':
        if (!this.gate(name, 250)) return;
        this.osc('square', 520, 260, 0.09, 0.2);
        this.noiseBurst(0.08, 0.2, 'bandpass', 900, 600, 3);
        this.osc('square', 480, 240, 0.08, 0.15, 0.13);
        break;
      case 'whistle2':
        this.osc('sine', 1600, 2400, 0.18, 0.12);
        this.osc('sine', 2400, 1500, 0.25, 0.12, 0.2);
        break;
      case 'door':
        this.noiseBurst(0.12, 0.5, 'lowpass', 900, 200, 1);
        this.osc('square', 140, 70, 0.08, 0.25, 0.02);
        break;
      case 'crash':
        if (!this.gate(name, 150)) return;
        this.noiseBurst(0.45, 0.9, 'bandpass', 1800, 300, 0.8);
        this.osc('square', 90, 40, 0.25, 0.4);
        break;
      case 'rummage':
        this.noiseBurst(0.18, 0.25, 'bandpass', 1200 + Math.random() * 1500, 600, 2);
        break;
      case 'beep':
        this.osc('square', 1400, 1400, 0.07, 0.18);
        break;
      case 'rescue':
        [523, 659, 784].forEach((f, i) => this.osc('triangle', f, f, 0.18, 0.25, i * 0.09));
        break;
      case 'mission':
        [392, 523, 659, 784, 1046].forEach((f, i) => this.osc('square', f, f, 0.14, 0.12, i * 0.08));
        this.osc('sine', 131, 131, 0.8, 0.3, 0.3);
        break;
      case 'over':
        [392, 370, 349, 330].forEach((f, i) => this.osc('triangle', f, f * 0.97, 0.45, 0.2, i * 0.38));
        this.osc('sine', 82, 70, 2.2, 0.3, 1.1);
        break;
    }
  }

  // Engine drone that follows the speedometer.
  engine(on, k = 0, boost = false) {
    if (!this.ctx) return;
    const c = this.ctx;
    if (on && !this.eng) {
      const o = c.createOscillator(), o2 = c.createOscillator(), f = c.createBiquadFilter(), g = c.createGain();
      o.type = 'sawtooth';
      o2.type = 'square';
      f.type = 'lowpass';
      f.frequency.value = 500;
      g.gain.value = 0;
      o.connect(f);
      o2.connect(f);
      f.connect(g).connect(this.sfx);
      o.start();
      o2.start();
      this.eng = { o, o2, f, g };
    }
    if (!on && this.eng) {
      const e = this.eng;
      e.g.gain.setTargetAtTime(0, c.currentTime, 0.08);
      e.o.stop(c.currentTime + 0.4);
      e.o2.stop(c.currentTime + 0.4);
      this.eng = null;
      return;
    }
    if (!this.eng) return;
    const t = c.currentTime, e = this.eng;
    const f0 = 42 + k * 70 + (boost ? 40 : 0);
    e.o.frequency.setTargetAtTime(f0, t, 0.08);
    e.o2.frequency.setTargetAtTime(f0 * 0.5, t, 0.08);
    e.f.frequency.setTargetAtTime(380 + k * 900 + (boost ? 800 : 0), t, 0.1);
    e.g.gain.setTargetAtTime(this.on ? 0.05 + k * 0.05 : 0, t, 0.1);
  }

  // Wailing police siren while Dale borrows the cruiser.
  siren(on) {
    if (!this.ctx) return;
    const c = this.ctx;
    if (on && !this.sirenOsc) {
      const o = c.createOscillator(), g = c.createGain(), l = c.createOscillator(), lg = c.createGain();
      o.type = 'triangle';
      o.frequency.value = 760;
      l.frequency.value = 0.9;
      lg.gain.value = 230;
      l.connect(lg).connect(o.frequency);
      g.gain.value = 0;
      g.gain.setTargetAtTime(this.on ? 0.07 : 0, c.currentTime, 0.1);
      o.connect(g).connect(this.sfx);
      o.start();
      l.start();
      this.sirenOsc = { o, l, g };
    } else if (!on && this.sirenOsc) {
      const s = this.sirenOsc;
      s.g.gain.setTargetAtTime(0, c.currentTime, 0.08);
      s.o.stop(c.currentTime + 0.4);
      s.l.stop(c.currentTime + 0.4);
      this.sirenOsc = null;
    }
  }

  // --- music: a 1950s B-movie theremin over a creeping bass line --------------
  startMusic() {
    const c = this.ctx;
    this.thereminGain = c.createGain();
    this.thereminGain.gain.value = 0;
    const filt = c.createBiquadFilter();
    filt.type = 'lowpass';
    filt.frequency.value = 2200;
    this.theremin = c.createOscillator();
    this.theremin.type = 'sine';
    this.theremin.frequency.value = 440;
    const vib = c.createOscillator(), vibG = c.createGain();
    vib.frequency.value = 5.6;
    vibG.gain.value = 7;
    vib.connect(vibG).connect(this.theremin.frequency);
    // a bit of delay for that spooky space echo
    const delay = c.createDelay(1.0), fb = c.createGain();
    delay.delayTime.value = 0.38;
    fb.gain.value = 0.35;
    this.theremin.connect(filt).connect(this.thereminGain);
    this.thereminGain.connect(this.mus);
    this.thereminGain.connect(delay);
    delay.connect(fb).connect(delay);
    delay.connect(this.mus);
    this.theremin.start();
    vib.start();
    this.step = 0;
    this.nextT = c.currentTime + 0.3;
    this.musicOn = true;
    const scale = [0, 2, 4, 6, 8, 10]; // whole tone - instant flying saucer
    this.melody = () => 220 * Math.pow(2, (scale[Math.floor(Math.random() * scale.length)] + 12 * Math.floor(Math.random() * 2)) / 12);
    setInterval(() => this.tick(), 90);
  }

  tick() {
    const c = this.ctx;
    if (!c) return;
    if (!this.musicOn) {
      this.thereminGain.gain.setTargetAtTime(0, c.currentTime, 0.1);
      this.nextT = c.currentTime + 0.1;
      return;
    }
    const bpm = 84 + this.intensity * 46;
    const beat = 60 / bpm / 2;
    while (this.nextT < c.currentTime + 0.25) {
      const t = this.nextT;
      const s = this.step++;
      // bass pulse
      const root = [55, 55, 58.27, 51.91][Math.floor(s / 16) % 4];
      if (s % 2 === 0) this.bass(t, s % 8 === 0 ? root : root * (s % 4 === 0 ? 1.5 : 1), beat * 1.6);
      // hats once things heat up
      if (this.intensity > 0.35 && s % 2 === 1) this.hat(t, 0.03 + this.intensity * 0.04);
      if (this.intensity > 0.7 && s % 4 === 2) this.hat(t + beat / 2, 0.05);
      // theremin phrase
      if (s % 4 === 0 && Math.random() < 0.75) {
        const f = this.melody();
        this.theremin.frequency.setTargetAtTime(f, t, 0.09);
        this.thereminGain.gain.setTargetAtTime(0.32, t, 0.12);
        this.thereminGain.gain.setTargetAtTime(0.0, t + beat * 3.2, 0.25);
      }
      this.nextT += beat;
    }
  }

  bass(t, f, dur) {
    const c = this.ctx;
    const o = c.createOscillator(), g = c.createGain(), lp = c.createBiquadFilter();
    o.type = 'sawtooth';
    o.frequency.value = f;
    lp.type = 'lowpass';
    lp.frequency.value = 260 + this.intensity * 500;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.5, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(lp).connect(g).connect(this.mus);
    o.start(t);
    o.stop(t + dur + 0.05);
  }

  hat(t, vol) {
    const c = this.ctx;
    const s = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain();
    s.buffer = this.noise;
    f.type = 'highpass';
    f.frequency.value = 7000;
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.05);
    s.connect(f).connect(g).connect(this.mus);
    s.start(t, Math.random() * 0.5);
    s.stop(t + 0.06);
  }
}

export { store };
