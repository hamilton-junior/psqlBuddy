
import { app, BrowserWindow, ipcMain, shell, utilityProcess } from 'electron';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';
import pkg from 'electron-updater';
const { autoUpdater } = pkg;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let mainWindow;
let serverChild;

// Configurações do Atualizador
autoUpdater.autoDownload = false;
autoUpdater.allowDowngrade = true; 
autoUpdater.allowPrerelease = true; 
autoUpdater.logger = console;

function getCalculatedAppVersion() {
  if (app.isPackaged) return app.getVersion();
  try {
    const commitCount = execSync('git rev-list --count HEAD').toString().trim();
    const count = parseInt(commitCount, 10) || 0;
    const major = Math.floor(count / 1000);
    const minor = Math.floor((count % 1000) / 100);
    const patch = count % 100;
    return `${major}.${minor}.${patch}`;
  } catch (e) {
    return app.getVersion();
  }
}

const CURRENT_VERSION = getCalculatedAppVersion();

function compareVersions(v1, v2) {
  if (!v1 || v1 === '---' || !v2 || v2 === '---' || v1 === '...' || v2 === '...') return 0;
  const cleanV1 = v1.replace(/^v/, '');
  const cleanV2 = v2.replace(/^v/, '');
  const p1 = cleanV1.split('.').map(n => parseInt(n, 10) || 0);
  const p2 = cleanV2.split('.').map(n => parseInt(n, 10) || 0);
  for (let i = 0; i < 3; i++) {
    if (p1[i] > p2[i]) return 1;
    if (p1[i] < p2[i]) return -1;
  }
  return 0;
}

/**
 * Inicializa o backend usando UtilityProcess (Electron 22+)
 * É mais seguro e lida melhor com módulos nativos e caminhos ASAR.
 */
function startBackend() {
  console.log("[MAIN] Iniciando Backend Service...");
  
  if (process.env.SKIP_BACKEND === '1') {
    console.log("[MAIN] SKIP_BACKEND ativo. Ignorando.");
    return;
  }

  // Caminho do servidor
  const serverPath = app.isPackaged 
    ? path.join(process.resourcesPath, 'app.asar.unpacked', 'server.js')
    : path.join(__dirname, 'server.js');

  console.log(`[MAIN] Resolvendo backend em: ${serverPath}`);

  if (!fs.existsSync(serverPath)) {
    console.error(`[MAIN] ERRO CRÍTICO: server.js não existe em ${serverPath}`);
    // Tenta fallback para dentro do ASAR se for packaged (apenas para debug)
    const asarPath = path.join(__dirname, 'server.js');
    if (app.isPackaged && !fs.existsSync(serverPath) && fs.existsSync(asarPath)) {
        console.warn("[MAIN] Fallback para caminho interno do ASAR detectado.");
    } else {
        return;
    }
  }

  try {
    // Usamos UtilityProcess para garantir isolamento e carregamento correto de dependências
    serverChild = utilityProcess.fork(serverPath, [], {
        env: { 
            ...process.env,
            PORT: '3000',
            HOST: '127.0.0.1'
        },
        stdio: 'inherit'
    });

    serverChild.on('spawn', () => {
        console.log("[MAIN] Backend Process (Utility) spawnado com sucesso na porta 3000.");
    });

    serverChild.on('exit', (code) => {
        console.warn(`[MAIN] Backend Process encerrou inesperadamente com código ${code}`);
    });
  } catch (err) {
    console.error("[MAIN] Falha ao executar fork do backend:", err);
  }
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280, height: 850,
    title: "PSQL Buddy",
    titleBarStyle: 'hidden',
    titleBarOverlay: { color: '#0f172a', symbolColor: '#94a3b8' },
    webPreferences: { 
      preload: path.join(__dirname, 'preload.js'), 
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  if (!app.isPackaged) {
    mainWindow.loadURL('http://127.0.0.1:5173');
  } else {
    mainWindow.loadFile(path.join(__dirname, 'dist/index.html'));
  }

  mainWindow.webContents.on('did-finish-load', () => {
    mainWindow.webContents.send('app-version', CURRENT_VERSION);
    fetchGitHubVersions().then(versions => {
      mainWindow.webContents.send('sync-versions', versions);
    }).catch(() => {});
  });
}

async function fetchGitHubVersions() {
  const repo = "Hamilton-Junior/psqlBuddy";
  const headers = { 'User-Agent': 'PSQL-Buddy-App' };
  try {
    let stable = '---';
    let main = '---';
    const tagsRes = await fetch(`https://api.github.com/repos/${repo}/tags`, { headers });
    if (tagsRes.ok) {
      const tags = await tagsRes.json();
      if (tags.length > 0) stable = tags[0].name.replace(/^v/, '');
    }
    const commitsRes = await fetch(`https://api.github.com/repos/${repo}/commits?sha=main&per_page=1`, { headers });
    if (commitsRes.ok) {
       const link = commitsRes.headers.get('link');
       if (link) {
          const match = link.match(/&page=(\d+)>; rel="last"/);
          if (match) {
             const count = parseInt(match[1]);
             main = `${Math.floor(count/1000)}.${Math.floor((count%1000)/100)}.${count%100}`;
          }
       }
    }
    return { stable, main };
  } catch (e) { 
    return { stable: 'Erro', main: 'Erro' }; 
  }
}

app.whenReady().then(() => { 
  startBackend();
  createWindow(); 
});

app.on('window-all-closed', () => { 
  if (serverChild) serverChild.kill();
  if (process.platform !== 'darwin') app.quit();
});

ipcMain.on('check-update', async (event, branch) => {
  console.log(`[MAIN] Buscando atualização para branch: ${branch}`);
  
  const versions = await fetchGitHubVersions();
  const remoteVersion = branch === 'main' ? versions.main : versions.stable;
  const comparison = compareVersions(remoteVersion, CURRENT_VERSION);

  if (comparison === 0) {
    mainWindow.webContents.send('update-not-available');
    return;
  }

  const updateType = comparison < 0 ? 'downgrade' : 'upgrade';
  console.log(`[MAIN] Alteração detectada: v${CURRENT_VERSION} -> v${remoteVersion} (${updateType})`);

  if (app.isPackaged && branch === 'stable') {
    // Força o autoUpdater a checar. allowDowngrade=true permite que ele ache a versão inferior
    autoUpdater.checkForUpdates().catch(err => {
      console.error("[MAIN] Erro autoUpdater:", err);
      // Se falhar o auto-check, enviamos o evento manualmente para a UI exibir o modal
      mainWindow.webContents.send('update-available', { 
        version: remoteVersion, 
        branch, 
        updateType,
        isManual: true 
      });
    });
  } else {
    // Para branch main ou dev, sempre via manual event
    mainWindow.webContents.send('update-available', { 
      version: remoteVersion, 
      branch, 
      updateType,
      isManual: true 
    });
  }
});

autoUpdater.on('update-available', (info) => {
  const comparison = compareVersions(info.version, CURRENT_VERSION);
  const updateType = comparison < 0 ? 'downgrade' : 'upgrade';
  mainWindow.webContents.send('update-available', { 
    version: info.version, 
    releaseNotes: info.releaseNotes,
    updateType 
  });
});

autoUpdater.on('update-not-available', () => {
  mainWindow.webContents.send('update-not-available');
});

autoUpdater.on('error', (err) => {
  console.error("[MAIN] Erro no atualizador:", err);
  mainWindow.webContents.send('update-error', err.message);
});

autoUpdater.on('download-progress', (p) => {
  mainWindow.webContents.send('update-downloading', p);
});

autoUpdater.on('update-downloaded', () => {
  mainWindow.webContents.send('update-ready');
});

ipcMain.on('start-download', () => {
  autoUpdater.downloadUpdate();
});

ipcMain.on('install-update', () => {
  autoUpdater.quitAndInstall();
});

ipcMain.on('refresh-remote-versions', async () => {
    const versions = await fetchGitHubVersions();
    if (mainWindow) mainWindow.webContents.send('sync-versions', versions);
});
