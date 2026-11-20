// Режиссёр: связывает сцену, голос, микрофон и "мозг" в main-процессе.
import { BuddyScene } from './scene.js';
import { Voice, Mic } from './voice.js';
import { Sfx } from './sfx.js';

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
const sfx = new Sfx();
sfx.setMuted(cfg.muted);
// звуки сцены
scene.onImpact = () => sfx.boing();
scene.onSnap = () => sfx.tink();
scene.onThrust = (sec) => sfx.whoosh(sec);
scene.onIdleAct = (name) => {
  if (name === 'hum') {
    noteOnce();
    sfx.blip();
    setTimeout(() => sfx.blip(), 220);
  }
};

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
// облачко "подпрыгивает" и меняет цвет рамки вместе с эмоцией
function bubbleEmo(emo) {
  if (els.bubble.dataset.emo === emo) return;
  els.bubble.dataset.emo = emo;
  els.bubble.classList.remove('bump');
  void els.bubble.offsetWidth; // перезапуск анимации
  els.bubble.classList.add('bump');
}

function emoFx(emo) {
  bubbleEmo(emo);
  const icon = EMO_FX[emo];
  const now = performance.now();
  if (!icon || (lastFx.emo === emo && now - lastFx.at < 8000)) return;
  lastFx = { emo, at: now };
  sfx.pop(0.7);
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
// *ремарки* — только когда звёздочки стоят отдельно от слов (2*3 + 4*5 не трогаем)
const STAGE_RE = /(^|\s)\*[^*\n]{1,60}\*(?=\s|[.,!?…]|$)/g;
function cleanBubble(text) {
  return text.replace(STAGE_RE, '$1').replace(/\s+/g, ' ').trim();
}
// для синтезатора: ещё и символы, которые он прочитал бы вслух как мусор
function cleanSpeech(text) {
  return cleanBubble(text)
    .replace(/&/g, ' и ') // Chromium отдаёт текст в SAPI как XML: & и <> могут сломать фразу
    .replace(/[<>]/g, ' ')
    .replace(/[\[\]`#~|]/g, '')
    .replace(/(^|\s)[*_]+|[*_]+(?=\s|$)/g, '$1')
    .replace(/\s+/g, ' ')
    .trim();
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
// хоткей по-человечески: CommandOrControl+Alt+Shift+L → Ctrl+Alt+Shift+L
const hk = (k) => (k || '').replace(/CommandOrControl|CmdOrCtrl/g, 'Ctrl');
// "мешок" без повторов: фраза не вернётся, пока не прозвучат остальные, и не пойдёт дважды подряд
const bags = new WeakMap();
const pick = (arr) => {
  if (arr.length < 3) return arr[Math.floor(Math.random() * arr.length)];
  let bag = bags.get(arr);
  if (!bag || !bag.queue.length) {
    const queue = [...arr].sort(() => Math.random() - 0.5);
    if (bag && queue[0] === bag.last) queue.push(queue.shift());
    bag = { queue, last: bag?.last };
    bags.set(arr, bag);
  }
  bag.last = bag.queue.shift();
  return bag.last;
};

// журнал того, что происходило между репликами — уходит в Claude как контекст
const events = [];
let pokesSinceChat = 0;
let lastUserMessageAt = 0;
function note(text) {
  events.push(text);
  while (events.length > 10) events.shift();
}
function contextNotes() {
  const now = new Date();
  const parts = [now.toLocaleString('ru-RU', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })];
  if (lastUserMessageAt) {
    const min = Math.round((Date.now() - lastUserMessageAt) / 60000);
    if (min >= 2) parts.push(min >= 120 ? `с прошлого сообщения ${Math.round(min / 60)} ч` : `с прошлого сообщения ${min} мин`);
  } else {
    parts.push('первое сообщение после запуска');
  }
  if (pokesSinceChat) parts.push(`тебя тыкнули ${pokesSinceChat} раз`);
  parts.push(...events);
  // забираем журнал, но если запрос не дойдёт (нет сети, нет ключа) — вернём его обратно
  const consumed = { events: events.splice(0), pokes: pokesSinceChat };
  pokesSinceChat = 0;
  lastUserMessageAt = Date.now();
  return { text: parts.join('; '), consumed };
}
function restoreNotes(ctx) {
  if (!ctx) return;
  events.unshift(...ctx.events);
  while (events.length > 10) events.shift();
  pokesSinceChat += ctx.pokes;
}

const state = {
  visible: false,
  seq: false, // идёт сценарий появления/исчезновения
  lastInteraction: performance.now(),
  userSeenAt: performance.now(), // когда последний раз двигалась мышь — значит, ты за компом
  sleptAt: 0,
  nextMumble: 0,
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
  els.bubble.classList.remove('thinking'); // send() вернёт точки сам, после showBubble
  els.bubbleText.textContent = text;
  els.bubbleText.scrollTop = 0;
  karaoke.cur = -1;
  karaoke.r = null;
  karaoke.top = -1;
  els.bubble.classList.toggle('micro', micro);
  els.bubble.classList.add('on');
  if (!sticky) bubbleTimer = setTimeout(hideBubble, Math.min(14000, 3500 + text.length * 70));
}
// ---- длинный ответ: облачко показывает то, что сейчас звучит ----
const karaoke = { r: null, cur: -1, top: -1 };
function renderReplyBubble(r) {
  clearTimeout(bubbleTimer);
  els.bubble.classList.remove('thinking', 'micro');
  els.bubble.classList.add('on');
  const t = els.bubbleText;
  const tail = cleanBubble(r.sent);
  // готовые предложения не перерисовываем — только дописываем; хвост (ещё не досказанное) — последний span
  if (karaoke.r !== r) { t.textContent = ''; karaoke.r = r; karaoke.cur = -1; karaoke.top = -1; t.scrollTop = 0; }
  t.querySelector('.tail')?.remove();
  for (let i = t.children.length; i < r.segs.length; i++) {
    const sp = document.createElement('span');
    sp.className = 'seg';
    sp.textContent = (i ? ' ' : '') + r.segs[i];
    t.appendChild(sp);
  }
  if (tail) {
    const sp = document.createElement('span');
    sp.className = 'seg tail';
    sp.textContent = (r.segs.length ? ' ' : '') + tail;
    t.appendChild(sp);
  }
  markSeg();
}
function markSeg() {
  [...els.bubbleText.children].forEach((sp, i) => {
    sp.classList.toggle('past', karaoke.cur >= 0 && i < karaoke.cur);
    sp.classList.toggle('now', i === karaoke.cur);
  });
}
// куда прокрутить: начало текущего предложения (или предыдущего, если влезают оба), с шагом в целую строку
function karaokeScroll(t) {
  const lh = parseFloat(getComputedStyle(t).lineHeight) || 20;
  const box = t.clientHeight;
  if (t.scrollHeight <= box + 2) { t.scrollTop = 0; t.classList.remove('clipTop', 'clipBot'); return; }
  let target;
  if (karaoke.r && karaoke.cur >= 0 && t.children[karaoke.cur]) {
    const base = t.getBoundingClientRect().top - t.scrollTop;
    const topOf = (el) => el.getClientRects()[0]?.top - base;
    const cur = t.children[karaoke.cur];
    const curTop = topOf(cur);
    const curBot = cur.getBoundingClientRect().bottom - base;
    const prev = t.children[karaoke.cur - 1];
    target = prev && curBot - topOf(prev) <= box ? topOf(prev) : curTop;
    if (curBot - target > box) target = curTop; // само предложение длиннее окна — с его начала
  } else {
    target = karaoke.r ? 0 : t.scrollHeight; // ещё не заговорил — с начала; обычная фраза — как раньше
  }
  target = Math.max(0, Math.min(t.scrollHeight - box, Math.floor(target / lh + 0.3) * lh));
  if (Math.abs(target - karaoke.top) > 1) { karaoke.top = target; t.scrollTo({ top: target, behavior: 'smooth' }); }
  t.classList.toggle('clipTop', target > 1);
  t.classList.toggle('clipBot', target + box < t.scrollHeight - 2);
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
  sfx.pop(cls === 'small' ? 1.3 : 1);
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
// междометие при смене эмоции в речи: «хи-хи», «ах», «хм», «пф»…
const EMOTE = {
  laugh: () => sfx.giggle(),
  surprised: () => sfx.gasp(),
  scared: () => sfx.gasp(),
  thinking: () => sfx.hmm(),
  sad: () => sfx.aww('sad'),
  love: () => sfx.aww('love'),
  angry: () => sfx.huff(),
  embarrassed: () => sfx.eep(),
  smug: () => sfx.heh(),
  wink: () => sfx.heh(),
};
let lastVoiceEmo = '';
let lastEmoteAt = 0;
voice.onSentenceStart = (item) => {
  if (item.r && item.r === karaoke.r) {
    karaoke.cur = item.seg;
    markSeg();
  }
  if (item.emotion) {
    scene.setEmotion(item.emotion, 6);
    emoFx(item.emotion);
    const now = performance.now();
    if (!item.micro && item.emotion !== lastVoiceEmo && !cfg.muted && now - lastEmoteAt > 2500 && Math.random() < 0.7) {
      EMOTE[item.emotion]?.();
      lastEmoteAt = now;
    }
    lastVoiceEmo = item.emotion;
  }
};
voice.onNoVoice = () => {
  toast('Нет русского голоса — говорю молча. Добавь: Параметры → Время и язык → Язык → Русский → Речь.', 9000);
};
voice.onIdle = () => {
  if (karaoke.r && karaoke.r.done && karaoke.r === reply) {
    clearTimeout(bubbleTimer);
    const last = karaoke.r.segs.at(-1) || '';
    bubbleTimer = setTimeout(hideBubble, Math.min(6000, 2200 + last.length * 30));
  }
  if (state.pendingHide) {
    state.pendingHide = false;
    setTimeout(() => whenFree(() => hide()), 300);
  }
};

function say(text, emotion = 'happy', opts = {}) {
  if (!opts.noNote) note(`ты сам сказал: «${text.slice(0, 120)}»`);
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
  state.pendingHide = false;
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

const GREETINGS = [
  'Я тут{name}! Чем займёмся?',
  'Вот и я{name}! Скучал?',
  'Тадам! Снова на посту{name}.',
  'Опа, я тут{name}. Что у нас на экране интересного?',
  'Привет{name}! Гриб нагрет, кофе остыл, я готов.',
  'О, снова ты{name}! Ну рассказывай.',
];
const GREET_EMOS = ['happy', 'wink', 'love'];
const JET_EXIT_POPS = ['вжух!', 'улетаю!', 'пока-пока!'];
const PEEK_CALLS = ['ку-ку… ты где?', 'ку-ку! есть кто живой?', 'тук-тук… я только гляну…', 'ку-ку… не занят?'];
const PEEK_SULKS = ['ну и ладно…', 'пф, не очень-то и хотелось', 'ладно, попозже загляну', 'эх, работаешь… не мешаю'];
const FOUND_LINES = ['Нашёл меня! Ну ладно, остаюсь.', 'О, заметил! Я тут посижу, ладно?', 'Попался! В смысле, я попался.'];
const DBL_LINES = ['Двойной тык — двойная радость!', 'Ну всё, ты меня разбудил окончательно.', 'Тык-тык! Я так тоже умею.'];

function greet() {
  if (!cfg.has_apiKey) {
    say('Привет! Я Клод. Дай мне ключ API в настройках — и я оживу по-настоящему.', 'happy');
    return;
  }
  const name = cfg.userName ? `, ${cfg.userName}` : '';
  say(pick(GREETINGS).replace('{name}', name), pick(GREET_EMOS));
}

async function hide() {
  if (!state.visible || state.seq) return;
  state.seq = true;
  state.hiding = true;
  state.pendingHide = false;
  reply = null; // поздние куски ответа, уже летевшие из main, больше не озвучиваются
  note('ты прятался');
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
    // иногда улетает на джетпаке, а не по нитке — не чаще раза в минуту, чтобы не приелось
    const jet = scene.canTrick && Math.random() < 0.4 && performance.now() - (state.lastJetExit ?? -Infinity) > 60000;
    if (jet) {
      state.lastJetExit = performance.now();
      setTimeout(() => pop(pick(JET_EXIT_POPS), 'small'), 700);
      await scene.jetpackExit();
    } else {
      await scene.ascend();
    }
    await scene.hideIsland();
    state.visible = false;
    setIgnore(true); // курсор мог остаться над пустым местом — отпускаем мышь
    schedulePeek();
  } finally {
    state.seq = false;
    state.hiding = false;
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
  // спрятан, прячется прямо сейчас или уползает после подглядывания — вернётся, как только освободится
  if (!state.visible || state.hiding) {
    whenFree(() => {
      if (!state.visible) appear({ kuku: false });
    });
  }
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
    const kuku = pick(PEEK_CALLS);
    showBubble(kuku, { micro: true });
    voice.say(kuku, { micro: true });
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
      if (!reply || reply.done) say(pick(FOUND_LINES), 'laugh');
    } else {
      const sulk = pick(PEEK_SULKS);
      showBubble(sulk, { micro: true });
      voice.say(sulk, { micro: true });
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
const WAKE_BACK = [
  ['О, вернулся! Я не спал, я… медитировал.', 'embarrassed'],
  ['А? Что? Я тут! Просто глаза отдыхали.', 'surprised'],
  ['Ох, задремал. Ты где пропадал?', 'sleepy'],
  ['Пришёл! А я уж думал, ты меня бросил.', 'love'],
];
const WAKE_POKE = [
  ['М-м… ещё пять минуточек…', 'sleepy'],
  ['Ай! Я не сплю! Почти.', 'surprised'],
  ['Кто здесь?! А, это ты. Фух.', 'scared'],
];
const MUMBLES = ['м-м… ещё пять минуточек…', 'хр-р… джетпак… выше…', 'мням… кофе…', 'не трогай мой гриб… хр-р', 'z-z… компилируется…'];

function wake(react = false) {
  if (!state.sleeping) return;
  const sleptMin = (performance.now() - state.sleptAt) / 60000;
  state.sleeping = false;
  scene.setActivity({ sleeping: false });
  if (sleptMin >= 1) note(`ты проспал ${Math.round(sleptMin)} мин`);
  if (react) {
    scene.setEmotion('surprised', 1.2);
    pop('!', 'small');
  }
  return sleptMin;
}
let zTimer = 0;
setInterval(() => {
  if (!state.visible || state.seq) return;
  const now = performance.now();
  // засыпаем, только когда тебя нет: ни кликов, ни движения мыши
  const awayMin = (now - Math.max(state.lastInteraction, state.userSeenAt)) / 60000;
  // пустая панель чата, к которой давно не прикасались, сама уезжает — иначе бадди "замирает"
  if (state.chatOpen && !els.input.value.trim() && now - state.lastInteraction > 25000 && !voice.active && !mic.recording && (!reply || reply.done)) {
    closeChat();
  }
  const busy = voice.active || scene.activity.thinking || scene.activity.listening || state.chatOpen;
  if (!state.sleeping && cfg.sleepAfterMin > 0 && awayMin > cfg.sleepAfterMin && !busy) {
    state.sleeping = true;
    state.sleptAt = now;
    state.mumbles = 0;
    state.nextMumble = now + (5 + Math.random() * 3) * 60000;
    scene.setActivity({ sleeping: true });
  }
  if (!state.sleeping) return;
  if (now - zTimer > 1300) {
    zTimer = now;
    zzz();
  }
  if (now > state.nextMumble) {
    state.nextMumble = now + (5 + Math.random() * 3) * 60000;
    const m = pick(MUMBLES);
    showBubble(m, { micro: true });
    // вслух — только первые пару раз за сон, дальше молча в облачке (ночью никого не будим)
    state.mumbles = (state.mumbles || 0) + 1;
    if (state.mumbles <= 2 && !state.away) voice.say(m, { micro: true });
  }
  // долго спал — один раз за твоё отсутствие сам просыпается и потягивается (тихо)
  if (!state.away && !state.selfWoke && (now - state.sleptAt) / 60000 > 20 && Math.random() < 0.0005) {
    state.selfWoke = true;
    wake();
    doTrick('stretch');
    const line = 'Ох, хорошо поспал… Ты всё ещё где-то там?';
    showBubble(line, { micro: true });
    voice.say(line, { micro: true });
  }
}, 400);

setInterval(() => {
  if (state.away) return; // экран заблокирован — никаких "ку-ку" в пустую комнату
  if (!state.visible && !state.seq && state.peekAt && performance.now() > state.peekAt) {
    state.peekAt = 0;
    peek();
  }
}, 5000);

// ---------------- трюки и самодеятельность ----------------
// одна нотка — когда мурлычет себе под нос
function noteOnce() {
  const p = scene.headScreen();
  const el = document.createElement('div');
  el.className = 'note';
  el.textContent = pick(NOTE_GLYPHS);
  el.style.left = `${p.x + 30}px`;
  el.style.top = `${p.y + 30}px`;
  els.fx.appendChild(el);
  setTimeout(() => el.remove(), 2200);
}
const NOTE_GLYPHS = ['♪', '♫', '♬'];

function notes() {
  for (let i = 0; i < 3; i += 1) {
    setTimeout(() => {
      const p = scene.headScreen();
      const el = document.createElement('div');
      el.className = 'note';
      sfx.blip();
      el.textContent = pick(NOTE_GLYPHS);
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
  if (state.away || !cfg.freeWill || !state.visible || state.seq || state.sleeping || state.chatOpen) return;
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
  lastVoiceEmo = '';
  reply = { id: ++reqId, raw: '', pos: 0, shown: '', sent: '', segs: [], emotion: 'neutral', gotText: false, done: false };
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
  r.ctx = contextNotes();
  api.chat(r.id, text, withScreen, r.ctx.text);
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
    } else {
      pushText(r, r.raw.slice(i, j + 1)); // незнакомое в скобках — обычный текст ([Enter], [docs])
    }
    r.pos = j + 1;
  }
}

function pushText(r, text) {
  if (!text) return;
  r.shown += text;
  r.sent += text;
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
  if (r.segs.length || cleanBubble(r.sent)) renderReplyBubble(r);
}

function flushSentence(r) {
  if (r.sent.trim()) enqueueSentence(r, r.sent);
  r.sent = '';
}

function enqueueSentence(r, text) {
  const b = cleanBubble(text);
  if (!b) return;
  r.segs.push(b);
  const clean = cleanSpeech(text);
  voice.enqueue({ text: clean, emotion: r.emotion, r, seg: r.segs.length - 1 });
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
      if (ev.kind === 'self' && !ev.duplicate) pop('урок усвоен', 'small');
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
      if (ev.stop === 'aborted') break; // сами отменили — облачко не трогаем
      feed(r, '');
      if (r.pos < r.raw.length) pushText(r, r.raw.slice(r.pos));
      flushSentence(r);
      if (r.segs.length) renderReplyBubble(r);
      scene.setActivity({ thinking: false, looking: false });
      setStatus('');
      els.bubble.classList.remove('thinking');
      if (!r.shown.trim()) {
        if (ev.stop === 'refusal') say('Не, вот на это я отвечать не буду. Давай что-нибудь другое?', 'embarrassed');
        else hideBubble();
      } else if (!voice.active) {
        bubbleTimer = setTimeout(hideBubble, 4000);
      } // иначе облачко уберёт voice.onIdle, когда договорит
      if (state.pendingHide && !voice.active) voice.onIdle();
      break;
    case 'error':
      r.done = true;
      restoreNotes(r.ctx?.consumed); // contextNotes() отдаёт { text, consumed }
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
    permission: ['Этому ключу не дали доступ — или Anthropic не пускает из твоей страны. Глянь настройки или включи VPN.', 'sad'],
    not_found: ['Такой модели нет. Выбери другую в настройках.', 'embarrassed'],
    rate_limit: ['Меня там душат лимитами. Попробуй через минутку.', 'sad'],
    network: ['Интернет отвалился? Я ничего не слышу оттуда.', 'scared'],
    screen: [`Не смог посмотреть на экран: ${ev.message}`, 'sad'],
    screen_off: ['Ты выключил мне доступ к экрану в настройках. Я бы и рад, но глаза завязаны.', 'smug'],
  };
  const [text, emo] = lines[ev.code] || [`Что-то сломалось: ${ev.message || 'непонятно что'}`, 'scared'];
  say(text, emo, { noNote: true }); // сообщения об ошибках — не "твои реплики" для контекста
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
  if (reply) reply.done = true; // старый ответ отменён — не висим в "думаю…"
  scene.setActivity({ thinking: false, looking: false });
  els.bubble.classList.remove('thinking');
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
    say(`Не могу включить микрофон: ${err.message}`, 'sad', { noNote: true });
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
    say(res.code === 'stt_auth' ? 'Ключ распознавания речи не подходит.' : `Распознавание сломалось: ${res.message}`, 'sad', { noNote: true });
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
  if (state.away || !state.visible || state.seq || state.sleeping || state.chatOpen || voice.active || mic.recording) return;
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
  const wasSleeping = state.sleeping;
  touch();
  scene.poke();
  pokesSinceChat += 1;
  sfx.squeak();
  if (wasSleeping) {
    const [text, emo] = pick(WAKE_POKE);
    say(text, emo);
    return;
  }
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
    say(pick(DBL_LINES), 'laugh');
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
  if (act === 'mute') {
    cfg = await api.setConfig({ muted: !cfg.muted });
    voice.configure(cfg);
    sfx.setMuted(cfg.muted);
  }
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
  const gotKey = !cfg.has_apiKey && c.has_apiKey;
  cfg = c;
  voice.configure(c);
  sfx.setMuted(c.muted);
  // только что вставили ключ — он "оживает" и коротко рассказывает, что умеет
  if (gotKey && state.visible) {
    whenFree(async () => {
      await say('Ура, ожил! Теперь я настоящий — сальто в честь знакомства!', 'love');
      await doTrick('backflip');
      const look = hk(cfg.hotkeys?.look);
      say(`Скажи «полетай» или «станцуй», жми глаз${look ? ` или ${look}` : ''} — гляну на экран. Только мышкой перед носом не тряси, голова кружится. Кликни по мне — поболтаем!`, 'wink');
    });
  }
});
api.onNotice(({ text }) => toast(text, 6000));
api.onPower?.(({ away }) => {
  const wasAway = state.away;
  state.away = away;
  if (!away) {
    scene.onWake?.();
    if (wasAway) {
      // разблокировали — не вываливаем сразу всё, что "накопилось" за ночь
      const now = performance.now();
      if (!state.visible) schedulePeek();
      state.nextFreeWill = Math.max(state.nextFreeWill || 0, now + 90000);
      state.nextChat = Math.max(state.nextChat || 0, now + 150000);
    }
  }
});
// ---------------- тряска мышкой: у него кружится голова ----------------
const WIGGLE_LINES = [
  ['Эй-эй, полегче! У меня голова кружится!', 'surprised'],
  ['Ты чего мышкой машешь? Я тебе не кот!', 'laugh'],
  ['Блин, у меня зрачки в узел завязались!', 'embarrassed'],
  ['Всё-всё, вижу тебя! Хватит гипнотизировать.', 'smug'],
  ['Уо-о-о… вертолёт… я вертолёт…', 'laugh'],
];
const WIGGLE_AGAIN = [
  ['Ну хватит, а то сам тебя закручу!', 'angry'],
  ['Опять?! Это аттракцион, гони за билет.', 'smug'],
];
const wig = { dir: 0, flips: [], cool: 0, count: 0, lastAt: 0 };
function trackWiggle(x, y) {
  if (!lastCursor) return;
  const now = performance.now();
  const dx = x - lastCursor.x;
  const dy = y - lastCursor.y;
  const ax = Math.abs(dx) >= Math.abs(dy);
  const d = ax ? dx : dy;
  if (Math.abs(d) < 30) return; // опрос раз в 50 мс: медленнее ~600 px/с — не тряска
  const sgn = Math.sign(d) * (ax ? 1 : 2);
  if (sgn !== wig.dir) {
    if (wig.dir === -sgn) wig.flips.push(now);
    wig.dir = sgn;
  }
  // трясти надо именно у него перед носом: внутри окна и рядом с лицом, иначе это просто работа мышкой
  const f = scene.faceScreen();
  const near = x >= 0 && x <= window.innerWidth && Math.hypot(x - f.x, y - f.y) < 220;
  if (!near) {
    wig.flips.length = 0;
    return;
  }
  while (wig.flips.length && now - wig.flips[0] > 1400) wig.flips.shift();
  if (wig.flips.length < 4 || now < wig.cool) return;
  wig.flips.length = 0;
  wig.cool = now + 40000;
  onWiggle(now);
}
function onWiggle(now = performance.now()) {
  if (!state.visible || state.seq) return;
  wig.count = now - wig.lastAt < 300000 ? wig.count + 1 : 1; // считаем за 5 минут
  wig.lastAt = now;
  note('пользователь тряс мышкой у тебя перед носом — у тебя кружилась голова');
  if (state.sleeping) wake(true);
  scene.dizzy(2.2);
  sfx.boing();
  pop('💫', 'small');
  const isBusy = () => voice.active || state.chatOpen || mic.recording || (reply && !reply.done) || state.seq;
  const busyNow = isBusy();
  setTimeout(() => {
    // за 2.3 с мог начаться ответ — не перебиваем его своей репликой
    if (busyNow || isBusy() || !state.visible) {
      scene.setEmotion('embarrassed', 1.5);
      return;
    }
    if (wig.count > 3) return; // дальше молча: покружилась голова — и ладно
    if (wig.count >= 3 && scene.canTrick) {
      say('Ах так? Тогда смотри!', 'smug');
      doTrick('backflip');
      wig.count = 3; // после сальто — дальше молча, просто кружится голова
      return;
    }
    const [text, emo] = pick(wig.count === 2 ? WIGGLE_AGAIN : WIGGLE_LINES);
    say(text, emo);
  }, 2300);
}

let lastCursor = null;
api.onCursor(({ x, y, screenDir }) => {
  scene.setCursor(x, y, screenDir);
  const moved = !lastCursor || Math.abs(lastCursor.x - x) + Math.abs(lastCursor.y - y) > 4;
  trackWiggle(x, y);
  lastCursor = { x, y };
  if (!moved) return;
  state.userSeenAt = performance.now();
  state.selfWoke = false; // ты вернулся — в следующий раз снова может проснуться сам
  if (state.sleeping && performance.now() - state.sleptAt > 20000 && !state.seq) {
    const slept = wake();
    if (slept > 3) {
      const [text, emo] = pick(WAKE_BACK);
      doTrick('stretch');
      say(text, emo);
    }
  }
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
  // облачко не уезжает за верх экрана: ограничиваем высоту и показываем хвост текста
  const t = els.bubbleText;
  t.style.maxHeight = `${Math.max(40, Math.min(window.innerHeight * 0.46, h.y - 16) - 30)}px`;
  const lh = parseFloat(getComputedStyle(t).lineHeight) || 20;
  const avail = Math.max(40, Math.min(window.innerHeight * 0.46, h.y - 16) - 30);
  t.style.maxHeight = `${Math.max(lh, Math.floor(avail / lh) * lh)}px`; // только целые строки
  karaokeScroll(t);
  els.bubble.style.setProperty('--tail', `${Math.max(18, Math.min(bw - 18, h.x - left))}px`);
  els.status.style.left = `${h.x}px`;
  els.status.style.top = `${h.y + 6}px`;
}

// Окно прозрачное, во всю высоту экрана и живёт целый день — рисуем не чаще, чем нужно:
// спрятан и ничего не анимируется — не рисуем вовсе; дремлет — 20 к/с; сидит в простое — 30;
// трюк, речь, тычок, перетаскивание, мышь у окна — полная частота (но не больше ~75 на 144 Гц).
let lastDrawAt = 0;
let parked = 0;
let idleDrawn = false;
function frameBudget() {
  if (scene.idleHidden && !voice.active) return 0;
  if (state.away && !scene.lively && !voice.active) return 0; // экран заблокирован
  const cursorNear = lastCursor && lastCursor.x > -60 && lastCursor.x < window.innerWidth + 60 && scene.time - scene.cursorMovedAt < 0.6;
  if (scene.lively || voice.active || down || cursorNear) return 60;
  return state.sleeping ? 20 : 30;
}
function drawFrame(now) {
  // dt по настоящему времени: анимации-обещания идут с той же скоростью при любой частоте
  const dt = lastDrawAt ? Math.min(0.1, (now - lastDrawAt) / 1000) : 1 / 60;
  lastDrawAt = now;
  const lip = voice.update(dt);
  scene.setLip(lip.open, lip.round);
  scene.setActivity({ speaking: voice.speaking, busy: voice.active || Boolean(reply && !reply.done) || state.chatOpen });
  scene.frame(dt);
  positionBubble();
}
function loop(now) {
  const fps = frameBudget();
  if (fps === 0) {
    if (!idleDrawn) drawFrame(now); // последний кадр — уже пустой
    idleDrawn = true;
    lastDrawAt = 0; // после паузы первый dt = 1/60, без рывка
    parked = setTimeout(() => {
      parked = 0;
      requestAnimationFrame(loop);
    }, 250);
    return;
  }
  idleDrawn = false;
  if (now - lastDrawAt >= 800 / fps) drawFrame(now);
  requestAnimationFrame(loop);
}
// любая новая анимация (появление, подглядывание) будит цикл сразу, не ждём таймера
scene.onWake = () => {
  if (!parked) return;
  clearTimeout(parked);
  parked = 0;
  requestAnimationFrame(loop);
};
requestAnimationFrame(loop);

// поехали: спуск на ниточке, "ку-ку", БАМ
setTimeout(() => appear({ kuku: true }), 600);

// для отладки и превью
window.__buddy = { scene, voice, say, send, hide, appear, peek, toggle, state, doTrick, wiggle: onWiggle };
