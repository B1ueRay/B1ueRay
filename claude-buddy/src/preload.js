'use strict';
const { contextBridge, ipcRenderer } = require('electron');

function on(channel, cb) {
  const handler = (_e, payload) => cb(payload);
  ipcRenderer.on(channel, handler);
  return () => ipcRenderer.removeListener(channel, handler);
}

contextBridge.exposeInMainWorld('buddy', {
  onCursor: (cb) => on('cursor', cb),
  onCommand: (cb) => on('command', cb),
  onConfig: (cb) => on('config', cb),
  onNotice: (cb) => on('notice', cb),
  onPower: (cb) => on('power', cb),
  onChatEvent: (cb) => on('chat:event', cb),

  setIgnoreMouse: (value) => ipcRenderer.send('mouse:ignore', Boolean(value)),
  dragStart: () => ipcRenderer.send('drag:start'),
  dragEnd: () => ipcRenderer.send('drag:end'),
  requestFocus: () => ipcRenderer.send('focus:request'),
  releaseFocus: () => ipcRenderer.send('focus:release'),

  getConfig: () => ipcRenderer.invoke('config:get'),
  setConfig: (patch) => ipcRenderer.invoke('config:set', patch),
  openSettings: () => ipcRenderer.send('settings:open'),
  quit: () => ipcRenderer.send('app:quit'),

  chat: (id, text, withScreen, notes) =>
    ipcRenderer.send('chat:send', { id, text, withScreen: Boolean(withScreen), notes: typeof notes === 'string' ? notes : '' }),
  abortChat: () => ipcRenderer.send('chat:abort'),
  resetChat: () => ipcRenderer.send('chat:reset'),
  memoryStats: () => ipcRenderer.invoke('memory:stats'),
  clearMemory: () => ipcRenderer.invoke('memory:clear'),
  listMemory: () => ipcRenderer.invoke('memory:list'),
  removeMemory: (kind, index, text) => ipcRenderer.invoke('memory:remove', kind, index, text),
  transcribe: (arrayBuffer, mime) => ipcRenderer.invoke('stt:transcribe', arrayBuffer, mime),
});
