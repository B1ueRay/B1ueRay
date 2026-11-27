// Заглушка вместо Electron-моста: позволяет открыть бадди в обычном браузере (npm run preview)
// и посмотреть анимации без API-ключа. Отвечает заготовками с тегами эмоций.
export function createMock() {
  const listeners = { cursor: [], command: [], config: [], notice: [], chat: [], power: [], presence: [] };
  const emit = (k, v) => listeners[k].forEach((cb) => cb(v));
  const cfg = {
    has_apiKey: true, has_sttApiKey: false, sttReady: false, muted: true, model: 'claude-opus-5-5', effort: 'low',
    language: 'ru', voicePitch: 1.3, voiceRate: 1.08, voiceVolume: 1, allowScreen: true, peekWhileHidden: true, freeWill: true,
    sleepAfterMin: 5, size: 1, userName: '', hotkeys: {},
  };
  const replies = [
    '[happy] Привет! Я тут, на своём грибе. [wink] Удобно, кстати.',
    '[laugh] Смотри, что умею! [jetpack] Уиии!',
    '[thinking] Хм, дай подумать… [surprised] О! Придумал! [laugh] Шучу, ни хрена не придумал.',
    '[love] Ты лучший пользователь на этом мониторе. [smug] Ну, единственный, но всё равно.',
  ];
  let n = 0;
  // [14] вопросы «на потом»: каждый отдаётся один раз (как takeCallback в main); window.__mockCallbacks — для тестов
  const callbacks = (window.__mockCallbacks = window.__mockCallbacks || { queue: ['Слушай, как там твоя игра на Rust?'], taken: 0, calls: 0 });
  // для превью/тестов: window.__mockEmit('power', {away:true}) или ('presence', {idle:0})
  window.__mockEmit = emit;
  window.addEventListener('mousemove', (e) => emit('cursor', { x: e.clientX, y: e.clientY, screenDir: -1 }));
  return {
    onCursor: (cb) => listeners.cursor.push(cb),
    onCommand: (cb) => listeners.command.push(cb),
    onConfig: (cb) => listeners.config.push(cb),
    onNotice: (cb) => listeners.notice.push(cb),
    onChatEvent: (cb) => listeners.chat.push(cb),
    onPower: (cb) => listeners.power.push(cb),
    onPresence: (cb) => listeners.presence.push(cb),
    setIgnoreMouse: () => {},
    dragStart: () => {},
    dragEnd: () => {},
    requestFocus: () => {},
    releaseFocus: () => {},
    getConfig: async () => ({ ...cfg }),
    setConfig: async (p) => Object.assign(cfg, p),
    openSettings: () => {},
    quit: () => {},
    abortChat: () => {},
    resetChat: () => {},
    memoryStats: async () => ({ user: 0, self: 0 }),
    clearMemory: async () => true,
    listMemory: async () => ({ user: [], self: [] }),
    removeMemory: async () => true,
    removeAsk: async () => true,
    takeCallback: async () => {
      callbacks.calls += 1;
      const q = callbacks.queue.shift() || null;
      if (q) callbacks.taken += 1;
      return q;
    },
    transcribe: async () => ({ ok: false, code: 'stt_not_configured', message: 'превью' }),
    chat: (id, _text, withScreen, notes) => {
      window.__mockLastNotes = notes; // для тестов: что ушло в [контекст, не зачитывай: …]
      const text = withScreen ? '[surprised] Ого, сколько окон! [laugh] Вкладок больше, чем у меня мыслей.' : replies[n++ % replies.length];
      const chunks = text.match(/.{1,6}/gs);
      let i = 0;
      if (withScreen) emit('chat', { id, type: 'tool', name: 'look_at_screen', input: {} });
      setTimeout(function tick() {
        if (i < chunks.length) {
          emit('chat', { id, type: 'text', delta: chunks[i++] });
          setTimeout(tick, 40);
        } else emit('chat', { id, type: 'done', stop: 'end_turn' });
      }, withScreen ? 1500 : 700);
    },
    __emit: emit,
  };
}
