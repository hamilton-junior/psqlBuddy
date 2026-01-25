
const { contextBridge, ipcRenderer } = require('electron');

console.log("[PRELOAD] Sistema de IPC Inicializado.");

contextBridge.exposeInMainWorld('electron', {
  // Expose versions to allow renderer to access electron and node versions safely
  versions: process.versions,
  send: (channel, data) => {
    let validChannels = ['check-update', 'install-update', 'start-download', 'refresh-remote-versions', 'open-external'];
    if (validChannels.includes(channel)) {
      ipcRenderer.send(channel, data);
    }
  },
  on: (channel, func) => {
    let validChannels = [
      'update-available', 
      'update-not-available', 
      'update-downloading', 
      'update-ready', 
      'sync-versions', 
      'update-error',
      'app-version'
    ];
    if (validChannels.includes(channel)) {
      ipcRenderer.on(channel, (event, ...args) => func(...args));
    }
  },
  removeAllListeners: (channel) => {
    ipcRenderer.removeAllListeners(channel);
  }
});
