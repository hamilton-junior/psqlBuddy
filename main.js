import { app, BrowserWindow, ipcMain, shell } from 'electron';
import path from 'path';
import { fileURLToPath } from 'url';
import { spawn, execSync } from 'child_process';
import pkg from 'electron-updater';
const { autoUpdater } = pkg;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let mainWindow;
let serverProcess;

// Configurações do autoUpdater
autoUpdater.autoDownload = false;
autoUpdater.allowDowngrade = true; 
autoUpdater.allowPrerelease = true; // Permite detectar versões marcadas como pre-release no GitHub
autoUpdater.logger = console;

/**
 * Obtém a versão correta do aplicativo
 */
function getCalculatedAppVersion() {
  if (app.isPackaged) {
    return app.getVersion();
  }
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

function calculateVersionFromCount(count) {
  const c = parseInt(count, 10) || 0;
  const major = Math.floor(c / 1000);
  const minor = Math.floor((count % 1000) / 100);
  const patch = c % 100;
  return `${major}.${minor}.${patch}`;
}

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

async function fetchGitHubVersions() {
  const repo = "Hamilton-Junior/psqlBuddy";
  const headers = { 
    'User-Agent': 'PSQL-Buddy-App',
    'Accept': 'application/vnd.github.v3+json',
    'Cache-Control': 'no-cache'
  };

  try {
    let stable = '---';
    // Nota: Tags mostram o que existe, mas o autoUpdater precisa de uma RELEASE publicada com latest.yml
    const tagsRes = await fetch(`https://api.github.com/repos/${repo}/tags?per_page=30`, { headers });
    if (tagsRes.ok) {
      const tags = await tagsRes.json();
      const valid = tags.map(t => t.name.replace(/^v/, '')).filter(v => /^\d+\.\d+\.\d+$/.test(v)).sort(compareVersions);
      if (valid.length > 0) stable = valid[valid.length - 1];
    }

    let main = '---';
    const commitsRes = await fetch(`https://api.github.com/repos/${repo}/commits?sha=main&per_page=1`, { headers });
    if (commitsRes.ok) {
      const link = commitsRes.headers.get('link');
      const count = link ? (link.match(/page=(\d+)>; rel="last"/) || [0, 1])[1] : 1;
      main = calculateVersionFromCount(count);
    }

    return { stable, main };
  } catch (error) {
    console.error('[GITHUB] Erro sincronização:', error.message);
    return { stable: 'Erro', main: 'Erro' };
  }
}

function startBackend() {
  if (!app.isPackaged || process.env.SKIP_BACKEND !== '1') {
    const serverPath = path.join(__dirname, 'server.js');
    serverProcess = spawn(process.execPath, [serverPath], {
      env: { ...process.env, ELECTRON_RUN_AS_NODE: '1' },
      stdio: 'inherit'
    });
  }
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280, height: 850,
    title: "PSQL Buddy",
    titleBarStyle: 'hidden',
    titleBarOverlay: { color: '#0f172a', symbolColor: '#94a3b8' },
    webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true }
  });

  if (!app.isPackaged) {
    mainWindow.loadURL('http://127.0.0.1:5173');
  } else {
    mainWindow.loadFile(path.join(__dirname, 'dist/index.html'));
  }

  mainWindow.webContents.on('did-finish-load', async () => {
    mainWindow.webContents.send('app-version', CURRENT_VERSION);
    const versions = await fetchGitHubVersions();
    mainWindow.webContents.send('sync-versions', versions);
  });
}

// Eventos autoUpdater
autoUpdater.on('update-available', (info) => {
  console.log(`[AUTO-UPDATER] Atualização encontrada: ${info.version}`);
  mainWindow.webContents.send('update-available', { 
    ...info, 
    updateType: compareVersions(info.version, CURRENT_VERSION) > 0 ? 'upgrade' : 'downgrade',
    branch: 'stable'
  });
});

autoUpdater.on('update-not-available', () => {
  console.log('[AUTO-UPDATER] Nenhuma atualização oficial encontrada via manifesto.');
  mainWindow.webContents.send('update-not-available');
});

autoUpdater.on('download-progress', (p) => {
  mainWindow.webContents.send('update-downloading', p);
});

autoUpdater.on('update-downloaded', () => {
  console.log('[AUTO-UPDATER] Download concluído e pronto para instalação.');
  mainWindow.webContents.send('update-ready');
});

autoUpdater.on('error', (e) => {
  console.error('[AUTO-UPDATER] Erro no processo:', e.message);
  mainWindow.webContents.send('update-error', e.message);
});

ipcMain.on('check-update', async (event, branch) => {
  console.log(`[UPDATE-LOG] Verificando canal: ${branch} | Local: ${CURRENT_VERSION} | Packaged: ${app.isPackaged}`);
  
  if (app.isPackaged && branch === 'stable') {
    // Se estiver empacotado e canal estável, usa o validador oficial
    autoUpdater.checkForUpdates();
  } else {
    // Modo dev ou canal main: usa detecção manual via API
    const versions = await fetchGitHubVersions();
    mainWindow.webContents.send('sync-versions', versions);
    const remote = branch === 'main' ? versions.main : versions.stable;
    const comp = compareVersions(remote, CURRENT_VERSION);
    
    if (comp !== 0) {
      mainWindow.webContents.send('update-available', {
        version: remote,
        updateType: comp > 0 ? 'upgrade' : 'downgrade',
        isManual: true, // Indica que não foi detectado pelo autoUpdater
        branch
      });
    } else {
      mainWindow.webContents.send('update-not-available');
    }
  }
});

ipcMain.on('start-download', (event, branch) => {
  console.log(`[UPDATE-LOG] Acionando download. Canal: ${branch} | Packaged: ${app.isPackaged}`);
  
  if (branch === 'stable') {
    if (app.isPackaged) {
      console.log('[AUTO-UPDATER] Iniciando download interno...');
      autoUpdater.downloadUpdate();
    } else {
      console.log('[UPDATE-LOG] App não empacotado. Redirecionando para Releases (Manual).');
      shell.openExternal('https://github.com/Hamilton-Junior/psqlBuddy/releases');
    }
  } else if (branch === 'main') {
    console.log('[UPDATE-LOG] Canal WIP. Abrindo link do código fonte.');
    shell.openExternal('https://github.com/Hamilton-Junior/psqlBuddy/archive/refs/heads/main.zip');
  }
});

ipcMain.on('install-update', () => {
  console.log('[AUTO-UPDATER] Reiniciando para instalar...');
  autoUpdater.quitAndInstall();
});

app.whenReady().then(() => { 
  startBackend(); 
  createWindow(); 
});

app.on('window-all-closed', () => { 
  if (serverProcess) serverProcess.kill(); 
  if (process.platform !== 'darwin') app.quit(); 
});