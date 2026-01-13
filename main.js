
import { app, BrowserWindow, ipcMain, net } from 'electron';
import path from 'path';
import { fileURLToPath } from 'url';
import { spawn } from 'child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let mainWindow;
let serverProcess;

const GITHUB_REPO = "Hamilton-Junior/psql-buddy";

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
  mainWindow = new BrowserWindow({
    width: 1280, height: 850, minWidth: 1000, minHeight: 700,
    title: "PSQL Buddy",
    titleBarStyle: 'hidden', 
    titleBarOverlay: { color: '#0f172a', symbolColor: '#94a3b8', height: 35 },
    backgroundColor: '#0f172a',
    webPreferences: { nodeIntegration: false, contextIsolation: true, preload: path.join(__dirname, 'preload.js') },
  });

  const isDev = !app.isPackaged;
  if (isDev) {
    mainWindow.loadURL('http://127.0.0.1:5173');
  } else {
    mainWindow.loadFile(path.join(__dirname, 'dist/index.html'));
  }
}

// --- LOGICA DE VERSÃO E ATUALIZAÇÃO ---

async function fetchGitHubData(path) {
  return new Promise((resolve, reject) => {
    const request = net.request({
      method: 'GET', protocol: 'https:', hostname: 'api.github.com', path,
      headers: { 'User-Agent': 'PSQL-Buddy-App' }
    });
    request.on('response', (response) => {
      let data = '';
      response.on('data', (chunk) => { data += chunk; });
      response.on('end', () => {
        resolve({ json: data ? JSON.parse(data) : {}, headers: response.headers });
      });
    });
    request.on('error', reject);
    request.end();
  });
}

// Calcula versão baseada em commits (Lógica: 0.1.10 = 110 commits)
async function getCalculatedMainVersion() {
  try {
    // Busca apenas 1 commit para pegar o total no header Link
    const { headers } = await fetchGitHubData(`/repos/${GITHUB_REPO}/commits?per_page=1`);
    const link = headers['link'];
    if (link && Array.isArray(link)) {
      const lastPageMatch = link[0].match(/&page=(\d+)>; rel="last"/);
      if (lastPageMatch) {
        const count = parseInt(lastPageMatch[1], 10);
        const major = Math.floor(count / 1000);
        const minor = Math.floor((count % 1000) / 100);
        const patch = count % 100;
        return `${major}.${minor}.${patch}`;
      }
    }
    return "0.0.0";
  } catch (e) { return "0.0.0"; }
}

ipcMain.on('check-update', async (event, branch = 'stable') => {
  try {
    const { json: releases } = await fetchGitHubData(`/repos/${GITHUB_REPO}/releases`);
    const mainVer = await getCalculatedMainVersion();
    
    const latestRelease = releases.find(r => !r.prerelease && !r.draft);
    const stableVer = latestRelease ? latestRelease.tag_name.replace('v', '') : "0.1.0";

    // Informação completa para o SettingsModal
    const versionsInfo = {
      stable: stableVer,
      main: `${mainVer}-nightly`
    };

    // Lógica de notificação de nova atualização
    let targetRelease = branch === 'stable' ? latestRelease : releases[0];
    if (targetRelease) {
      const latestVersion = targetRelease.tag_name.replace('v', '');
      if (latestVersion !== app.getVersion()) {
        mainWindow.webContents.send('update-available', {
          version: latestVersion,
          notes: targetRelease.body,
          branch: branch === 'main' ? 'Main' : 'Stable',
          isPrerelease: targetRelease.prerelease,
          allVersions: versionsInfo // Dados para o modal de config
        });
      }
    }
    
    // Sempre envia o status das versões para sincronizar o SettingsModal
    mainWindow.webContents.send('sync-versions', versionsInfo);

  } catch (error) {
    console.error("[UPDATE] Erro GitHub:", error.message);
  }
});

ipcMain.on('start-download', () => {
  let progress = 0;
  const interval = setInterval(() => {
    progress += 20;
    mainWindow.webContents.send('update-downloading', { percent: Math.min(progress, 100) });
    if (progress >= 100) {
      clearInterval(interval);
      setTimeout(() => mainWindow.webContents.send('update-ready'), 500);
    }
  }, 400);
});

ipcMain.on('install-update', () => { app.relaunch(); app.exit(); });

app.whenReady().then(() => { startBackend(); createWindow(); });

app.on('window-all-closed', () => {
  if (serverProcess) serverProcess.kill();
  if (process.platform !== 'darwin') app.quit();
});
