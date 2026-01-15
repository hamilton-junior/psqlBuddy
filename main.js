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

/**
 * Utilitário para calcular a string de versão seguindo a lógica do projeto:
 * Major = Count / 1000, Minor = (Count % 1000) / 100, Patch = Count % 100
 */
function calculateVersionFromCount(count) {
  const c = parseInt(count, 10) || 0;
  const major = Math.floor(c / 1000);
  const minor = Math.floor((c % 1000) / 100);
  const patch = c % 100;
  return `${major}.${minor}.${patch}`;
}

/**
 * Compara duas strings de versão SemVer (x.y.z)
 * Retorna: 1 (v1 > v2), -1 (v1 < v2), 0 (iguais)
 */
function compareVersions(v1, v2, context = 'General') {
  console.log(`[DEBUG:VERSION:${context}] Iniciando comparação: "${v1}" vs "${v2}"`);
  
  if (!v1 || v1 === '---' || !v2 || v2 === '---') {
    console.log(`[DEBUG:VERSION:${context}] Dados insuficientes para comparação.`);
    return 0;
  }
  
  const cleanV1 = v1.replace(/^v/, '');
  const cleanV2 = v2.replace(/^v/, '');
  
  const p1 = cleanV1.split('.').map(n => parseInt(n, 10) || 0);
  const p2 = cleanV2.split('.').map(n => parseInt(n, 10) || 0);
  
  console.log(`[DEBUG:VERSION:${context}] Partes processadas: [${p1.join(',')}] vs [${p2.join(',')}]`);

  for (let i = 0; i < 3; i++) {
    if (p1[i] > p2[i]) {
      console.log(`[DEBUG:VERSION:${context}] Resultado: 1 (Upgrade disponível)`);
      return 1;
    }
    if (p1[i] < p2[i]) {
      console.log(`[DEBUG:VERSION:${context}] Resultado: -1 (Downgrade detectado)`);
      return -1;
    }
  }
  
  console.log(`[DEBUG:VERSION:${context}] Resultado: 0 (Versões idênticas)`);
  return 0;
}

/**
 * Recupera o total de commits de uma branch no GitHub.
 */
async function fetchTotalCommits(repo, branch, headers) {
  try {
    const res = await fetch(`https://api.github.com/repos/${repo}/commits?sha=${branch}&per_page=1`, { headers });
    if (!res.ok) return null;
    const linkHeader = res.headers.get('link');
    if (!linkHeader) return 1;
    const match = linkHeader.match(/page=(\d+)>; rel="last"/);
    return match ? parseInt(match[1], 10) : 1;
  } catch (e) {
    console.error(`[GITHUB API] Erro ao contar commits da branch ${branch}:`, e.message);
    return null;
  }
}

// Busca versões reais do GitHub (Tags para Stable, Commits para Main)
async function fetchGitHubVersions() {
  const repo = "Hamilton-Junior/psqlBuddy";
  const timestamp = new Date().getTime();
  
  try {
    const headers = { 
      'User-Agent': 'PSQL-Buddy-App',
      'Accept': 'application/vnd.github.v3+json',
      'Cache-Control': 'no-cache'
    };

    // 1. Versão Estável (Highest Tag)
    let stable = '---';
    try {
      const tagsRes = await fetch(`https://api.github.com/repos/${repo}/tags?per_page=30&t=${timestamp}`, { headers });
      if (tagsRes.ok) {
        const tags = await tagsRes.json();
        const validVersions = tags
          .map(t => t.name.replace(/^v/, ''))
          .filter(v => /^\d+\.\d+\.\d+$/.test(v))
          .sort((a, b) => compareVersions(a, b, 'GitHub-Tags-Sorter'));
        
        if (validVersions.length > 0) stable = validVersions[validVersions.length - 1];
      }
    } catch (e) { console.error("[GITHUB API] Erro tags:", e.message); }

    // 2. Versão Main (Development)
    let main = '---';
    try {
      const commitCount = await fetchTotalCommits(repo, 'main', headers);
      if (commitCount !== null) main = calculateVersionFromCount(commitCount);
    } catch (e) { console.error("[GITHUB API] Erro main:", e.message); }

    console.log(`[APP] [MAIN] Sincronização GitHub concluída. Stable: ${stable}, Main: ${main}`);
    return { stable, main };
  } catch (error) {
    console.error('[GITHUB API] Falha na conexão:', error.message);
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
    const currentVer = app.getVersion();
    mainWindow.webContents.send('app-version', currentVer);
    console.log(`[APP] [MAIN] Versão local enviada: ${currentVer}`);
    
    const versions = await fetchGitHubVersions();
    mainWindow.webContents.send('sync-versions', versions);
  });
}

// Eventos do autoUpdater
autoUpdater.on('update-available', (info) => {
  console.log(`[APP] [MAIN] autoUpdater: Nova versão detectada: ${info.version}`);
  mainWindow.webContents.send('update-available', { 
    version: info.version, 
    updateType: 'upgrade',
    releaseNotes: info.releaseNotes || 'Nova atualização estável disponível via canal oficial.'
  });
});

autoUpdater.on('update-not-available', () => {
  console.log('[APP] [MAIN] autoUpdater: Nenhuma atualização necessária.');
  mainWindow.webContents.send('update-not-available');
});

autoUpdater.on('download-progress', (progressObj) => {
  mainWindow.webContents.send('update-downloading', { percent: progressObj.percent });
});

autoUpdater.on('update-downloaded', (info) => {
  mainWindow.webContents.send('update-ready', info);
});

autoUpdater.on('error', (err) => {
  console.error('[APP] [MAIN] Erro no autoUpdater:', err.message);
  mainWindow.webContents.send('update-error', { message: err.message });
});

// IPC Listeners
ipcMain.on('check-update', async (event, branch) => {
  const targetBranch = branch || 'stable';
  const current = app.getVersion();
  console.log(`[APP] [MAIN] Verificação manual solicitada. Canal: ${targetBranch}, Local: ${current}`);
  
  if (app.isPackaged && targetBranch === 'stable') {
    console.log('[APP] [MAIN] Usando autoUpdater oficial.');
    autoUpdater.checkForUpdates();
  } else {
    console.log('[APP] [MAIN] Verificação manual via GitHub API.');
    const versions = await fetchGitHubVersions();
    mainWindow.webContents.send('sync-versions', versions);
    
    const remote = (targetBranch === 'main') ? versions.main : versions.stable;
    
    if (remote === 'Erro' || remote === '---') {
       console.log('[APP] [MAIN] Versão remota indisponível.');
       mainWindow.webContents.send('update-not-available');
       return;
    }

    const comparison = compareVersions(remote, current, 'Manual-Check');

    if (comparison > 0) {
      console.log(`[APP] [MAIN] Enviando: Upgrade Disponível (${remote} > ${current})`);
      mainWindow.webContents.send('update-available', { 
        version: remote, 
        releaseNotes: targetBranch === 'main' ? 'Novas alterações detectadas na branch main.' : 'Nova versão estável disponível.',
        updateType: 'upgrade',
        isManual: true 
      });
    } else if (comparison < 0) {
      console.log(`[APP] [MAIN] Enviando: Downgrade Detectado (${remote} < ${current})`);
      mainWindow.webContents.send('update-available', { 
        version: remote, 
        releaseNotes: `A versão oficial do canal ${targetBranch} (${remote}) é anterior à sua instalada (${current}).`,
        updateType: 'downgrade',
        isManual: true 
      });
    } else {
      console.log('[APP] [MAIN] Versões idênticas. Enviando update-not-available.');
      mainWindow.webContents.send('update-not-available');
    }
  }
});

ipcMain.on('start-download', () => { 
  if (app.isPackaged) {
    console.log('[APP] [MAIN] Iniciando download via autoUpdater.');
    autoUpdater.downloadUpdate(); 
  } else {
    console.log("[APP] [MAIN] Download ignorado em modo desenvolvimento.");
  }
});

ipcMain.on('install-update', () => { 
  if (app.isPackaged) {
    console.log('[APP] [MAIN] Solicitando reinicialização para instalação.');
    autoUpdater.quitAndInstall(); 
  }
});

app.whenReady().then(() => { 
  startBackend(); 
  createWindow(); 
});

app.on('window-all-closed', () => {
  if (serverProcess) serverProcess.kill();
  if (process.platform !== 'darwin') app.quit();
});