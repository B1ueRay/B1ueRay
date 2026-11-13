/**
 * Kurazh Sound Kit — synthesized UI sounds for the Kurazh PWA.
 * "Call it or do it."
 *
 * Self-contained: Web Audio only, no audio files, no libraries. Load with
 * <script src="sound.js"></script>; it defines `window.KurazhSound`.
 *
 * ─── API ──────────────────────────────────────────────────────────────────
 *   KurazhSound.play(name, opts = {}) → boolean
 *       Plays a sound. Returns true if it was scheduled. Never throws.
 *       opts.volume  number 0..1 (default 1), multiplies the sound's own level.
 *       opts.delay   seconds from now (default 0). Values above 20 are read as
 *                    milliseconds, so { delay: 250 } also works.
 *       opts.pitch   semitones of transposition for musical sounds (default 0).
 *       Per-sound extras:
 *         countdown  { final: true } or { n: 0 } plays the "go" bell instead of a tick.
 *         vote       { no: true } plays the lower token (a "no" vote).
 *         heartbeat  { urgent: true } slightly higher and firmer (last 2 seconds).
 *   KurazhSound.setEnabled(bool) → boolean
 *       Turns all sound on/off, stores "on"/"off" in localStorage["kurazh.sound"].
 *       Turning on from a tap handler also unlocks audio.
 *   KurazhSound.enabled → boolean  (getter; default true unless stored "off")
 *   KurazhSound.unlock() → boolean
 *       Call inside a user gesture (tap/click/key). Creates/resumes the
 *       AudioContext (iOS Safari needs this). Auto-called on the first
 *       pointerdown / touchend / keydown / click anywhere on the page.
 *   KurazhSound.volume(v?) → number
 *       Master volume 0..1 (default 1 = the kit's gentle phone-safe level).
 *       Without an argument returns the current value.
 *
 * ─── Sonic identity ───────────────────────────────────────────────────────
 *   Key: D major, root D5 (587 Hz) — sits right in the sweet spot of phone
 *   speakers. Gold = soft FM bells (celesta/vibraphone). Green = warm low
 *   sines. Logo motif intervals: 0, +7, +4, +12 (D5 A5 F#5 D6) with a tiny
 *   "wink" A6 after the last note. Money sounds reuse these intervals.
 *
 * ─── Sounds ───────────────────────────────────────────────────────────────
 *   tap          Ultra-short soft tick for buttons/chips. Barely there.
 *   open         Sheet/drawer slides up: airy rising "fwip".
 *   close        (extra) Sheet slides down: the reverse "fwip".
 *   notify       Phone-style notification: two gold bells F#5 → D6.
 *   hold         Money frozen on the card: soft lock click "tk-chk", no tone.
 *   charge       Dare counted, hold is charged: quick gold arpeggio 0-7-12
 *                from the logo + coin glint. Confident, not flashy.
 *   release      Hold lifted, money back: soft warm A4 → D5 over a low pad.
 *                Reassuring — "all good, nothing lost".
 *   vote         Token dropped into the "Does it count?" vote. Wooden pluck.
 *   win          Dare done / big moment: the logo motif played fast, then a
 *                full D major bloom with sparkles.
 *   lose         Dare failed / not counted: gentle descending A4-F4-D4 with a
 *                small downward bend. A shrug with a wink, never mocking.
 *   live-start   Going live: short riser into a gold "on air" chord.
 *   live-end     Stream ended: calm descending D6-A5-D5 bells.
 *   dare-new     A new dare arrived: two plucks and a playful high glint.
 *   dare-accept  Taker accepted: low thump + warm brass stab + bell. "Game on."
 *   error        Something went wrong: two short muted low notes. Firm, soft-edged.
 *   blocked      Not allowed (filter, limit, 18+ gate): one low closed-door thunk.
 *   countdown    Timer tick (wood block); { final: true } = "go" bell.
 *   logo         Brand sting: D5 A5 F#5 D6 + wink, ~2 s.
 *   crow         (extra) Synthesized rooster "ko-ko-ko-kooo" with a street echo.
 *   cheer        (extra) Short crowd cheer with claps.
 *   heartbeat    (extra) One lub-dub. Call once per second in the last 5 s.
 *   role-caller  (extra) "Who are you tonight?" → Caller: decisive low A4 → D4 brass.
 *   role-taker   (extra) → Taker: brave rising plucks D4-A4-D5 into gold bells.
 *   like         (extra) Tiny rising pop for likes/hearts.
 *
 * ─── Safety ───────────────────────────────────────────────────────────────
 *   Lazy AudioContext (created on first unlock/play), never throws, no-op
 *   without Web Audio, skips sounds while the page is hidden, max 6 voices
 *   (oldest stolen with a fast fade), per-sound rate limits, highpass +
 *   compressor + limiter on the master bus, conservative default level.
 *   On Safari 17+ sets navigator.audioSession.type = "ambient" so UI sounds
 *   mix with the user's music and respect the silent switch.
 *   Sound never carries meaning alone: always pair it with visible UI
 *   (and haptics where available).
 */
(function (root) {
  'use strict';
  if (!root || root.KurazhSound) return;

  var STORE_KEY = 'kurazh.sound';
  var AC = root.AudioContext || root.webkitAudioContext || null;
  var ROOT_HZ = 587.33;            // D5
  var LOGO = [0, 7, 4, 12];        // brand intervals (semitones from D5)
  var BASE_LEVEL = 0.72;           // headroom for phone speakers
  var MAX_VOICES = 6;

  var ctx = null, bus = null, master = null, fxIn = null, noiseBuf = null;
  var enabled = readStored();
  var userVol = 1;
  var voices = [];
  var lastAt = {};
  var silentPlayed = false;

  function noop() {}
  function num(v, d) { v = Number(v); return isFinite(v) ? v : d; }
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }

  function readStored() {
    try { return root.localStorage.getItem(STORE_KEY) !== 'off'; } catch (e) { return true; }
  }
  function writeStored(on) {
    try { root.localStorage.setItem(STORE_KEY, on ? 'on' : 'off'); } catch (e) { /* private mode */ }
  }

  // ─── Context & master graph ────────────────────────────────────────────
  function ensure() {
    if (ctx) return ctx;
    if (!AC) return null;
    try {
      try { ctx = new AC({ latencyHint: 'interactive' }); } catch (e) { ctx = new AC(); }
      try { if (root.navigator && root.navigator.audioSession) root.navigator.audioSession.type = 'ambient'; } catch (e) { /* optional */ }

      bus = ctx.createGain();
      var hp = ctx.createBiquadFilter();       // phone speakers can't do sub-bass; don't waste energy
      hp.type = 'highpass'; hp.frequency.value = 90; hp.Q.value = 0.7;
      var comp = ctx.createDynamicsCompressor();
      setP(comp.threshold, -20); setP(comp.knee, 10); setP(comp.ratio, 3.5);
      setP(comp.attack, 0.004); setP(comp.release, 0.18);
      var lim = ctx.createDynamicsCompressor();
      setP(lim.threshold, -4); setP(lim.knee, 0); setP(lim.ratio, 20);
      setP(lim.attack, 0.001); setP(lim.release, 0.08);
      master = ctx.createGain();
      master.gain.value = userVol * BASE_LEVEL;
      bus.connect(hp); hp.connect(comp); comp.connect(lim); lim.connect(master); master.connect(ctx.destination);

      // Cheap ambience: two short filtered feedback delays (no convolver).
      fxIn = ctx.createGain();
      var wet = ctx.createGain(); wet.gain.value = 0.5; wet.connect(bus);
      [[0.083, 0.3, 3200], [0.131, 0.26, 2400]].forEach(function (c) {
        var d = ctx.createDelay(0.5); d.delayTime.value = c[0];
        var lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = c[2];
        var fb = ctx.createGain(); fb.gain.value = c[1];
        fxIn.connect(d); d.connect(lp); lp.connect(fb); fb.connect(d); lp.connect(wet);
      });

      var len = Math.floor(ctx.sampleRate);
      noiseBuf = ctx.createBuffer(1, len, ctx.sampleRate);
      var ch = noiseBuf.getChannelData(0);
      for (var i = 0; i < len; i++) ch[i] = Math.random() * 2 - 1;
    } catch (e) {
      ctx = null;
    }
    return ctx;
  }
  function setP(p, v) { try { p.value = v; } catch (e) { /* ignore */ } }

  function resume() {
    try {
      if (!ctx || ctx.state === 'running' || ctx.state === 'closed') return Promise.resolve();
      var p = ctx.resume();
      return p && typeof p.then === 'function' ? p.catch(noop) : Promise.resolve();
    } catch (e) { return Promise.resolve(); }
  }

  function unlock() {
    try {
      if (!ensure()) return false;
      resume();
      if (!silentPlayed) {              // classic iOS unlock: play 1 silent sample in the gesture
        var b = ctx.createBuffer(1, 1, 22050);
        var s = ctx.createBufferSource();
        s.buffer = b; s.connect(ctx.destination); s.start(0);
        silentPlayed = true;
      }
      return ctx.state === 'running';
    } catch (e) { return false; }
  }

  // ─── Voices ────────────────────────────────────────────────────────────
  function prune(now) {
    for (var i = voices.length - 1; i >= 0; i--) if (voices[i].end < now) voices.splice(i, 1);
  }
  function release(v, ms) {
    setTimeout(function () {
      try { v.out.disconnect(); } catch (e) { /* ignore */ }
      try { if (v.fx) v.fx.disconnect(); } catch (e) { /* ignore */ }
    }, Math.max(50, ms));
  }
  function kill(v, at) {
    // Fade from `at` (now, or the start of the sound that replaces this voice).
    try {
      [v.out, v.fx].forEach(function (g) {
        if (!g) return;
        g.gain.cancelScheduledValues(at);
        g.gain.setValueAtTime(v.vol, at);
        g.gain.setTargetAtTime(0, at, 0.012);
      });
    } catch (e) { /* ignore */ }
    var i = voices.indexOf(v);
    if (i >= 0) voices.splice(i, 1);
    v.end = at + 0.06;
    release(v, (v.end - ctx.currentTime) * 1000 + 120);
  }
  function killAll() {
    if (!ctx) return;
    var now = ctx.currentTime;
    voices.slice().forEach(function (v) { kill(v, now); });
  }

  // ─── Synthesis kit (per voice) ─────────────────────────────────────────
  function kit(v) {
    var pm = Math.pow(2, v.pitch / 12);
    var k = { pm: pm, out: v.out };

    function sendOf(node, amt) {
      if (!amt) return;
      if (!v.fx) { v.fx = ctx.createGain(); v.fx.gain.value = v.vol; v.fx.connect(fxIn); }
      var s = ctx.createGain(); s.gain.value = amt; node.connect(s); s.connect(v.fx);
    }
    function env(p, t, a, h, d, peak) {
      p.setValueAtTime(0, t);
      p.linearRampToValueAtTime(peak, t + a);
      if (h) p.setValueAtTime(peak, t + a + h);
      p.exponentialRampToValueAtTime(0.0001, t + a + h + d);
      return t + a + h + d;
    }
    k.env = env;
    k.send = sendOf;
    k.hz = function (semi) { return ROOT_HZ * Math.pow(2, semi / 12) * pm; };

    /** Oscillator with AD(H) envelope, optional glide and lowpass. */
    k.osc = function (p) {
      var t = p.t, a = p.a == null ? 0.005 : p.a, h = p.h || 0, d = p.d == null ? 0.2 : p.d;
      var o = ctx.createOscillator();
      o.type = p.type || 'sine';
      o.frequency.setValueAtTime(p.f, t);
      if (p.to) o.frequency.exponentialRampToValueAtTime(p.to, t + (p.glide || a + h + d));
      if (p.detune) o.detune.value = p.detune;
      var g = ctx.createGain();
      var end = env(g.gain, t, a, h, d, p.peak);
      var n = o;
      if (p.lp) {
        var f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.Q.value = p.q || 0.7;
        f.frequency.setValueAtTime(p.lp, t);
        if (p.lpTo) f.frequency.exponentialRampToValueAtTime(p.lpTo, end);
        o.connect(f); n = f;
      }
      n.connect(g); g.connect(p.dest || v.out); sendOf(g, p.send);
      o.start(t); o.stop(end + 0.03);
      return o;
    };

    /** Gold bell: 2-op FM (ratio 4, decaying index) + octave + faint inharmonic glint. */
    k.bell = function (f, t, dur, peak, send) {
      var car = ctx.createOscillator(); car.frequency.value = f;
      var mod = ctx.createOscillator(); mod.frequency.value = f * 4;
      var mi = ctx.createGain();
      mi.gain.setValueAtTime(f * 1.4, t);
      mi.gain.exponentialRampToValueAtTime(f * 0.08, t + Math.min(0.35, dur * 0.5));
      mod.connect(mi); mi.connect(car.frequency);
      var g = ctx.createGain(); var end = env(g.gain, t, 0.004, 0, dur, peak);
      car.connect(g);
      var o2 = ctx.createOscillator(); o2.frequency.value = f * 2;
      var g2 = ctx.createGain(); env(g2.gain, t, 0.003, 0, dur * 0.45, peak * 0.22);
      o2.connect(g2); g2.connect(g);
      var o3 = ctx.createOscillator(); o3.frequency.value = f * 5.43;
      var g3 = ctx.createGain(); env(g3.gain, t, 0.002, 0, 0.12, peak * 0.07);
      o3.connect(g3); g3.connect(g);
      g.connect(v.out); sendOf(g, send == null ? 0.25 : send);
      [car, mod, o2, o3].forEach(function (o) { o.start(t); o.stop(end + 0.03); });
    };

    /** Plucked/wooden note: triangle through a closing lowpass. */
    k.pluck = function (f, t, peak, dur, send) {
      dur = dur || 0.25;
      k.osc({ type: 'triangle', f: f, t: t, a: 0.002, d: dur, peak: peak, lp: f * 6, lpTo: f * 1.1, send: send });
      k.osc({ type: 'sine', f: f * 2, t: t, a: 0.002, d: dur * 0.4, peak: peak * 0.25 });
    };

    /** Low body thump with pitch drop. */
    k.thump = function (f0, f1, t, d, peak) {
      k.osc({ type: 'sine', f: f0, to: f1, glide: d, t: t, a: 0.002, d: d, peak: peak });
    };

    /** Filtered noise burst/sweep from the shared buffer. */
    k.noise = function (p) {
      var t = p.t, a = p.a == null ? 0.002 : p.a, h = p.h || 0, d = p.d == null ? 0.05 : p.d;
      var src = ctx.createBufferSource(); src.buffer = noiseBuf; src.loop = true;
      var f = ctx.createBiquadFilter(); f.type = p.type || 'bandpass'; f.Q.value = p.q || 1;
      f.frequency.setValueAtTime(p.f || 1000, t);
      var g = ctx.createGain();
      var end = env(g.gain, t, a, h, d, p.peak);
      if (p.to) f.frequency.exponentialRampToValueAtTime(p.to, end);
      src.connect(f); f.connect(g); g.connect(p.dest || v.out); sendOf(g, p.send);
      src.start(t, Math.random() * 0.8); src.stop(end + 0.03);
      return g;
    };

    /** Warm brass-ish stab: two detuned saws through a lowpass with its own envelope. */
    k.brass = function (f, t, p) {
      var a = p.a || 0.02, h = p.h || 0.06, d = p.d || 0.3;
      var flt = ctx.createBiquadFilter(); flt.type = 'lowpass'; flt.Q.value = 1.1;
      flt.frequency.setValueAtTime(p.lp0 || 400, t);
      flt.frequency.exponentialRampToValueAtTime(p.lp1 || 2400, t + a + 0.02);
      flt.frequency.exponentialRampToValueAtTime(p.lp2 || 600, t + a + h + d);
      var g = ctx.createGain(); var end = env(g.gain, t, a, h, d, p.peak);
      flt.connect(g); g.connect(v.out); sendOf(g, p.send);
      [-7, 7].forEach(function (dt) {
        var o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = f; o.detune.value = dt;
        o.connect(flt); o.start(t); o.stop(end + 0.03);
      });
    };

    return k;
  }

  // ─── Recipes: fn(k, t, opts) returns duration in seconds ───────────────
  var R = {
    'tap': { gap: 0.025, poly: 4, fn: function (k, t) {
      k.osc({ f: 1500 * k.pm, to: 950 * k.pm, t: t, a: 0.002, d: 0.035, peak: 0.28 });
      k.noise({ t: t, type: 'highpass', f: 5000, a: 0.001, d: 0.012, peak: 0.05 });
      return 0.06;
    } },

    'open': { gap: 0.08, fn: function (k, t) {
      k.noise({ t: t, f: 500, to: 2400, q: 0.9, a: 0.06, d: 0.16, peak: 0.16 });
      k.osc({ f: k.hz(-5), to: k.hz(0), t: t, a: 0.02, d: 0.18, peak: 0.07, send: 0.2 });
      return 0.3;
    } },

    'close': { gap: 0.08, fn: function (k, t) {
      k.noise({ t: t, f: 2200, to: 500, q: 0.9, a: 0.03, d: 0.16, peak: 0.13 });
      k.osc({ f: k.hz(0), to: k.hz(-5), t: t, a: 0.01, d: 0.16, peak: 0.06 });
      return 0.28;
    } },

    'notify': { gap: 0.25, fn: function (k, t) {
      k.bell(k.hz(4), t, 0.9, 0.3, 0.25);
      k.bell(k.hz(12), t + 0.13, 1.3, 0.28, 0.3);
      return 1.5;
    } },

    'hold': { gap: 0.05, fn: function (k, t) {
      k.noise({ t: t, f: 2600, q: 1.5, a: 0.001, d: 0.02, peak: 0.28 });          // "tk"
      k.thump(260 * k.pm, 110 * k.pm, t + 0.028, 0.07, 0.3);                     // body
      k.noise({ t: t + 0.03, f: 1400, q: 2, a: 0.001, d: 0.03, peak: 0.16 });      // "chk"
      k.osc({ type: 'triangle', f: 1900 * k.pm, t: t + 0.03, a: 0.001, d: 0.015, peak: 0.05 });
      return 0.15;
    } },

    'charge': { gap: 0.2, fn: function (k, t) {
      k.thump(180 * k.pm, 90 * k.pm, t, 0.1, 0.22);
      k.bell(k.hz(0), t, 0.4, 0.2, 0.2);
      k.bell(k.hz(7), t + 0.07, 0.45, 0.22, 0.2);
      k.bell(k.hz(12), t + 0.14, 1.0, 0.27, 0.3);
      k.noise({ t: t + 0.14, type: 'highpass', f: 6500, a: 0.002, d: 0.12, peak: 0.045 });
      return 1.2;
    } },

    'release': { gap: 0.2, fn: function (k, t) {
      k.noise({ t: t, f: 900, q: 1, a: 0.004, d: 0.05, peak: 0.07 });             // soft unlatch
      k.osc({ f: k.hz(-12), t: t, a: 0.06, h: 0.1, d: 0.75, peak: 0.11 });         // warm pad D4
      k.osc({ type: 'triangle', f: k.hz(-5), t: t + 0.05, a: 0.03, d: 0.45, peak: 0.1, lp: 1800, send: 0.25 });
      k.osc({ type: 'triangle', f: k.hz(0), t: t + 0.22, a: 0.03, d: 0.7, peak: 0.11, lp: 2000, send: 0.3 });
      return 1.1;
    } },

    'vote': { gap: 0.04, poly: 3, fn: function (k, t, o) {
      k.pluck(k.hz(o.no ? 0 : 7), t, 0.34, 0.25, 0.15);
      k.noise({ t: t, f: 1800, q: 3, a: 0.001, d: 0.02, peak: 0.09 });
      return 0.35;
    } },

    'win': { gap: 0.4, fn: function (k, t) {
      LOGO.forEach(function (s, i) { k.bell(k.hz(s), t + i * 0.09, i === 3 ? 1.6 : 0.5, 0.2, 0.3); });
      var c = t + 0.36;
      k.bell(k.hz(0), c, 1.6, 0.15, 0.3);
      k.bell(k.hz(4), c, 1.5, 0.12, 0.3);
      k.bell(k.hz(7), c, 1.5, 0.12, 0.3);
      k.osc({ f: k.hz(-12), t: c, a: 0.02, d: 1.4, peak: 0.13 });
      [16, 19, 24].forEach(function (s, i) { k.bell(k.hz(s), t + 0.52 + i * 0.06, 0.4, 0.055, 0.4); });
      k.noise({ t: c, type: 'highpass', f: 7000, a: 0.3, d: 0.8, peak: 0.025 });
      return 2.2;
    } },

    'lose': { gap: 0.4, fn: function (k, t) {
      k.osc({ type: 'triangle', f: k.hz(-5), t: t, a: 0.01, h: 0.08, d: 0.2, peak: 0.145, lp: 1100, send: 0.2 });
      k.osc({ type: 'triangle', f: k.hz(-9), t: t + 0.2, a: 0.01, h: 0.08, d: 0.2, peak: 0.14, lp: 1100, send: 0.2 });
      k.osc({ type: 'triangle', f: k.hz(-12), to: k.hz(-13), glide: 0.65, t: t + 0.4, a: 0.01, h: 0.1, d: 0.55, peak: 0.145, lp: 1000, send: 0.25 });
      return 1.2;
    } },

    'live-start': { gap: 0.8, fn: function (k, t) {
      k.noise({ t: t, f: 300, to: 3200, q: 1.2, a: 0.35, d: 0.05, peak: 0.11 });
      k.osc({ f: k.hz(-12), to: k.hz(0), glide: 0.35, t: t, a: 0.35, d: 0.05, peak: 0.05 });
      var h = t + 0.38;
      k.thump(160 * k.pm, 70 * k.pm, h, 0.18, 0.3);
      k.bell(k.hz(0), h, 1.2, 0.24, 0.3);
      k.bell(k.hz(7), h, 1.1, 0.16, 0.3);
      k.bell(k.hz(12), h + 0.12, 1.2, 0.2, 0.35);
      return 1.8;
    } },

    'live-end': { gap: 0.8, fn: function (k, t) {
      k.bell(k.hz(12), t, 0.9, 0.2, 0.3);
      k.bell(k.hz(7), t + 0.16, 1.0, 0.19, 0.3);
      k.bell(k.hz(0), t + 0.32, 1.4, 0.2, 0.35);
      k.osc({ f: k.hz(-12), t: t + 0.32, a: 0.05, d: 1.2, peak: 0.1 });
      k.noise({ t: t, type: 'lowpass', f: 1200, to: 300, a: 0.02, d: 0.6, peak: 0.04 });
      return 1.9;
    } },

    'dare-new': { gap: 0.3, fn: function (k, t) {
      k.pluck(k.hz(7), t, 0.24, 0.22, 0.15);
      k.pluck(k.hz(12), t + 0.085, 0.26, 0.28, 0.2);
      k.bell(k.hz(16), t + 0.2, 0.6, 0.09, 0.4);                                  // the wink
      return 0.9;
    } },

    'dare-accept': { gap: 0.4, fn: function (k, t) {
      k.thump(170 * k.pm, 60 * k.pm, t, 0.2, 0.32);
      [-12, -5, 0].forEach(function (s) { k.brass(k.hz(s), t, { a: 0.02, h: 0.08, d: 0.35, peak: 0.075, send: 0.2 }); });
      k.bell(k.hz(12), t + 0.06, 0.9, 0.15, 0.3);
      return 1.0;
    } },

    'error': { gap: 0.2, fn: function (k, t) {
      [0, 0.13].forEach(function (dt) {
        k.osc({ type: 'triangle', f: k.hz(-9), t: t + dt, a: 0.004, h: 0.05, d: 0.06, peak: 0.19, lp: 900 });
        k.osc({ type: 'square', f: k.hz(-21), t: t + dt, a: 0.004, h: 0.04, d: 0.05, peak: 0.03, lp: 600 });
      });
      return 0.35;
    } },

    'blocked': { gap: 0.2, fn: function (k, t) {
      k.thump(220 * k.pm, 120 * k.pm, t, 0.12, 0.28);
      k.osc({ type: 'triangle', f: k.hz(-14), t: t, a: 0.004, h: 0.06, d: 0.18, peak: 0.24, lp: 800 });
      k.noise({ t: t, type: 'lowpass', f: 800, a: 0.001, d: 0.05, peak: 0.11 });
      return 0.4;
    } },

    'countdown': { gap: 0.12, poly: 3, fn: function (k, t, o) {
      if (o.final || o.n === 0) {
        k.thump(200 * k.pm, 90 * k.pm, t, 0.1, 0.2);
        k.bell(k.hz(12), t, 1.0, 0.28, 0.3);
        k.bell(k.hz(0), t, 0.9, 0.15, 0.25);
        return 1.1;
      }
      k.osc({ f: 1180 * k.pm, to: 1100 * k.pm, t: t, a: 0.001, d: 0.06, peak: 0.42 });
      k.noise({ t: t, f: 2500, q: 2, a: 0.001, d: 0.015, peak: 0.14 });
      return 0.12;
    } },

    'logo': { gap: 1, fn: function (k, t) {
      var at = [0, 0.14, 0.28, 0.46], dur = [0.7, 0.7, 0.6, 2.0], pk = [0.25, 0.25, 0.21, 0.29];
      LOGO.forEach(function (s, i) { k.bell(k.hz(s), t + at[i], dur[i], pk[i], 0.35); });
      var l = t + 0.46;
      k.osc({ f: k.hz(-12), t: l, a: 0.03, d: 1.6, peak: 0.12 });
      k.osc({ type: 'triangle', f: k.hz(-5), t: l, a: 0.03, d: 1.4, peak: 0.06, lp: 1500 });
      k.bell(k.hz(19), t + 0.74, 0.5, 0.065, 0.45);                              // wink
      return 2.4;
    } },

    'crow': { gap: 1, poly: 1, fn: function (k, t) {
      // ko — ko — ko — kooooo: one continuous raspy voice, gated into syllables.
      var pm = k.pm, D = 1.3;
      var contour = [[0, 560, 1], [0.11, 760], [0.15, 740, 1], [0.26, 860], [0.3, 820, 1], [0.43, 980],
                     [0.48, 1000, 1], [0.6, 1110], [0.92, 1080], [D, 720]];
      var amp = ctx.createGain();
      amp.gain.setValueAtTime(0, t);
      [[0, 0.11], [0.15, 0.11], [0.3, 0.13], [0.48, D - 0.48]].forEach(function (s, i) {
        var a = t + s[0], e = a + s[1], pk = i === 3 ? 0.34 : 0.28;
        amp.gain.setValueAtTime(0, a);
        amp.gain.linearRampToValueAtTime(pk, a + 0.02);
        if (i === 3) amp.gain.setValueAtTime(pk, a + 0.4);
        amp.gain.linearRampToValueAtTime(0.0001, e);
      });
      var f1 = ctx.createBiquadFilter(); f1.type = 'bandpass'; f1.frequency.value = 1150; f1.Q.value = 4;
      var f2 = ctx.createBiquadFilter(); f2.type = 'bandpass'; f2.frequency.value = 2500; f2.Q.value = 5;
      var lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 2600;
      [[f1, 1.2], [f2, 0.7], [lp, 0.18]].forEach(function (b) {
        var g = ctx.createGain(); g.gain.value = b[1]; b[0].connect(g); g.connect(amp);
      });
      var lfo = ctx.createOscillator(); lfo.frequency.value = 6.5;
      var lg = ctx.createGain(); lg.gain.value = 16 * pm; lfo.connect(lg);
      [0, 14].forEach(function (det, i) {               // second saw slightly detuned = rasp
        var o = ctx.createOscillator(); o.type = 'sawtooth'; o.detune.value = det;
        contour.forEach(function (c) {
          if (c[2]) o.frequency.setValueAtTime(c[1] * pm, t + c[0]);
          else o.frequency.linearRampToValueAtTime(c[1] * pm, t + c[0]);
        });
        lg.connect(o.frequency);
        var g = ctx.createGain(); g.gain.value = i ? 0.5 : 1;
        o.connect(g); g.connect(f1); g.connect(f2); g.connect(lp);
        o.start(t); o.stop(t + D + 0.05);
      });
      lfo.start(t); lfo.stop(t + D + 0.05);
      k.noise({ t: t, f: 2600, q: 2, a: 0.02, h: D - 0.3, d: 0.2, peak: 0.03, dest: amp });   // breath
      amp.connect(k.out); k.send(amp, 0.45);                                                 // street echo
      return D + 0.6;
    } },

    'cheer': { gap: 1, poly: 1, fn: function (k, t) {
      var D = 1.9;
      [[450, 0.11], [1000, 0.09], [2300, 0.05]].forEach(function (b) {
        var g = k.noise({ t: t, f: b[0], q: 1.1, a: 0.25, h: 0.9, d: D - 1.15, peak: b[1], send: 0.2 });
        for (var x = t + 0.3; x < t + 1.1; x += 0.07) g.gain.linearRampToValueAtTime(b[1] * (0.7 + Math.random() * 0.45), x);
        g.gain.linearRampToValueAtTime(b[1], t + 1.15);
        g.gain.exponentialRampToValueAtTime(0.0001, t + D);
      });
      var vf = ctx.createBiquadFilter(); vf.type = 'bandpass'; vf.frequency.value = 850; vf.Q.value = 0.9;
      vf.connect(k.out);
      for (var i = 0; i < 6; i++) {
        var f = (180 + Math.random() * 260) * k.pm;
        var o = ctx.createOscillator(); o.type = 'sawtooth';
        o.frequency.setValueAtTime(f * 0.9, t);
        o.frequency.linearRampToValueAtTime(f * 1.08, t + 0.35);
        o.frequency.linearRampToValueAtTime(f, t + 1.2);
        o.frequency.linearRampToValueAtTime(f * 0.85, t + D);
        var g = ctx.createGain(); k.env(g.gain, t + Math.random() * 0.1, 0.2, 0.5, 1.0, 0.03);
        o.connect(g); g.connect(vf); o.start(t); o.stop(t + D + 0.05);
      }
      var cf = ctx.createBiquadFilter(); cf.type = 'bandpass'; cf.frequency.value = 1400; cf.Q.value = 0.7;
      cf.connect(k.out);
      for (var j = 0; j < 18; j++) {
        k.noise({ t: t + 0.15 + Math.random() * 1.3, type: 'highpass', f: 400, a: 0.001, d: 0.03, peak: 0.07 + Math.random() * 0.05, dest: cf });
      }
      return D + 0.3;
    } },

    'heartbeat': { gap: 0.3, poly: 2, fn: function (k, t, o) {
      var u = o.urgent ? 1.2 : 1, pm = k.pm * (o.urgent ? 1.06 : 1);
      [[0, 1], [0.2, 0.7]].forEach(function (b) {
        var s = t + b[0], p = b[1] * u;
        k.osc({ f: 120 * pm, to: 55 * pm, t: s, a: 0.005, d: 0.14, peak: 0.45 * p });
        k.osc({ type: 'triangle', f: 240 * pm, to: 110 * pm, t: s, a: 0.004, d: 0.1, peak: 0.16 * p, lp: 500 });
      });
      return 0.5;
    } },

    'role-caller': { gap: 0.4, fn: function (k, t) {
      k.brass(k.hz(-5), t, { a: 0.02, h: 0.1, d: 0.25, peak: 0.12, lp1: 1800, send: 0.2 });
      k.brass(k.hz(-12), t + 0.17, { a: 0.02, h: 0.2, d: 0.5, peak: 0.13, lp1: 1600, send: 0.25 });
      k.thump(150 * k.pm, 70 * k.pm, t + 0.17, 0.16, 0.24);
      k.bell(k.hz(0), t + 0.17, 0.9, 0.12, 0.3);
      return 1.2;
    } },

    'role-taker': { gap: 0.4, fn: function (k, t) {
      [-12, -5, 0].forEach(function (s, i) { k.pluck(k.hz(s), t + i * 0.07, 0.2 + i * 0.03, 0.22, 0.15); });
      k.bell(k.hz(7), t + 0.21, 0.8, 0.18, 0.3);
      k.bell(k.hz(12), t + 0.3, 1.0, 0.2, 0.35);
      return 1.3;
    } },

    'like': { gap: 0.05, poly: 4, fn: function (k, t) {
      k.osc({ f: 600 * k.pm, to: 1400 * k.pm, t: t, a: 0.002, d: 0.07, peak: 0.16 });
      k.osc({ type: 'triangle', f: k.hz(16), t: t + 0.03, a: 0.002, d: 0.08, peak: 0.04 });
      return 0.12;
    } }
  };

  // ─── Scheduling ────────────────────────────────────────────────────────
  function schedule(name, r, opts, delay) {
    var now = ctx.currentTime;
    var t0 = now + 0.006 + delay;
    var gap = r.gap || 0.03;
    if (lastAt[name] != null && Math.abs(t0 - lastAt[name]) < gap) return false;
    prune(now);
    // Only voices sounding at t0 compete (sounds scheduled for later are left alone).
    var live = function () { return voices.filter(function (x) { return x.start <= t0 + 0.001 && x.end > t0; }); };
    var same = live().filter(function (x) { return x.name === name; });
    if (same.length >= (r.poly || 2)) kill(same[0], t0);
    for (var busy = live(); busy.length >= MAX_VOICES; busy = live()) kill(busy[0], t0);

    var vol = clamp(num(opts.volume, 1), 0, 1.5);
    if (vol <= 0) return false;
    lastAt[name] = t0;
    var v = { name: name, start: t0, vol: vol, pitch: clamp(num(opts.pitch, 0), -24, 24), out: ctx.createGain(), fx: null, end: t0 };
    v.out.gain.value = vol;
    v.out.connect(bus);
    var k = kit(v);
    var dur = num(r.fn(k, t0, opts), 1);
    v.end = t0 + dur;
    voices.push(v);
    release(v, (v.end - now + 0.6) * 1000);
    return true;
  }

  function play(name, opts) {
    try {
      opts = opts && typeof opts === 'object' ? opts : {};
      if (!enabled) return false;
      var r = Object.prototype.hasOwnProperty.call(R, name) ? R[name] : null;
      if (!r) return false;
      if (root.document && root.document.hidden) return false;
      if (!ensure()) return false;
      var delay = num(opts.delay, 0);
      if (delay > 20) delay /= 1000;
      delay = clamp(delay, 0, 10);
      if (ctx.state === 'running') return schedule(name, r, opts, delay);
      // Suspended (e.g. Safari before resume settles): play only if it resumes almost immediately.
      var asked = Date.now();
      resume().then(function () {
        try {
          if (enabled && ctx.state === 'running' && Date.now() - asked < 350) schedule(name, r, opts, delay);
        } catch (e) { /* never throw */ }
      });
      return true;
    } catch (e) { return false; }
  }

  function setEnabled(on) {
    try {
      enabled = !!on;
      writeStored(enabled);
      if (enabled) unlock(); else killAll();
    } catch (e) { /* never throw */ }
    return enabled;
  }

  function volume(v) {
    try {
      if (v === undefined) return userVol;
      userVol = clamp(num(v, userVol), 0, 1);
      if (ctx && master) master.gain.setTargetAtTime(userVol * BASE_LEVEL, ctx.currentTime, 0.02);
    } catch (e) { /* never throw */ }
    return userVol;
  }

  // ─── Auto-unlock on first gesture (kept on to recover from iOS interruptions) ──
  function onGesture() {
    try { if (enabled && (!ctx || ctx.state !== 'running')) unlock(); } catch (e) { /* ignore */ }
  }
  try {
    if (root.document && root.document.addEventListener) {
      ['pointerdown', 'touchend', 'keydown', 'click'].forEach(function (ev) {
        root.document.addEventListener(ev, onGesture, { capture: true, passive: true });
      });
      root.document.addEventListener('visibilitychange', function () {
        if (!root.document.hidden && ctx && ctx.state !== 'running' && enabled) resume();
      });
    }
  } catch (e) { /* ignore */ }

  var api = {
    play: play,
    setEnabled: setEnabled,
    get enabled() { return enabled; },
    unlock: unlock,
    volume: volume
  };
  try {
    Object.defineProperty(root, 'KurazhSound', { value: Object.freeze(api), writable: false, configurable: true, enumerable: true });
  } catch (e) {
    root.KurazhSound = api;
  }
})(typeof window !== 'undefined' ? window : this);
