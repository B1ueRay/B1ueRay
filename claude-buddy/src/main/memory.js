'use strict';
// Долгая память бадди: факты о пользователе и заметки самому себе ("уроки"),
// которые переживают перезапуск. Хранится локально в userData/memory.json.
const fs = require('fs');
const path = require('path');
const electron = require('electron');

const app = typeof electron === 'object' ? electron.app : null;

const LIMITS = { user: 60, self: 40 };

function file() {
  const dir = process.env.BUDDY_MEMORY_DIR || (app ? app.getPath('userData') : process.cwd());
  return path.join(dir, 'memory.json');
}

function load() {
  try {
    const raw = JSON.parse(fs.readFileSync(file(), 'utf8'));
    return { user: Array.isArray(raw.user) ? raw.user : [], self: Array.isArray(raw.self) ? raw.self : [] };
  } catch {
    return { user: [], self: [] };
  }
}

function save(mem) {
  fs.mkdirSync(path.dirname(file()), { recursive: true });
  fs.writeFileSync(file(), JSON.stringify(mem, null, 2), 'utf8');
}

const norm = (s) => String(s).toLowerCase().replace(/\s+/g, ' ').trim();

function remember(fact, about) {
  const kind = about === 'self' ? 'self' : 'user';
  const text = String(fact || '').replace(/\s+/g, ' ').trim().slice(0, 300);
  if (!text) throw new Error('пустой факт');
  const mem = load();
  const list = mem[kind];
  if (list.some((x) => norm(x.text) === norm(text))) return { kind, text, duplicate: true };
  list.push({ text, at: new Date().toISOString().slice(0, 10) });
  while (list.length > LIMITS[kind]) list.shift();
  save(mem);
  return { kind, text, duplicate: false };
}

function forget(query) {
  const q = norm(query || '');
  if (!q) return 0;
  const mem = load();
  let removed = 0;
  for (const kind of ['user', 'self']) {
    const before = mem[kind].length;
    mem[kind] = mem[kind].filter((x) => !norm(x.text).includes(q));
    removed += before - mem[kind].length;
  }
  save(mem);
  return removed;
}

function clear() {
  save({ user: [], self: [] });
}

// Текст для системного промпта — собирается один раз на сессию разговора.
function snapshot() {
  const mem = load();
  const lines = [];
  if (mem.user.length) {
    lines.push('Что ты помнишь о пользователе из прошлых разговоров:');
    mem.user.forEach((x) => lines.push(`- ${x.text}`));
  }
  if (mem.self.length) {
    lines.push('', 'Твои уроки самому себе (как быть лучше для этого пользователя) — следуй им:');
    mem.self.forEach((x) => lines.push(`- ${x.text}`));
  }
  return lines.length ? lines.join('\n') : 'Долгая память пока пустая — это ваше первое знакомство или пользователь её стёр.';
}

function stats() {
  const mem = load();
  return { user: mem.user.length, self: mem.self.length };
}

module.exports = { remember, forget, clear, snapshot, stats, load };
