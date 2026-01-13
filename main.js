
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
  console.log(`[UPDATE] Consultando GitHub: ${apiPath}`);
  return new Promise((resolve, reject) => {
    const request = net.request({
      method: 'GET', protocol: 'https:', hostname: 'api.github.com', path: apiPath,
      headers: { 'User-Agent': 'PSQL-Buddy-App' }
    });
    
    request.on('response', (response) => {
      let data = '';
      console.log(`[UPDATE] Status Resposta: ${response.statusCode}`);
      
      response.on('data', (chunk) => { data += chunk; });
      response.on('end', () => {
        try {
          const json = data ? JSON.parse(data) : {};
          resolve({ json, headers: response.headers });
        } catch (e) {
          console.error("[UPDATE] Erro ao parsear JSON do GitHub");
          resolve({ json: {}, headers: response.headers });
        }
      });
    });
    
    request.on('error', (err) => {
      console.error(`[UPDATE] Erro na requisição net: ${err.message}`);
      reject(err);
    });
    request.end();
  });
}

// Retorna o status de commits de uma branch específica
async function getGitHubBranchStatus(branch) {
  try {
    const { json: commits, headers } = await fetchGitHubData(`/repos/${GITHUB_REPO}/commits?sha=${branch}&per_page=1`);
    
    const link = headers['link'];
    let count = 0;

    // A API do GitHub usa o header 'link' para paginação. O total de commits é a última página.
    if (link) {
      const linkStr = Array.isArray(link) ? link[0] : link;
      console.log(`[UPDATE] Header Link (${branch}): ${linkStr}`);
      
      // Regex para capturar o número da última página
      const lastPageMatch = linkStr.match(/page=(\d+)>; rel="last"/);
      if (lastPageMatch) {
        count = parseInt(lastPageMatch[1], 10);
      } else {
        // Se não houver "last", mas houver dados, assumimos o tamanho do array retornado (geralmente 1 devido ao per_page)
        count = Array.isArray(commits) ? commits.length : 0;
      }
    } else {
      // Sem header link significa que só existe 1 página de resultados
      count = (Array.isArray(commits) && commits.length > 0) ? 1 : 0;
    }

    const major = Math.floor(count / 1000);
    const minor = Math.floor((count % 1000) / 100);
    const patch = count % 100;
    const version = `${major}.${minor}.${patch}`;

    console.log(`[UPDATE] Branch: ${branch} | Commits: ${count} | Versão Calculada: ${version}`);

    return {
      version,
      commitCount: count,
      lastMessage: commits[0]?.commit?.message || "Sem descrição.",
      url: `https://github.com/${GITHUB_REPO}/archive/refs/heads/${branch}.zip`
    };
  } catch (e) { 
    console.error(`[UPDATE] Falha crítica ao obter status da branch ${branch}:`, e.message);
    return null; 
  }
}

ipcMain.on('check-update', async (event, branch = 'stable') => {
  try {
    console.log(`[UPDATE] Verificação iniciada para canal: ${branch}`);
    
    // Busca informações de ambas as branches para o seletor de versões
    const [mainStatus, stableStatus] = await Promise.all([
      getGitHubBranchStatus('main'),
      getGitHubBranchStatus('stable')
    ]);

    const versionsInfo = {
      stable: stableStatus?.version || "0.0.0",
      main: mainStatus?.version || "0.0.0"
    };

    console.log(`[UPDATE] Sincronizando versões com UI:`, versionsInfo);

    if (mainWindow && !mainWindow.isDestroyed()) {
       mainWindow.webContents.send('sync-versions', versionsInfo);
    }

    const currentAppVersion = app.getVersion();
    const targetStatus = branch === 'main' ? mainStatus : stableStatus;

    if (targetStatus) {
      if (targetStatus.version !== currentAppVersion) {
        console.log(`[UPDATE] Nova versão disponível! Local: ${currentAppVersion} | Remota: ${targetStatus.version}`);
        mainWindow.webContents.send('update-available', {
          version: targetStatus.version,
          notes: `[Branch: ${branch}]\n${targetStatus.lastMessage}`,
          branch: branch === 'main' ? 'Main (Nightly)' : 'Stable',
          isPrerelease: branch === 'main',
          allVersions: versionsInfo,
          downloadUrl: targetStatus.url
        });
      } else {
        console.log(`[UPDATE] Aplicativo já está na última versão (${currentAppVersion}).`);
        mainWindow.webContents.send('update-not-available', { version: currentAppVersion });
      }
    }
  } catch (error) {
    console.error("[UPDATE] Erro geral no check-update:", error.message);
  }
});

ipcMain.on('start-download', () => {
  console.log("[UPDATE] Iniciando simulação de download...");
  let progress = 0;
  const interval = setInterval(() => {
    progress += 10;
    mainWindow.webContents.send('update-downloading', { percent: Math.min(progress, 100) });
    if (progress >= 100) {
      clearInterval(interval);
      console.log("[UPDATE] Download concluído.");
      setTimeout(() => mainWindow.webContents.send('update-ready'), 500);
    }
  }, 200);
});

ipcMain.on('install-update', () => { 
  console.log("[UPDATE] Instalando atualização e reiniciando...");
  app.relaunch(); 
  app.exit(); 
});

app.whenReady().then(() => { startBackend(); createWindow(); });

app.on('window-all-closed', () => {
  if (serverProcess) serverProcess.kill();
  if (process.platform !== 'darwin') app.quit();
});
