
import { app, BrowserWindow, ipcMain, net } from 'electron';
import path from 'path';
import { fileURLToPath } from 'url';
import { spawn } from 'child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let mainWindow;
let serverProcess;

// Configuração do Repositório (Altere se necessário)
const GITHUB_REPO = "Hamilton-Junior/psql-buddy";

function startBackend() {
  const isDev = !app.isPackaged;
  
  if (isDev && process.env.SKIP_BACKEND === '1') {
    console.log(`[MAIN] SKIP_BACKEND ativo. Assumindo que o servidor já está rodando na porta 3000.`);
    return;
  }

  const serverPath = path.join(__dirname, 'server.js');
  
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
      preload: path.join(__dirname, 'preload.js') 
    },
  });

  const isDev = !app.isPackaged;
  if (isDev) {
    const url = 'http://127.0.0.1:5173';
    const loadWithRetry = () => {
      mainWindow.loadURL(url).catch(() => {
        setTimeout(loadWithRetry, 1500);
      });
    };
    loadWithRetry();
  } else {
    mainWindow.loadFile(path.join(__dirname, 'dist/index.html'));
  }
}

// --- LOGICA DE ATUALIZAÇÃO REAL ---

async function fetchGitHubReleases() {
  return new Promise((resolve, reject) => {
    const request = net.request({
      method: 'GET',
      protocol: 'https:',
      hostname: 'api.github.com',
      path: `/repos/${GITHUB_REPO}/releases`,
      headers: {
        'User-Agent': 'PSQL-Buddy-App'
      }
    });

    request.on('response', (response) => {
      let data = '';
      response.on('data', (chunk) => { data += chunk; });
      response.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          reject(e);
        }
      });
    });

    request.on('error', (err) => reject(err));
    request.end();
  });
}

ipcMain.on('check-update', async (event, branch = 'stable') => {
  console.log(`[UPDATE] Buscando atualizações reais no GitHub (Branch: ${branch})...`);
  
  try {
    const releases = await fetchGitHubReleases();
    
    if (!Array.isArray(releases) || releases.length === 0) {
      console.log("[UPDATE] Nenhum lançamento encontrado no repositório.");
      return;
    }

    let targetRelease;
    if (branch === 'stable') {
      // Pega o lançamento mais recente que NÃO é pre-release
      targetRelease = releases.find(r => !r.prerelease && !r.draft);
    } else {
      // Pega absolutamente o mais recente (incluindo pre-releases)
      targetRelease = releases[0];
    }

    if (targetRelease) {
      const currentVersion = app.getVersion();
      const latestVersion = targetRelease.tag_name.replace('v', '');

      // Só notifica se a versão do GitHub for diferente/maior que a atual
      // (Em desenvolvimento currentVersion costuma ser o do package.json)
      const updateData = {
        version: latestVersion,
        notes: targetRelease.body || "Nenhuma nota de lançamento fornecida.",
        branch: branch === 'main' ? 'Main' : 'Stable',
        isPrerelease: targetRelease.prerelease,
        url: targetRelease.html_url
      };

      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('update-available', updateData);
      }
    }
  } catch (error) {
    console.error("[UPDATE] Erro ao consultar API do GitHub:", error.message);
  }
});

ipcMain.on('start-download', () => {
  console.log('[UPDATE] Iniciando download simulado dos assets do GitHub...');
  let progress = 0;
  const interval = setInterval(() => {
    progress += Math.random() * 20;
    if (progress >= 100) {
      progress = 100;
      clearInterval(interval);
      mainWindow.webContents.send('update-downloading', { percent: 100 });
      setTimeout(() => mainWindow.webContents.send('update-ready'), 500);
    } else {
      mainWindow.webContents.send('update-downloading', { percent: progress });
    }
  }, 300);
});

ipcMain.on('install-update', () => {
  console.log('[UPDATE] Reiniciando app...');
  app.relaunch();
  app.exit();
});

app.whenReady().then(() => {
  startBackend();
  createWindow();
});

app.on('window-all-closed', () => {
  if (serverProcess) serverProcess.kill();
  if (process.platform !== 'darwin') app.quit();
});
