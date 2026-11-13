/* Kurazh live transport: real streams between devices over WebRTC (PeerJS).
 * The Taker's device is the authority: it owns the room id, the rules, the queue and the votes.
 * Callers open a DataConnection to it and the Taker calls them back with the camera stream.
 * This file knows nothing about the UI; index.html drives it through window.KurazhLive. */
(function (w) {
  'use strict';
  const PEERJS_URL = 'https://unpkg.com/peerjs@1.5.4/dist/peerjs.min.js';
  // Subresource Integrity: hash of the published npm file that unpkg serves byte for byte. qrcodejs on cdnjs and Google's
  // GIS client have no pinned hash here: GIS is served dynamically by Google, and the cdnjs build could not be verified offline.
  const PEERJS_SRI = 'sha384-nlUQ8ZqCbvStErob+biJNzSgltf6urV3VGqhfIfzhmg9RXmpeRm76ELw0pYnKlTR';
  const QR_URL = 'https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js';
  const GIS_URL = 'https://accounts.google.com/gsi/client';
  const PREFIX = 'kurazh-';
  const DEV_KEY = 'kurazh.dev.v1';
  const ALPHA = 'abcdefghjkmnpqrstuvwxyz23456789';

  /* ---------- scripts from CDNs, loaded only when needed ---------- */
  const pending = {};
  function loadScript(src, ready, timeout = 10000, integrity = '') {
    try { const v = ready && ready(); if (v) return Promise.resolve(v); } catch (e) { /* not ready */ }
    if (pending[src]) return pending[src];
    pending[src] = new Promise((resolve, reject) => {
      const s = document.createElement('script');
      let done = false;
      const fail = (msg) => { if (done) return; done = true; delete pending[src]; s.remove(); reject(new Error(msg)); };
      const to = setTimeout(() => fail('timeout'), timeout);
      if (integrity) { s.integrity = integrity; s.crossOrigin = 'anonymous'; }
      s.src = src; s.async = true;
      s.onload = () => {
        clearTimeout(to); if (done) return;
        let v = true; try { v = ready ? ready() : true; } catch (e) { v = null; }
        if (v) { done = true; resolve(v); } else fail('loaded but not usable');
      };
      s.onerror = () => { clearTimeout(to); fail('could not load'); };
      document.head.appendChild(s);
    });
    return pending[src];
  }
  const loadPeer = () => { const u = config().peerjsUrl; return loadScript(u || PEERJS_URL, () => w.Peer, 12000, u ? '' : PEERJS_SRI); };
  const loadQR = () => loadScript(QR_URL, () => w.QRCode, 8000);
  const loadGIS = () => loadScript(GIS_URL, () => w.google && w.google.accounts && w.google.accounts.id, 8000);

  /* ---------- config: config.js, overridden per device by Developer settings ---------- */
  function devSettings() { try { return JSON.parse(localStorage.getItem(DEV_KEY) || '{}') || {}; } catch (e) { return {}; } }
  function saveDev(v) { try { localStorage.setItem(DEV_KEY, JSON.stringify(v || {})); } catch (e) { /* private mode */ } }
  function config() {
    const base = w.KURAZH_CONFIG || {}, dev = devSettings();
    return {
      googleClientId: String(dev.googleClientId || base.googleClientId || '').trim(),
      peerHost: dev.peerHost || base.peerHost || null,
      iceServers: base.iceServers || null,
      peerjsUrl: base.peerjsUrl || null,
      source: { google: dev.googleClientId ? 'device' : base.googleClientId ? 'config.js' : 'none', peer: dev.peerHost ? 'device' : base.peerHost ? 'config.js' : 'default' },
    };
  }
  function peerOptions() {
    const c = config(), o = { debug: 1 };
    let h = c.peerHost;
    if (h && typeof h === 'object') Object.assign(o, h);
    else if (typeof h === 'string' && h.trim()) {
      h = h.trim();
      const secure = !/^http:\/\//i.test(h) && (/^https:\/\//i.test(h) || location.protocol === 'https:');
      const m = h.replace(/^\w+:\/\//, '').match(/^([^/:]+)(?::(\d+))?(\/.*)?$/);
      if (m) { o.host = m[1]; o.secure = secure; o.port = m[2] ? +m[2] : secure ? 443 : 80; o.path = m[3] || '/'; }
    }
    if (c.iceServers) o.config = { iceServers: c.iceServers };
    return o;
  }

  /* ---------- room codes ---------- */
  function makeCode() {
    const a = new Uint8Array(6);
    try { crypto.getRandomValues(a); } catch (e) { for (let i = 0; i < 6; i++) a[i] = Math.random() * 256; }
    return [...a].map((n) => ALPHA[n % ALPHA.length]).join('');
  }
  function normCode(s) {
    s = String(s || '').trim();
    const m = s.match(/[?&]watch=([^&#\s]+)/); if (m) s = decodeURIComponent(m[1]);
    s = s.toLowerCase().replace(/^kurazh-/, '').replace(/[^a-z0-9]/g, '');
    return /^[a-z0-9]{4,12}$/.test(s) ? s : '';
  }

  /* ---------- tiny event emitter ---------- */
  class Emitter {
    constructor() { this._h = {}; }
    on(e, f) { (this._h[e] = this._h[e] || []).push(f); return this; }
    emit(e, ...a) { for (const f of this._h[e] || []) { try { f(...a); } catch (err) { console.error('[KurazhLive]', e, err); } } }
  }
  const FATAL = ['browser-incompatible', 'invalid-key', 'ssl-unavailable', 'invalid-id'];

  /* ---------- Taker: the room host ---------- */
  class Host extends Emitter {
    constructor(code, stream) {
      super(); this.code = code; this.stream = stream; this.viewers = new Map();
      this.status = 'connecting'; this.closed = false; this.tries = 0; this.Peer = null;
      this.sweep = setInterval(() => this._sweep(), 5000);
    }
    _status(s, info) { if (this.status !== s) { this.status = s; this.emit('status', s, info); } }
    async start() { this.Peer = await loadPeer(); this._open(); return this; }
    _open() {
      if (this.closed) return;
      let p;
      try { p = this.peer = new this.Peer(PREFIX + this.code, peerOptions()); } catch (e) { this._status('offline', e.message); this._retry(); return; }
      p.on('open', () => { if (p !== this.peer) return; this.tries = 0; this._status('online'); });
      p.on('connection', (conn) => this._conn(conn));
      p.on('disconnected', () => {
        if (this.closed || p !== this.peer || p.destroyed) return;
        this._status('reconnecting');
        setTimeout(() => { if (!this.closed && p === this.peer && p.disconnected && !p.destroyed) { try { p.reconnect(); } catch (e) { /* retried below */ } } }, Math.min(8000, 1000 * ++this.tries));
      });
      p.on('error', (err) => {
        if (p !== this.peer) return;
        const t = err && err.type;
        if (t === 'peer-unavailable') return; // a viewer left before we called back
        if (t === 'unavailable-id') { // the broker still holds our id (e.g. right after a reload)
          this._status('reconnecting', 'room id busy'); try { p.destroy(); } catch (e) { /* ignore */ }
          if (this.tries++ < 8) setTimeout(() => this._open(), 2500); else this._status('id-taken');
          return;
        }
        if (FATAL.includes(t)) { this._status('offline', t); this.emit('error', err); return; }
        this._status(this.tries > 3 ? 'offline' : 'reconnecting', t);
        if (p.destroyed) this._retry();
      });
      p.on('close', () => { if (!this.closed && p === this.peer) this._retry(); });
    }
    _retry() { if (this.closed) return; clearTimeout(this.rt); this.rt = setTimeout(() => this._open(), Math.min(10000, 1500 * ++this.tries)); }
    _conn(conn) {
      conn.on('data', (m) => {
        if (!m || typeof m !== 'object') return;
        let v = this.viewers.get(conn.peer);
        if (m.type === 'join') {
          if (v && v.conn !== conn) { try { v.conn.close(); } catch (e) { /* ignore */ } try { v.call && v.call.close(); } catch (e) { /* ignore */ } }
          v = { conn, call: null, info: m, last: Date.now(), admitted: false };
          this.viewers.set(conn.peer, v);
          this.emit('join', conn.peer, m);
          return;
        }
        if (!v || v.conn !== conn) return;
        v.last = Date.now();
        if (m.type !== 'ping') this.emit('message', conn.peer, m);
      });
      conn.on('close', () => this._drop(conn.peer, conn));
      conn.on('error', () => this._drop(conn.peer, conn));
    }
    _drop(id, conn) {
      const v = this.viewers.get(id); if (!v || (conn && v.conn !== conn)) return;
      this.viewers.delete(id);
      try { v.call && v.call.close(); } catch (e) { /* ignore */ }
      try { v.conn.close(); } catch (e) { /* ignore */ }
      this.emit('leave', id, v.info);
    }
    _sweep() { const now = Date.now(); for (const [id, v] of this.viewers) if (now - v.last > 20000) this._drop(id); }
    admit(id) {
      const v = this.viewers.get(id); if (!v || !this.peer) return;
      v.admitted = true;
      if (!this.stream) return;
      try {
        const call = this.peer.call(id, this.stream, { metadata: { room: this.code } });
        if (!call) return;
        v.call = call;
        call.on('error', () => {});
        call.on('close', () => { if (v.call === call) v.call = null; });
      } catch (e) { this.emit('error', e); }
    }
    send(id, m) { const v = this.viewers.get(id); if (v && v.conn.open) { try { v.conn.send(m); return true; } catch (e) { /* closed */ } } return false; }
    broadcast(m, except) { let n = 0; for (const [id, v] of this.viewers) if (v.admitted && id !== except && this.send(id, m)) n++; return n; }
    kick(id, m) { if (m) this.send(id, m); setTimeout(() => this._drop(id), 300); }
    count() { let n = 0; for (const v of this.viewers.values()) if (v.admitted) n++; return n; }
    setStream(stream) { // camera flip or mic change: swap tracks on every open call without renegotiating
      this.stream = stream;
      for (const [id, v] of this.viewers) {
        const pc = v.call && v.call.peerConnection; if (!pc) { if (v.admitted && !v.call) this.admit(id); continue; }
        for (const tr of pc.getTransceivers ? pc.getTransceivers() : []) {
          const kind = tr.receiver && tr.receiver.track && tr.receiver.track.kind;
          const nt = stream.getTracks().find((t) => t.kind === kind);
          if (nt && tr.sender) tr.sender.replaceTrack(nt).catch(() => {});
        }
      }
    }
    close() {
      this.closed = true; clearInterval(this.sweep); clearTimeout(this.rt);
      setTimeout(() => {
        for (const v of this.viewers.values()) { try { v.call && v.call.close(); } catch (e) { /* ignore */ } try { v.conn.close(); } catch (e) { /* ignore */ } }
        this.viewers.clear();
        try { this.peer && this.peer.destroy(); } catch (e) { /* ignore */ }
      }, 400);
    }
  }

  /* ---------- Caller: joins a room, receives video, never sends media ---------- */
  class Viewer extends Emitter {
    constructor(code) {
      super(); this.code = code; this.status = 'connecting'; this.closed = false; this.ever = false;
      this.last = 0; this.lostSince = Date.now(); this.limit = 25000;
    }
    _status(s, info) { if (this.status !== s) { this.status = s; this.emit('status', s, info); } }
    async start() {
      this.Peer = await loadPeer();
      this._open();
      this.hb = setInterval(() => {
        if (this.closed) return;
        if (this.conn && this.conn.open) {
          try { this.conn.send({ type: 'ping' }); } catch (e) { /* closed */ }
          if (this.last && Date.now() - this.last > 9000) { try { this.conn.close(); } catch (e) { /* ignore */ } this._lost(); }
        }
      }, 3000);
      return this;
    }
    _open() {
      if (this.closed) return;
      let p;
      try { p = this.peer = new this.Peer(peerOptions()); } catch (e) { this._status('offline', e.message); this._lost(); return; }
      p.on('open', () => { if (p === this.peer) this._connect(); });
      p.on('call', (call) => {
        this.call = call;
        try { call.answer(); } catch (e) { return; }
        call.on('stream', (s) => this.emit('stream', s));
        call.on('close', () => { if (this.call === call) this.emit('stream-end'); });
        call.on('error', () => {});
      });
      p.on('disconnected', () => { if (!this.closed && p === this.peer && !p.destroyed) setTimeout(() => { try { if (p.disconnected && !p.destroyed) p.reconnect(); } catch (e) { /* ignore */ } }, 1500); });
      p.on('error', (err) => {
        if (p !== this.peer) return;
        const t = err && err.type;
        if (t === 'peer-unavailable') { this._status(this.ever ? 'reconnecting' : 'not-found'); this._lost(); return; }
        if (FATAL.includes(t)) { this._status('offline', t); this.emit('lost', t); return; }
        this._status('reconnecting', t); this._lost();
        if (p.destroyed) { clearTimeout(this.rt); this.rt = setTimeout(() => this._open(), 2500); }
      });
    }
    _connect() {
      if (this.closed || !this.peer || this.peer.destroyed) return;
      if (this.conn) { try { this.conn.close(); } catch (e) { /* ignore */ } }
      const c = this.conn = this.peer.connect(PREFIX + this.code, { reliable: true, serialization: 'json' });
      if (!c) { this._lost(); return; }
      c.on('open', () => {
        if (c !== this.conn) return;
        this.ever = true; this.last = Date.now(); this.lostSince = 0; this.limit = 60000;
        this._status('connected'); this.emit('open');
      });
      c.on('data', (m) => { if (c !== this.conn) return; this.last = Date.now(); if (m && m.type !== 'ping') this.emit('message', m); });
      c.on('close', () => { if (c === this.conn && !this.closed) { this._status('reconnecting'); this._lost(); } });
      c.on('error', () => {});
    }
    _lost() {
      if (this.closed) return;
      if (!this.lostSince) this.lostSince = Date.now();
      if (Date.now() - this.lostSince > this.limit) { this._status(this.ever ? 'lost' : 'not-found'); this.emit('lost', this.status); return; }
      clearTimeout(this.rt);
      this.rt = setTimeout(() => {
        if (this.closed) return;
        if (!this.peer || this.peer.destroyed) { this._open(); return; }
        if (this.peer.disconnected) { try { this.peer.reconnect(); } catch (e) { /* ignore */ } setTimeout(() => this._connect(), 1200); return; }
        this._connect();
      }, 2500);
    }
    retry() { this.lostSince = Date.now(); this.limit = 25000; this._status('connecting'); if (!this.peer || this.peer.destroyed) this._open(); else this._connect(); }
    send(m) { if (this.conn && this.conn.open) { try { this.conn.send(m); return true; } catch (e) { /* closed */ } } return false; }
    close() {
      this.closed = true; clearInterval(this.hb); clearTimeout(this.rt);
      try { this.send({ type: 'leave' }); } catch (e) { /* ignore */ }
      setTimeout(() => { try { this.conn && this.conn.close(); } catch (e) { /* ignore */ } try { this.peer && this.peer.destroy(); } catch (e) { /* ignore */ } }, 200);
    }
  }

  /* ---------- keep the screen awake while live or watching ---------- */
  const wake = {
    lock: null, want: false,
    async acquire() {
      this.want = true;
      try {
        if (!this.lock && 'wakeLock' in navigator && document.visibilityState === 'visible') {
          this.lock = await navigator.wakeLock.request('screen');
          this.lock.addEventListener && this.lock.addEventListener('release', () => { this.lock = null; });
        }
      } catch (e) { this.lock = null; }
      return !!this.lock;
    },
    release() { this.want = false; try { this.lock && this.lock.release(); } catch (e) { /* ignore */ } this.lock = null; },
  };
  document.addEventListener('visibilitychange', () => { if (wake.want && document.visibilityState === 'visible' && !wake.lock) wake.acquire(); });

  w.KurazhLive = { PREFIX, PEERJS_URL, QR_URL, GIS_URL, loadScript, loadPeer, loadQR, loadGIS, config, devSettings, saveDev, peerOptions, makeCode, normCode, Host, Viewer, wake };
})(window);
