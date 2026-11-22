'use strict';
// Claude Buddy — прозрачное окно поверх всех окон, в котором живёт 3D-Клод на островке.
const path = require('path');
const { fileURLToPath } = require('url');
const {
  app, BrowserWindow, Tray, Menu, nativeImage, screen, globalShortcut,
  ipcMain, desktopCapturer, session, shell, systemPreferences, powerMonitor,
} = require('electron');
const config = require('./config');
const { Brain } = require('./brain');
const { transcribe } = require('./stt');

const BASE_WIDTH = 440;
const ROOT = path.join(__dirname, '..', '..');

let cfg;
let win = null;
let settingsWin = null;
let tray = null;
let brain = null;
let ignoring = true;
let dragTimer = null;
let cursorTimer = null;
let quitting = false;
let latestChatId = 0; // самый свежий запрос из окна: всё, что старее, выкидываем
let lastLoginItem = null;

const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (!win) createOverlay();
    send('command', { name: 'toggle', forceShow: true });
  });
}
app.on('before-quit', () => {
  quitting = true;
});

const RENDERER_DIR = path.join(__dirname, '..', 'renderer');
// IPC принимаем только от наших собственных страниц
function trusted(e, page) {
  try {
    const url = new URL(e.senderFrame.url);
    if (url.protocol !== 'file:') return false;
    const ci = (x) => (process.platform === 'win32' ? x.toLowerCase() : x);
    // fileURLToPath корректно разбирает и диски, и сетевые пути \\server\share
    const file = ci(path.normalize(fileURLToPath(url)));
    const dir = ci(RENDERER_DIR);
    return page ? file === ci(path.join(RENDERER_DIR, page)) : file.startsWith(dir);
  } catch {
    return false;
  }
}
function lockDown(w) {
  w.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https:\/\//.test(url)) shell.openExternal(url);
    return { action: 'deny' };
  });
  w.webContents.on('will-navigate', (e) => e.preventDefault());
}

// Прозрачные окна + WebGL: на некоторых видеокартах без этого бывает чёрный фон.
app.commandLine.appendSwitch('enable-transparent-visuals');
app.commandLine.appendSwitch('autoplay-policy', 'no-user-gesture-required');

let pageReady = false;
const power = { locked: false, suspended: false };
const sendPower = () => send('power', { away: power.locked || power.suspended });
const pendingNotices = [];
function send(channel, payload) {
  if (!win || win.isDestroyed()) return;
  // пока страница не загрузилась, уведомления копим — иначе "хоткей занят" теряется при старте
  if (channel === 'notice' && !pageReady) {
    pendingNotices.push(payload);
    return;
  }
  win.webContents.send(channel, payload);
}

function overlayBounds(display) {
  const wa = display.workArea;
  // на коротких экранах (ноутбук с масштабом 150%) не даём окну стать шире, чем позволяет высота
  const width = Math.round(Math.min(BASE_WIDTH * (cfg.size || 1), wa.height * 0.65));
  return { x: wa.x + wa.width - width, y: wa.y, width, height: wa.height };
}

function createOverlay() {
  const display = screen.getPrimaryDisplay();
  win = new BrowserWindow({
    ...overlayBounds(display),
    transparent: true,
    backgroundColor: '#00000000',
    frame: false,
    resizable: false,
    maximizable: false,
    minimizable: false,
    fullscreenable: false,
    skipTaskbar: true,
    hasShadow: false,
    alwaysOnTop: true,
    show: false,
    title: 'Claude Buddy',
    webPreferences: {
      preload: path.join(__dirname, '..', 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      backgroundThrottling: false,
    },
  });
  win.setAlwaysOnTop(true, 'screen-saver');
  win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  win.setIgnoreMouseEvents(true, { forward: true });
  ignoring = true;
  win.loadFile(path.join(__dirname, '..', 'renderer', 'index.html'));
  win.once('ready-to-show', () => win.showInactive());
  pageReady = false;
  win.webContents.on('did-finish-load', () => {
    pageReady = true;
    // даём app.js подписаться на события
    setTimeout(() => {
      pendingNotices.splice(0).forEach((n) => send('notice', n));
      if (power.locked || power.suspended) sendPower(); // после перезапуска рендерера — тоже знать, что никого нет
    }, 1500);
  });
  lockDown(win);
  // у оверлея нет меню: иначе Ctrl+R перезагружает бадди, Ctrl+-/+ меняют масштаб, Ctrl+Shift+I — devtools
  win.removeMenu();
  // новая страница начинает с "мышь сквозь окно" — main должен думать так же, иначе колонка окна глотает клики
  win.webContents.on('did-start-loading', () => {
    pageReady = false;
    ignoring = true;
    win.setIgnoreMouseEvents(true, { forward: true });
  });
  // упал рендерер (драйвер, OOM) — оживаем сами, а не висим пустым окном до вечера
  // с нарастающей паузой: если рендерер падает на каждом старте, не перезапускаем его раз в секунду весь день
  let crashes = 0;
  let healthyTimer = 0;
  win.webContents.on('render-process-gone', (_e, d) => {
    if (quitting || d.reason === 'clean-exit') return;
    clearTimeout(healthyTimer);
    const delay = [1000, 5000, 30000, 300000][Math.min(crashes, 3)];
    crashes += 1;
    setTimeout(() => {
      if (!win || win.isDestroyed()) return;
      win.reload();
      healthyTimer = setTimeout(() => {
        crashes = 0; // минуту прожил без падений — считаем, что выздоровел
      }, 60000);
    }, delay);
  });
  // Alt+F4 по оверлею не должен убивать бадди навсегда — живём до "Выйти"
  win.on('close', (e) => {
    if (!quitting) e.preventDefault();
  });
  win.on('closed', () => {
    win = null;
  });
  startCursorFeed();
}

// Положение курсора относительно окна — чтобы глаза следили за мышкой по всему экрану.
function startCursorFeed() {
  clearTimeout(cursorTimer);
  let last = '';
  let movedAt = Date.now();
  const tick = () => {
    if (win && !win.isDestroyed()) {
      const p = screen.getCursorScreenPoint();
      const b = win.getBounds();
      const key = `${p.x},${p.y},${b.x}`;
      if (key !== last) {
        last = key;
        movedAt = Date.now();
        const d = screen.getDisplayMatching(b);
        send('cursor', {
          x: p.x - b.x,
          y: p.y - b.y,
          // в какую сторону от окна "основной" экран: -1 = влево, 1 = вправо
          screenDir: d.workArea.x + d.workArea.width / 2 < b.x + b.width / 2 ? -1 : 1,
        });
      }
    }
    // мышь лежит 3 с — опрашиваем 4 раза в секунду; шевельнулась — снова 20 раз
    cursorTimer = setTimeout(tick, Date.now() - movedAt > 3000 ? 250 : 50);
  };
  tick();
}

function openSettings() {
  if (settingsWin && !settingsWin.isDestroyed()) {
    settingsWin.show();
    settingsWin.focus();
    return;
  }
  settingsWin = new BrowserWindow({
    width: 560,
    height: 760,
    title: 'Claude Buddy — настройки',
    backgroundColor: '#1d1512',
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, '..', 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });
  lockDown(settingsWin);
  settingsWin.loadFile(path.join(__dirname, '..', 'renderer', 'settings.html'));
  settingsWin.on('closed', () => {
    settingsWin = null;
  });
}

function trayIcon() {
  const img = nativeImage.createFromPath(path.join(ROOT, 'assets', 'icon.png'));
  return img.isEmpty() ? img : img.resize({ width: 16, height: 16 });
}

function buildTray() {
  if (!tray) {
    tray = new Tray(trayIcon());
    tray.setToolTip('Claude Buddy');
    tray.on('click', () => command('toggle'));
  }
  const menu = Menu.buildFromTemplate([
    { label: 'Поговорить', click: () => command('talk') },
    { label: 'Посмотри на мой экран', click: () => command('look') },
    { label: 'Спрятать / позвать', click: () => command('toggle') },
    { type: 'separator' },
    { label: 'Без звука', type: 'checkbox', checked: cfg.muted, click: (i) => applyConfig({ muted: i.checked }) },
    { label: 'Забыть разговор', click: () => { brain.reset(); send('command', { name: 'reset' }); } },
    { label: 'Настройки…', click: openSettings },
    { type: 'separator' },
    { label: 'Выйти', click: () => app.quit() },
  ]);
  tray.setContextMenu(menu);
}

function command(name) {
  if (!win) createOverlay();
  if (name === 'talk' && win) {
    win.show();
    win.focus();
  }
  send('command', { name });
}

function registerHotkeys() {
  globalShortcut.unregisterAll();
  const failed = [];
  for (const [name, accel] of Object.entries(cfg.hotkeys || {})) {
    if (!accel) continue;
    try {
      if (!globalShortcut.register(accel, () => command(name))) failed.push(accel);
    } catch {
      failed.push(accel);
    }
  }
  if (failed.length) send('notice', { text: `Не смог занять горячие клавиши: ${failed.join(', ')}` });
}

function applyConfig(patch) {
  const prev = cfg;
  const prevSize = cfg.size;
  cfg = config.merge(cfg, patch);
  config.save(cfg);
  // имя и хоткеи живут в блоке памяти system — пересобираем его, разговор не трогаем
  if (prev.userName !== cfg.userName || JSON.stringify(prev.hotkeys) !== JSON.stringify(cfg.hotkeys)) brain?.invalidateMemory();
  if (prev.model !== cfg.model) brain?.modelChanged();
  if (cfg.size !== prevSize && win) {
    win.setBounds(overlayBounds(screen.getDisplayMatching(win.getBounds())));
  }
  syncLoginItem();
  registerHotkeys();
  send('config', config.publicView(cfg));
  if (tray) buildTray();
  return config.publicView(cfg);
}

function syncLoginItem() {
  const want = Boolean(cfg.launchAtLogin);
  if (want === lastLoginItem) return;
  lastLoginItem = want;
  try {
    // portable-сборка распаковывается во временную папку — регистрируем сам .exe;
    // при запуске через `electron .` нужен путь к приложению аргументом
    const exe = process.env.PORTABLE_EXECUTABLE_FILE || process.execPath;
    // путь в кавычках: иначе папка с пробелом ("Новая папка") ломает автозапуск
    const args = app.isPackaged ? [] : [`"${app.getAppPath()}"`];
    app.setLoginItemSettings({ openAtLogin: want, path: exe, args });
  } catch {
    /* не на всех платформах */
  }
}

async function captureScreen() {
  if (process.platform === 'darwin' && systemPreferences.getMediaAccessStatus('screen') !== 'granted') {
    throw new Error('macOS не дал доступ к записи экрана (Настройки → Конфиденциальность → Запись экрана)');
  }
  const cursor = screen.getCursorScreenPoint();
  const display = screen.getDisplayNearestPoint(cursor);
  const { width, height } = display.size;
  const k = Math.min(1, 1568 / Math.max(width, height));
  const sources = await desktopCapturer.getSources({
    types: ['screen'],
    thumbnailSize: { width: Math.round(width * k), height: Math.round(height * k) },
  });
  if (!sources.length) throw new Error('не нашёл ни одного экрана');
  const src = sources.find((s) => String(s.display_id) === String(display.id)) || sources[0];
  const size = src.thumbnail.getSize();
  return { data: src.thumbnail.toJPEG(80).toString('base64'), width: size.width, height: size.height };
}

function setupIpc() {
  ipcMain.on('mouse:ignore', (e, value) => {
    if (!trusted(e, 'index.html') || !win || value === ignoring) return;
    ignoring = value;
    win.setIgnoreMouseEvents(value, { forward: true });
  });

  ipcMain.on('drag:start', () => {
    if (!win) return;
    const start = screen.getCursorScreenPoint();
    const b0 = win.getBounds();
    clearInterval(dragTimer);
    dragTimer = setInterval(() => {
      if (!win) return;
      const p = screen.getCursorScreenPoint();
      win.setPosition(b0.x + (p.x - start.x), b0.y);
    }, 16);
  });
  ipcMain.on('drag:end', () => {
    clearInterval(dragTimer);
    dragTimer = null;
    if (!win) return;
    // Прилипаем к рабочей области того монитора, куда притащили.
    const b = win.getBounds();
    snapTo(screen.getDisplayNearestPoint({ x: b.x + b.width / 2, y: b.y + 10 }));
  });

  ipcMain.on('focus:release', () => {
    // после закрытия чата отдаём клавиатуру обратно тому окну, где ты работал
    if (win && win.isFocused()) win.blur();
  });

  ipcMain.on('focus:request', () => {
    if (win) {
      win.show();
      win.focus();
    }
  });

  ipcMain.handle('config:get', () => config.publicView(cfg));
  ipcMain.handle('config:set', (e, patch) => {
    patch = { ...(patch || {}) };
    // секреты, адреса и хоткеи меняются только из окна настроек
    if (!trusted(e, 'settings.html')) {
      const allowed = ['muted'];
      Object.keys(patch).forEach((k) => {
        if (!allowed.includes(k)) delete patch[k];
      });
    }
    return applyConfig(patch);
  });
  ipcMain.on('settings:open', openSettings);
  ipcMain.on('app:quit', () => app.quit());

  ipcMain.handle('stt:transcribe', async (e, buf, mime) => {
    if (!trusted(e, 'index.html')) return { ok: false, code: 'denied', message: 'denied' };
    try {
      return { ok: true, text: await transcribe(Buffer.from(buf), mime, cfg) };
    } catch (err) {
      return { ok: false, code: err.code || 'stt_error', message: err.message };
    }
  });

  ipcMain.on('chat:abort', (e) => {
    if (!trusted(e, 'index.html')) return;
    latestChatId = Infinity; // отменяет и снимок экрана, который ещё не успел сделаться
    brain.abort();
  });
  ipcMain.on('chat:reset', (e) => {
    if (!trusted(e, 'index.html')) return;
    latestChatId = Infinity;
    brain.reset();
  });
  ipcMain.handle('memory:stats', () => require('./memory').stats());
  ipcMain.handle('memory:list', (e) => (trusted(e, 'settings.html') ? require('./memory').load() : { user: [], self: [] }));
  ipcMain.handle('memory:remove', (e, kind, index, text) => {
    if (!trusted(e, 'settings.html')) return false;
    const ok = require('./memory').removeAt(kind, Number(index), text);
    if (ok) brain.invalidateMemory(); // разговор не трогаем, просто память без этой записи
    return ok;
  });
  ipcMain.handle('memory:clear', (e) => {
    if (!trusted(e, 'settings.html')) return false;
    require('./memory').clear();
    brain.invalidateMemory();
    return true;
  });

  ipcMain.on('chat:send', async (e, { id, text, withScreen, notes }) => {
    if (!trusted(e, 'index.html')) return;
    latestChatId = id;
    const emit = (ev) => send('chat:event', { id, ...ev });
    let screenshot = null;
    if (withScreen) {
      if (!cfg.allowScreen) {
        emit({ type: 'error', code: 'screen_off', message: 'Доступ к экрану выключен в настройках' });
        return;
      }
      emit({ type: 'tool', name: 'look_at_screen', input: {} });
      try {
        screenshot = await captureScreen();
      } catch (err) {
        emit({ type: 'error', code: 'screen', message: err.message });
        return;
      }
      // пока снимали экран, пользователь мог написать новое или спрятать бадди
      if (id !== latestChatId) return;
    }
    await brain.send(text, {
      screenshot,
      emit,
      notes,
      tools: {
        look_at_screen: async () => {
          if (!cfg.allowScreen) throw new Error('пользователь выключил доступ к экрану');
          // даём персонажу полсекунды красиво повернуться к монитору
          await new Promise((r) => setTimeout(r, 450));
          return captureScreen();
        },
      },
    });
  });
}

function snapTo(display) {
  if (!win) return;
  const b = win.getBounds();
  const nb = overlayBounds(display);
  const wa = display.workArea;
  const x = Math.min(Math.max(b.x, wa.x), wa.x + wa.width - nb.width);
  win.setBounds({ ...nb, x });
}

app.whenReady().then(() => {
  if (!gotLock) return;
  cfg = config.load();
  brain = new Brain(() => cfg);

  // Микрофон — только для нашего окна, остальное запрещаем.
  session.defaultSession.setPermissionRequestHandler((_wc, permission, cb) => {
    cb(permission === 'media' || permission === 'speaker-selection');
  });
  session.defaultSession.setPermissionCheckHandler((_wc, permission) => permission === 'media' || permission === 'speaker-selection');

  setupIpc();
  createOverlay();
  buildTray();
  registerHotkeys();
  if (!cfg.apiKey) setTimeout(openSettings, 4500);

  const resnap = () => {
    if (win) snapTo(screen.getDisplayMatching(win.getBounds()));
  };
  screen.on('display-metrics-changed', resnap);
  screen.on('display-removed', resnap);
  lastLoginItem = null;
  syncLoginItem();
  // экран заблокирован / сон — рисовать некому
  // "нет человека" = экран заблокирован ИЛИ комп спит; пробуждение при залоченном экране — всё ещё нет
  // power — на уровне модуля: перезагруженная страница должна сразу узнать, что экран залочен
  powerMonitor.on('lock-screen', () => { power.locked = true; sendPower(); });
  powerMonitor.on('unlock-screen', () => { power.locked = false; sendPower(); });
  powerMonitor.on('suspend', () => { power.suspended = true; sendPower(); });
  powerMonitor.on('resume', () => { power.suspended = false; sendPower(); });
});

app.on('will-quit', () => globalShortcut.unregisterAll());
app.on('window-all-closed', () => {
  /* живём в трее */
});
