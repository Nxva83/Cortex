const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('cortex', {
  demander: (donnees) => ipcRenderer.invoke('demander-ia', donnees),
});
