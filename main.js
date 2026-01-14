import { app, BrowserWindow, ipcMain } from 'electron';
import path from 'path';
import { fileURLToPath } from 'url';
import { spawn } from 'child_process';
import pkg from 'electron-updater';
const { autoUpdater } = pkg;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let mainWindow;
let serverProcess;

// Configurações do autoUpdater
autoUpdater.autoDownload = false;
autoUpdater.logger = console;

// Função para buscar versões reais do GitHub (funciona em DEV e PROD)
async function fetchGitHubVersions() {
  try {
    const repo = "Hamilton-Junior/psqlBuddy";
    // Buscar última tag/release (Stable)
    const releaseRes = await fetch(`https://api.github.com/repos/${repo}/releases/latest`);
    const releaseData = await releaseRes.json();
    
    // Buscar último commit da main (para quem usa canal Beta/Main)
    const branchRes = await fetch(`https://api.github.com/repos/${repo}/branches/main`);
    const branchData = await branchRes.json();

    const stable = releaseData.tag_name ? releaseData.tag_name.replace('v', '') : '---';
    const main = branchData.commit ? '0.1.X' : '---'; // Simplificado já que a versão do commit é dinâmica

    return { stable, main };
  } catch (error) {
    console.error('[GITHUB API] Erro ao buscar versões:', error);
    return { stable: 'Erro', main: 'Erro' };
  }
}

function startBackend() {
  const isDev = !app.isPackaged;
  if (isDev && process.env.SKIP_BACKEND === '1') return;
  const serverPath = path.join(__dirname, 'server.js');
  serverProcess = spawn(process.execPath, [serverPath], {
    env: { ...process.env, ELECTRON_RUN_AS_NODE: '1' },
    stdio: 'inherit'
  });
}

function createWindow() {
  const preloadPath = path.join(__dirname, 'preload.js');
  
  mainWindow = new BrowserWindow({
    width: 1280, height: 850, minWidth: 1000, minHeight: 700,
    title: "PSQL Buddy",
    titleBarStyle: 'hidden', 
    titleBarOverlay: { color: '#0f172a', symbolColor: '#94a3b8', height: 35 },
    backgroundColor: '#0f172a',
    webPreferences: { 
      nodeIntegration: false, 
      contextIsolation: true, 
      preload: preloadPath 
    },
  });

  if (!app.isPackaged) {
    mainWindow.loadURL('http://127.0.0.1:5173');
  } else {
    mainWindow.loadFile(path.join(__dirname, 'dist/index.html'));
  }

  mainWindow.webContents.on('did-finish-load', async () => {
    mainWindow.webContents.send('app-version', app.getVersion());
    // Envia as versões do GitHub para o SettingsModal
    const versions = await fetchGitHubVersions();
    mainWindow.webContents.send('sync-versions', versions);
  });
}

autoUpdater.on('update-available', (info) => {
  mainWindow.webContents.send('update-available', info);
});

autoUpdater.on('update-not-available', () => {
  mainWindow.webContents.send('update-not-available');
});

autoUpdater.on('download-progress', (progressObj) => {
  mainWindow.webContents.send('update-downloading', { percent: progressObj.percent });
});

autoUpdater.on('update-downloaded', (info) => {
  mainWindow.webContents.send('update-ready', info);
});

autoUpdater.on('error', (err) => {
  mainWindow.webContents.send('update-error', { message: err.message });
});

ipcMain.on('check-update', async () => {
  if (app.isPackaged) {
    autoUpdater.checkForUpdates();
  } else {
    // Em dev, apenas re-sincronizamos as versões para a UI
    const versions = await fetchGitHubVersions();
    mainWindow.webContents.send('sync-versions', versions);
    mainWindow.webContents.send('update-not-available');
  }
});

ipcMain.on('start-download', () => { autoUpdater.downloadUpdate(); });
ipcMain.on('install-update', () => { autoUpdater.quitAndInstall(); });

app.whenReady().then(() => { 
  startBackend(); 
  createWindow(); 
});

app.on('window-all-closed', () => {
  if (serverProcess) serverProcess.kill();
  if (process.platform !== 'darwin') app.quit();
});