'use strict';
// Claude Buddy — прозрачное окно поверх всех окон, в котором живёт 3D-Клод на островке.
const path = require('path');
const {
  app, BrowserWindow, Tray, Menu, nativeImage, screen, globalShortcut,
  ipcMain, desktopCapturer, session, shell, systemPreferences,
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

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', () => send('command', { name: 'toggle', forceShow: true }));
}

// Прозрачные окна + WebGL: на некоторых видеокартах без этого бывает чёрный фон.
app.commandLine.appendSwitch('enable-transparent-visuals');
app.commandLine.appendSwitch('autoplay-policy', 'no-user-gesture-required');

function send(channel, payload) {
  if (win && !win.isDestroyed()) win.webContents.send(channel, payload);
}

function overlayBounds(display) {
  const wa = display.workArea;
  const width = Math.round(BASE_WIDTH * (cfg.size || 1));
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
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https:\/\//.test(url)) shell.openExternal(url);
    return { action: 'deny' };
  });
  win.webContents.on('will-navigate', (e) => e.preventDefault());
  win.on('closed', () => {
    win = null;
  });
  startCursorFeed();
}

// Положение курсора относительно окна — чтобы глаза следили за мышкой по всему экрану.
function startCursorFeed() {
  clearInterval(cursorTimer);
  let last = '';
  cursorTimer = setInterval(() => {
    if (!win || win.isDestroyed()) return;
    const p = screen.getCursorScreenPoint();
    const b = win.getBounds();
    const d = screen.getDisplayMatching(b);
    const key = `${p.x},${p.y},${b.x}`;
    if (key === last) return;
    last = key;
    send('cursor', {
      x: p.x - b.x,
      y: p.y - b.y,
      // в какую сторону от окна "основной" экран: -1 = влево, 1 = вправо
      screenDir: d.workArea.x + d.workArea.width / 2 < b.x + b.width / 2 ? -1 : 1,
    });
  }, 50);
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
  tray = new Tray(trayIcon());
  tray.setToolTip('Claude Buddy');
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
  tray.on('click', () => command('toggle'));
}

function command(name) {
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
  const prevSize = cfg.size;
  cfg = config.merge(cfg, patch);
  config.save(cfg);
  if (cfg.size !== prevSize && win) {
    win.setBounds(overlayBounds(screen.getDisplayMatching(win.getBounds())));
  }
  try {
    app.setLoginItemSettings({ openAtLogin: Boolean(cfg.launchAtLogin) });
  } catch {
    /* не на всех платформах */
  }
  registerHotkeys();
  send('config', config.publicView(cfg));
  if (tray) buildTray();
  return config.publicView(cfg);
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
  ipcMain.on('mouse:ignore', (_e, value) => {
    if (!win || value === ignoring) return;
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
    const d = screen.getDisplayNearestPoint({ x: b.x + b.width / 2, y: b.y + 10 });
    const wa = d.workArea;
    const x = Math.min(Math.max(b.x, wa.x), wa.x + wa.width - b.width);
    win.setBounds({ x, y: wa.y, width: b.width, height: wa.height });
  });

  ipcMain.on('focus:request', () => {
    if (win) {
      win.show();
      win.focus();
    }
  });

  ipcMain.handle('config:get', () => config.publicView(cfg));
  ipcMain.handle('config:set', (_e, patch) => applyConfig(patch || {}));
  ipcMain.on('settings:open', openSettings);
  ipcMain.on('app:quit', () => app.quit());

  ipcMain.handle('stt:transcribe', async (_e, buf, mime) => {
    try {
      return { ok: true, text: await transcribe(Buffer.from(buf), mime, cfg) };
    } catch (err) {
      return { ok: false, code: err.code || 'stt_error', message: err.message };
    }
  });

  ipcMain.on('chat:abort', () => brain.abort());

  ipcMain.on('chat:send', async (_e, { id, text, withScreen }) => {
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
    }
    await brain.send(text, {
      screenshot,
      emit,
      tools: {
        look_at_screen: async () => {
          if (!cfg.allowScreen) throw new Error('пользователь выключил доступ к экрану');
          // даём персонажу полсекунды красиво повернуться к монитору
          await new Promise((r) => setTimeout(r, 450));
          return captureScreen();
        },
        hide_myself: async () => {},
      },
    });
  });
}

app.whenReady().then(() => {
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

  screen.on('display-metrics-changed', () => {
    if (!win) return;
    const b = win.getBounds();
    const d = screen.getDisplayMatching(b);
    win.setBounds({ ...b, y: d.workArea.y, height: d.workArea.height });
  });
});

app.on('will-quit', () => globalShortcut.unregisterAll());
app.on('window-all-closed', () => {
  /* живём в трее */
});
