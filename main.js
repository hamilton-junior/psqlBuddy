
import { app, BrowserWindow, ipcMain, net } from 'electron';
import path from 'path';
import { fileURLToPath } from 'url';
import { spawn } from 'child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let mainWindow;
let serverProcess;

// Garanta que este repositório é público e o nome está correto
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
    const url = 'http://127.0.0.1:5173';
    const loadWithRetry = () => {
      mainWindow.loadURL(url).catch(() => {
        setTimeout(loadWithRetry, 2000);
      });
    };
    loadWithRetry();
  } else {
    mainWindow.loadFile(path.join(__dirname, 'dist/index.html'));
  }
}

// --- LOGICA DE VERSÃO E ATUALIZAÇÃO ---

async function fetchGitHubData(apiPath) {
  const fullUrl = `https://api.github.com${apiPath}`;
  console.log(`[UPDATE] Solicitando: ${fullUrl}`);
  
  return new Promise((resolve, reject) => {
    const request = net.request({
      method: 'GET',
      protocol: 'https:',
      hostname: 'api.github.com',
      path: apiPath,
      headers: { 
        'User-Agent': 'PSQL-Buddy-App',
        'Accept': 'application/vnd.github.v3+json'
      }
    });
    
    request.on('response', (response) => {
      let data = '';
      response.on('data', (chunk) => { data += chunk; });
      response.on('end', () => {
        try {
          const json = data ? JSON.parse(data) : {};
          resolve({ 
            json, 
            headers: response.headers, 
            status: response.statusCode,
            ok: response.statusCode >= 200 && response.statusCode < 300
          });
        } catch (e) {
          resolve({ json: {}, headers: response.headers, status: response.statusCode, ok: false });
        }
      });
    });
    
    request.on('error', (err) => {
      console.error(`[UPDATE] Erro de rede: ${err.message}`);
      reject(err);
    });
    request.end();
  });
}

function parseTotalCommitsFromLink(linkHeader) {
  if (!linkHeader) return 0;
  const links = Array.isArray(linkHeader) ? linkHeader[0] : linkHeader;
  
  // O link com rel="last" contém o número da última página (contagem total quando per_page=1)
  // Regex aprimorada para capturar espaços e variações no header
  const match = links.match(/[?&]page=(\d+)[^>]*>;\s*rel="last"/);
  return match ? parseInt(match[1], 10) : 0;
}

async function getGitHubBranchStatus(branch) {
  try {
    let response = await fetchGitHubData(`/repos/${GITHUB_REPO}/commits?sha=${branch}&per_page=1`);
    
    // FIX: Corrigido o erro onde 'status' não estava definido
    if (response.status === 404 && branch === 'main') {
       console.log(`[UPDATE] Branch 'main' não encontrada em ${GITHUB_REPO}, tentando 'master'...`);
       response = await fetchGitHubData(`/repos/${GITHUB_REPO}/commits?sha=master&per_page=1`);
    }

    if (!response.ok) {
      console.error(`[UPDATE] Erro na API (Status: ${response.status}) para branch: ${branch}`);
      return { error: true, status: response.status, branch };
    }

    const commits = response.json;
    const linkHeader = response.headers['link'];
    let count = parseTotalCommitsFromLink(linkHeader);

    // Se não houver paginação, o count é o tamanho do array retornado (geralmente 1 se houver commits)
    if (count === 0 && Array.isArray(commits)) {
      count = commits.length;
    }

    // Lógica SemVer baseada em commits: 159 commits = 0.1.59
    const major = Math.floor(count / 1000);
    const minor = Math.floor((count % 1000) / 100);
    const patch = count % 100;
    const versionString = `${major}.${minor}.${patch}`;

    console.log(`[UPDATE] Sincronizado '${branch}': v${versionString} (${count} commits)`);

    return {
      version: versionString,
      commitCount: count,
      lastMessage: (Array.isArray(commits) && commits[0]?.commit?.message) || "Sem descrição.",
      url: `https://github.com/${GITHUB_REPO}/archive/refs/heads/${branch}.zip`
    };
  } catch (e) { 
    console.error(`[UPDATE] Falha crítica ao obter status da branch ${branch}:`, e.message);
    return null; 
  }
}

ipcMain.on('check-update', async (event, branch = 'stable') => {
  try {
    console.log(`[UPDATE] Verificação de atualização iniciada (Canal: ${branch})`);
    
    // Busca informações de ambas as branches
    const [mainStatus, stableStatus] = await Promise.all([
      getGitHubBranchStatus('main'),
      getGitHubBranchStatus('stable')
    ]);

    const versionsInfo = {
      stable: (stableStatus && !stableStatus.error) ? stableStatus.version : "Erro",
      main: (mainStatus && !mainStatus.error) ? mainStatus.version : "Erro",
    };

    console.log(`[UPDATE] Enviando para UI:`, versionsInfo);

    if (mainWindow && !mainWindow.isDestroyed()) {
       mainWindow.webContents.send('sync-versions', versionsInfo);
    }

    const currentAppVersion = app.getVersion();
    const targetStatus = branch === 'main' ? mainStatus : stableStatus;

    if (targetStatus && !targetStatus.error) {
      if (targetStatus.version !== currentAppVersion) {
        console.log(`[UPDATE] Nova versão disponível! ${currentAppVersion} -> ${targetStatus.version}`);
        mainWindow.webContents.send('update-available', {
          version: targetStatus.version,
          notes: targetStatus.lastMessage,
          branch: branch === 'main' ? 'Nightly' : 'Stable',
          isPrerelease: branch === 'main',
          allVersions: versionsInfo,
          downloadUrl: targetStatus.url
        });
      } else {
        console.log(`[UPDATE] App atualizado (v${currentAppVersion})`);
        mainWindow.webContents.send('update-not-available', { version: currentAppVersion });
      }
    } else if (targetStatus && targetStatus.error) {
       console.warn(`[UPDATE] Erro ao acessar canal '${branch}' (Status: ${targetStatus.status})`);
       mainWindow.webContents.send('update-error', { 
         message: `Erro ${targetStatus.status}: Não foi possível localizar a branch '${targetStatus.branch}'. Verifique se o repositório é público.` 
       });
    }
  } catch (error) {
    console.error("[UPDATE] Erro inesperado no check-update:", error.message);
    mainWindow.webContents.send('update-error', { message: "Falha interna ao verificar atualizações." });
  }
});

ipcMain.on('start-download', () => {
  let progress = 0;
  const interval = setInterval(() => {
    progress += 10;
    mainWindow.webContents.send('update-downloading', { percent: Math.min(progress, 100) });
    if (progress >= 100) {
      clearInterval(interval);
      setTimeout(() => mainWindow.webContents.send('update-ready'), 500);
    }
  }, 200);
});

ipcMain.on('install-update', () => { 
  app.relaunch(); 
  app.exit(); 
});

app.whenReady().then(() => { startBackend(); createWindow(); });

app.on('window-all-closed', () => {
  if (serverProcess) serverProcess.kill();
  if (process.platform !== 'darwin') app.quit();
});
