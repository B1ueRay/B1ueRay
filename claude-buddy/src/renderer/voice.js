// Голос: озвучка через системный синтезатор (на Windows — голоса SAPI, есть русские Irina/Pavel),
// липсинк по границам слов, и запись микрофона с автоостановкой по тишине.

const VOWEL_OPEN = {
  а: [1, 0], я: [0.95, 0], a: [1, 0],
  о: [0.85, 1], ё: [0.8, 0.8], o: [0.85, 1],
  у: [0.45, 1], ю: [0.5, 0.9], u: [0.45, 1], w: [0.4, 1],
  э: [0.7, 0], е: [0.65, 0], e: [0.65, 0],
  и: [0.45, 0], ы: [0.5, 0], i: [0.45, 0], y: [0.45, 0],
};
const CLOSED = new Set(['м', 'б', 'п', 'm', 'b', 'p', 'в', 'ф', 'v', 'f']);

function visemesFor(word) {
  const out = [];
  for (const ch of word.toLowerCase()) {
    if (VOWEL_OPEN[ch]) out.push(VOWEL_OPEN[ch]);
    else if (CLOSED.has(ch)) out.push([0.02, 0]);
    else if (/[\p{L}\p{N}]/u.test(ch)) out.push([0.22, 0]);
  }
  return out;
}

// ---------- голос под эмоцию ----------
const WIN = typeof navigator !== 'undefined' && /Windows/.test(navigator.userAgent);
// p — сдвиг высоты (шаг SAPI = 0.1), r — шаги скорости, v — множитель громкости
const PROSODY = {
  neutral: { p: 0, r: 0, v: 1 },
  happy: { p: 0.1, r: 0, v: 1 },
  laugh: { p: 0.2, r: 1, v: 1 },
  surprised: { p: 0.3, r: 0, v: 1 },
  sad: { p: -0.2, r: -1, v: 0.8 },
  angry: { p: -0.1, r: 1, v: 1 },
  thinking: { p: -0.1, r: -1, v: 0.9 },
  love: { p: 0.1, r: -1, v: 0.85 },
  smug: { p: -0.1, r: -1, v: 1 },
  sleepy: { p: -0.3, r: -2, v: 0.6 },
  scared: { p: 0.3, r: 1, v: 0.9 },
  embarrassed: { p: 0.1, r: 0, v: 0.7 },
  wink: { p: 0.1, r: 0, v: 1 },
};
// Chromium на Windows квантует скорость SAPI: шаг = trunc(10*log10(rate)). Нейтральная фраза звучит как раньше.
function stepRate(base, steps) {
  if (!WIN) return Math.min(2, Math.max(0.5, base * 1.12 ** steps));
  const st = Math.trunc(10 * Math.log10(base)) + steps;
  return Math.min(4, Math.max(0.3, 10 ** ((st + Math.sign(st) * 0.05) / 10)));
}
// пауза после фразы — по последнему знаку
function pauseAfter(text, emotion) {
  const t = text.trim();
  let ms = 120;
  if (/(…|\.\.\.)["»)]?$/.test(t)) ms = 420;
  else if (/\?["»)]?$/.test(t)) ms = 220;
  else if (/!["»)]?$/.test(t)) ms = 160;
  else if (/,$/.test(t)) ms = 40;
  return emotion === 'sleepy' || emotion === 'sad' ? ms * 1.5 : ms;
}

export class Voice {
  constructor() {
    this.synth = window.speechSynthesis || null;
    this.voices = [];
    this.cfg = { muted: false, voiceName: '', voicePitch: 1.3, voiceRate: 1.08, voiceVolume: 1, language: 'ru' };
    this.queue = [];
    this.busy = false;
    this.speaking = false;
    this.timeline = [];
    this.uttStart = 0;
    this.gotBoundary = false;
    this.fakeUntil = 0;
    this.open = 0;
    this.round = 0;
    this.onSentenceStart = null;
    this.onIdle = null;
    this.gen = 0; // растёт на каждом stop(): старые таймеры очереди узнают, что они устарели
    this.nextTimer = 0;
    if (this.synth) {
      const load = () => {
        this.voices = this.synth.getVoices();
      };
      load();
      this.synth.addEventListener?.('voiceschanged', load);
    }
  }

  configure(cfg) {
    Object.assign(this.cfg, cfg);
  }

  pickVoice(text = '') {
    if (!this.voices.length && this.synth) this.voices = this.synth.getVoices();
    const { voiceName, language } = this.cfg;
    if (voiceName) {
      const v = this.voices.find((x) => x.name === voiceName);
      if (v) return v;
    }
    const lang = (language || 'ru').toLowerCase();
    return (
      this.voices.find((v) => v.lang.toLowerCase().startsWith(lang) && /natural|neural/i.test(v.name)) ||
      this.voices.find((v) => v.lang.toLowerCase().startsWith(lang)) ||
      // английский голос кириллицу коверкает/пропускает — для русского текста лучше немой режим с подсказкой
      (/[а-яё]/i.test(text) ? null : this.voices.find((v) => v.default)) ||
      null
    );
  }

  // В очередь: {text, emotion, micro}
  enqueue(item) {
    this.queue.push(item);
    if (!this.busy) this.next();
  }

  // Сказать прямо сейчас (с обрывом текущего), вернуть промис окончания
  say(text, opts = {}) {
    this.stop();
    return new Promise((resolve) => {
      this.enqueue({ text, ...opts, done: resolve });
    });
  }

  stop() {
    this.gen += 1;
    clearTimeout(this.nextTimer);
    clearTimeout(this.startTimer);
    this.utt = null;
    const pending = this.queue;
    this.queue = [];
    pending.forEach((q) => q.done?.());
    if (this.current) {
      const c = this.current;
      this.current = null;
      c.done?.();
    }
    if (this.synth) this.synth.cancel();
    this.busy = false;
    this.speaking = false;
    this.timeline = [];
    this.fakeUntil = 0;
    clearTimeout(this.safety);
  }

  get active() {
    return this.busy || this.queue.length > 0;
  }

  next() {
    const item = this.queue.shift();
    if (!item) {
      this.busy = false;
      this.speaking = false;
      this.onIdle?.();
      return;
    }
    this.busy = true;
    this.current = item;
    const text = item.text.trim();
    this.onSentenceStart?.(item);
    const finish = () => {
      if (this.current !== item) return;
      clearTimeout(this.safety);
      clearTimeout(this.startTimer);
      this.utt = null;
      this.current = null;
      this.speaking = false;
      this.timeline = [];
      this.fakeUntil = 0;
      item.done?.();
      const gen = this.gen;
      this.nextTimer = setTimeout(() => {
        if (gen === this.gen) this.next();
      }, item.micro ? 60 : pauseAfter(text, item.emotion));
    };

    const voice = this.pickVoice(text);
    const estimate = 0.4 + text.length * 0.075;
    if (!voice && this.synth && !this.cfg.muted && text && !this.warnedNoVoice && this.voices.length) {
      this.warnedNoVoice = true;
      this.onNoVoice?.();
    }
    if (this.cfg.muted || !this.synth || !voice || !text) {
      // без звука — рот всё равно шевелится в такт "чтению"
      this.speaking = Boolean(text);
      this.uttStart = performance.now() / 1000;
      this.fakeUntil = this.uttStart + Math.min(12, estimate * 0.85);
      this.gotBoundary = false;
      this.safety = setTimeout(finish, Math.min(12, estimate * 0.85) * 1000);
      return;
    }

    const u = new SpeechSynthesisUtterance(text);
    u.voice = voice;
    u.lang = voice.lang;
    const micro = item.micro;
    const P = PROSODY[item.emotion] || PROSODY.neutral;
    // лёгкий разброс высоты и чуть выше на вопросах — чтобы не звучать роботом
    const jit = [-0.1, 0, 0, 0.1][Math.floor(Math.random() * 4)];
    const q = /\?["»)]?$/.test(text) ? 0.1 : 0;
    // шаг SAPI = trunc(pitch*10-10): ниже 1.0 сдвигаем вниз, выше — вверх, чтобы не съедало шаг
    const pv = Math.round((this.cfg.voicePitch + P.p + jit + q) * 10) / 10;
    const pitch = Math.min(2, Math.max(0.5, pv + (pv < 1 ? -0.005 : 0.005)));
    u.pitch = micro ? 2 : pitch;
    u.rate = micro ? Math.min(2, this.cfg.voiceRate * 1.25) : stepRate(this.cfg.voiceRate, P.r);
    u.volume = micro ? Math.min(1, this.cfg.voiceVolume * 0.75) : Math.min(1, this.cfg.voiceVolume * P.v);
    this.mouthGain = micro ? 1 : P.v; // тихий/сонный голос — и рот открывается меньше
    this.utt = u; // держим ссылку: иначе сборщик мусора съедает utterance и onend теряется (Chromium)
    u.onstart = () => {
      clearTimeout(this.startTimer);
      this.speaking = true;
      this.uttStart = performance.now() / 1000;
      this.gotBoundary = false;
      this.timeline = [];
    };
    u.onboundary = (ev) => {
      if (ev.name && ev.name !== 'word') return;
      this.gotBoundary = true;
      const rest = text.slice(ev.charIndex);
      const word = (ev.charLength ? rest.slice(0, ev.charLength) : rest.match(/^[\p{L}\p{N}'-]+/u)?.[0]) || '';
      const vis = visemesFor(word);
      const now = performance.now() / 1000;
      const per = 0.072 / u.rate;
      const g = 0.55 + 0.45 * (this.mouthGain ?? 1);
      this.timeline = vis.map(([open, round], i) => ({ t: now + i * per, open: open * g, round }));
      this.timeline.push({ t: now + vis.length * per, open: 0.05, round: 0 });
    };
    u.onend = finish;
    u.onerror = finish;
    // движок завис посреди фразы — отменяем и идём дальше, а не ждём следующую в очереди
    this.safety = setTimeout(() => {
      u.onend = null;
      u.onerror = null;
      this.synth.cancel();
      finish();
    }, (estimate / u.rate) * 1000 * 1.8 + 2500);
    // движок так и не начал говорить — переходим на "немой" рот, чтобы бадди не застыл
    this.startTimer = setTimeout(() => {
      if (this.current !== item || this.speaking) return;
      u.onend = null;
      u.onerror = null;
      u.onstart = null; // отменённая фраза, стартовавшая с опозданием, не должна дёргать рот следующей
      u.onboundary = null;
      this.synth.cancel();
      this.speaking = true;
      this.uttStart = performance.now() / 1000;
      this.fakeUntil = this.uttStart + Math.min(12, estimate * 0.85);
      clearTimeout(this.safety);
      this.safety = setTimeout(finish, Math.min(12, estimate * 0.85) * 1000);
    }, 2000);
    this.synth.speak(u);
  }

  // вызывается каждый кадр: считаем открытие рта
  update(dt = 1 / 60) {
    const now = performance.now() / 1000;
    let target = 0;
    let round = 0;
    if (this.speaking) {
      const fallback = this.fakeUntil ? now < this.fakeUntil : !this.gotBoundary && now - this.uttStart > 0.25;
      if (this.timeline.length) {
        let cur = null;
        for (const p of this.timeline) {
          if (p.t <= now) cur = p;
          else break;
        }
        if (cur && now - cur.t < 0.25) {
          target = cur.open;
          round = cur.round;
        }
      } else if (fallback) {
        const tt = now * 13;
        target = 0.25 + 0.45 * Math.abs(Math.sin(tt)) * (0.6 + 0.4 * Math.sin(now * 3.7));
        round = Math.max(0, Math.sin(now * 2.3)) * 0.5;
      }
    }
    // сглаживание не зависит от частоты кадров (60/144/30 Гц выглядят одинаково)
    const f = Math.min(4, dt * 60);
    const k = 1 - (1 - (target > this.open ? 0.55 : 0.35)) ** f;
    this.open += (target - this.open) * k;
    this.round += (round - this.round) * (1 - 0.7 ** f);
    return { open: this.open, round: this.round };
  }
}

// ---------- микрофон ----------
export class Mic {
  constructor() {
    this.level = 0;
    this.recording = false;
  }

  async start({ onLevel, maxSec = 25, silenceMs = 1300 } = {}) {
    if (this.recording) return null;
    this.recording = true;
    // stop() до того, как микрофон открылся, тоже должен сработать
    let cancelled = false;
    this.stop = () => {
      cancelled = true;
    };
    let stream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } });
    } catch (err) {
      this.recording = false;
      throw err;
    }
    if (cancelled) {
      stream.getTracks().forEach((tr) => tr.stop());
      this.recording = false;
      return null;
    }
    const ctx = new AudioContext();
    const src = ctx.createMediaStreamSource(stream);
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 1024;
    src.connect(analyser);
    const buf = new Float32Array(analyser.fftSize);
    const mime = ['audio/webm;codecs=opus', 'audio/webm', 'audio/ogg;codecs=opus'].find((m) => MediaRecorder.isTypeSupported(m)) || '';
    const rec = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
    const chunks = [];
    rec.ondataavailable = (e) => e.data.size && chunks.push(e.data);

    return new Promise((resolve) => {
      const t0 = performance.now();
      let floor = 0.01;
      let speechAt = 0;
      let lastLoud = 0;
      let raf = 0;
      const cleanup = () => {
        cancelAnimationFrame(raf);
        stream.getTracks().forEach((tr) => tr.stop());
        ctx.close().catch(() => {});
        this.recording = false;
        this.level = 0;
        onLevel?.(0);
      };
      rec.onstop = () => {
        cleanup();
        if (!speechAt || !chunks.length) return resolve(null);
        resolve(new Blob(chunks, { type: rec.mimeType || 'audio/webm' }));
      };
      this.stop = () => {
        if (rec.state !== 'inactive') rec.stop();
      };
      const tick = () => {
        analyser.getFloatTimeDomainData(buf);
        let sum = 0;
        for (let i = 0; i < buf.length; i += 1) sum += buf[i] * buf[i];
        const rms = Math.sqrt(sum / buf.length);
        const now = performance.now();
        // шумовой пол меряем по первым 350 мс, но с потолком: если сразу заговорил — речь не станет "шумом"
        if (now - t0 < 350) floor = Math.min(0.02, Math.max(floor, rms));
        const thr = Math.max(0.016, floor * 2.2);
        if (rms > thr) {
          lastLoud = now;
          if (!speechAt) speechAt = now;
        }
        this.level = Math.min(1, rms * 9);
        onLevel?.(this.level);
        const quietFor = now - lastLoud;
        if ((speechAt && quietFor > silenceMs) || now - t0 > maxSec * 1000 || (!speechAt && now - t0 > 7000)) {
          this.stop();
          return;
        }
        raf = requestAnimationFrame(tick);
      };
      rec.start(250);
      raf = requestAnimationFrame(tick);
    });
  }

  stop() {
    /* переопределяется во время записи */
  }
}
