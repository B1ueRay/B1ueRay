/* Kurazh analytics: privacy-first, on-device event log. No network, no third parties.
   API: window.KurazhAnalytics = { track(name, props), identify(userId, traits), page(name), events(), clear(),
                                   consent: { get(), set(level) } }
   Events: localStorage "kurazh.analytics.v1" (JSON array, oldest first, FIFO cap 5000, 90-day retention).
   Device/session/consent state: localStorage "kurazh.analytics.meta.v1".
   Event shape: { id, name, props, ts, session_id, device_id, user_id (salted SHA-256, never raw), app_version,
                  viewport, standalone, platform, consent }.
   Consent: "essential" (default; operational events only) or "full". Do Not Track / GPC forces "essential".
   Safe to load more than once; every public call is wrapped and never throws. */
(function (w) {
  'use strict';
  try {
    if (!w || (w.KurazhAnalytics && typeof w.KurazhAnalytics.track === 'function')) return; // loaded already

    var KEY = 'kurazh.analytics.v1', META = 'kurazh.analytics.meta.v1';
    var CAP = 5000, IDLE = 30 * 60 * 1000, KEEP = 90 * 864e5, MAX_ERR = 20, MAX_PROPS = 30;
    var nav = w.navigator || {}, doc = w.document;

    // Operational events kept under "essential": service health, account state, money movement, safety, compliance.
    var ESSENTIAL = {};
    ('app_open session_start client_error perf signup_complete login kyc_start kyc_complete hold_placed ' +
     'hold_captured hold_released dare_decline dare_timeout decline_bonus withdrawal_request dare_blocked ' +
     'report_submitted live_start live_end adult_unlock').split(' ').forEach(function (n) { ESSENTIAL[n] = 1; });

    // Prop keys that are dropped outright, whatever their value.
    var PII = /^(name|names|surname|(first|last|full|user|real|display|legal|given|family|middle)_?name|e_?mail|email_?address|phone|phone_?number|mobile|tel|telephone|msisdn|address|street|dob|birth_?date|date_of_birth|password|passcode|otp|card_?number|pan|cvv|cvc|iban|ssn|document_?number|passport)$|(^|_)(email|phone)(_|$)/;
    var EMAIL = /[^\s@<>"'(),;:]+@[^\s@<>"'(),;:]+\.[a-z]{2,}/gi;

    var now = function () { return Date.now(); };
    var read = function (k, d) { try { var v = w.localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch (e) { return d; } };
    var write = function (k, v) { try { w.localStorage.setItem(k, JSON.stringify(v)); return true; } catch (e) { return false; } };
    var rid = function () {
      try { if (w.crypto && w.crypto.randomUUID) return w.crypto.randomUUID(); } catch (e) {}
      return 'x' + now().toString(36) + Math.random().toString(36).slice(2, 12);
    };
    var dnt = function () {
      try {
        return nav.doNotTrack === '1' || nav.doNotTrack === 'yes' || w.doNotTrack === '1' ||
          nav.msDoNotTrack === '1' || nav.globalPrivacyControl === true;
      } catch (e) { return false; }
    };

    var meta = read(META, null);
    if (!meta || typeof meta !== 'object') meta = {};
    if (!meta.device_id) meta.device_id = rid();
    if (meta.consent !== 'full') meta.consent = 'essential';
    if (typeof meta.user_hash === 'string' && meta.user_hash.indexOf('pending:') === 0) meta.user_hash = null; // hash never finished
    var saveMeta = function () { write(META, meta); };
    saveMeta();

    var level = function () { return meta.consent === 'full' && !dnt() ? 'full' : 'essential'; };

    // ---------- context ----------
    var version = function () {
      try {
        if (w.KURAZH_VERSION) return String(w.KURAZH_VERSION).slice(0, 32);
        var m = doc && doc.querySelector('meta[name="kurazh-version"],meta[name="application-version"]');
        if (m && m.content) return m.content.slice(0, 32);
      } catch (e) {}
      return '0.1.0-demo';
    };
    var PLATFORM = (function () {
      try {
        var ua = nav.userAgent || '', p = (nav.userAgentData && nav.userAgentData.platform) || nav.platform || '';
        if (/iPhone|iPad|iPod/.test(ua) || (p === 'MacIntel' && nav.maxTouchPoints > 1)) return 'ios';
        if (/Android/i.test(ua)) return 'android';
        if (/Mac/i.test(p)) return 'macos';
        if (/Win/i.test(p)) return 'windows';
        if (/Linux|CrOS/i.test(p)) return 'linux';
      } catch (e) {}
      return 'other';
    })();
    var standalone = function () {
      try { return !!((w.matchMedia && w.matchMedia('(display-mode: standalone)').matches) || nav.standalone === true); }
      catch (e) { return false; }
    };

    // ---------- privacy ----------
    // strict: free text such as error messages (also masks long digit runs that may be phones or card numbers).
    var scrub = function (s, max, strict) {
      s = String(s).replace(EMAIL, '[email]').replace(/(https?:\/\/[^\s?#]+)[?#]\S*/g, '$1');
      if (strict) s = s.replace(/\+?\d[\d\s().-]{6,}\d/g, '[num]');
      return s.slice(0, max || 160);
    };
    var clean = function (props) {
      var out = {}, n = 0;
      if (!props || typeof props !== 'object') return out;
      for (var k in props) {
        if (!Object.prototype.hasOwnProperty.call(props, k) || n >= MAX_PROPS) continue;
        var key = String(k).toLowerCase().replace(/[^a-z0-9]+/g, '_').slice(0, 40);
        if (!key || PII.test(key)) continue;
        var v = props[k], t = typeof v;
        if (v === null || t === 'boolean') out[key] = v;
        else if (t === 'number') { if (isFinite(v)) out[key] = Math.round(v * 100) / 100; else continue; }
        else if (t === 'string') out[key] = scrub(v, 200);
        else if (Array.isArray(v)) out[key] = v.slice(0, 10).filter(function (x) { return x === null || typeof x !== 'object'; })
          .map(function (x) { return typeof x === 'string' ? scrub(x, 60) : x; });
        else continue; // nested objects, functions: dropped
        n++;
      }
      return out;
    };
    var fnv = function (s, seed) {
      var h = seed >>> 0;
      for (var i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; }
      return ('0000000' + h.toString(16)).slice(-8);
    };
    // Fallback only where SubtleCrypto is missing (plain http on a LAN IP): non-reversible, not cryptographic.
    var weakHash = function (s) { return 'f1:' + fnv(s, 2166136261) + fnv(s, 3141592653) + fnv(s.split('').reverse().join(''), 2654435761); };

    // ---------- event store: memory queue flushed into localStorage ----------
    var queue = [], timer = null, pendingTag = null;
    var stored = function () { var a = read(KEY, []); return Array.isArray(a) ? a : []; };
    var flush = function () {
      try {
        if (timer) { clearTimeout(timer); timer = null; }
        if (!queue.length) return;
        var all = stored().concat(queue);
        if (all.length > CAP) all = all.slice(all.length - CAP); // FIFO
        if (!write(KEY, all)) { all = all.slice(Math.floor(all.length / 2)); write(KEY, all); } // quota: drop oldest half
        queue = [];
      } catch (e) {}
    };
    var schedule = function () { if (!timer) timer = setTimeout(flush, 400); };

    // Retention: drop events older than 90 days and unresolved hash placeholders from an interrupted identify().
    (function () {
      var all = stored(), cut = now() - KEEP, dirty = false;
      var kept = all.filter(function (e) { return e && typeof e === 'object' && e.ts >= cut; });
      kept.forEach(function (e) { if (typeof e.user_id === 'string' && e.user_id.indexOf('pending:') === 0) { e.user_id = null; dirty = true; } });
      if (dirty || kept.length !== all.length) write(KEY, kept);
    })();

    var push = function (name, props, t) {
      var vw = 0, vh = 0;
      try { vw = w.innerWidth || 0; vh = w.innerHeight || 0; } catch (e) {}
      queue.push({
        id: rid(), name: name, props: props, ts: t, session_id: meta.session_id, device_id: meta.device_id,
        user_id: meta.user_hash || null, app_version: version(), viewport: vw + 'x' + vh,
        standalone: standalone(), platform: PLATFORM, consent: level()
      });
      if (queue.length >= 50) flush(); else schedule();
    };

    // Starts a new session after 30 min of inactivity; every tracked call counts as activity.
    var touch = function (t) {
      var fresh = !meta.session_id || !meta.last || t - meta.last > IDLE;
      if (fresh) { meta.session_id = rid(); meta.session_ts = t; meta.app_open = false; }
      meta.last = t;
      saveMeta();
      if (fresh) push('session_start', {}, t);
    };

    var track = function (name, props) {
      try {
        if (typeof name !== 'string') return false;
        name = name.trim().toLowerCase().replace(/[^a-z0-9_]+/g, '_').slice(0, 64);
        if (!name || name === 'session_start') return false; // session_start is emitted by the SDK only
        var t = now();
        touch(t);
        if (level() !== 'full' && !ESSENTIAL[name]) return false;
        if (name === 'app_open') { if (meta.app_open) return false; meta.app_open = true; saveMeta(); } // once per session
        push(name, clean(props), t);
        return true;
      } catch (e) { return false; }
    };

    // Raw ids are never stored: only a salted SHA-256 (first 128 bits). identify(null) signs out.
    var identify = function (userId, traits) {
      try {
        if (userId === null || userId === undefined || userId === '') {
          meta.user_hash = null; pendingTag = null; saveMeta(); return;
        }
        var raw = 'kurazh:' + String(userId).trim().toLowerCase();
        var tag = 'pending:' + rid();
        meta.user_hash = tag; pendingTag = tag; saveMeta();
        var done = function (hash) {
          try {
            if (pendingTag !== tag) return; // superseded by a later identify()
            pendingTag = null; meta.user_hash = hash; saveMeta();
            queue.forEach(function (e) { if (e.user_id === tag) e.user_id = hash; });
            var all = stored(), hit = false;
            all.forEach(function (e) { if (e && e.user_id === tag) { e.user_id = hash; hit = true; } });
            if (hit) write(KEY, all);
            if (level() === 'full') track('identify', traits);
          } catch (e) {}
        };
        var subtle = w.crypto && w.crypto.subtle;
        if (subtle && w.TextEncoder) {
          subtle.digest('SHA-256', new w.TextEncoder().encode(raw)).then(function (buf) {
            var b = new Uint8Array(buf), s = '';
            for (var i = 0; i < 16; i++) s += ('0' + b[i].toString(16)).slice(-2);
            done('s256:' + s);
          }, function () { done(weakHash(raw)); });
        } else done(weakHash(raw));
      } catch (e) {}
    };

    var page = function (name) {
      try {
        var p = name ? String(name) : (w.location ? w.location.pathname + (w.location.hash || '') : '');
        return track('page_view', { page: scrub(p, 120, true) });
      } catch (e) { return false; }
    };

    var events = function () { try { return JSON.parse(JSON.stringify(stored().concat(queue))); } catch (e) { return []; } };

    var clear = function () {
      try { queue = []; if (timer) { clearTimeout(timer); timer = null; } w.localStorage.removeItem(KEY); } catch (e) {}
    };

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

    w.KurazhAnalytics = { track: track, identify: identify, page: page, events: events, clear: clear, consent: consent };

    // ---------- auto events ----------
    track('app_open', { referrer: doc && doc.referrer ? scrub(doc.referrer.split(/[?#]/)[0], 120) : '' });

    var errCount = 0, seen = {};
    var onErr = function (kind, msg, src, line, col) {
      if (errCount >= MAX_ERR) return;
      msg = scrub(msg || 'Unknown error', 160, true);
      var k = msg + '|' + (line || 0);
      if (seen[k]) return;
      seen[k] = 1; errCount++;
      track('client_error', {
        kind: kind, message: msg, line: line || 0, col: col || 0,
        source: src ? String(src).split(/[?#]/)[0].split('/').pop().slice(0, 60) : ''
      });
    };
    w.addEventListener('error', function (e) {
      try { if (e && e.message !== undefined) onErr('error', e.message, e.filename, e.lineno, e.colno); } catch (x) {}
    });
    w.addEventListener('unhandledrejection', function (e) {
      try { var r = e && e.reason; onErr('promise', r && r.message ? r.message : String(r)); } catch (x) {}
    });

    // Performance: TTFB, first paint, FCP, LCP, load. Once per page load, a few seconds after load or on hide.
    var perf = {}, perfSent = false;
    var sendPerf = function () {
      if (perfSent) return;
      perfSent = true;
      try {
        var P = w.performance, n = P.getEntriesByType && P.getEntriesByType('navigation')[0];
        if (n) { perf.ttfb = Math.round(n.responseStart); perf.dom_ready = Math.round(n.domContentLoadedEventEnd); perf.load = Math.round(n.loadEventEnd); }
        (P.getEntriesByType('paint') || []).forEach(function (p) {
          perf[p.name === 'first-paint' ? 'fp' : p.name === 'first-contentful-paint' ? 'fcp' : p.name] = Math.round(p.startTime);
        });
      } catch (e) {}
      track('perf', perf);
    };
    try {
      if (w.PerformanceObserver) new w.PerformanceObserver(function (list) {
        var es = list.getEntries(); if (es.length) perf.lcp = Math.round(es[es.length - 1].startTime);
      }).observe({ type: 'largest-contentful-paint', buffered: true });
    } catch (e) {}
    var afterLoad = function () { setTimeout(sendPerf, 3000); };
    if (doc && doc.readyState === 'complete') afterLoad(); else w.addEventListener('load', afterLoad);

    if (doc) doc.addEventListener('visibilitychange', function () {
      try {
        if (doc.visibilityState === 'hidden') { sendPerf(); flush(); }
        else if (meta.last && now() - meta.last > IDLE) track('app_open', { resume: true }); // back after 30 min: new session
      } catch (e) {}
    });
    w.addEventListener('pagehide', function () { try { sendPerf(); flush(); } catch (e) {} });
  } catch (e) { /* analytics must never break the app */ }
})(typeof window !== 'undefined' ? window : undefined);
