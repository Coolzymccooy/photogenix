// electron/main.cjs — Electron main process for PhotoGenix Desktop
const { app, BrowserWindow, ipcMain, dialog, shell, Menu } = require("electron");
const path = require("path");
const { spawn } = require("child_process");

const isDev = !app.isPackaged;
let mainWindow = null;
let backendProcess = null;

// Backend server port
const BACKEND_PORT = 5051;

function startBackend() {
  const serverPath = isDev
    ? path.join(__dirname, "..", "server", "index.cjs")
    : path.join(process.resourcesPath, "server", "index.cjs");

  backendProcess = spawn(process.execPath.replace("electron", "node"), [serverPath], {
    env: {
      ...process.env,
      PORT: String(BACKEND_PORT),
      CORS_ORIGIN: `http://localhost:${BACKEND_PORT}`,
      NODE_ENV: isDev ? "development" : "production",
    },
    stdio: ["ignore", "pipe", "pipe"],
  });

  // Try node directly if the above fails (packaged apps bundle node differently)
  if (!backendProcess.pid) {
    backendProcess = spawn("node", [serverPath], {
      env: {
        ...process.env,
        PORT: String(BACKEND_PORT),
        CORS_ORIGIN: `http://localhost:${BACKEND_PORT}`,
        NODE_ENV: isDev ? "development" : "production",
      },
      stdio: ["ignore", "pipe", "pipe"],
    });
  }

  backendProcess.stdout?.on("data", (d) => {
    console.log("[backend]", d.toString().trim());
  });
  backendProcess.stderr?.on("data", (d) => {
    console.error("[backend]", d.toString().trim());
  });
  backendProcess.on("error", (err) => {
    console.error("[backend] Failed to start:", err.message);
  });
  backendProcess.on("exit", (code) => {
    console.log("[backend] Exited with code:", code);
  });
}

function stopBackend() {
  if (backendProcess && !backendProcess.killed) {
    backendProcess.kill();
    backendProcess = null;
  }
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1024,
    minHeight: 700,
    title: "PhotoGenix AI Studio",
    backgroundColor: "#09090b",
    icon: path.join(__dirname, "..", "public", "icon.png"),
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
    titleBarStyle: "hiddenInset",
    titleBarOverlay: {
      color: "#09090b",
      symbolColor: "#6366f1",
      height: 36,
    },
    show: false,
  });

  // Custom application menu
  const menuTemplate = [
    {
      label: "PhotoGenix",
      submenu: [
        { role: "about" },
        { type: "separator" },
        { role: "quit" },
      ],
    },
    {
      label: "File",
      submenu: [
        {
          label: "Import Images...",
          accelerator: "CmdOrCtrl+O",
          click: () => mainWindow?.webContents.send("menu-import-images"),
        },
        {
          label: "Export Current...",
          accelerator: "CmdOrCtrl+S",
          click: () => mainWindow?.webContents.send("menu-export"),
        },
        { type: "separator" },
        { role: "close" },
      ],
    },
    {
      label: "Edit",
      submenu: [
        { role: "undo" },
        { role: "redo" },
        { type: "separator" },
        { role: "cut" },
        { role: "copy" },
        { role: "paste" },
      ],
    },
    {
      label: "View",
      submenu: [
        { role: "togglefullscreen" },
        { role: "zoomIn" },
        { role: "zoomOut" },
        { role: "resetZoom" },
        { type: "separator" },
        ...(isDev ? [{ role: "toggleDevTools" }] : []),
      ],
    },
    {
      label: "Help",
      submenu: [
        {
          label: "Learn More",
          click: () => shell.openExternal("https://photogenix-one.vercel.app"),
        },
      ],
    },
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(menuTemplate));

  // Load the app
  if (isDev) {
    mainWindow.loadURL("http://localhost:3080");
    mainWindow.webContents.openDevTools({ mode: "detach" });
  } else {
    mainWindow.loadFile(path.join(__dirname, "..", "dist", "index.html"));
  }

  mainWindow.once("ready-to-show", () => {
    mainWindow.show();
  });

  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

// IPC handlers for native desktop features
ipcMain.handle("dialog:openFiles", async (_event, options) => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ["openFile", "multiSelections"],
    filters: [
      {
        name: "Images",
        extensions: [
          "jpg", "jpeg", "png", "webp", "bmp", "tiff", "gif",
          "dng", "cr2", "cr3", "nef", "arw", "raf", "orf", "rw2", "pef",
        ],
      },
      { name: "Videos", extensions: ["mp4", "mov", "avi", "webm"] },
      { name: "All Files", extensions: ["*"] },
    ],
    ...options,
  });
  return result;
});

ipcMain.handle("dialog:saveFile", async (_event, options) => {
  const result = await dialog.showSaveDialog(mainWindow, {
    filters: [
      { name: "JPEG", extensions: ["jpg"] },
      { name: "PNG", extensions: ["png"] },
      { name: "WebP", extensions: ["webp"] },
    ],
    ...options,
  });
  return result;
});

ipcMain.handle("app:getVersion", () => app.getVersion());
ipcMain.handle("app:getPlatform", () => process.platform);

// App lifecycle
app.whenReady().then(() => {
  startBackend();

  // Give backend a moment to start, then create window
  setTimeout(createWindow, 1500);

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on("window-all-closed", () => {
  stopBackend();
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("before-quit", () => {
  stopBackend();
});
