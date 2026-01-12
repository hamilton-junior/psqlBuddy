import { app, BrowserWindow, ipcMain } from 'electron';
import path from 'path';
import { fileURLToPath } from 'url';
import { spawn } from 'child_process';

// Nota: Em um ambiente real, você instalaria 'electron-updater'
// Aqui simulamos os eventos para que a interface possa ser testada
// import { autoUpdater } from 'electron-updater';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let mainWindow;
let serverProcess;

function startBackend() {
  const isDev = !app.isPackaged;
  const serverPath = path.join(__dirname, 'server.js');
  
  console.log(`[MAIN] Iniciando backend em:`, serverPath);
  
  serverProcess = spawn(process.execPath, [serverPath], {
    env: { 
      ...process.env, 
      ELECTRON_RUN_AS_NODE: '1',
      NODE_ENV: isDev ? 'development' : 'production'
    },
    stdio: 'inherit'
  });
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 850,
    minWidth: 1000,
    minHeight: 700,
    title: "PSQL Buddy",
    titleBarStyle: 'hidden', 
    titleBarOverlay: {       
      color: '#0f172a',      
      symbolColor: '#94a3b8',
      height: 35
    },
    backgroundColor: '#0f172a',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js') // Recomendado para segurança IPC
    },
  });

  const isDev = !app.isPackaged;
  if (isDev) {
    mainWindow.loadURL('http://127.0.0.1:5173');
  } else {
    mainWindow.loadFile(path.join(__dirname, 'dist/index.html'));
  }
}

// IPC para Atualizações
ipcMain.on('check-update', () => {
  console.log('[UPDATE] Verificando atualizações...');
  // Simulação de fluxo de atualização
  mainWindow.webContents.send('update-available', { version: '0.2.0', notes: 'Melhorias no Extrator de SQL e novo sistema de temas.' });
  
  setTimeout(() => {
    mainWindow.webContents.send('update-downloading', { percent: 45 });
  }, 2000);

  setTimeout(() => {
    mainWindow.webContents.send('update-downloading', { percent: 100 });
    mainWindow.webContents.send('update-ready');
  }, 5000);
});

ipcMain.on('install-update', () => {
  console.log('[UPDATE] Reiniciando para instalar...');
  // autoUpdater.quitAndInstall();
});

app.whenReady().then(() => {
  startBackend();
  createWindow();
});

app.on('window-all-closed', () => {
  if (serverProcess) serverProcess.kill();
  if (process.platform !== 'darwin') app.quit();
});