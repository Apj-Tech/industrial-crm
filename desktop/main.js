const { app, BrowserWindow, Menu, shell, ipcMain, dialog } = require('electron');
const path = require('path');

// ───────────────────────────────────────────────────────────────────────
// Point this at your deployed frontend URL, or http://localhost:3000
// while running the dev server locally for testing.
// ───────────────────────────────────────────────────────────────────────
const APP_URL = process.env.CRM_URL || 'http://localhost:3000';

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1024,
    minHeight: 640,
    backgroundColor: '#0F172A',
    icon: path.join(__dirname, 'icon.ico'),
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
    show: false,
    title: 'Industrial CRM',
  });

  mainWindow.once('ready-to-show', () => mainWindow.show());

  mainWindow.loadURL(APP_URL).catch(() => {
    dialog.showErrorBox(
      'Connection failed',
      `Could not reach ${APP_URL}.\n\nMake sure the Industrial CRM backend and frontend servers are running, or update CRM_URL to your deployed server address.`
    );
  });

  // Open external links (e.g. "Open in browser") in the system browser, not Electron
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (!url.startsWith(APP_URL)) {
      shell.openExternal(url);
      return { action: 'deny' };
    }
    return { action: 'allow' };
  });

  // Reload shortcut for convenience during local dev
  mainWindow.webContents.on('before-input-event', (event, input) => {
    if (input.key === 'F5' || (input.control && input.key.toLowerCase() === 'r')) {
      mainWindow.reload();
    }
  });
}

function buildMenu() {
  const template = [
    {
      label: 'Industrial CRM',
      submenu: [
        { label: 'Reload', accelerator: 'F5', click: () => mainWindow.reload() },
        { label: 'Toggle DevTools', accelerator: 'F12', click: () => mainWindow.webContents.toggleDevTools() },
        { type: 'separator' },
        { label: 'Quit', accelerator: 'Alt+F4', click: () => app.quit() },
      ],
    },
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

app.whenReady().then(() => {
  buildMenu();
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
