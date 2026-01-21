import { app, BrowserWindow, ipcMain, systemPreferences } from 'electron';
import path from 'path';
import { registerIpcHandlers } from './ipc';

const HEADER_HEIGHT = 52;
const TRAFFIC_LIGHT_HEIGHT = 14;

function createWindow() {
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 800,
    minHeight: 600,

    // Transparent window - CSS controls the glassmorphism
    transparent: true,
    backgroundColor: '#00000000',

    // Frameless with traffic lights
    titleBarStyle: 'hiddenInset',
    trafficLightPosition: {
      x: 20,
      y: Math.round(HEADER_HEIGHT / 2 - TRAFFIC_LIGHT_HEIGHT / 2)
    },

    // Prevent white flash
    show: false,
    hasShadow: true,

    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
    }
  });

  // Development: load from Vite dev server
  // Production: load built files
  if (process.env.NODE_ENV === 'development') {
    win.loadURL('http://localhost:5173');
    win.webContents.openDevTools();
  } else {
    win.loadFile(path.join(__dirname, '../../renderer/index.html'));
  }

  // Show only when ready to prevent white flash
  win.once('ready-to-show', () => {
    win.show();
  });

  // Handle titlebar double-click (macOS behavior)
  ipcMain.on('titlebar-double-click', (event) => {
    const clickedWin = BrowserWindow.fromWebContents(event.sender);
    if (!clickedWin) return;

    const action = systemPreferences.getUserDefault('AppleActionOnDoubleClick', 'string');
    if (action === 'Minimize') {
      clickedWin.minimize();
    } else if (action === 'Maximize') {
      clickedWin.isMaximized() ? clickedWin.unmaximize() : clickedWin.maximize();
    }
  });

  return win;
}

app.whenReady().then(() => {
  registerIpcHandlers();
  createWindow();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
