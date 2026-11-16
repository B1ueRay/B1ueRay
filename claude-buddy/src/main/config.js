'use strict';
// Хранилище настроек. Ключи шифруются через safeStorage (DPAPI на Windows),
// в renderer никогда не уходят — только флаги "ключ есть / нет".
const fs = require('fs');
const path = require('path');
const { app, safeStorage } = require('electron');

const DEFAULTS = {
  apiKey: '',
  model: 'claude-opus-5-5',
  effort: 'low',
  language: 'ru',
  userName: '',
  // голос
  muted: false,
  voiceName: '',
  voicePitch: 1.3,
  voiceRate: 1.08,
  voiceVolume: 1,
  // распознавание речи (любой OpenAI-совместимый /audio/transcriptions: OpenAI, Groq, локальный whisper-сервер)
  sttBaseUrl: 'https://api.openai.com/v1',
  sttApiKey: '',
  sttModel: 'whisper-1',
  // поведение
  allowScreen: true,
  peekWhileHidden: true,
  sleepAfterMin: 5,
  size: 1,
  launchAtLogin: false,
  hotkeys: {
    talk: 'CommandOrControl+Alt+K',
    toggle: 'CommandOrControl+Alt+H',
    look: 'CommandOrControl+Alt+L',
  },
};

const SECRET_FIELDS = ['apiKey', 'sttApiKey'];

function file() {
  return path.join(app.getPath('userData'), 'config.json');
}

function canEncrypt() {
  try {
    return safeStorage.isEncryptionAvailable();
  } catch {
    return false;
  }
}

function load() {
  let raw = {};
  try {
    raw = JSON.parse(fs.readFileSync(file(), 'utf8'));
  } catch {
    raw = {};
  }
  const cfg = { ...DEFAULTS, ...raw, hotkeys: { ...DEFAULTS.hotkeys, ...(raw.hotkeys || {}) } };
  for (const k of SECRET_FIELDS) {
    const enc = raw[`${k}Enc`];
    if (enc && canEncrypt()) {
      try {
        cfg[k] = safeStorage.decryptString(Buffer.from(enc, 'base64'));
      } catch {
        cfg[k] = '';
      }
    }
    delete cfg[`${k}Enc`];
  }
  if (!cfg.apiKey && process.env.ANTHROPIC_API_KEY) cfg.apiKey = process.env.ANTHROPIC_API_KEY;
  return cfg;
}

function save(cfg) {
  const out = { ...cfg };
  for (const k of SECRET_FIELDS) {
    if (canEncrypt() && out[k]) {
      out[`${k}Enc`] = safeStorage.encryptString(out[k]).toString('base64');
      delete out[k];
    }
  }
  fs.mkdirSync(path.dirname(file()), { recursive: true });
  fs.writeFileSync(file(), JSON.stringify(out, null, 2), 'utf8');
}

// То, что можно показать в renderer: без секретов.
function publicView(cfg) {
  const view = { ...cfg };
  for (const k of SECRET_FIELDS) {
    view[`has_${k}`] = Boolean(cfg[k]);
    delete view[k];
  }
  view.sttReady = Boolean(cfg.sttApiKey && cfg.sttBaseUrl && cfg.sttModel);
  return view;
}

// Пустое поле секрета в форме = "оставить как было".
function merge(current, patch) {
  const next = { ...current, ...patch, hotkeys: { ...current.hotkeys, ...(patch.hotkeys || {}) } };
  for (const k of SECRET_FIELDS) {
    if (patch[k] === undefined || patch[k] === '') next[k] = current[k];
    if (patch[`clear_${k}`]) next[k] = '';
    delete next[`clear_${k}`];
  }
  next.size = Math.min(1.6, Math.max(0.6, Number(next.size) || 1));
  next.voicePitch = Math.min(2, Math.max(0.1, Number(next.voicePitch) || 1));
  next.voiceRate = Math.min(2, Math.max(0.5, Number(next.voiceRate) || 1));
  next.sleepAfterMin = Math.max(0, Number(next.sleepAfterMin) || 0);
  return next;
}

module.exports = { DEFAULTS, load, save, publicView, merge };
