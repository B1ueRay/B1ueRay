/* Kurazh voice: the simulated Taker talks back, and the viewer can speak instead of typing.
 *
 * Three engines, each with a fallback, picked once at load:
 *  - speech out: Claude's voice (the artifact's `tts` capability) inside a Claude viewer,
 *    otherwise the browser's own speechSynthesis;
 *  - speech in: Claude dictation (the `dictation` capability), otherwise the browser's
 *    SpeechRecognition (Chrome, Safari on iOS 14.5+); typing always works;
 *  - replies: Claude (the `sample` capability) inside a Claude viewer, otherwise the page's
 *    own scripted lines (the caller passes them in).
 *
 * window.KurazhVoice = { ready, can, speak(text, who), stopSpeaking(), listen(handlers), stopListening(),
 *                        listening, ask(prompt) }
 */
(function () {
  'use strict';
  const V = { can: { tts: false, stt: false, ai: false }, listening: false, engine: { tts: 'none', stt: 'none', ai: 'none' } };
  let ctts = null, cdict = null, csample = null, ttsOff = false, rec = null, handlers = null, voices = [];

  /* ---------- discovery ---------- */
  const hasBrowserTTS = typeof window.speechSynthesis !== 'undefined' && typeof window.SpeechSynthesisUtterance !== 'undefined';
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition || null;
  function refreshCan() {
    V.can.tts = !ttsOff && (!!ctts || hasBrowserTTS);
    V.can.stt = !!cdict || !!SR;
    V.can.ai = !!csample;
    V.engine = { tts: ttsOff ? 'off' : ctts ? 'claude' : hasBrowserTTS ? 'browser' : 'none', stt: cdict ? 'claude' : SR ? 'browser' : 'none', ai: csample ? 'claude' : 'scripted' };
    try { window.dispatchEvent(new CustomEvent('kurazh-voice', { detail: { ...V.can } })); } catch { /* old browsers */ }
  }
  if (hasBrowserTTS) {
    const load = () => { try { voices = window.speechSynthesis.getVoices() || []; } catch { voices = []; } };
    load(); try { window.speechSynthesis.addEventListener('voiceschanged', load); } catch { /* Safari < 14 */ }
  }
  refreshCan();
  V.ready = (async () => {
    const use = window.claude && typeof window.claude.use === 'function' ? (n) => window.claude.use(n).catch(() => null) : null;
    if (!use) return V.can;
    const [t, d, s] = await Promise.all([use('tts'), use('dictation'), use('sample')]);
    ctts = t; cdict = d; csample = s;
    if (cdict) {
      cdict.onPartial(({ text }) => handlers?.onPartial?.(text));
      cdict.onFinal(({ text }) => handlers?.onFinal?.(text));
      cdict.onState(({ state, reason }) => {
        V.listening = state !== 'idle';
        handlers?.onState?.(V.listening ? 'listening' : 'idle', reason);
        if (state === 'idle' && (reason === 'not_granted' || reason === 'unavailable')) { cdict = null; refreshCan(); }
      });
    }
    refreshCan();
    return V.can;
  })();

  /* ---------- speech out ---------- */
  const cyr = (s) => /[Ѐ-ӿ]/.test(s);
  const uaOnly = (s) => /[іїєґІЇЄҐ]/.test(s);
  function langOf(text) { return !cyr(text) ? 'en-US' : uaOnly(text) ? 'uk-UA' : 'ru-RU'; }
  function pickVoice(lang, gender) {
    const pool = voices.filter((v) => v.lang && v.lang.toLowerCase().startsWith(lang.slice(0, 2)));
    if (!pool.length) return null;
    const fem = /female|samantha|victoria|karen|moira|tessa|milena|katya|lesya|alice|anna|zira|susan|serena|fiona/i;
    const mal = /male|daniel|alex|fred|yuri|maxim|oliver|tom|george|aaron|arthur|david|mark/i;
    const want = gender === 'm' ? mal : fem, avoid = gender === 'm' ? fem : mal;
    return pool.find((v) => want.test(v.name) && !avoid.test(v.name.replace(want, ''))) || pool.find((v) => !avoid.test(v.name)) || pool[0];
  }
  /** who = { gender: 'f'|'m', claudeVoice, pitch, rate } */
  V.speak = function (text, who = {}) {
    text = String(text || '').trim().slice(0, 600);
    if (!text || ttsOff) return Promise.resolve(false);
    if (ctts) {
      return ctts.speak(text, { voice: who.claudeVoice || 'buttery' }).then(() => true).catch((e) => {
        // the viewer turned reading aloud off: respect it, never fall back to another voice
        if (e && (e.code === 'not_granted' || e.code === 'unavailable')) { ttsOff = true; refreshCan(); }
        return false;
      });
    }
    if (!hasBrowserTTS) return Promise.resolve(false);
    return new Promise((res) => {
      try {
        const u = new SpeechSynthesisUtterance(text), lang = langOf(text), v = pickVoice(lang, who.gender);
        u.lang = v?.lang || lang; if (v) u.voice = v;
        u.pitch = who.pitch ?? (who.gender === 'm' ? 0.9 : 1.08); u.rate = who.rate ?? 1.02; u.volume = 1;
        u.onend = () => res(true); u.onerror = () => res(false);
        window.speechSynthesis.cancel(); window.speechSynthesis.speak(u);
        setTimeout(() => res(false), 20000);
      } catch { res(false); }
    });
  };
  V.stopSpeaking = function () {
    try { if (ctts) ctts.stop().catch(() => {}); } catch { /* ignore */ }
    try { if (hasBrowserTTS) window.speechSynthesis.cancel(); } catch { /* ignore */ }
  };
  /** Call from a tap: unlocks speech on iOS, where the first utterance must come from a gesture. */
  V.unlock = function () {
    if (ctts || !hasBrowserTTS) return;
    try { const u = new SpeechSynthesisUtterance(' '); u.volume = 0; window.speechSynthesis.speak(u); } catch { /* ignore */ }
  };

  /* ---------- speech in ---------- */
  /** Must be called straight from the viewer's tap. h = { onPartial(text), onFinal(text), onState(state, reason), onError(code) } */
  V.listen = function (h) {
    handlers = h;
    if (cdict) {
      V.stopSpeaking();
      cdict.start().catch((e) => { V.listening = false; h.onError?.(e?.code || 'upstream_error'); h.onState?.('idle', e?.code); if (e && (e.code === 'not_granted' || e.code === 'unavailable')) { cdict = null; refreshCan(); } });
      return true;
    }
    if (!SR) { h.onError?.('unavailable'); return false; }
    try {
      V.stopSpeaking();
      rec = new SR();
      rec.lang = navigator.language || 'en-US'; rec.interimResults = true; rec.continuous = false; rec.maxAlternatives = 1;
      rec.onstart = () => { V.listening = true; h.onState?.('listening'); };
      rec.onresult = (ev) => {
        let interim = '', fin = '';
        for (let i = ev.resultIndex; i < ev.results.length; i++) { const r = ev.results[i]; (r.isFinal ? (fin += r[0].transcript) : (interim += r[0].transcript)); }
        if (interim) h.onPartial?.(interim);
        if (fin) { h.onPartial?.(''); h.onFinal?.(fin); }
      };
      rec.onerror = (ev) => { h.onError?.(ev.error === 'not-allowed' || ev.error === 'service-not-allowed' ? 'not_granted' : ev.error || 'upstream_error'); };
      rec.onend = () => { V.listening = false; rec = null; h.onState?.('idle', 'stopped'); };
      rec.start();
      return true;
    } catch { h.onError?.('upstream_error'); return false; }
  };
  V.stopListening = function () {
    if (cdict) return cdict.stop().catch(() => {});
    try { rec?.stop(); } catch { /* ignore */ }
    return Promise.resolve();
  };

  /* ---------- replies ---------- */
  /** Ask Claude for a short reply. Resolves the text, or null when Claude is not available here. */
  V.ask = async function (prompt, signal) {
    if (!csample) return null;
    try {
      const r = await csample(prompt, { modelTier: 'quick', cache: false, signal });
      return (r && r.text ? String(r.text) : '').trim() || null;
    } catch (e) {
      if (e && e.code === 'not_granted') { csample = null; refreshCan(); }
      return null;
    }
  };

  window.KurazhVoice = V;
})();
