// Мультяшные звуки, синтезированные на лету (WebAudio) — никаких файлов.
// Тихие (общая громкость ~0.2), выключаются вместе с «Без звука».

const PENTA = [523.25, 587.33, 659.25, 783.99, 880, 1046.5];

export class Sfx {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.muted = false;
    this.volume = 0.22;
  }

  setMuted(m) {
    this.muted = Boolean(m);
  }

  ready() {
    if (this.muted) return false;
    try {
      if (!this.ctx) {
        this.ctx = new AudioContext();
        this.master = this.ctx.createGain();
        this.master.gain.value = this.volume;
        this.master.connect(this.ctx.destination);
      }
      if (this.ctx.state === 'suspended') this.ctx.resume().catch(() => {});
      return true;
    } catch {
      return false;
    }
  }

  // тон с огибающей: freqs — точки [время, частота]
  tone(type, freqs, dur, peak = 0.3) {
    if (!this.ready()) return;
    const t0 = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freqs[0][1], t0);
    for (const [t, f] of freqs.slice(1)) osc.frequency.exponentialRampToValueAtTime(f, t0 + t);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(peak, t0 + Math.min(0.02, dur / 4));
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(g).connect(this.master);
    osc.start(t0);
    osc.stop(t0 + dur + 0.02);
  }

  boing() {
    this.tone('sine', [[0, 140], [0.08, 420], [0.33, 220]], 0.36, 0.32);
  }

  pop(pitch = 1) {
    this.tone('sine', [[0, 500 * pitch], [0.06, 1100 * pitch]], 0.09, 0.25);
  }

  tink() {
    this.tone('triangle', [[0, 2200], [0.04, 2100]], 0.06, 0.15);
  }

  squeak() {
    this.tone('square', [[0, 900], [0.05, 1500], [0.12, 1100]], 0.13, 0.08);
  }

  blip() {
    const f = PENTA[Math.floor(Math.random() * PENTA.length)];
    this.tone('triangle', [[0, f], [0.15, f * 0.99]], 0.18, 0.14);
  }

  // шипение джетпака: шум через полосовой фильтр с "проходом" частоты
  whoosh(sec = 1) {
    if (!this.ready()) return;
    const ctx = this.ctx;
    const t0 = ctx.currentTime;
    const len = Math.ceil(ctx.sampleRate * sec);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i += 1) d[i] = Math.random() * 2 - 1;
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.Q.value = 0.8;
    bp.frequency.setValueAtTime(400, t0);
    bp.frequency.exponentialRampToValueAtTime(1600, t0 + sec * 0.3);
    bp.frequency.exponentialRampToValueAtTime(500, t0 + sec);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(0.15, t0 + 0.15);
    g.gain.setValueAtTime(0.15, t0 + sec * 0.85);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + sec);
    src.connect(bp).connect(g).connect(this.master);
    src.start(t0);
    src.stop(t0 + sec + 0.05);
  }
}
