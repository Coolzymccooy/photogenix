// electron/main.cjs — Electron main process for PhotoGenix Desktop
const { app, BrowserWindow, ipcMain, dialog, shell, Menu } = require("electron");
const path = require("path");
const { spawn } = require("child_process");

let mainWindow = null;
let backendProcess = null;
const BACKEND_PORT = 5051;

function getIsDev() {
  try { return !app.isPackaged; } catch { return true; }
}

function startBackend() {
  if (getIsDev()) {
    console.log("[backend] Dev mode — backend managed by concurrently");
    return;
  }
  const serverPath = path.join(process.resourcesPath, "server", "index.cjs");
  const nodeCmd = process.platform === "win32" ? "node.exe" : "node";
  backendProcess = spawn(nodeCmd, [serverPath], {
    env: { ...process.env, PORT: String(BACKEND_PORT), CORS_ORIGIN: "http://localhost:3080", NODE_ENV: "production" },
    stdio: ["ignore", "pipe", "pipe"],
  });
  backendProcess.stdout?.on("data", (d) => console.log("[backend]", d.toString().trim()));
  backendProcess.stderr?.on("data", (d) => console.error("[backend]", d.toString().trim()));
  backendProcess.on("error", (err) => console.error("[backend] Failed:", err.message));
}

function stopBackend() {
  if (backendProcess && !backendProcess.killed) { backendProcess.kill(); backendProcess = null; }
}

function createWindow() {
  const isDev = getIsDev();
  mainWindow = new BrowserWindow({
    width: 1440, height: 900, minWidth: 1024, minHeight: 700,
    title: "PhotoGenix AI Studio",
    backgroundColor: "#09090b",
    icon: path.join(__dirname, "..", "public", "icon.png"),
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
    },
    show: false,
  });

  const menuTemplate = [
    { label: "PhotoGenix", submenu: [{ role: "about" }, { type: "separator" }, { role: "quit" }] },
    { label: "File", submenu: [
      { label: "Import Images...", accelerator: "CmdOrCtrl+O", click: () => mainWindow?.webContents.send("menu-import-images") },
      { label: "Export Current...", accelerator: "CmdOrCtrl+S", click: () => mainWindow?.webContents.send("menu-export") },
      { type: "separator" }, { role: "close" },
    ]},
    { label: "Edit", submenu: [{ role: "undo" }, { role: "redo" }, { type: "separator" }, { role: "cut" }, { role: "copy" }, { role: "paste" }] },
    { label: "View", submenu: [
      { role: "togglefullscreen" }, { role: "zoomIn" }, { role: "zoomOut" }, { role: "resetZoom" },
      { type: "separator" }, ...(isDev ? [{ role: "toggleDevTools" }] : []),
    ]},
    { label: "Help", submenu: [{ label: "Learn More", click: () => shell.openExternal("https://photogenix-one.vercel.app") }] },
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(menuTemplate));

  if (isDev) {
    mainWindow.loadURL("http://localhost:3080");
    mainWindow.webContents.openDevTools({ mode: "detach" });
  } else {
    mainWindow.loadFile(path.join(__dirname, "..", "dist", "index.html"));
  }

  mainWindow.once("ready-to-show", () => mainWindow.show());
  mainWindow.on("closed", () => { mainWindow = null; });
}

// App lifecycle — compatible with Electron v18+ (app.whenReady may not exist)
const onReady = app.whenReady ? app.whenReady() : new Promise((r) => app.on("ready", r));
onReady.then(() => {
  startBackend();

  // Register IPC handlers
  ipcMain.handle("dialog:openFiles", async (_event, options) => {
    return dialog.showOpenDialog(mainWindow, {
      properties: ["openFile", "multiSelections"],
      filters: [
        { name: "Images", extensions: ["jpg","jpeg","png","webp","bmp","tiff","gif","dng","cr2","cr3","nef","arw","raf","orf","rw2","pef"] },
        { name: "Videos", extensions: ["mp4","mov","avi","webm"] },
        { name: "All Files", extensions: ["*"] },
      ],
      ...options,
    });
  });

  ipcMain.handle("dialog:saveFile", async (_event, options) => {
    return dialog.showSaveDialog(mainWindow, {
      filters: [{ name: "JPEG", extensions: ["jpg"] }, { name: "PNG", extensions: ["png"] }, { name: "WebP", extensions: ["webp"] }],
      ...options,
    });
  });

  ipcMain.handle("app:getVersion", () => app.getVersion());
  ipcMain.handle("app:getPlatform", () => process.platform);

  const delay = getIsDev() ? 500 : 2000;
  setTimeout(createWindow, delay);

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => { stopBackend(); if (process.platform !== "darwin") app.quit(); });
app.on("before-quit", () => stopBackend());
