/* global buddy */
const $ = (id) => document.getElementById(id);
const FIELDS = ['model', 'effort', 'userName', 'language', 'voiceName', 'voicePitch', 'voiceRate', 'sttBaseUrl', 'sttModel', 'sleepAfterMin', 'size'];
const CHECKS = ['muted', 'allowScreen', 'peekWhileHidden', 'freeWill', 'launchAtLogin'];

function fillVoices(selected) {
  const sel = $('voiceName');
  const voices = speechSynthesis.getVoices();
  sel.length = 1;
  voices.forEach((v) => {
    const o = document.createElement('option');
    o.value = v.name;
    o.textContent = `${v.name} (${v.lang})`;
    sel.appendChild(o);
  });
  sel.value = selected || '';
}

function outputs() {
  $('pitchOut').textContent = Number($('voicePitch').value).toFixed(2);
  $('rateOut').textContent = Number($('voiceRate').value).toFixed(2);
  $('sizeOut').textContent = `${Math.round(Number($('size').value) * 100)}%`;
}

let savedVoice = '';
speechSynthesis.addEventListener('voiceschanged', () => fillVoices($('voiceName').value || savedVoice));

async function load() {
  const cfg = await buddy.getConfig();
  FIELDS.forEach((f) => {
    if ($(f) && cfg[f] !== undefined) $(f).value = cfg[f];
  });
  CHECKS.forEach((f) => {
    $(f).checked = Boolean(cfg[f]);
  });
  $('hk_talk').value = cfg.hotkeys?.talk || '';
  $('hk_toggle').value = cfg.hotkeys?.toggle || '';
  $('hk_look').value = cfg.hotkeys?.look || '';
  $('apiKeyState').textContent = cfg.has_apiKey ? 'ключ сохранён (оставь поле пустым, чтобы не менять)' : '';
  $('sttKeyState').textContent = cfg.has_sttApiKey ? 'ключ сохранён' : '';
  fillVoices(cfg.voiceName);
  savedVoice = cfg.voiceName;
  outputs();
}

async function save() {
  const patch = {};
  FIELDS.forEach((f) => {
    patch[f] = $(f).value;
  });
  CHECKS.forEach((f) => {
    patch[f] = $(f).checked;
  });
  ['voicePitch', 'voiceRate', 'sleepAfterMin', 'size'].forEach((f) => {
    patch[f] = Number(patch[f]);
  });
  patch.hotkeys = { talk: $('hk_talk').value.trim(), toggle: $('hk_toggle').value.trim(), look: $('hk_look').value.trim() };
  if ($('apiKey').value.trim()) patch.apiKey = $('apiKey').value.trim();
  if ($('sttApiKey').value.trim()) patch.sttApiKey = $('sttApiKey').value.trim();
  await buddy.setConfig(patch);
  $('apiKey').value = '';
  $('sttApiKey').value = '';
  $('saved').textContent = 'Сохранено ✓';
  setTimeout(() => ($('saved').textContent = ''), 2500);
  load();
}

async function memStats() {
  const m = await buddy.memoryStats();
  $('memStats').textContent = `Фактов о тебе: ${m.user}, уроков себе: ${m.self}`;
  const mem = await buddy.listMemory();
  const ul = $('memList');
  ul.textContent = '';
  for (const kind of ['user', 'self']) {
    mem[kind].forEach((item, index) => {
      const li = document.createElement('li');
      const tag = document.createElement('em');
      tag.textContent = kind === 'user' ? 'о тебе' : 'урок';
      const text = document.createElement('span');
      text.textContent = item.text; // textContent: запись из памяти — данные, не HTML
      const del = document.createElement('button');
      del.type = 'button';
      del.textContent = 'удалить';
      del.addEventListener('click', async () => {
        await buddy.removeMemory(kind, index);
        memStats();
      });
      li.append(tag, text, del);
      ul.appendChild(li);
    });
  }
}
$('clearMem').addEventListener('click', async () => {
  if (!confirm('Стереть всю долгую память бадди? Это не отменить.')) return;
  await buddy.clearMemory();
  memStats();
});
memStats();
$('save').addEventListener('click', save);
['voicePitch', 'voiceRate', 'size'].forEach((f) => $(f).addEventListener('input', outputs));
$('testVoice').addEventListener('click', () => {
  speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance('Привет! Это я, Клод. Как тебе мой голосок?');
  const v = speechSynthesis.getVoices().find((x) => x.name === $('voiceName').value);
  if (v) {
    u.voice = v;
    u.lang = v.lang;
  } else u.lang = 'ru-RU';
  u.pitch = Number($('voicePitch').value);
  u.rate = Number($('voiceRate').value);
  speechSynthesis.speak(u);
});
load();
