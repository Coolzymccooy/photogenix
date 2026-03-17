// electron/preload.cjs — Secure bridge between renderer and main process
const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("electronAPI", {
  // Native file dialogs
  openFiles: (options) => ipcRenderer.invoke("dialog:openFiles", options),
  saveFile: (options) => ipcRenderer.invoke("dialog:saveFile", options),

  // App info
  getVersion: () => ipcRenderer.invoke("app:getVersion"),
  getPlatform: () => ipcRenderer.invoke("app:getPlatform"),

  // Menu events from main process
  onMenuImportImages: (callback) => {
    ipcRenderer.on("menu-import-images", callback);
    return () => ipcRenderer.removeListener("menu-import-images", callback);
  },
  onMenuExport: (callback) => {
    ipcRenderer.on("menu-export", callback);
    return () => ipcRenderer.removeListener("menu-export", callback);
  },

  // Platform detection
  isElectron: true,
});
