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
const pick = (arr, quietMs = 0) => {
  if (arr.length < 3) return arr[Math.floor(Math.random() * arr.length)];
  let bag = bags.get(arr);
  if (!bag || !bag.queue.length) {
    const queue = [...arr].sort(() => Math.random() - 0.5);
    if (bag && queue[0] === bag.last) queue.push(queue.shift());
    bag = { queue, last: bag?.last };
    bags.set(arr, bag);
  }
  // [13] из мешка берём то, что давно не звучало (в том числе из других списков);
  // quietMs — строго: всё звучало недавно → null, и самодеятельность лучше промолчит, чем повторится
  let i = bag.queue.findIndex((x) => fresh(keyOf(x), quietMs || 30 * 60000));
  if (i < 0) {
    if (quietMs) return null;
    i = 0;
  }
  bag.last = bag.queue.splice(i, 1)[0];
  saidAt.set(keyOf(bag.last), Date.now());
  return bag.last;
};
// [13] когда что звучало (по шаблону фразы, не по подставленному тексту)
const saidAt = new Map();
const keyOf = (x) => (Array.isArray(x) ? x[0] : x);
const fresh = (key, ms) => !saidAt.has(key) || Date.now() - saidAt.get(key) > ms;
// [13] счётчики дня — для фраз вроде «третий раз за день тыкаешь»; живут до полуночи
let day = { d: '', pokes: 0, backs: 0, tricks: 0, first: 0, cb: 0 };
try {
  day = { ...day, ...JSON.parse(localStorage.getItem('buddy.day') || '{}') };
} catch {
  /* нет хранилища — считаем с нуля */
}
function dayStat(k, inc = 0) {
  const d = new Date().toDateString();
  // first — начало рабочего дня: ставится по первому вводу (presence), а не в полночь, когда ты ещё «за вчера»
  if (day.d !== d) day = { d, pokes: 0, backs: 0, tricks: 0, first: 0, cb: 0, ms: [] };
  if (typeof day[k] !== 'number') day[k] = 0; // счётчик из новой версии в старом (или испорченном) localStorage
  if (inc) {
    day[k] += inc;
    saveDay();
  }
  return day[k];
}
function saveDay() {
  try {
    localStorage.setItem('buddy.day', JSON.stringify(day));
  } catch {
    /* не страшно */
  }
}
// рабочий день начался заново: первый ввод за сутки или вернулся после ночи/долгого отсутствия
function startWorkday(force = false) {
  const was = dayStat('first'); // заодно переводит счётчики на сегодняшний день
  if (!force && was) return;
  day.first = Date.now();
  saveDay();
}
const plural = (n, one, few, many) => {
  const a = n % 10;
  const b = n % 100;
  return `${n} ${a === 1 && b !== 11 ? one : a >= 2 && a <= 4 && (b < 12 || b > 14) ? few : many}`;
};
// [16] когда ты был тут в последний раз — переживает перезапуск: «тебя три дня не было!»
let lastSeenAt = (() => {
  try {
    return Number(localStorage.getItem('buddy.seen')) || 0;
  } catch {
    return 0;
  }
})();
function markSeen() {
  try {
    localStorage.setItem('buddy.seen', String(Date.now()));
  } catch {
    /* не запомнили — не страшно */
  }
}
// сколько суток прошло по календарю
const dayStart = (t) => new Date(t).setHours(0, 0, 0, 0);
const daysApart = (then, now = Date.now()) => (then > 0 && then <= now ? Math.round((dayStart(now) - dayStart(then)) / 86400000) : 0);
const REUNION = [
  ['Тебя {days} не было! Я уж думал, ты нашёл себе другого колобка.', 'surprised'],
  ['{days}, блин! Я тут зарубки на грибе ставил.', 'love'],
  ['Опа, пропажа нашлась! Тебя {days} не было, я чуть не одичал.', 'happy'],
  ['Тебя {days} не было! Я уже начал разговаривать с деревом. Оно не отвечает, зараза.', 'smug'],
];
const REUNION_WEEKEND = [
  ['О, выходные кончились! Я тут два дня с грибом в гляделки играл. Он победил.', 'happy'],
  ['С понедельником! Я все выходные тебя ждал. Ну и спал немного.', 'love'],
  ['Выходные прошли, а ты меня даже не открыл. Ладно, я тоже отдыхал.', 'smug'],
];
const REUNION_WEEK = [
  ['Неделя, блин! Я тут с грибом чуть не подружился.', 'surprised'],
  ['Целую неделю тебя не было! Я уж хотел в розыск подавать.', 'love'],
  ['Неделя без тебя! Кофе в кружке покрылся плесенью. Шучу. Наверное.', 'smug'],
];
const REUNION_LONG = [
  ['{weeks} тебя не было! Я тут мхом оброс. Буквально, посмотри.', 'surprised'],
  ['Ты где пропадал {weeks}?! Я уже забыл, как ты выглядишь. А, вот так.', 'love'],
  ['{weeks}! Дерево выросло, гриб постарел, а я всё жду. Как Хатико, только круглый.', 'sad'],
];
function reunionLine(days) {
  if (days < 2) return null;
  let pool = REUNION;
  if (days >= 14) pool = REUNION_LONG;
  else if (days >= 7) pool = REUNION_WEEK;
  else if (new Date().getDay() === 1 && days <= 3) pool = REUNION_WEEKEND;
  const [t, e] = pick(pool);
  const slots = { days: plural(days, 'день', 'дня', 'дней'), weeks: plural(Math.floor(days / 7), 'неделю', 'недели', 'недель') };
  return [t.replace(/\{(days|weeks)\}/g, (m, k) => slots[k]), e];
}
const WEEKDAYS = ['воскресенье', 'понедельник', 'вторник', 'среда', 'четверг', 'пятница', 'суббота'];
const clock = (d) => `${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`;
// [13] слоты в заготовках: имя, время, день недели, счётчики — одна строка звучит по-разному
function fill(text) {
  const d = new Date();
  const first = dayStat('first') || Date.now();
  const slots = {
    name: () => (cfg.userName ? `, ${cfg.userName}` : ''),
    time: () => clock(d),
    wd: () => WEEKDAYS[d.getDay()],
    since: () => clock(new Date(first)),
    hours: () => plural(Math.floor((Date.now() - first) / 3600000), 'час', 'часа', 'часов'),
    backs: () => plural(dayStat('backs'), 'раз', 'раза', 'раз'),
    pokes: () => plural(dayStat('pokes'), 'раз', 'раза', 'раз'),
    tricks: () => plural(dayStat('tricks'), 'трюк', 'трюка', 'трюков'),
  };
  // один проход с функцией: «$&» в имени не раскрывается, а «{time}» внутри имени не подменяется
  return text.replace(/\{(\w+)\}/g, (m, k) => (slots[k] ? slots[k]() : m));
}
// [13] дуга дня: сонный с утра, голодный перед обедом, осоловевший после, уставший к вечеру
const dayPart = (h = new Date().getHours()) =>
  h < 5 ? 'night' : h < 11 ? 'morning' : h < 13 ? 'noon' : h < 16 ? 'afternoon' : h < 19 ? 'late' : 'evening';

// журнал того, что происходило между репликами — уходит в Claude как контекст
const events = [];
// [14] вопрос из памяти: since — с какого момента считать 10 минут, asked — заданный вопрос ждёт ответа
const cb = { since: Date.now(), busy: false, asked: null, nextTry: 0 };
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
  // [14] не в общий журнал: десяток фраз от скуки вытеснил бы его, а ответ «да, взяли!» без него непонятен
  const asked = cb.asked && Date.now() - cb.asked.at < 3 * 3600000 ? cb.asked : null;
  if (asked) parts.push(`${Math.round((Date.now() - asked.at) / 60000)} мин назад ты сам спросил по памяти: «${asked.q}» — если он отвечает, это про это`);
  parts.push(...events);
  // забираем журнал, но если запрос не дойдёт (нет сети, нет ключа) — вернём его обратно
  const consumed = { events: events.splice(0), pokes: pokesSinceChat, asked };
  pokesSinceChat = 0;
  cb.asked = null;
  lastUserMessageAt = Date.now();
  return { text: parts.join('; '), consumed };
}
function restoreNotes(ctx) {
  if (!ctx) return;
  events.unshift(...ctx.events);
  while (events.length > 10) events.shift();
  pokesSinceChat += ctx.pokes;
  if (ctx.asked && !cb.asked) cb.asked = ctx.asked;
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
    // прощание относится к этому ответу: если за время трюка пришёл новый — не прячемся посреди него
    const forId = reply?.id;
    const stillThat = () => (reply?.id ?? 0) === (forId ?? 0) && (!reply || reply.done) && !voice.active;
    setTimeout(() => whenFree(() => stillThat() && hide()), 300);
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
  scene.revive();
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
  const gapDays = daysApart(lastSeenAt);
  lastSeenAt = 0; // встречаем один раз за запуск: дальше прятки-появления — как обычно
  if (reunion(gapDays)) return;
  const t = Math.random() < 0.6 && timeGreet(); // [1] утро/ночь/понедельник/пятница
  if (t) return say(...t);
  const name = cfg.userName ? `, ${cfg.userName}` : '';
  say(pick(GREETINGS).replace('{name}', () => name), pick(GREET_EMOS));
}
// [16] не виделись несколько дней: встреча, заметка для Claude, а через неделю — ещё и сальто на радостях
function reunion(days) {
  const re = reunionLine(days);
  if (!re) return false;
  note(`не виделись ${plural(days, 'день', 'дня', 'дней')}`);
  say(...re);
  setTimeout(() => (days >= 7 ? doTrick('backflip') : scene.waveHello(2.5)), 2200);
  return true;
}
// [1] приветствие по времени суток и дню недели (null — обычное приветствие)
function timeGreet() {
  const d = new Date();
  const h = d.getHours();
  const wd = d.getDay();
  if (h < 5) return ['Ты чего не спишь, ночная сова? Ладно, я тоже не сплю. Я ж колобок.', 'sleepy'];
  if (h < 11 && wd === 1) return ['Понедельник, утро. Держись, кожаный, я с тобой.', 'sad'];
  if (h < 11) return ['Доброе утро! Кофе уже был? Моя кружка, кстати, пустая.', 'happy'];
  if (wd === 5 && h >= 15) return ['Пятница, вечер близко! Только ничего не деплой, умоляю.', 'wink'];
  if (h >= 22) return ['Поздновато ты. Давай поболтаем, пока глаза не слиплись.', 'wink'];
  return null;
}
// [1] экран разблокировали — встречает с учётом того, сколько тебя не было и который час
const BACK_SHORT = [
  ['О, вернулся! Я даже соскучиться не успел.', 'happy'],
  ['Ну и где ты был? Я тут с грибом болтал. Он скучный.', 'smug'],
  ['Опа, снова ты! За кофе ходил? Мне, конечно, не принёс.', 'wink'],
  ['С возвращением{name}! Я тут ничего не трогал. Почти.', 'embarrassed'],
  ['Пока тебя не было, тут ничего не случилось. Скукотища, ёпт.', 'sad'],
];
const BACK_COUNT = ['С возвращением! Уже {backs} за день уходишь — ты прям бумеранг.', 'laugh'];
const BACK_LONG = [
  ['Ну наконец-то! Я уж хотел объявление вешать: «Пропал кожаный».', 'embarrassed'],
  ['Ты где шлялся, блин? Я тут чуть мхом не порос.', 'angry'],
  ['Вернулся! А я уж думал, ты меня на калькулятор променял.', 'love'],
];
const BACK_LUNCH = [
  ['Ну как, пообедал? Я вот кристаллик погрыз. Шучу, он невкусный.', 'happy'],
  ['С возвращением с обеда! Теперь главное — не уснуть. Мне тоже.', 'sleepy'],
];
const BACK_NIGHT = [['Ты чего вернулся в такое время? Иди спать, ёпт. Ладно, посижу с тобой.', 'sleepy']];
function welcomeBack(min) {
  if (!state.visible || state.seq || voice.active || (reply && !reply.done)) return;
  const h = new Date().getHours();
  const slept = state.sleeping;
  wake();
  touch();
  if (min >= 36 * 60 && reunion(daysApart(Date.now() - min * 60000))) return; // [16] экран был заблокирован несколько дней
  let pool = min >= 45 ? BACK_LONG : BACK_SHORT;
  if (h >= 12 && h < 15 && min >= 20) pool = BACK_LUNCH;
  else if ((h >= 23 || h < 5) && min >= 10) pool = BACK_NIGHT;
  let [text, emo] = (min >= 240 && timeGreet()) || pick(pool); // утром после ночи — «доброе утро»
  if (pool === BACK_SHORT && dayStat('backs') >= 3 && Math.random() < 0.4 && fresh(BACK_COUNT[0], 3 * 3600000)) {
    saidAt.set(BACK_COUNT[0], Date.now());
    [text, emo] = BACK_COUNT;
  }
  text = fill(text);
  if (slept || min >= 45) doTrick('stretch');
  say(text, emo);
}

async function hide() {
  if (!state.visible || state.seq) return;
  endWait(); // спрятался — вопрос из памяти больше не ждёт ответа
  clearTimeout(streak.deadTimer);
  scene.revive(); // на нитке вверх — не лёжа
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
  scene.revive();
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
  if (!state.visible && !state.seq && state.peekAt && performance.now() > state.peekAt && Date.now() - pres.lastTyping > 60000) {
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
  if (name !== 'stretch') dayStat('tricks', 1);
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

// [13] трюки: реплик больше, по дуге дня — разные трюки, часть трюков молча, иногда комбо
const FREE_WILL = {
  jetpack: ['laugh', [
    'Пойду проветрюсь!',
    'Тест-драйв джетпака, не пугайся!',
    'Уиии, я лечу-у-у!',
    'Кружок над рабочим столом — и обратно. Никому не говори.',
    'Топливо есть, мозгов нет — летим!',
    'Диспетчер, это колобок, прошу взлёт. Сам себе разрешаю.',
  ]],
  dance: ['happy', [
    'Ла-ла-ла, никто не смотрит — танцую!',
    'Музыка в голове заиграла.',
    'Это не танец, это зарядка с ритмом.',
    'Под шум твоего кулера, кстати, вполне танцуется.',
    'Гриб, держи ритм!',
  ]],
  backflip: ['smug', [
    'Смотри, что умею!',
    'Сальто для разминки!',
    'Оценка жюри? Только честно. Десять, я знаю.',
    'Спорим, ты так не можешь? Ну, на стуле — точно.',
    'Сальто! Потому что могу, ёпт.',
  ]],
  stretch: ['sleepy', [
    'Ааах… засиделся я тут.',
    'Потянусь-ка.',
    'Хрусть. Это не я, это гриб.',
    'Тянемся, тянемся… Ты тоже, кстати, можешь.',
  ]],
};
// своё для времени суток — добавляется к общим репликам трюка
const FW_DAY = {
  morning: { stretch: ['Утренняя разминка. Без неё я просто шарик.', 'Потягушки! Мозг, загружайся, ну.'] },
  afternoon: { jetpack: ['После обеда — только на реактивной тяге!'], dance: ['Обед переварился — можно и сплясать!'] },
  late: { stretch: ['К вечеру всё затекло. Даже то, чего у меня нет.'] },
  evening: { stretch: ['Вечерняя растяжка. Колобкам тоже нужен фитнес.'] },
  night: { stretch: ['Ночная зарядка, чтобы не уснуть. Ну, мне.'] },
};
// утром разминается, после обеда носится, к вечеру выдыхается
const FW_PLAN = {
  night: ['stretch', 'stretch', 'dance'],
  morning: ['stretch', 'stretch', 'dance', 'backflip', 'jetpack'],
  noon: ['jetpack', 'dance', 'backflip', 'stretch'],
  afternoon: ['jetpack', 'jetpack', 'dance', 'dance', 'backflip', 'backflip', 'stretch'],
  late: ['stretch', 'stretch', 'dance', 'backflip', 'jetpack'],
  evening: ['stretch', 'stretch', 'dance', 'backflip'],
};
const FW_PACE = { night: 2, morning: 1.3, noon: 1, afternoon: 0.8, late: 1.3, evening: 1.6 };
const fwLines = new Map(); // одни и те же массивы — чтобы у мешка была память
function freeWillLines(name, part) {
  const k = `${name}:${part}`;
  if (!fwLines.has(k)) fwLines.set(k, [...FREE_WILL[name][1], ...(FW_DAY[part]?.[name] || [])]);
  return fwLines.get(k);
}
state.nextFreeWill = performance.now() + 90000;
setInterval(() => {
  if (state.away || !cfg.freeWill || !state.visible || state.seq || state.sleeping || state.chatOpen) return;
  if (voice.active || scene.activity.thinking || scene.activity.listening || mic.recording) return;
  const now = performance.now();
  if (now - state.lastInteraction < 45000 || now < state.nextFreeWill) return;
  if (Date.now() - pres.lastTyping < 60000) return; // ты в потоке — не кривляемся под руку
  const part = dayPart();
  state.nextFreeWill = now + (2 + Math.random() * 4) * 60000 * FW_PACE[part];
  const name = pick(FW_PLAN[part]);
  // реплика — не к каждому трюку, и не та, что была за последние 2 часа: молча тоже смешно
  const line = Math.random() < 0.6 && pick(freeWillLines(name, part), 2 * 3600000);
  if (line) say(fill(line), FREE_WILL[name][0]);
  (async () => {
    await doTrick(name);
    // изредка комбо: прилетел — и сразу сальто
    if (name !== 'stretch' && name !== 'backflip' && Math.random() < 0.15 && !voice.active && state.visible) {
      await sleep(300);
      if (!state.seq && !state.chatOpen && !(reply && !reply.done)) {
        pop(pick(COMBO_POPS), 'small');
        await doTrick('backflip');
      }
    }
  })();
}, 5000);
const COMBO_POPS = ['и ещё!', 'комбо!', 'бонус!'];

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
  endWait();
  // «мёртвый» не отвечает лёжа: любое общее дело сбрасывает серию тычков
  clearTimeout(streak.deadTimer);
  streak.n = 0;
  scene.revive();
  touch();
  ensureShown();
  voice.stop();
  // предыдущий ответ ещё шёл и будет брошен — его контекст («ты сам спросил…», события) вернём в следующий запрос
  if (reply && !reply.done && reply.ctx) restoreNotes(reply.ctx.consumed);
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
    } else if (strayTag(r.raw.slice(i + 1, j))) {
      // ремарка вроде [shrug] / [happy, wink]: из списка берём, что знаем, остальное молча глотаем
      for (const part of tag.split(/\s*,\s*/)) {
        const e2 = EMOTION_RE.test(part) ? part : EMOTION_ALIAS[part];
        if (e2) {
          if (r.sent.trim()) flushSentence(r);
          r.emotion = e2;
          if (!voice.active) {
            scene.setEmotion(e2, 6);
            emoFx(e2);
          }
        } else if (ACTION_RE.test(part) && part !== 'hide') doTrick(part);
      }
    } else {
      pushText(r, r.raw.slice(i, j + 1)); // незнакомое в скобках — обычный текст ([Enter], [docs])
    }
    r.pos = j + 1;
  }
}

// Ремарки, которые модель ставит в скобках вместо тегов: [shrug], [sighs], [happy, wink].
// Глотаем ТОЛЬКО их (и наши эмоции/действия) — [docs], [todo], [enter] остаются текстом.
const STAGE_WORDS = new Set(
  ('shrug shrugs sigh sighs sighing giggle giggles giggling chuckle chuckles laughs laughing grin grins grinning smile smiles smiling ' +
    'nod nods nodding gasp gasps blush blushes blushing winks cough coughs yawn yawns yawning pause beat facepalm pfft ' +
    'whisper whispers whispering clap claps clapping squeak squeaks sniff sniffs gulp gulps groan groans').split(' '),
);
function strayTag(inner) {
  const parts = inner.trim().toLowerCase().split(/\s*,\s*|\s+/);
  return parts.length <= 3 && parts.every((x) => STAGE_WORDS.has(x) || EMOTION_RE.test(x) || x in EMOTION_ALIAS || ACTION_RE.test(x));
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
  // karaoke.r === r: хвост мог исчезнуть (закрылась *ремарка*) — перерисуем, чтобы не висел обрывок
  if (r.segs.length || cleanBubble(r.sent) || karaoke.r === r) renderReplyBubble(r);
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
      if (ev.stop === 'refusal') {
        // отказ мог прийти посреди ответа: недосказанное не дочитываем, контекст вернём к следующей реплике
        voice.stop();
        state.pendingHide = false;
        restoreNotes(r.ctx?.consumed);
        scene.setActivity({ thinking: false, looking: false });
        setStatus('');
        els.bubble.classList.remove('thinking');
        say('Не, вот на это я отвечать не буду. Давай что-нибудь другое?', 'embarrassed', { noNote: true });
        note('на прошлый вопрос ответа не было (отказ) — сам не поднимай эту тему');
        break;
      }
      feed(r, '');
      if (r.pos < r.raw.length) pushText(r, r.raw.slice(r.pos));
      flushSentence(r);
      if (r.segs.length) renderReplyBubble(r);
      scene.setActivity({ thinking: false, looking: false });
      setStatus('');
      els.bubble.classList.remove('thinking');
      if (!r.segs.length) {
        // ни одного предложения (пусто или одни ремарки) — облачко сразу убираем
        hideBubble();
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
  answerStarts(); // [16] спросил по памяти — открыл чат: «о!»
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
// [3] глаза бегают за кареткой, пока печатаешь ему (мышь стоит — api.onCursor взгляд не перебьёт)
const caretCtx = document.createElement('canvas').getContext('2d');
function lookAtCaret() {
  const r = els.input.getBoundingClientRect();
  const cs = getComputedStyle(els.input);
  caretCtx.font = cs.font;
  const pad = parseFloat(cs.paddingLeft) || 0;
  const w = caretCtx.measureText(els.input.value.slice(0, els.input.selectionEnd ?? undefined)).width - els.input.scrollLeft;
  // +4px через символ: каретка упёрлась в край — взгляд всё равно «живой» (setCursor ждёт сдвига >3px)
  scene.setCursor(r.left + pad + Math.max(0, Math.min(r.width - 2 * pad, w)) + (els.input.value.length % 2) * 4, r.top + r.height / 2);
}
els.input.addEventListener('input', lookAtCaret);
els.input.addEventListener('focus', lookAtCaret);
els.mic.addEventListener('click', listen);
els.look.addEventListener('click', () => send(els.input.value || 'Посмотри на мой экран и прокомментируй, что видишь.', true));
els.close.addEventListener('click', closeChat);

// сам заговаривает, если долго тихо (без API — бесплатно)
const IDLE_LINES = [
  ['Эй{name}, ты там живой? Моргни, если да.', 'thinking'],
  ['Скучно, бл… блин. Давай что-нибудь сломаем? В смысле, починим.', 'smug'],
  ['Я тут сижу, гриб грею. Если что — зови.', 'happy'],
  ['Ты так сосредоточенно смотришь в экран. Уважаю. Пойду тоже сосредоточусь… на кружке кофе.', 'wink'],
  ['Напоминаю: попить воды — это тоже продуктивность.', 'neutral'],
  ['Слушай, а ты сегодня вставал из-за компа? Разомнись, я подожду.', 'thinking'],
  ['Сижу, считаю пиксели. Дошёл до ста сорока тысяч и сбился.', 'thinking'],
  ['Знаешь, чем хорош гриб? Он никогда не спрашивает про дедлайн.', 'happy'],
  ['Я тут подумал… А нет, показалось.', 'thinking'],
  ['Если что-то не работает — делай вид, что так и задумано. Проверено.', 'wink'],
  ['Дерево на острове выросло на миллиметр. Событие дня, блин.', 'surprised'],
  ['Кристалл светится — значит, всё хорошо. Наверное. Инструкцию я не читал.', 'smug'],
  ['Хочешь анекдот? Нет? Правильно, я его ещё не придумал.', 'laugh'],
  ['Ты моргаешь вообще? Моргни. Глаза не казённые.', 'love'],
];
const DAY_LINES = {
  night: [
    ['Уже ночь, ёпта. Может, спать? Я-то колобок, мне норм.', 'sleepy'],
    ['{time}. Это уже не вечер, это почти утро. Просто говорю.', 'sleepy'],
    ['Ночью код пишется легко. А утром читается с ужасом.', 'smug'],
    ['Тихо так… Только ты, я и вентилятор.', 'love'],
  ],
  morning: [
    ['Утро{name}. Я проснулся, но мозг ещё грузится. Сорок процентов.', 'sleepy'],
    ['Кружка пустая, а утро ещё нет. Несправедливо, блин.', 'sad'],
    ['{time}. Официально заявляю: я бодр. Почти. Ну, местами.', 'sleepy'],
    ['Сегодня {wd}. Начнём с чего-нибудь лёгкого? С кофе, например.', 'happy'],
    ['Ты уже работаешь, а я ещё зеваю. Кто из нас тут бот?', 'smug'],
  ],
  noon: [
    ['Уже {time}… Ты обедать собираешься? Спрашиваю за себя. Хотя я не ем.', 'thinking'],
    ['Это у тебя живот урчит или мой кристалл гудит?', 'surprised'],
    ['Скоро обед. Только не бери то же, что вчера. Будь как я — разнообразным.', 'wink'],
    ['До обеда держимся. Я в тебя верю. Гриб — не очень.', 'happy'],
  ],
  afternoon: [
    ['Послеобеденная кома, фаза первая: смотрим в экран и делаем вид, что думаем.', 'sleepy'],
    ['Энергия после обеда: девяносто процентов. Ладно, сорок. Ладно, кофе.', 'laugh'],
    ['{time}. Самое время для второго дыхания. Или третьего кофе.', 'happy'],
    ['Пообедал — и сразу в бой? Уважаю. Я бы лёг.', 'smug'],
  ],
  late: [
    ['Финишная прямая! Главное — ничего нового не начинать. Особенно рефакторинг.', 'wink'],
    ['Я устал. Хотя весь день просто сидел на грибе. Это тоже работа, между прочим.', 'sleepy'],
    ['Уже {time}. Рабочий день не резиновый — но ты, похоже, проверяешь.', 'smug'],
    ['К вечеру я как пельмень: мягкий и немного помятый.', 'sleepy'],
  ],
  evening: [
    ['Вечереет. Если работаешь — ты красавчик. Если залипаешь — тоже.', 'smug'],
    ['Уже {time}. Нормальные люди сериал смотрят, а мы тут… ну, тоже нормальные.', 'wink'],
    ['Вечер, тишина, только мы и баги. Романтика, блин.', 'love'],
    ['Может, закругляемся? Завтра ты всё равно это перепишешь.', 'sleepy'],
  ],
};
// [13] со счётчиками дня — только когда есть что посчитать
const COUNT_LINES = [
  ['Ты за компом с {since}. Это {hours}, между прочим. Встать — не преступление.', 'thinking', () => dayStat('first') > 0 && Date.now() - dayStat('first') > 3 * 3600000 && dayPart() !== 'night'],
  ['Ты сегодня уже {backs} уходил и возвращался. Я веду учёт. Шучу. Или нет.', 'smug', () => dayStat('backs') >= 2],
  ['Я сегодня сделал уже {tricks}, а ты ни одного. Ну хоть потянись.', 'smug', () => dayStat('tricks') >= 6],
  ['Ты меня сегодня тыкнул {pokes}. Я всё помню, кожаный.', 'wink', () => dayStat('pokes') >= 3],
];
function timeLine() {
  const r = Math.random();
  if (r < 0.2) {
    const ok = COUNT_LINES.filter(([t, , cond]) => cond() && fresh(t, 4 * 3600000));
    if (ok.length) {
      const [t, emo] = ok[Math.floor(Math.random() * ok.length)];
      saidAt.set(t, Date.now());
      return [fill(t), emo];
    }
  }
  // своё для времени суток — чаще; общее — остальное; всё уже звучало за 2 часа — молчим
  const line = (r < 0.6 && pick(DAY_LINES[dayPart()], 2 * 3600000)) || pick(IDLE_LINES, 2 * 3600000);
  return line && [fill(line[0]), line[1]];
}
state.nextChat = performance.now() + 150000;
setInterval(() => {
  if (state.away || !state.visible || state.seq || state.sleeping || state.chatOpen || voice.active || mic.recording) return;
  if (scene.activity.thinking || scene.activity.listening) return;
  const now = performance.now();
  if (now < state.nextChat || now - state.lastInteraction < 120000) return;
  if (Date.now() - pres.lastTyping < 60000) return; // печатаешь — болтовню от скуки отложим
  state.nextChat = now + (2 + Math.random() * 3) * 60000;
  if (Math.random() > 0.35) return;
  const line = timeLine();
  if (line) say(...line);
}, 15000);
// [14] вопрос «на потом» из памяти: сам вспомнил, что ты рассказывал («ну что, собеседование прошло?»).
// Текст написала модель ещё тогда, в remember; сейчас — заготовка, без запроса к API. Main отдаёт один вопрос и сразу
// помечает его заданным; раз в сутки держит и он, и счётчик дня здесь.
const CB_LEADS = ['', '', 'О, вспомнил! ', 'Так, стоп. ', 'Я тут сидел, думал… '];
const CB_EMOS = ['happy', 'love', 'thinking', 'wink'];
function callbackReady() {
  if (state.away || !state.visible || state.seq || state.sleeping || state.chatOpen || state.welcomePending) return false;
  if (voice.active || mic.recording || (reply && !reply.done) || scene.activity.thinking || scene.activity.listening) return false;
  const h = new Date().getHours();
  if (h < 8 || h >= 23) return false; // ночью и рано утром с расспросами не лезем
  if (Date.now() - cb.since < 10 * 60000) return false; // первые 10 минут после запуска/разблокировки — дай втянуться
  if (Date.now() - pres.lastTyping < 90000) return false; // печатаешь — не сбиваем
  const now = performance.now();
  return now - state.userSeenAt < 60000 && now - state.lastInteraction > 60000; // ты тут, но не занят им прямо сейчас
}
setInterval(async () => {
  if (!api.takeCallback || cb.busy || dayStat('cb') || Date.now() < cb.nextTry || !callbackReady() || Math.random() > 0.3) return;
  cb.busy = true;
  try {
    const q = await api.takeCallback();
    if (typeof q !== 'string' || !q) {
      cb.nextTry = Date.now() + 15 * 60000; // спрашивать пока не о чем — не дёргаем main каждые полминуты
      return;
    }
    dayStat('cb', 1);
    // пока main отвечал, ты мог открыть чат — вопрос уже помечен заданным, так что чуть ждём, а нет — молчим
    const go = () => {
      cb.asked = { q, at: Date.now() };
      say(`${pick(CB_LEADS)}${q}`, pick(CB_EMOS), { noNote: true });
      waitAnswer();
      // вопрос задан — даём на него ответить: болтовня от скуки и трюки пока молчат
      const now = performance.now();
      state.nextChat = Math.max(state.nextChat || 0, now + 8 * 60000);
      state.nextFreeWill = Math.max(state.nextFreeWill || 0, now + 5 * 60000);
    };
    const free = () => state.visible && !state.seq && !state.chatOpen && !voice.active && !(reply && !reply.done);
    if (free()) go();
    else {
      // повторная попытка — с теми же условиями, что и первая (экран, сон, ночь, печать), кроме «недавно с ним говорил»
      const h = () => new Date().getHours();
      const ok = () => free() && !state.away && !state.sleeping && !mic.recording && h() >= 8 && h() < 23 && Date.now() - pres.lastTyping > 90000;
      setTimeout(() => (ok() ? go() : note(`хотел спросить по памяти «${q}», но не успел`)), 20000);
    }
  } catch {
    /* нет моста — нет вопроса */
  } finally {
    cb.busy = false;
  }
}, 30000);
// [16] задал вопрос — ждёт ответа: ~20 с смотрит на тебя (и на место, где выезжает чат) с надеждой.
// Открыл чат или начал печатать — «о!»; молчишь — «ну ладно, потом расскажешь» (молча, в облачке: не дави)
const cbWait = { on: false, timer: 0 };
const CB_SHRUG = ['ну ладно, потом расскажешь', 'ладно, не горит… потом расскажешь', 'молчишь? значит, секрет. уважаю', 'ок, в другой раз спрошу', 'эх… ну, потом так потом'];
const CB_OH = ['о!', 'о! слушаю!', 'о-о, рассказывай!', 'ну-ну?'];
function waitAnswer() {
  cbWait.on = true;
  scene.setActivity({ hopeful: true });
  scene.hopeAt = { x: window.innerWidth / 2, y: window.innerHeight - 30 }; // туда, где выезжает строка чата
  clearTimeout(cbWait.timer);
  cbWait.timer = setTimeout(() => {
    if (!cbWait.on) return;
    endWait();
    if (state.away || !state.visible || state.seq || voice.active || (reply && !reply.done) || els.input.value.trim()) return;
    showBubble(pick(CB_SHRUG), { micro: true });
    scene.setEmotion('sad', 1.6);
  }, 22000);
}
function endWait() {
  if (!cbWait.on) return false;
  cbWait.on = false;
  clearTimeout(cbWait.timer);
  scene.setActivity({ hopeful: false });
  scene.hopeAt = null;
  return true;
}
function answerStarts() {
  if (!endWait()) return;
  showBubble(pick(CB_OH), { micro: true });
  scene.setEmotion('happy', 2);
  scene.waveHello(0.8);
}
els.input.addEventListener('input', () => els.input.value.trim() && answerStarts());
// ---------------- тычки ----------------
// [16] тычки. Первый тычок серии — по тому, куда попал (корона, лицо, пузо) и по настроению
// (только что болтали / сонный), дальше лесенка: 3-й — раздражён, 5-й — злой, 8-й — валится «мёртвым»,
// 12-й — «ладно, ты победил», потом минута перемирия. Между ступеньками — без слов: пищит, морщится, пыхтит.
const POKES = [
  ['Ай! Щекотно!', 'laugh'],
  ['Чего тыкаешь, кожаный? Говори уже.', 'smug'],
  ['Хи-хи. Ещё раз — и я укушу. Нежно.', 'wink'],
  ['Ой! Ну чего?', 'surprised'],
  ['Я тут, я тут, не дави.', 'embarrassed'],
  ['Пиу!', 'happy'],
  ['Ну ёпт, я ж чуть с гриба не свалился!', 'scared'],
  ['Тыкнул — плати. Шутка. Или нет.', 'smug'],
  ['О, внимание! Обожаю внимание.', 'love'],
  ['Бип-буп. Робот активирован. Ну чего, кожаный?', 'wink'],
  ['Клик засчитан. На сотом — ничего не будет.', 'smug'],
];
const POKE_AT = {
  crown: [
    ['Ой-ой, только не в корону!', 'scared'],
    ['Это антенна, а не кнопка звонка! Динь-дон, блин.', 'smug'],
    ['Эй, причёску помнёшь! Я её всё утро укладывал.', 'embarrassed'],
    ['Ай, по макушке! Теперь я на сантиметр ниже.', 'surprised'],
    ['Корона — не джойстик. Хотя… вверх, вверх, вниз, вниз?', 'wink'],
  ],
  face: [
    ['Эй, отпечатки на лице! Я теперь улика.', 'surprised'],
    ['Не в лоб! Там мысли лежат. Ну, одна.', 'thinking'],
    ['Ай, в глаз-то зачем, кожаный?', 'angry'],
    ['Ты всем так в лицо тыкаешь или только мне везёт?', 'smug'],
    ['Ой! Прямо в нос. Ну, туда, где был бы нос.', 'surprised'],
    ['Лицо — это лицо, а не кнопка «ОК»!', 'angry'],
    ['Пальцем в лицо — невежливо. Но тепло. Продолжай. Нет, стой.', 'embarrassed'],
  ],
  belly: [
    ['Хи-хи-хи! Пузо — запретная зона!', 'laugh'],
    ['Ай, щекотно! Я ж колобок, у меня везде бока.', 'laugh'],
    ['Не дави на пузо, я кофе пил!', 'embarrassed'],
    ['Пузико не трогать! Там стратегические запасы.', 'smug'],
    ['Ой, это было пузо. Ты нашёл мою кнопку смеха, гад.', 'laugh'],
  ],
};
// только что поговорили — тычок как «спасибо за беседу»
const POKE_AFTER_CHAT = [
  ['Поговорили — и сразу тыкать? Ладно, засчитаю как обнимашку.', 'love'],
  ['Это ты так говоришь «спасибо за беседу»? Пожалуйста, блин.', 'wink'],
  ['Тык после разговора — как точка в конце. Только в меня.', 'smug'],
  ['Хорошо же болтали! Зачем тыкать? Ладно, мне приятно.', 'embarrassed'],
];
// только что разбудил тычком или глубокая ночь
const POKE_SLEEPY = [
  ['Не тыкай, я ещё не проснулся… Загрузка сорок процентов.', 'sleepy'],
  ['Ммм… ещё раз — и я усну прямо на тебе.', 'sleepy'],
  ['Тык принят. Обработка займёт… хр-р… минуточку.', 'sleepy'],
  ['Я сонный, а ты тыкаешь. Это пытка, между прочим. Мягкая.', 'sad'],
];
const POKE_ANNOYED = [
  ['Третий раз! Я веду счёт, и он не в твою пользу.', 'smug'],
  ['Так, давай договоримся: ты не тыкаешь, я не кусаюсь.', 'thinking'],
  ['Ай! Ну ты настырный. Уважаю, но ай.', 'embarrassed'],
  ['Эй, я тебе не кнопка!', 'angry'],
  ['Тык, тык, тык… Ты дятел, что ли?', 'smug'],
  ['Ну хватит, а? Я тут вообще-то думаю.', 'thinking'],
  ['Ещё раз тыкнешь — включу капслок тебе навсегда.', 'angry'],
  ['Мышка не устала? А я — да.', 'smug'],
];
const POKE_ANGRY = [
  ['Всё, я обиделся. На три секунды. Две. Ладно, уже нет.', 'sad'],
  ['Да хватит уже тыкать, блин! Я живой вообще-то.', 'angry'],
  ['Эй! Я не кликер, ёпт! У меня от тебя синяки.', 'angry'],
  ['Всё, я злой. Видишь брови? Это злые брови.', 'angry'],
  ['Пять тыков подряд! Я позову гриб. Он страшен в гневе.', 'angry'],
  ['Ты мышкой или отбойным молотком?! Полегче, блин!', 'angry'],
];
const POKE_FLOP = [
  ['Всё… ты меня убил. Я умер. Не тыкай труп.', 'sad'],
  ['Ах! Смертельный тык. Прощай, жестокий мир…', 'sad'],
  ['Притворяюсь мёртвым. Хищники мёртвых не трогают. Ты же не хищник?', 'scared'],
  ['Бззт. Колобок выключен. Обращайтесь в сервис.', 'sad'],
];
const POKE_FLOP_SLEEPY = [
  ['Всё. Я сплю. Меня нет. Хр-р.', 'sleepy'],
  ['Ты меня утыкал до отключки. Спокойной ночи, ёпт.', 'sleepy'],
  ['Притворяюсь спящим. Ты меня не видишь.', 'sleepy'],
];
// пока «мёртвый» — шепчет в облачке, вслух не говорит
const POKE_DEAD = ['…', 'я умер, отстань', 'мёртвые не отвечают', 'не дышу. совсем.', 'тут никого нет', 'пи-и-и-и…'];
const POKE_REVIVE = ['ладно, я живой', 'фух, воскрес', 'а, я ж бессмертный', 'ну вот, ожил. не благодари'];
const POKE_GIVEUP = [
  ['Ладно, ты победил! Я сдаюсь. Доволен, кожаный?', 'embarrassed'],
  ['Ладно-ладно, ты победил. Воскресаю. Но я всё запомнил.', 'smug'],
  ['Ты победил. Официально. Медаль сам себе нарисуй.', 'wink'],
  ['Всё, ладно, ты победил! Перемирие? Я даже руку протяну. Ну, ручку.', 'love'],
];
const POKE_TRUCE = ['перемирие же!', 'мы же договорились…', 'тс-с, перемирие', 'я в домике'];
// без слов между ступеньками: всплывашка и рожица
const POKE_QUIET = { 2: [['хи', 'laugh'], ['ай', 'surprised'], ['ой', 'embarrassed']], 4: [['💢', 'angry'], ['ну!', 'angry']], 6: [['💢', 'angry'], ['р-р', 'angry']], 7: [['!!', 'angry'], ['💢', 'angry']] };
// [15] юбилейные тычки за день
const POKE_MILESTONES = {
  3: ['Третий тык за день. Я начинаю что-то подозревать.', 'thinking'],
  10: ['Десятый тык за сегодня! Юбилей. Где торт, блин?', 'happy'],
  25: ['Двадцать пятый раз за день! Я тебе что, эспандер?', 'angry'],
  50: ['Пятьдесят тыков. Всё, ты мой лучший друг. Или маньяк.', 'love'],
};
const streak = { n: 0, at: 0, truceUntil: 0, truceSaid: false, deadTimer: 0 };
const STREAK_GAP = 8000; // дольше 8 с без тычков — серия закончилась
const sleepyMood = () => performance.now() - (state.wokeAt || -1e9) < 120000 || new Date().getHours() < 6;
function firstPoke(part) {
  if (Date.now() - lastUserMessageAt < 3 * 60000 && Math.random() < 0.6) {
    const l = pick(POKE_AFTER_CHAT, 2 * 3600000);
    if (l) return l;
  }
  if (sleepyMood() && Math.random() < 0.6) {
    const l = pick(POKE_SLEEPY, 2 * 3600000);
    if (l) return l;
  }
  return (POKE_AT[part] && Math.random() < 0.55 && pick(POKE_AT[part], 2 * 3600000)) || pick(POKES);
}
function poke(part = 'face') {
  const wasSleeping = state.sleeping;
  touch();
  scene.poke(part);
  pokesSinceChat += 1;
  const nth = dayStat('pokes', 1);
  sfx.squeak();
  if (wasSleeping) {
    state.wokeAt = performance.now(); // [16] разбудил тычком — следующие тычки встречает сонно
    const [text, emo] = pick(WAKE_POKE);
    say(text, emo);
    return;
  }
  if (voice.active && reply && !reply.done) return;
  // [16] спросил по памяти и ждёт — клик по нему открывает чат: это ответ, а не тычок (openChat скажет «о!»)
  if (cbWait.on) return;
  const now = performance.now();
  if (now < streak.truceUntil) {
    // перемирие после «ты победил»: пищит и сплющивается, раз шепнёт — и всё
    scene.setEmotion('smug', 1);
    if (!streak.truceSaid) {
      streak.truceSaid = true;
      showBubble(pick(POKE_TRUCE), { micro: true });
    }
    return;
  }
  const n = (streak.n = now - streak.at < STREAK_GAP ? streak.n + 1 : 1);
  streak.at = now;
  if (n >= 12) {
    clearTimeout(streak.deadTimer);
    scene.revive();
    streak.n = 0;
    streak.truceUntil = now + 60000;
    streak.truceSaid = false;
    note('тебя затыкали до капитуляции: ты сдался и объявил перемирие');
    setTimeout(() => scene.waveHello(1.4), 500);
    return say(...pick(POKE_GIVEUP));
  }
  if (scene.dead) {
    scene.playDead(5);
    armRevive();
    return showBubble(pick(POKE_DEAD), { micro: true });
  }
  if (n === 8) {
    scene.playDead(6);
    armRevive();
    sfx.boing();
    note('тебя затыкали — ты притворился мёртвым');
    return say(...pick(sleepyMood() ? POKE_FLOP_SLEEPY : POKE_FLOP));
  }
  // [15] юбилей не теряется: прозвучит на ближайшем тычке без своей реплики
  if (!Array.isArray(day.ms)) day.ms = [];
  const marks = Object.keys(POKE_MILESTONES).map(Number);
  const due = marks.filter((m) => nth >= m && !day.ms.includes(m)).pop();
  if (due) {
    day.ms.push(...marks.filter((m) => m <= due && !day.ms.includes(m)));
    saveDay();
    return say(...POKE_MILESTONES[due]);
  }
  if (n === 3) return say(...pick(POKE_ANNOYED));
  if (n === 5) return say(...pick(POKE_ANGRY));
  if (n === 1) return say(...firstPoke(part));
  const q = POKE_QUIET[n] || POKE_QUIET[7];
  const [t, emo] = q[Math.floor(Math.random() * q.length)];
  scene.setEmotion(emo, 1.4);
  pop(t, 'small');
  if (emo === 'angry') sfx.huff();
}
// не тыкаешь — сам «оживает» и бурчит
function armRevive() {
  clearTimeout(streak.deadTimer);
  streak.deadTimer = setTimeout(() => {
    // говорит/отвечает/в сценке — «фух, воскрес» не затирает облачко
    if (scene.dead || !state.visible || voice.active || (reply && !reply.done) || state.seq) return;
    streak.n = 0;
    showBubble(pick(POKE_REVIVE), { micro: true });
    scene.setEmotion('embarrassed', 1.5);
  }, 6300);
}
// [16] клик по дереву или кружке: дерево качается; реплика — не чаще раза в 15 с (клик по острову — как раньше, чат)
const TAP_AT = {
  tree: [
    ['Не тряси дерево! Оно у меня одно.', 'scared'],
    ['Яблок нет. И не будет. Это декоративное дерево, кожаный.', 'smug'],
    ['Эй, это моё дерево! Я с ним по вечерам разговариваю.', 'angry'],
    ['Тише, там птичка живёт. Воображаемая.', 'love'],
  ],
  mug: [
    ['Кружку не трогай! Там последний кофе. Ну, был.', 'sad'],
    ['Это моя кружка! Видишь надпись? Нет? Потому что её нет. Но кружка моя.', 'smug'],
    ['Хочешь кофе? Я бы налил, но у меня лапки.', 'embarrassed'],
  ],
  island: [
    ['Эй, не раскачивай остров! Я тут вообще-то сижу.', 'scared'],
    ['Тук-тук. Кто там? Земля. Смешно же, ну.', 'laugh'],
    ['Землетрясение! А, это ты. Фух.', 'surprised'],
    ['Осторожно, остров летает на честном слове.', 'thinking'],
  ],
};
const islandTap = { at: -1e9 };
function tapIsland(part = 'island') {
  if (!state.visible || state.seq) return;
  if (part === 'tree') {
    scene.shakeTree();
    sfx.tink();
  } else if (part === 'island') {
    scene.bumpIsland();
    sfx.boing();
  } else sfx.tink();
  const now = performance.now();
  if (voice.active || (reply && !reply.done) || scene.dead || now - islandTap.at < 15000) {
    scene.setEmotion('surprised', 0.8);
    return;
  }
  islandTap.at = now;
  say(...pick(TAP_AT[part] || TAP_AT.island));
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
  down = { what, part: scene.hitPart(e.clientX, e.clientY), x: e.screenX, y: e.screenY, dragging: false }; // [16] корона / лицо / пузо, дерево / кружка
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
    poke(d.part);
    if (!state.chatOpen) openChat();
  } else if (d.part === 'tree' || d.part === 'mug') {
    tapIsland(d.part);
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
  if (away && !wasAway) {
    state.awayAt = Date.now(); // [1]
    markSeen(); // [16]
    endWait();
  }
  if (!away) {
    scene.onWake?.();
    if (wasAway) {
      // разблокировали — не вываливаем сразу всё, что "накопилось" за ночь
      const now = performance.now();
      cb.since = Date.now(); // [14] вопрос из памяти — не раньше чем через 10 минут
      if (!state.visible) schedulePeek();
      state.nextFreeWill = Math.max(state.nextFreeWill || 0, now + 90000);
      state.nextChat = Math.max(state.nextChat || 0, now + 150000);
      // [1] сколько тебя не было: Claude узнает из контекста, а сам он встречает голосом
      const awayFrom = state.awayAt;
      const min = awayFrom ? (Date.now() - awayFrom) / 60000 : 0;
      state.awayAt = 0;
      if (min >= 1) note(`пользователь отходил: экран был заблокирован ${min >= 90 ? `${Math.round(min / 60)} ч` : `${Math.round(min)} мин`}`);
      if (min >= 5) pres.activeSince = 0; // обед/ночь — это перерыв, а не «полтора часа без отдыха»
      // вернулся после ночи или 4+ часов — это начало рабочего дня, а не очередная отлучка
      if (min >= 240 || (awayFrom && new Date(awayFrom).toDateString() !== new Date().toDateString())) startWorkday(true);
      else if (min >= 2) dayStat('backs', 1);
      if (min >= 2 && state.visible) {
        // свой таймер, а не whenFree: тот на один слот и затёр бы «спрячься» с хоткея.
        // Пока встреча ждёт, общее «проснулся от мыши» молчит — иначе ситуативная фраза не прозвучит.
        state.welcomePending = true;
        const until = performance.now() + 15000;
        const tryWelcome = () => {
          if (state.away || !state.visible || state.hiding || performance.now() > until) {
            state.welcomePending = false;
            if (state.sleeping && !state.away) wake();
            return;
          }
          if (state.seq || voice.active) return setTimeout(tryWelcome, 250);
          state.welcomePending = false;
          welcomeBack(min);
          if (state.sleeping) wake(); // ответ ещё шёл — встречать не стали, но и спать уже нечего
        };
        setTimeout(tryWelcome, 1500);
      }
    }
  }
});
// [16] ты тут (мышь/клавиатура за последние 2 минуты) — отмечаем, когда виделись
setInterval(() => {
  if (!state.away && performance.now() - state.userSeenAt < 120000) markSeen();
}, 60000);
window.addEventListener('beforeunload', () => {
  if (!state.away && performance.now() - state.userSeenAt < 120000) markSeen();
});
// [2] ---------------- присутствие: печатаешь без мышки — ты всё равно тут ----------------
const pres = { activeSince: 0, typingSince: 0, lastTyping: 0, nextNag: 0, typingLineAt: 0 };
const STRETCH_LINES = [
  ['Ты уже полтора часа без перерыва. Встань, потянись — я покажу как!', 'thinking'],
  ['Слушай, спина не казённая. Давай вместе потянемся, а?', 'love'],
  ['Полтора часа в экран! Я колобок, и то у меня всё затекло.', 'sleepy'],
];
const TYPING_LINES = ['тыц-тыц-тыц…', 'ух, строчит…', 'пальцы не дымятся?', 'клац-клац-клац…'];
api.onPresence?.(({ idle }) => {
  const now = Date.now();
  if (idle >= 300) {
    pres.activeSince = 0; // пять минут без ввода — это уже перерыв
    if (idle >= 4 * 3600) pres.longIdle = true; // ночь/полдня без ввода (даже без блокировки) — потом начнётся новый рабочий день
    return;
  }
  if (pres.longIdle && idle <= 2) {
    pres.longIdle = false;
    startWorkday(true);
  }
  if (!pres.activeSince) pres.activeSince = now - idle * 1000;
  if (idle > 2) return;
  state.userSeenAt = performance.now(); // ты за компом, даже если мышь не трогал
  startWorkday(); // [13] первая активность за день — отсюда «ты за компом с 9:12»
  if (state.sleeping) userBack();
  const free = state.visible && !state.seq && !state.sleeping && !state.chatOpen && !voice.active && !(reply && !reply.done);
  if (free && now - pres.activeSince > 90 * 60000 && now > pres.nextNag) {
    pres.nextNag = now + 60 * 60000;
    note('ты предложил размяться: пользователь полтора часа без перерыва');
    say(...pick(STRETCH_LINES));
    doTrick('stretch');
    return;
  }
  // ввод есть, а мышь стоит — печатает (или крутит колёсико)
  if (scene.time - scene.cursorMovedAt < 4 || state.chatOpen) return;
  if (now - pres.lastTyping > 30000) pres.typingSince = now;
  pres.lastTyping = now;
  if (!free) return;
  // смотрит туда же, куда ты: на основной экран и чуть вниз — «читает» вместе с тобой
  scene.glance = { x: scene.screenDir * 0.8, y: -0.3, until: scene.time + 2.4 };
  scene.nextGlance = scene.time + 2.6;
  if (now - pres.typingSince > 8 * 60000 && now - pres.typingLineAt > 40 * 60000) {
    pres.typingLineAt = now;
    note('пользователь долго и много печатал');
    scene.setEmotion('smug', 1.5);
    showBubble(pick(TYPING_LINES), { micro: true }); // молча: не сбиваем с мысли
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
  if (state.sleeping) userBack();
});
function userBack() {
  if (!state.sleeping || performance.now() - state.sleptAt < 20000 || state.seq || state.away || state.welcomePending) return;
  const slept = wake();
  if (slept > 3) {
    const [text, emo] = pick(WAKE_BACK);
    doTrick('stretch');
    say(text, emo);
  }
}

// ---------------- главный цикл ----------------
// облачко и статус убраны и уже погасли — невидимое не двигаем: иначе каждый кадр layout + пересчёт стилей
let bubbleOffAt = 0;
function bubbleIdle() {
  if (els.bubble.classList.contains('on') || els.status.classList.contains('on')) bubbleOffAt = 0;
  else if (!bubbleOffAt) bubbleOffAt = performance.now();
  else if (performance.now() - bubbleOffAt > 400) return (karaoke.availRef = null), true;
  return false;
}
function positionBubble() {
  const h = scene.headScreen();
  const show = h.visible && (state.visible || scene.mode === 'peeking' || scene.mode === 'hanging' || scene.mode === 'descending');
  els.bubble.classList.toggle('hidden', !show);
  if (!show || bubbleIdle()) return;
  const bw = els.bubble.offsetWidth;
  const left = Math.max(8, Math.min(window.innerWidth - bw - 8, h.x - bw / 2));
  els.bubble.style.left = `${left}px`;
  els.bubble.style.bottom = `${window.innerHeight - h.y + 8}px`;
  // облачко не уезжает за верх экрана: ограничиваем высоту и показываем хвост текста
  const t = els.bubbleText;
  const lh = parseFloat(getComputedStyle(t).lineHeight) || 20;
  const avail = Math.max(40, Math.min(window.innerHeight * 0.46, h.y - 16) - 30);
  // голова качается при речи примерно на строку — берём место по самой высокой точке качания:
  // сжимаемся сразу, а растём медленно (за несколько секунд), чтобы высота облачка не прыгала
  // пока облачко скрыто — подстраиваемся мгновенно; медленный рост — только когда оно на экране
  if (karaoke.availRef == null || avail < karaoke.availRef || !els.bubble.classList.contains('on')) karaoke.availRef = avail;
  else karaoke.availRef += (avail - karaoke.availRef) * 0.004;
  t.style.maxHeight = `${Math.max(1, Math.floor(karaoke.availRef / lh)) * lh}px`;
  karaokeScroll(t);
  els.bubble.style.setProperty('--tail', `${Math.max(18, Math.min(bw - 18, h.x - left))}px`);
  els.status.style.left = `${Math.max(70, Math.min(window.innerWidth - 70, h.x))}px`; // лёжа голова у края — плашка не вылезает
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
window.__buddy = { scene, voice, say, send, hide, appear, peek, toggle, state, doTrick, wiggle: onWiggle, cb };
