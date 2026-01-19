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
function compareVersions(v1, v2) {
  if (!v1 || v1 === '---' || !v2 || v2 === '---') return 0;
  
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
 * Recupera o total de commits de uma branch no GitHub.
 * Como a branch WIP não tem release, usamos a contagem de commits como "versão de build".
 */
async function fetchTotalCommits(repo, branch, headers) {
  try {
    const res = await fetch(`https://api.github.com/repos/${repo}/commits?sha=${branch}&per_page=1`, { headers });
    if (!res.ok) return null;
    
    const linkHeader = res.headers.get('link');
    if (!linkHeader) return 1; // Se não houver link header, provavelmente só tem 1 commit carregado
    
    // O GitHub retorna o link da última página no header "link"
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
    console.log('[GITHUB API] Sincronizando versões remotas...');
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
        // Filtra apenas tags que parecem SemVer e pega a maior
        const validVersions = tags
          .map(t => t.name.replace(/^v/, ''))
          .filter(v => /^\d+\.\d+\.\d+$/.test(v))
          .sort(compareVersions);
        
        if (validVersions.length > 0) stable = validVersions[validVersions.length - 1];
      }
    } catch (e) { console.error("[GITHUB API] Erro ao buscar tags:", e.message); }

    // 2. Versão Main (WIP) - Baseada em Commits
    let main = '---';
    try {
      const commitCount = await fetchTotalCommits(repo, 'main', headers);
      if (commitCount !== null) {
        main = calculateVersionFromCount(commitCount);
        console.log(`[GITHUB API] WIP calculada via commits (${commitCount}): ${main}`);
      }
    } catch (e) { console.error("[GITHUB API] Erro ao calcular WIP:", e.message); }

    return { stable, main };
  } catch (error) {
    console.error('[GITHUB API] Falha crítica na sincronização:', error.message);
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
    console.log(`[APP] Versão local: ${currentVer}`);
    
    // Busca inicial de versões remotas
    const versions = await fetchGitHubVersions();
    mainWindow.webContents.send('sync-versions', versions);
  });
}

// Eventos do autoUpdater (Apenas produção e canal estável)
autoUpdater.on('update-available', (info) => {
  console.log('[UPDATE] Atualização oficial via release encontrada.');
  mainWindow.webContents.send('update-available', { ...info, updateType: 'upgrade' });
});

autoUpdater.on('update-not-available', () => {
  console.log('[UPDATE] Nenhuma atualização via release encontrada.');
  mainWindow.webContents.send('update-not-available');
});

autoUpdater.on('download-progress', (progressObj) => {
  mainWindow.webContents.send('update-downloading', { percent: progressObj.percent });
});

autoUpdater.on('update-downloaded', (info) => {
  mainWindow.webContents.send('update-ready', info);
});

autoUpdater.on('error', (err) => {
  console.error('[UPDATE] Erro no autoUpdater:', err.message);
  mainWindow.webContents.send('update-error', { message: err.message });
});

// IPC Listeners
ipcMain.on('check-update', async (event, branch) => {
  const targetBranch = branch || 'stable';
  console.log(`[UPDATE-ENGINE] Verificação solicitada para canal: ${targetBranch}`);
  
  if (app.isPackaged && targetBranch === 'stable') {
    // Se estiver em prod e canal stable, usa o motor oficial (precisa de release/tag)
    console.log('[UPDATE-ENGINE] Utilizando autoUpdater oficial.');
    autoUpdater.checkForUpdates();
  } else {
    // Para WIP ou Dev, usamos comparação manual via API do GitHub (Contagem de commits)
    console.log('[UPDATE-ENGINE] Utilizando motor de comparação manual (WIP/Commit Count).');
    const versions = await fetchGitHubVersions();
    mainWindow.webContents.send('sync-versions', versions);
    
    const current = app.getVersion();
    const remote = (targetBranch === 'main') ? versions.main : versions.stable;
    
    const result = compareVersions(remote, current);
    
    if (result > 0) {
      console.log(`[UPDATE-ENGINE] UPGRADE: Remota (${remote}) > Local (${current})`);
      mainWindow.webContents.send('update-available', { 
        version: remote, 
        releaseNotes: 'Novas alterações commitadas na branch de desenvolvimento.',
        updateType: 'upgrade',
        isManual: true 
      });
    } else if (result < 0) {
      console.log(`[UPDATE-ENGINE] DOWNGRADE: Remota (${remote}) < Local (${current})`);
      mainWindow.webContents.send('update-available', { 
        version: remote, 
        releaseNotes: 'A versão remota é anterior à sua versão local.',
        updateType: 'downgrade',
        isManual: true 
      });
    } else {
      console.log(`[UPDATE-ENGINE] EQUAL: Sincronizado na versão ${current}`);
      mainWindow.webContents.send('update-not-available');
    }
  }
});

ipcMain.on('start-download', () => { 
  if (app.isPackaged) {
    autoUpdater.downloadUpdate(); 
  } else {
    console.log("[UPDATE-ENGINE] Download bloqueado em ambiente de desenvolvimento.");
  }
});

ipcMain.on('install-update', () => { 
  if (app.isPackaged) {
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