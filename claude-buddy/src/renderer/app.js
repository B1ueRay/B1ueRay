// Режиссёр: связывает сцену, голос, микрофон и "мозг" в main-процессе.
import { BuddyScene } from './scene.js';
import { Voice, Mic } from './voice.js';

const api = window.buddy || (await import('./mock-bridge.js')).createMock();
const $ = (id) => document.getElementById(id);
const els = {
  canvas: $('scene'),
  bubble: $('bubble'),
  bubbleText: $('bubbleText'),
  status: $('status'),
  chat: $('chat'),
  input: $('chatInput'),
  mic: $('micBtn'),
  look: $('lookBtn'),
  close: $('closeBtn'),
  menu: $('menu'),
  toast: $('toast'),
  you: $('you'),
  fx: $('fx'),
};

const scene = new BuddyScene(els.canvas);
const voice = new Voice();
const mic = new Mic();
let cfg = await api.getConfig();
voice.configure(cfg);

const EMOTION_RE = /^(neutral|happy|laugh|surprised|sad|angry|thinking|love|smug|sleepy|scared|embarrassed|wink)$/i;
const ACTION_RE = /^(jetpack|backflip|dance|stretch|wave|hide)$/i;
// синонимы, которые модель иногда придумывает сама
const EMOTION_ALIAS = {
  excited: 'happy', joy: 'happy', joyful: 'happy', cheerful: 'happy', grin: 'happy', smile: 'happy',
  laughing: 'laugh', lol: 'laugh', shocked: 'surprised', shock: 'surprised', amazed: 'surprised', wow: 'surprised',
  cry: 'sad', crying: 'sad', upset: 'sad', mad: 'angry', annoyed: 'angry', furious: 'angry',
  confused: 'thinking', curious: 'thinking', hmm: 'thinking', shy: 'embarrassed', blush: 'embarrassed',
  proud: 'smug', sly: 'smug', tired: 'sleepy', afraid: 'scared', fear: 'scared', heart: 'love', calm: 'neutral',
};
// наклейки над головой — эмоции читаются даже на пёстром рабочем столе
const EMO_FX = { angry: '💢', scared: '💦', embarrassed: '💦', thinking: '❓', sad: '💧', love: '💕', surprised: '❗' };
let lastFx = { emo: '', at: 0 };
function emoFx(emo) {
  const icon = EMO_FX[emo];
  const now = performance.now();
  if (!icon || (lastFx.emo === emo && now - lastFx.at < 8000)) return;
  lastFx = { emo, at: now };
  const p = scene.headScreen();
  const el = document.createElement('div');
  el.className = 'sticker';
  el.textContent = icon;
  el.style.left = `${p.x + 46}px`;
  el.style.top = `${p.y + 26}px`;
  els.fx.appendChild(el);
  setTimeout(() => el.remove(), 1800);
}
// убираем то, что синтезатор прочитал бы вслух как мусор
function cleanSpeech(text) {
  return text
    .replace(/\*[^*\n]{1,60}\*/g, ' ') // *смеётся*
    .replace(/\[[a-z_ -]{1,20}\]/gi, ' ') // забытые теги
    .replace(/[*_`#>~|]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

const state = {
  visible: false,
  seq: false, // идёт сценарий появления/исчезновения
  lastInteraction: performance.now(),
  chatOpen: false,
  sleeping: false,
  peekAt: 0,
  peekClick: null,
  ignoring: true,
  pendingHide: false,
  lookingSince: 0,
};

// ---------------- облачко / статус / тосты ----------------
let bubbleTimer = 0;
function showBubble(text, { micro = false, sticky = false } = {}) {
  clearTimeout(bubbleTimer);
  els.bubbleText.textContent = text;
  els.bubble.classList.toggle('micro', micro);
  els.bubble.classList.add('on');
  if (!sticky) bubbleTimer = setTimeout(hideBubble, Math.min(14000, 3500 + text.length * 70));
}
function hideBubble() {
  els.bubble.classList.remove('on');
}
function holdBubble() {
  clearTimeout(bubbleTimer);
}

function setStatus(text) {
  els.status.textContent = text || '';
  els.status.classList.toggle('on', Boolean(text));
}

let toastTimer = 0;
function toast(text, ms = 4000) {
  els.toast.textContent = text;
  els.toast.classList.add('on');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => els.toast.classList.remove('on'), ms);
}

function pop(text, cls = 'bam') {
  const p = scene.faceScreen();
  const el = document.createElement('div');
  el.className = `pop ${cls}`;
  el.textContent = text;
  el.style.left = `${p.x}px`;
  el.style.top = `${p.y - 40}px`;
  els.fx.appendChild(el);
  setTimeout(() => el.remove(), 1400);
}

function zzz() {
  const p = scene.headScreen();
  const el = document.createElement('div');
  el.className = 'zzz';
  el.textContent = pick(['z', 'Z', 'z']);
  el.style.left = `${p.x + 30}px`;
  el.style.top = `${p.y + 20}px`;
  els.fx.appendChild(el);
  setTimeout(() => el.remove(), 2600);
}

// ---------------- речь ----------------
voice.onSentenceStart = (item) => {
  if (item.emotion) {
    scene.setEmotion(item.emotion, 6);
    emoFx(item.emotion);
  }
};
voice.onIdle = () => {
  if (state.pendingHide) {
    state.pendingHide = false;
    setTimeout(() => whenFree(() => hide()), 300);
  }
};

function say(text, emotion = 'happy', opts = {}) {
  if (emotion) {
    scene.setEmotion(emotion, 5);
    emoFx(emotion);
  }
  showBubble(text, opts);
  return voice.say(text, { emotion, ...opts });
}

// ---------------- появление / прятки ----------------
async function appear({ kuku = true } = {}) {
  if (state.visible || state.seq) return;
  state.seq = true;
  try {
    if (scene.mode !== 'peeking') {
      await scene.descend();
    }
    if (kuku) {
      scene.setEmotion('happy', 4);
      showBubble('Ку-ку! Ты где?', { micro: true });
      await Promise.race([voice.say('Ку-ку! Ты где?', { micro: true }), sleep(2500)]);
      await sleep(250);
    }
    hideBubble();
    scene.setEmotion('surprised', 1.2);
    const island = scene.showIsland();
    await sleep(120);
    const dropping = scene.drop();
    await sleep(330);
    pop('БАМ!');
    await dropping;
    await island;
    state.visible = true;
    scene.waveHello(1.8);
    if (!reply || reply.done) greet(); // если пока падали уже что-то спросили — не перебиваем ответ
  } finally {
    state.seq = false;
    touch();
  }
}

function greet() {
  if (!cfg.has_apiKey) {
    say('Привет! Я Клод. Дай мне ключ API в настройках — и я оживу по-настоящему.', 'happy');
    return;
  }
  const name = cfg.userName ? `, ${cfg.userName}` : '';
  say(
    pick([
      `Я тут${name}! Чем займёмся?`,
      `Вот и я${name}! Скучал?`,
      `Тадам! Снова на посту${name}.`,
      `Опа, я тут${name}. Что у нас на экране интересного?`,
    ]),
    pick(['happy', 'wink', 'love']),
  );
}

async function hide() {
  if (!state.visible || state.seq) return;
  state.seq = true;
  state.pendingHide = false;
  state.listenGen = (state.listenGen || 0) + 1; // недослушанная фраза уже никуда не уйдёт
  if (mic.recording) mic.stop();
  try {
    closeChat();
    voice.stop();
    api.abortChat();
    setStatus('');
    hideBubble();
    wake();
    scene.setActivity({ thinking: false, looking: false, listening: false });
    scene.setEmotion('wink', 2);
    await scene.ascend();
    await scene.hideIsland();
    state.visible = false;
    setIgnore(true); // курсор мог остаться над пустым местом — отпускаем мышь
    schedulePeek();
  } finally {
    state.seq = false;
  }
}

// если подглядывает сверху — любое обращение = "нашёл!", он спрыгивает
function catchPeek() {
  if (scene.mode === 'peeking' && state.peekClick) {
    state.peekClick();
    return true;
  }
  return false;
}

// пока идёт сценарий (появление, трюк) — запоминаем последнюю просьбу и выполняем после
let queuedTimer = 0;
function whenFree(fn) {
  clearInterval(queuedTimer);
  if (!state.seq) return fn();
  queuedTimer = setInterval(() => {
    if (state.seq) return;
    clearInterval(queuedTimer);
    fn();
  }, 200);
  return undefined;
}

function ensureShown() {
  if (catchPeek()) return;
  if (!state.visible && !state.seq) appear({ kuku: false });
}

function toggle(forceShow = false) {
  if (catchPeek()) return;
  whenFree(() => {
    if (state.visible && !forceShow) hide();
    else if (!state.visible) appear();
  });
}

function schedulePeek() {
  state.peekAt = performance.now() + (6 + Math.random() * 9) * 60000;
}

async function peek() {
  if (state.visible || state.seq || !cfg.peekWhileHidden) return;
  state.seq = true;
  let clicked = false;
  try {
    await scene.peekDown();
    showBubble('ку-ку… ты где?', { micro: true });
    voice.say('ку-ку… ты где?', { micro: true });
    clicked = await new Promise((resolve) => {
      state.peekClick = () => resolve(true);
      setTimeout(() => resolve(false), 9000);
    });
    state.peekClick = null;
    if (clicked) {
      hideBubble();
      scene.setEmotion('surprised', 1);
      const isl = scene.dropFromPeek();
      await sleep(600);
      pop('БАМ!');
      await isl;
      state.visible = true;
      scene.waveHello(1.5);
      if (!reply || reply.done) say(pick(['Нашёл меня! Ну ладно, остаюсь.', 'О, заметил! Я тут посижу, ладно?']), 'laugh');
    } else {
      showBubble('ну и ладно…', { micro: true });
      voice.say('ну и ладно', { micro: true });
      scene.setEmotion('sad', 2);
      await sleep(900);
      hideBubble();
      await scene.peekUp();
      schedulePeek();
    }
  } finally {
    state.seq = false;
    state.peekClick = null;
  }
}

// ---------------- сон ----------------
function touch() {
  state.lastInteraction = performance.now();
  if (state.sleeping) wake(true);
}
function wake(react = false) {
  if (!state.sleeping) return;
  state.sleeping = false;
  scene.setActivity({ sleeping: false });
  if (react) {
    scene.setEmotion('surprised', 1.2);
    pop('!', 'small');
  }
}
let zTimer = 0;
setInterval(() => {
  if (!state.visible || state.seq) return;
  const idleMin = (performance.now() - state.lastInteraction) / 60000;
  const busy = voice.active || scene.activity.thinking || scene.activity.listening || state.chatOpen;
  if (!state.sleeping && cfg.sleepAfterMin > 0 && idleMin > cfg.sleepAfterMin && !busy) {
    state.sleeping = true;
    scene.setActivity({ sleeping: true });
  }
  if (state.sleeping && performance.now() - zTimer > 1300) {
    zTimer = performance.now();
    zzz();
  }
}, 400);

setInterval(() => {
  if (!state.visible && !state.seq && state.peekAt && performance.now() > state.peekAt) {
    state.peekAt = 0;
    peek();
  }
}, 5000);

// ---------------- трюки и самодеятельность ----------------
function notes() {
  for (let i = 0; i < 3; i += 1) {
    setTimeout(() => {
      const p = scene.headScreen();
      const el = document.createElement('div');
      el.className = 'note';
      el.textContent = pick(['♪', '♫', '♬']);
      el.style.left = `${p.x + (Math.random() - 0.5) * 120}px`;
      el.style.top = `${p.y + 30}px`;
      els.fx.appendChild(el);
      setTimeout(() => el.remove(), 2200);
    }, i * 450);
  }
}

async function doTrick(name) {
  if (!state.visible || state.seq) return;
  if (name === 'wave') {
    scene.waveHello(2);
    return;
  }
  if (!scene.canTrick) return;
  wake();
  state.seq = true;
  try {
    if (name === 'jetpack') {
      setTimeout(() => pop('ВЖУХ!', 'small'), 900);
      await scene.jetpackFlight();
      pop('БАМ!');
    } else if (name === 'backflip') {
      await scene.backflip();
      pop('та-дам!', 'small');
    } else if (name === 'dance') {
      const t = setInterval(notes, 1400);
      notes();
      try {
        await scene.dance(4.5);
      } finally {
        clearInterval(t);
      }
    } else if (name === 'stretch') {
      await scene.stretch();
    }
  } finally {
    state.seq = false;
  }
}

const FREE_WILL = [
  ['jetpack', ['Пойду проветрюсь!', 'Тест-драйв джетпака, не пугайся!', 'Уиии, я лечу-у-у!'], 'laugh'],
  ['dance', ['Ла-ла-ла, никто не смотрит — танцую!', 'Музыка в голове заиграла.'], 'happy'],
  ['backflip', ['Смотри, что умею!', 'Сальто для разминки!'], 'smug'],
  ['stretch', ['Ааах… засиделся я тут.', 'Потянусь-ка.'], 'sleepy'],
];
state.nextFreeWill = performance.now() + 90000;
setInterval(() => {
  if (!cfg.freeWill || !state.visible || state.seq || state.sleeping || state.chatOpen) return;
  if (voice.active || scene.activity.thinking || scene.activity.listening || mic.recording) return;
  const now = performance.now();
  if (now - state.lastInteraction < 45000 || now < state.nextFreeWill) return;
  state.nextFreeWill = now + (2 + Math.random() * 4) * 60000;
  const [name, lines, emo] = pick(FREE_WILL);
  say(pick(lines), emo);
  doTrick(name);
}, 5000);

// ---------------- чат с Claude ----------------
let reqId = 0;
let reply = null;

function newReply() {
  state.pendingHide = false; // прощание из прошлого ответа не должно сработать на новом
  reply = { id: ++reqId, raw: '', pos: 0, shown: '', sent: '', emotion: 'neutral', gotText: false, done: false };
  return reply;
}

function send(text, withScreen = false) {
  text = (text || '').trim();
  if (!text && !withScreen) return;
  touch();
  ensureShown();
  voice.stop();
  const r = newReply();
  els.input.value = '';
  if (text) showYou(text);
  scene.setActivity({ thinking: true, looking: false });
  setStatus(withScreen ? 'смотрю в экран…' : 'думаю…');
  showBubble('…', { sticky: true });
  els.bubble.classList.add('thinking');
  api.chat(r.id, text, withScreen);
}

function showYou(text) {
  els.you.textContent = text;
  els.you.classList.add('on');
  clearTimeout(showYou.t);
  showYou.t = setTimeout(() => els.you.classList.remove('on'), 5000);
}

function feed(r, delta) {
  r.raw += delta;
  // разбираем теги эмоций прямо в потоке
  while (r.pos < r.raw.length) {
    const i = r.raw.indexOf('[', r.pos);
    if (i < 0) {
      pushText(r, r.raw.slice(r.pos));
      r.pos = r.raw.length;
      break;
    }
    if (i > r.pos) pushText(r, r.raw.slice(r.pos, i));
    const j = r.raw.indexOf(']', i);
    if (j < 0) {
      if (r.raw.length - i < 16 && !r.done) {
        r.pos = i;
        return; // ждём продолжения тега
      }
      pushText(r, '[');
      r.pos = i + 1;
      continue;
    }
    const tag = r.raw.slice(i + 1, j).trim().toLowerCase();
    const emo = EMOTION_RE.test(tag) ? tag : EMOTION_ALIAS[tag];
    if (emo) {
      if (r.sent.trim()) flushSentence(r);
      r.emotion = emo;
      if (!voice.active) {
        scene.setEmotion(r.emotion, 6);
        emoFx(r.emotion);
      }
    } else if (ACTION_RE.test(tag)) {
      if (tag === 'hide') state.pendingHide = true;
      else doTrick(tag); // трюк — сразу, пока он говорит
    } else if (!/^[a-z_ -]{1,20}$/.test(tag)) {
      pushText(r, r.raw.slice(i, j + 1)); // обычные квадратные скобки в тексте
    }
    r.pos = j + 1;
  }
}

function pushText(r, text) {
  if (!text) return;
  r.shown += text;
  r.sent += text;
  const shown = cleanSpeech(r.shown);
  if (shown) {
    els.bubble.classList.remove('thinking');
    showBubble(shown, { sticky: true });
  }
  // режем на предложения для синтезатора
  let m;
  while ((m = r.sent.match(/^([\s\S]*?[.!?…]+["»)]?)(\s+)([\s\S]*)$/))) {
    if (m[1].trim().length < 2) break;
    enqueueSentence(r, m[1]);
    r.sent = m[3];
  }
  if (r.sent.length > 240) {
    const cut = r.sent.lastIndexOf(',', 200);
    if (cut > 40) {
      enqueueSentence(r, r.sent.slice(0, cut + 1));
      r.sent = r.sent.slice(cut + 1);
    }
  }
}

function flushSentence(r) {
  if (r.sent.trim()) enqueueSentence(r, r.sent);
  r.sent = '';
}

function enqueueSentence(r, text) {
  const clean = cleanSpeech(text);
  if (clean) voice.enqueue({ text: clean, emotion: r.emotion });
}

api.onChatEvent((ev) => {
  const r = reply;
  if (!r || ev.id !== r.id) return;
  switch (ev.type) {
    case 'tool_start':
    case 'tool':
      if (ev.name === 'look_at_screen') {
        if (!scene.activity.looking) {
          state.lookingSince = performance.now();
          scene.setActivity({ looking: true, thinking: false });
          setStatus('смотрю в экран…');
          if (ev.type === 'tool') {
            setTimeout(() => pop('щёлк', 'small'), 420);
          }
        }
      }
      break;
    case 'memory':
      if (ev.kind === 'self') pop('урок усвоен', 'small');
      else if (ev.kind === 'user' && !ev.duplicate) pop('запомнил!', 'small');
      else if (ev.kind === 'forget') pop('забыл', 'small');
      break;
    case 'text': {
      if (!r.gotText) {
        r.gotText = true;
        const lookedFor = performance.now() - state.lookingSince;
        const release = () => {
          scene.setActivity({ thinking: false, looking: false });
          setStatus('');
        };
        if (scene.activity.looking && lookedFor < 1400) setTimeout(release, 1400 - lookedFor);
        else release();
      }
      feed(r, ev.delta);
      break;
    }
    case 'done':
      r.done = true;
      feed(r, '');
      if (r.pos < r.raw.length) pushText(r, r.raw.slice(r.pos));
      flushSentence(r);
      scene.setActivity({ thinking: false, looking: false });
      setStatus('');
      els.bubble.classList.remove('thinking');
      if (!r.shown.trim()) {
        if (ev.stop === 'refusal') say('Не, вот на это я отвечать не буду. Давай что-нибудь другое?', 'embarrassed');
        else hideBubble();
      } else {
        showBubble(cleanSpeech(r.shown));
      }
      if (state.pendingHide && !voice.active) voice.onIdle();
      break;
    case 'error':
      scene.setActivity({ thinking: false, looking: false });
      setStatus('');
      els.bubble.classList.remove('thinking');
      handleError(ev);
      break;
    default:
      break;
  }
});

function handleError(ev) {
  const lines = {
    no_key: ['Мне нужен API-ключ Anthropic. Открываю настройки — вставь его, и поболтаем.', 'sad'],
    auth: ['Ключ не подходит, блин. Проверь его в настройках.', 'angry'],
    permission: ['Этому ключу не дали доступ к модели. Глянь настройки.', 'sad'],
    not_found: ['Такой модели нет. Выбери другую в настройках.', 'embarrassed'],
    rate_limit: ['Меня там душат лимитами. Попробуй через минутку.', 'sad'],
    network: ['Интернет отвалился? Я ничего не слышу оттуда.', 'scared'],
    screen: [`Не смог посмотреть на экран: ${ev.message}`, 'sad'],
    screen_off: ['Ты выключил мне доступ к экрану в настройках. Я бы и рад, но глаза завязаны.', 'smug'],
  };
  const [text, emo] = lines[ev.code] || [`Что-то сломалось: ${ev.message || 'непонятно что'}`, 'scared'];
  say(text, emo);
  if (['no_key', 'auth', 'permission', 'not_found'].includes(ev.code)) setTimeout(() => api.openSettings(), 1500);
}

// ---------------- микрофон ----------------
async function listen() {
  touch();
  if (mic.recording) {
    mic.stop();
    return;
  }
  if (!cfg.sttReady) {
    openChat();
    say('Голосовой ввод не настроен — добавь ключ распознавания в настройках. А пока можешь нажать Win+H и диктовать прямо в поле.', 'thinking');
    return;
  }
  voice.stop();
  api.abortChat();
  const gen = (state.listenGen = (state.listenGen || 0) + 1);
  scene.setActivity({ listening: true, thinking: false });
  setStatus('слушаю…');
  els.mic.classList.add('rec');
  showBubble('Слушаю…', { sticky: true });
  let blob = null;
  try {
    blob = await mic.start({ onLevel: (l) => (scene.micLevel = l) });
  } catch (err) {
    els.mic.classList.remove('rec');
    scene.setActivity({ listening: false });
    setStatus('');
    say(`Не могу включить микрофон: ${err.message}`, 'sad');
    return;
  }
  els.mic.classList.remove('rec');
  scene.setActivity({ listening: false });
  scene.micLevel = 0;
  if (gen !== state.listenGen || !state.visible) {
    setStatus('');
    return; // пока слушал — спрятали или начали новую запись
  }
  if (!blob) {
    setStatus('');
    say('Не расслышал. Скажешь ещё раз?', 'embarrassed');
    return;
  }
  setStatus('распознаю…');
  const res = await api.transcribe(await blob.arrayBuffer(), blob.type);
  setStatus('');
  if (gen !== state.listenGen || !state.visible) return;
  if (!res.ok) {
    say(res.code === 'stt_auth' ? 'Ключ распознавания речи не подходит.' : `Распознавание сломалось: ${res.message}`, 'sad');
    return;
  }
  if (!res.text) {
    say('Тишина какая-то. Повтори?', 'thinking');
    return;
  }
  send(res.text, false);
}

// ---------------- панель чата ----------------
function openChat() {
  ensureShown();
  state.chatOpen = true;
  els.chat.classList.add('on');
  api.requestFocus();
  setTimeout(() => els.input.focus(), 30);
  touch();
}
function closeChat() {
  const wasOpen = state.chatOpen;
  state.chatOpen = false;
  els.chat.classList.remove('on');
  els.input.blur();
  if (wasOpen) api.releaseFocus?.(); // клавиатуру — обратно твоему окну
}

els.input.addEventListener('keydown', (e) => {
  touch();
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    send(els.input.value);
  } else if (e.key === 'Escape') {
    closeChat();
  }
});
els.mic.addEventListener('click', listen);
els.look.addEventListener('click', () => send(els.input.value || 'Посмотри на мой экран и прокомментируй, что видишь.', true));
els.close.addEventListener('click', closeChat);

// ---------------- тычки ----------------
const POKES = [
  ['Ай! Щекотно!', 'laugh'],
  ['Эй, я тебе не кнопка!', 'angry'],
  ['Чего тыкаешь, кожаный? Говори уже.', 'smug'],
  ['Хи-хи. Ещё раз — и я укушу. Нежно.', 'wink'],
  ['Ой! Ну чего?', 'surprised'],
  ['Я тут, я тут, не дави.', 'embarrassed'],
  ['Пиу!', 'happy'],
  ['Ну ёпт, я ж чуть с гриба не свалился!', 'scared'],
  ['Тыкнул — плати. Шутка. Или нет.', 'smug'],
  ['Ещё раз тыкнешь — включу капслок тебе навсегда.', 'angry'],
  ['О, внимание! Обожаю внимание.', 'love'],
  ['Бип-буп. Робот активирован. Ну чего, кожаный?', 'wink'],
  ['Щекотно, блин! Я ж колобок, у меня везде бока.', 'laugh'],
];

// сам заговаривает, если долго тихо (без API — бесплатно)
const IDLE_LINES = [
  ['Эй, ты там живой? Моргни, если да.', 'thinking'],
  ['Скучно, бл… блин. Давай что-нибудь сломаем? В смысле, починим.', 'smug'],
  ['Я тут сижу, гриб грею. Если что — зови.', 'happy'],
  ['Ты так сосредоточенно смотришь в экран. Уважаю. Пойду тоже сосредоточусь… на кружке кофе.', 'wink'],
  ['Напоминаю: попить воды — это тоже продуктивность.', 'neutral'],
  ['Слушай, а ты сегодня вставал из-за компа? Разомнись, я подожду.', 'thinking'],
];
function timeLine() {
  const h = new Date().getHours();
  if (h >= 0 && h < 5) return ['Уже ночь, ёпта. Может, спать? Я-то колобок, мне норм.', 'sleepy'];
  if (h < 11) return ['Доброе утро! Кофе уже был? У меня вот кружка пустая.', 'happy'];
  if (h >= 18 && h < 24 && Math.random() < 0.5) return ['Вечереет. Если работаешь — ты красавчик. Если залипаешь — тоже.', 'smug'];
  return pick(IDLE_LINES);
}
state.nextChat = performance.now() + 150000;
setInterval(() => {
  if (!state.visible || state.seq || state.sleeping || state.chatOpen || voice.active || mic.recording) return;
  if (scene.activity.thinking || scene.activity.listening) return;
  const now = performance.now();
  if (now < state.nextChat || now - state.lastInteraction < 120000) return;
  state.nextChat = now + (2 + Math.random() * 3) * 60000;
  if (Math.random() > 0.35) return;
  const [text, emo] = timeLine();
  say(text, emo);
}, 15000);
const pokeTimes = [];
function poke() {
  touch();
  scene.poke();
  const now = performance.now();
  pokeTimes.push(now);
  while (pokeTimes.length && now - pokeTimes[0] > 4000) pokeTimes.shift();
  if (voice.active && reply && !reply.done) return;
  if (pokeTimes.length >= 5) {
    say('Да хватит уже тыкать, блин! Я живой вообще-то.', 'angry');
    pokeTimes.length = 0;
    return;
  }
  const [text, emo] = pick(POKES);
  say(text, emo);
}

// ---------------- мышь: клик-сквозь, тычки, перетаскивание ----------------
let down = null;
function setIgnore(v) {
  if (v === state.ignoring) return;
  state.ignoring = v;
  api.setIgnoreMouse(v);
}
function overUi(target) {
  return Boolean(target.closest?.('.ui'));
}
window.addEventListener('mousemove', (e) => {
  if (down) {
    if (!down.dragging && down.what === 'island' && Math.hypot(e.screenX - down.x, e.screenY - down.y) > 5) {
      down.dragging = true;
      api.dragStart();
      document.body.classList.add('dragging');
    }
    return;
  }
  const hit = overUi(e.target) ? 'ui' : scene.hitTest(e.clientX, e.clientY);
  setIgnore(!hit);
  if (hit === 'buddy' && state.visible && !state.seq && !state.sleeping && performance.now() - (state.lastHover || 0) > 30000) {
    scene.waveHello(1.2); // навёл курсор — машет
    scene.setEmotion('happy', 1.5);
  }
  if (hit === 'buddy') state.lastHover = performance.now();
  document.body.dataset.hover = hit || '';
});
window.addEventListener('mouseleave', () => {
  if (!down) setIgnore(true);
});
window.addEventListener('mousedown', (e) => {
  if (e.button !== 0 || overUi(e.target)) return;
  hideMenu();
  const what = scene.hitTest(e.clientX, e.clientY);
  if (!what) return;
  down = { what, x: e.screenX, y: e.screenY, dragging: false };
});
window.addEventListener('mouseup', (e) => {
  if (!down) return;
  const d = down;
  down = null;
  if (d.dragging) {
    api.dragEnd();
    document.body.classList.remove('dragging');
    touch();
    return;
  }
  if (e.button !== 0) return;
  if (scene.mode === 'peeking') {
    state.peekClick?.();
    return;
  }
  if (!state.visible || state.seq) return;
  if (d.what === 'buddy') {
    poke();
    if (!state.chatOpen) openChat();
  } else if (d.what === 'island') {
    if (state.chatOpen) closeChat();
    else openChat();
  }
});
window.addEventListener('dblclick', (e) => {
  if (scene.hitTest(e.clientX, e.clientY) === 'buddy' && state.visible) {
    say(pick(['Двойной тык — двойная радость!', 'Ну всё, ты меня разбудил окончательно.']), 'laugh');
  }
});

// контекстное меню
function showMenu(x, y) {
  els.menu.querySelector('[data-act="mute"]').textContent = cfg.muted ? 'Включить звук' : 'Без звука';
  els.menu.style.left = `${Math.min(x, window.innerWidth - 210)}px`;
  els.menu.style.top = `${Math.min(y, window.innerHeight - 260)}px`;
  els.menu.classList.add('on');
}
function hideMenu() {
  els.menu.classList.remove('on');
}
window.addEventListener('contextmenu', (e) => {
  e.preventDefault();
  if (scene.hitTest(e.clientX, e.clientY)) showMenu(e.clientX, e.clientY);
});
els.menu.addEventListener('click', async (e) => {
  const act = e.target.closest('[data-act]')?.dataset.act;
  hideMenu();
  if (!act) return;
  if (act === 'talk') openChat();
  if (act === 'look') send('Посмотри на мой экран и прокомментируй, что видишь.', true);
  if (act === 'hide') whenFree(() => hide());
  if (act === 'jetpack') doTrick('jetpack');
  if (act === 'dance') doTrick('dance');
  if (act === 'reset') resetChat();
  if (act === 'mute') cfg = await api.setConfig({ muted: !cfg.muted });
  if (act === 'settings') api.openSettings();
  if (act === 'quit') api.quit();
});

function resetChat() {
  api.resetChat?.();
  voice.stop();
  reply = null;
  say('Всё, я всё забыл. Начнём с чистого листа!', 'wink');
}

// ---------------- команды из main ----------------
api.onCommand(({ name, forceShow }) => {
  touch();
  if (name === 'toggle') toggle(forceShow);
  if (name === 'talk') {
    openChat();
    if (cfg.sttReady) listen();
  }
  if (name === 'look') {
    send('Посмотри на мой экран и прокомментируй, что видишь.', true);
  }
  if (name === 'reset') resetChat();
});
api.onConfig((c) => {
  cfg = c;
  voice.configure(c);
});
api.onNotice(({ text }) => toast(text, 6000));
api.onCursor(({ x, y, screenDir }) => {
  scene.setCursor(x, y, screenDir);
  if (state.sleeping) return;
});

// ---------------- главный цикл ----------------
function positionBubble() {
  const h = scene.headScreen();
  const show = h.visible && (state.visible || scene.mode === 'peeking' || scene.mode === 'hanging' || scene.mode === 'descending');
  els.bubble.classList.toggle('hidden', !show);
  if (!show) return;
  const bw = els.bubble.offsetWidth;
  const left = Math.max(8, Math.min(window.innerWidth - bw - 8, h.x - bw / 2));
  els.bubble.style.left = `${left}px`;
  els.bubble.style.bottom = `${window.innerHeight - h.y + 8}px`;
  els.bubble.style.setProperty('--tail', `${Math.max(18, Math.min(bw - 18, h.x - left))}px`);
  els.status.style.left = `${h.x}px`;
  els.status.style.top = `${h.y + 6}px`;
}

function loop() {
  const lip = voice.update();
  scene.setLip(lip.open, lip.round);
  scene.setActivity({ speaking: voice.speaking });
  scene.frame();
  positionBubble();
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);

// поехали: спуск на ниточке, "ку-ку", БАМ
setTimeout(() => appear({ kuku: true }), 600);

// для отладки и превью
window.__buddy = { scene, voice, say, send, hide, appear, peek, toggle, state, doTrick };
