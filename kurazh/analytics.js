/* Kurazh analytics: privacy-first, on-device event log. No network, no third parties.
   API: window.KurazhAnalytics = { track, identify, page, events, clear, consent: { get, set } }
   Events live in localStorage "kurazh.analytics.v1" (JSON array, newest last, max 5000).
   Device/session/consent state lives in "kurazh.analytics.meta.v1". */
(function (w) {
  'use strict';
  try {
    if (!w || (w.KurazhAnalytics && typeof w.KurazhAnalytics.track === 'function')) return; // loaded already
  } catch (e) { return; }

  var KEY = 'kurazh.analytics.v1', META = 'kurazh.analytics.meta.v1';
  var CAP = 5000, IDLE = 30 * 60 * 1000, MAX_ERR = 20;
  var nav = w.navigator || {}, doc = w.document;
  // Operational events: kept under "essential" consent (service health, money, safety, account state).
  var ESSENTIAL = {};
  ('app_open session_start client_error perf signup_complete login kyc_start kyc_complete hold_placed hold_captured ' +
   'hold_released withdrawal_request dare_blocked report_submitted live_start live_end').split(' ')
    .forEach(function (n) { ESSENTIAL[n] = 1; });
  var PII = /^(e-?mail|email_address|(first|last|full|user|real|display)?_?name|phone|phone_?number|mobile|tel)$/i;
  var EMAIL = /[^\s@<>"']+@[^\s@<>"']+\.[a-z]{2,}/gi;

  function now() { return Date.now(); }
  function read(k, d) { try { var v = w.localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch (e) { return d; } }
  function write(k, v) {
    try { w.localStorage.setItem(k, JSON.stringify(v)); return true; } catch (e) { return false; }
  }
  function rid() {
    try { if (w.crypto && w.crypto.randomUUID) return w.crypto.randomUUID(); } catch (e) {}
    return 'x' + now().toString(36) + Math.random().toString(36).slice(2, 10);
  }
  function dnt() {
    try {
      return nav.doNotTrack === '1' || nav.doNotTrack === 'yes' || w.doNotTrack === '1' ||
        nav.msDoNotTrack === '1' || nav.globalPrivacyControl === true;
    } catch (e) { return false; }
  }

  var meta = read(META, null);
  if (!meta || typeof meta !== 'object') meta = {};
  if (!meta.device_id) meta.device_id = rid();
  if (meta.consent !== 'full') meta.consent = 'essential';
  if (typeof meta.user_hash === 'string' && meta.user_hash.indexOf('pending:') === 0) meta.user_hash = null; // hash never finished
  function saveMeta() { write(META, meta); }

  function level() { return meta.consent === 'full' && !dnt() ? 'full' : 'essential'; }

  // ---------- context ----------
  function version() {
    try {
      if (w.KURAZH_VERSION) return String(w.KURAZH_VERSION);
      var m = doc && doc.querySelector('meta[name="kurazh-version"],meta[name="application-version"]');
      if (m && m.content) return m.content;
    } catch (e) {}
    return '0.1.0-demo';
  }
  function platform() {
    try {
      var ua = nav.userAgent || '', p = (nav.userAgentData && nav.userAgentData.platform) || nav.platform || '';
      if (/iPhone|iPad|iPod/.test(ua) || (p === 'MacIntel' && nav.maxTouchPoints > 1)) return 'ios';
      if (/Android/i.test(ua)) return 'android';
      if (/Mac/i.test(p)) return 'macos';
      if (/Win/i.test(p)) return 'windows';
      if (/Linux|CrOS/i.test(p)) return 'linux';
    } catch (e) {}
    return 'other';
  }
  function standalone() {
    try { return !!((w.matchMedia && w.matchMedia('(display-mode: standalone)').matches) || nav.standalone === true); }
    catch (e) { return false; }
  }
  var PLATFORM = platform();

  // ---------- privacy ----------
  function scrub(s, max, strict) { // strict: free text such as error messages (also masks long digit runs)
    s = String(s).replace(EMAIL, '[email]').replace(/(https?:\/\/[^\s?#]+)[?#][^\s]*/g, '$1');
    if (strict) s = s.replace(/\+?\d[\d\s().-]{6,}\d/g, '[num]');
    return s.slice(0, max || 160);
  }
  function clean(props) {
    var out = {}, n = 0;
    if (!props || typeof props !== 'object') return out;
    for (var k in props) {
      if (!Object.prototype.hasOwnProperty.call(props, k) || PII.test(k) || n >= 30) continue;
      var v = props[k], t = typeof v;
      if (v === null || t === 'boolean') out[k] = v;
      else if (t === 'number') { if (isFinite(v)) out[k] = v; else continue; }
      else if (t === 'string') out[k] = scrub(v, 200);
      else if (Array.isArray(v)) out[k] = v.slice(0, 10).filter(function (x) { return typeof x !== 'object'; })
        .map(function (x) { return typeof x === 'string' ? scrub(x, 60) : x; });
      else continue;
      n++;
    }
    return out;
  }
  function fnv(s, seed) {
    var h = seed >>> 0;
    for (var i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; }
    return ('0000000' + h.toString(16)).slice(-8);
  }
  function weakHash(s) { return 'f1:' + fnv(s, 2166136261) + fnv(s, 3141592653) + fnv(s.split('').reverse().join(''), 2654435761); }

  // ---------- event store (memory queue, flushed into localStorage) ----------
  var queue = [], timer = null, pendingTag = null;
  function stored() { var a = read(KEY, []); return Array.isArray(a) ? a : []; }
  function flush() {
    timer = null;
    if (!queue.length) return;
    var all = stored().concat(queue);
    if (all.length > CAP) all = all.slice(all.length - CAP);
    if (!write(KEY, all)) { all = all.slice(Math.floor(all.length / 2)); write(KEY, all); } // quota: drop oldest half
    queue = [];
  }
  function schedule() { if (!timer) timer = setTimeout(flush, 400); }

  // ---------- sessions ----------
  var sessionTracked = {};
  function touch(t) {
    var fresh = !meta.session_id || !meta.last || t - meta.last > IDLE;
    if (fresh) { meta.session_id = rid(); meta.session_ts = t; meta.app_open = false; }
    meta.last = t;
    saveMeta();
    if (fresh) { push('session_start', {}, t); }
  }

  function push(name, props, t) {
    var vw = 0, vh = 0;
    try { vw = w.innerWidth; vh = w.innerHeight; } catch (e) {}
    var ev = {
      id: rid(), name: name, props: props, ts: t, session_id: meta.session_id, device_id: meta.device_id,
      user_id: meta.user_hash || null, app_version: version(), viewport: vw + 'x' + vh,
      standalone: standalone(), platform: PLATFORM, consent: level()
    };
    queue.push(ev);
    if (queue.length >= 50) flush(); else schedule();
    return ev;
  }

  function track(name, props) {
    try {
      name = String(name || '').trim().toLowerCase().replace(/[^a-z0-9_]+/g, '_').slice(0, 64);
      if (!name) return false;
      var t = now();
      touch(t);
      if (level() !== 'full' && !ESSENTIAL[name]) return false;
      if (name === 'app_open') { if (meta.app_open) return false; meta.app_open = true; saveMeta(); }
      if (name === 'session_start') return false; // emitted by the SDK only
      push(name, clean(props), t);
      return true;
    } catch (e) { return false; }
  }

  function identify(userId, traits) {
    try {
      if (userId === null || userId === undefined || userId === '') { // sign-out
        meta.user_hash = null; pendingTag = null; saveMeta(); return;
      }
      var raw = 'kurazh:' + String(userId).trim().toLowerCase();
      var tag = 'pending:' + rid();
      meta.user_hash = tag; pendingTag = tag; saveMeta();
      var done = function (hash) {
        if (pendingTag !== tag) return; // superseded
        pendingTag = null; meta.user_hash = hash; saveMeta();
        queue.forEach(function (e) { if (e.user_id === tag) e.user_id = hash; });
        var all = stored(), hit = false;
        all.forEach(function (e) { if (e && e.user_id === tag) { e.user_id = hash; hit = true; } });
        if (hit) write(KEY, all);
        if (level() === 'full') track('identify', traits);
      };
      var subtle = w.crypto && w.crypto.subtle;
      if (subtle && w.TextEncoder) {
        subtle.digest('SHA-256', new TextEncoder().encode(raw)).then(function (buf) {
          var b = new Uint8Array(buf), s = '';
          for (var i = 0; i < 16; i++) s += ('0' + b[i].toString(16)).slice(-2);
          done('s256:' + s);
        }).catch(function () { done(weakHash(raw)); });
      } else done(weakHash(raw));
    } catch (e) {}
  }

  function page(name) {
    try {
      var p = name ? String(name) : (w.location ? w.location.pathname + (w.location.hash || '') : '');
      return track('page_view', { page: scrub(p, 120) });
    } catch (e) { return false; }
  }

  function events() {
    try { return JSON.parse(JSON.stringify(stored().concat(queue))); } catch (e) { return []; }
  }

  function clear() {
    try { queue = []; w.localStorage.removeItem(KEY); } catch (e) {}
  }

  var consent = {
    get: function () { try { return level(); } catch (e) { return 'essential'; } },
    set: function (lvl) {
      try {
        meta.consent = lvl === 'full' ? 'full' : 'essential';
        saveMeta();
        if (level() === 'essential') { // downgrade: purge behavioural events already collected
          flush();
          var all = stored(), keep = all.filter(function (e) { return e && ESSENTIAL[e.name]; });
          if (keep.length !== all.length) write(KEY, keep);
        }
        return level();
      } catch (e) { return 'essential'; }
    }
  };

  try {
    w.KurazhAnalytics = { track: track, identify: identify, page: page, events: events, clear: clear, consent: consent };
  } catch (e) { return; }

  // ---------- auto events ----------
  try {
    track('app_open', { referrer: doc && doc.referrer ? scrub(doc.referrer.split('?')[0], 120) : '' });

    var errCount = 0, seen = {};
    var onErr = function (kind, msg, src, line, col) {
      if (errCount >= MAX_ERR) return;
      msg = scrub(msg || 'Unknown error', 160, true);
      var key = msg + '|' + line;
      if (seen[key]) return;
      seen[key] = 1; errCount++;
      track('client_error', { kind: kind, message: msg, source: src ? String(src).split(/[?#]/)[0].split('/').pop().slice(0, 60) : '',
        line: line || 0, col: col || 0 });
    };
    w.addEventListener('error', function (e) {
      try { if (e && e.message !== undefined) onErr('error', e.message, e.filename, e.lineno, e.colno); } catch (x) {}
    });
    w.addEventListener('unhandledrejection', function (e) {
      try { var r = e && e.reason; onErr('promise', r && r.message ? r.message : String(r)); } catch (x) {}
    });

    // Performance: first paint, FCP, LCP, TTFB, load. Reported once per page load.
    var perf = {}, perfSent = false;
    var sendPerf = function () {
      if (perfSent) return;
      perfSent = true;
      try {
        var n = w.performance.getEntriesByType && w.performance.getEntriesByType('navigation')[0];
        if (n) { perf.ttfb = Math.round(n.responseStart); perf.dom_ready = Math.round(n.domContentLoadedEventEnd); perf.load = Math.round(n.loadEventEnd); }
        (w.performance.getEntriesByType('paint') || []).forEach(function (p) {
          perf[p.name === 'first-paint' ? 'fp' : p.name === 'first-contentful-paint' ? 'fcp' : p.name] = Math.round(p.startTime);
        });
      } catch (e) {}
      track('perf', perf);
    };
    if (w.PerformanceObserver) {
      try {
        new w.PerformanceObserver(function (list) {
          var es = list.getEntries(); if (es.length) perf.lcp = Math.round(es[es.length - 1].startTime);
        }).observe({ type: 'largest-contentful-paint', buffered: true });
      } catch (e) {}
    }
    var afterLoad = function () { setTimeout(sendPerf, 3000); };
    if (doc && doc.readyState === 'complete') afterLoad(); else w.addEventListener('load', afterLoad);

    var onHide = function () {
      try {
        if (doc.visibilityState === 'hidden') { sendPerf(); flush(); }
        else if (meta.last && now() - meta.last > IDLE) track('app_open', {}); // came back after 30 min: new session
      } catch (e) {}
    };
    if (doc) doc.addEventListener('visibilitychange', onHide);
    w.addEventListener('pagehide', function () { try { sendPerf(); flush(); } catch (e) {} });
  } catch (e) {}
})(typeof window !== 'undefined' ? window : undefined);
