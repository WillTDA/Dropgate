const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
    getSettings: () => ipcRenderer.invoke('get-settings'),
    setSettings: (settings) => ipcRenderer.invoke('set-settings', settings),
    onFileOpened: (callback) => ipcRenderer.on('file-opened', (_event, file) => callback(file)),
    getClientVersion: () => ipcRenderer.invoke('get-app-version')
});