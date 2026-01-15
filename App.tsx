import React, { useState, useEffect, useRef, useCallback } from 'react';
import { 
  DatabaseSchema, AppStep, BuilderState, QueryResult, DbCredentials, 
  AppSettings, DEFAULT_SETTINGS, VirtualRelation, DashboardItem
} from './types';
import { Rocket } from 'lucide-react';
import Sidebar from '@/components/Sidebar';
import ConnectionStep from '@/components/steps/ConnectionStep';
import BuilderStep from '@/components/steps/BuilderStep';
import PreviewStep from '@/components/steps/PreviewStep';
import ResultsStep from '@/components/steps/ResultsStep';
import DataDiffStep from '@/components/steps/DataDiffStep';
import DashboardStep from '@/components/steps/DashboardStep';
import RoadmapStep from '@/components/steps/RoadmapStep';
import SettingsModal from '@/components/SettingsModal';
import SchemaDiagramModal from '@/components/SchemaDiagramModal';
import HistoryModal from '@/components/HistoryModal';
import ShortcutsModal from '@/components/ShortcutsModal';
import SqlCheatSheetModal from '@/components/SqlCheatSheetModal';
import VirtualRelationsModal from '@/components/VirtualRelationsModal';
import LogAnalyzerModal from '@/components/LogAnalyzerModal';
import TemplateModal from '@/components/TemplateModal';
import SqlExtractorModal from '@/components/SqlExtractorModal';
import UpdateModal from '@/components/UpdateModal';
import { generateSqlFromBuilderState } from '@/services/geminiService';
import { generateLocalSql } from '@/services/localSqlService';
import { executeQueryReal } from '@/services/dbService';
import { executeOfflineQuery, initializeSimulation, SimulationData } from '@/services/simulationService';
import { Toaster, toast } from 'react-hot-toast';

const INITIAL_BUILDER_STATE: BuilderState = {
  selectedTables: [],
  selectedColumns: [],
  aggregations: {},
  joins: [],
  filters: [],
  groupBy: [],
  orderBy: [],
  limit: 100
};

/**
 * Utilitário de comparação de versões para o frontend
 */
function compareVersions(v1: string, v2: string, context = 'App') {
  console.log(`[DEBUG:VERSION:${context}] Comparando: "${v1}" vs "${v2}"`);
  
  if (!v1 || v1 === '---' || !v2 || v2 === '---') {
    return 0;
  }
  
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

const App: React.FC = () => {
  const [currentStep, setCurrentStep] = useState<AppStep>('connection');
  const [schema, setSchema] = useState<DatabaseSchema | null>(null);
  const [credentials, setCredentials] = useState<DbCredentials | null>(null);
  const [simulationData, setSimulationData] = useState<SimulationData>({});
  const [builderState, setBuilderState] = useState<BuilderState>(INITIAL_BUILDER_STATE);
  const [isGenerating, setIsGenerating] = useState(false);
  const [queryResult, setQueryResult] = useState<QueryResult | null>(null);
  const [executionResult, setExecutionResult] = useState<any[]>([]);
  const [isExecuting, setIsExecuting] = useState(false);
  
  const [settings, setSettings] = useState<AppSettings>(() => {
    try {
      const stored = localStorage.getItem('psqlBuddy-settings');
      return stored ? { ...DEFAULT_SETTINGS, ...JSON.parse(stored) } : DEFAULT_SETTINGS;
    } catch { return DEFAULT_SETTINGS; }
  });

  const [dashboardItems, setDashboardItems] = useState<DashboardItem[]>(() => {
    try {
      const stored = localStorage.getItem('psqlBuddy-dashboard');
      return stored ? JSON.parse(stored) : [];
    } catch { return []; }
  });

  // Modal Visibility States
  const [showSettings, setShowSettings] = useState(false);
  const [showDiagram, setShowDiagram] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [showShortcuts, setShowShortcuts] = useState(false);
  const [showCheatSheet, setShowCheatSheet] = useState(false);
  const [showVirtualRelations, setShowVirtualRelations] = useState(false);
  const [showLogAnalyzer, setShowLogAnalyzer] = useState(false);
  const [showTemplates, setShowTemplates] = useState(false);
  const [showSqlExtractor, setShowSqlExtractor] = useState(false);
  const [virtualRelations, setVirtualRelations] = useState<VirtualRelation[]>([]);
  
  // Update States
  const [updateInfo, setUpdateInfo] = useState<{version: string, notes: string, branch?: string, updateType?: 'upgrade' | 'downgrade', currentVersion?: string} | null>(null);
  const [remoteVersions, setRemoteVersions] = useState<{stable: string, main: string} | null>(null);
  const [currentAppVersion, setCurrentAppVersion] = useState<string>('...');
  const [downloadProgress, setDownloadProgress] = useState<number | null>(null);
  const [updateReady, setUpdateReady] = useState(false);
  const manualCheckRef = useRef(false);

  useEffect(() => {
    if (settings.theme === 'dark') document.documentElement.classList.add('dark');
    else document.documentElement.classList.remove('dark');
    localStorage.setItem('psqlBuddy-settings', JSON.stringify(settings));
  }, [settings.theme]);

  useEffect(() => {
    localStorage.setItem('psqlBuddy-dashboard', JSON.stringify(dashboardItems));
  }, [dashboardItems]);

  // Função para processar aviso de atualização vindo do autoUpdater ou verificação manual
  const handleUpdateDetection = useCallback((info: any) => {
    const ignoredVersions = JSON.parse(localStorage.getItem('psqlBuddy-ignored-versions') || '[]');
    const isManual = manualCheckRef.current || info.isManual;
    
    // IMPORTANTE: Manter o manualCheckRef apenas para o toast de sucesso se não houver atualização
    // mas o reset deve ocorrer após a detecção
    const updateType = info.updateType || 'upgrade';

    console.log(`[APP] [UPDATE_HANDLER] Recebido do Backend: v${info.version}, Tipo: ${updateType}, Manual: ${isManual}`);

    // Se as versões são iguais, o backend envia update-not-available, 
    // mas se por algum erro chegar aqui, fazemos uma última defesa.
    if (currentAppVersion !== '...' && compareVersions(info.version, currentAppVersion, 'Final-UI-Guard') === 0) {
      console.log(`[APP] [UPDATE_HANDLER] Versões idênticas em UI Guard. Ignorando.`);
      setUpdateInfo(null);
      manualCheckRef.current = false;
      return;
    }

    // Só exibe se for manual ou se não estiver na lista de ignorados
    if (isManual || !ignoredVersions.includes(info.version)) {
      console.log(`[APP] [UPDATE_HANDLER] Definindo estado updateInfo para exibição do modal.`);
      setUpdateInfo({
        version: info.version,
        notes: info.releaseNotes || 'Novas melhorias disponíveis no repositório.',
        branch: settings.updateBranch === 'main' ? 'Main' : 'Stable',
        updateType: updateType,
        currentVersion: currentAppVersion
      });
      
      if (isManual) {
        if (updateType === 'downgrade') {
          toast("A versão oficial do canal é anterior à instalada.", { icon: '⚠️', id: 'update-toast' });
        } else {
          toast.success(`Versão v${info.version} disponível no canal ${settings.updateBranch.toUpperCase()}!`, { id: 'update-toast' });
        }
      }
    } else {
       console.log(`[APP] [UPDATE_HANDLER] Versão ignorada ou não manual.`);
    }
    
    manualCheckRef.current = false;
  }, [settings.updateBranch, currentAppVersion]);

  useEffect(() => {
    const electron = (window as any).electron;
    if (electron) {
      electron.on('app-version', (v: string) => {
        console.log(`[APP] [ELECTRON_EVENT] Versão Local Recebida: ${v}`);
        setCurrentAppVersion(v);
      });
      
      electron.on('sync-versions', (v: any) => {
        console.log(`[APP] [ELECTRON_EVENT] Versões do Repositório Sincronizadas:`, v);
        setRemoteVersions(v);
      });

      const handleUpdateNotAvailable = () => {
        console.log(`[APP] [ELECTRON_EVENT] Notificado: Nenhuma atualização disponível.`);
        if (manualCheckRef.current) {
          toast.success("Sua instância está sincronizada!", { id: 'update-toast' });
        }
        manualCheckRef.current = false;
        setUpdateInfo(null);
      };

      electron.on('update-available', handleUpdateDetection);
      electron.on('update-not-available', handleUpdateNotAvailable);
      electron.on('update-error', (err: any) => {
        manualCheckRef.current = false;
        console.error("[APP] [ELECTRON_EVENT] Erro crítico no processo de atualização:", err);
      });
      
      electron.on('update-downloading', (p: any) => setDownloadProgress(p.percent));
      
      electron.on('update-ready', () => {
        setUpdateReady(true);
        setDownloadProgress(100);
        toast.success("Pacote baixado! Pronto para instalar.", { id: 'update-toast' });
      });

      return () => {
         electron.removeAllListeners('update-available');
         electron.removeAllListeners('update-not-available');
         electron.removeAllListeners('sync-versions');
         electron.removeAllListeners('update-ready');
         electron.removeAllListeners('update-error');
      }
    }
  }, [handleUpdateDetection]);

  // Monitora mudanças nas versões remotas ou no canal para disparar o aviso automaticamente se necessário
  useEffect(() => {
    if (!remoteVersions || currentAppVersion === '...') return;
    
    const targetRemote = settings.updateBranch === 'main' ? remoteVersions.main : remoteVersions.stable;
    
    if (targetRemote === 'Erro' || targetRemote === '---') return;

    const comparison = compareVersions(targetRemote, currentAppVersion, 'Background-Monitor');
    
    console.log(`[APP] [VERSION_MONITOR] Avaliando: Canal ${settings.updateBranch.toUpperCase()} | Local: ${currentAppVersion} | Remoto: ${targetRemote} | Resultado: ${comparison}`);

    if (comparison > 0) {
      handleUpdateDetection({ 
        version: targetRemote, 
        updateType: 'upgrade',
        releaseNotes: `Uma nova versão (${targetRemote}) foi encontrada no canal ${settings.updateBranch.toUpperCase()}.` 
      });
    } else if (comparison < 0) {
      handleUpdateDetection({
        version: targetRemote,
        updateType: 'downgrade',
        releaseNotes: `A versão estável do canal (${targetRemote}) é anterior à sua versão instalada (${currentAppVersion}).`
      });
    } else {
      // Se forem iguais e o modal de update estava aberto (talvez por causa de outro canal), fechamos
      if (updateInfo && !manualCheckRef.current) {
         console.log(`[APP] [VERSION_MONITOR] Versão sincronizada com o canal. Limpando modal.`);
         setUpdateInfo(null);
      }
    }
  }, [remoteVersions, settings.updateBranch, currentAppVersion, handleUpdateDetection]);

  const handleCheckUpdate = () => {
    const electron = (window as any).electron;
    if (electron) {
      manualCheckRef.current = true;
      console.log(`[APP] [UI] Iniciando verificação manual de atualização. Canal: ${settings.updateBranch}`);
      electron.send('check-update', settings.updateBranch);
    }
  };

  const handleIgnoreUpdate = (version: string) => {
    const ignored = JSON.parse(localStorage.getItem('psqlBuddy-ignored-versions') || '[]');
    if (!ignored.includes(version)) {
      ignored.push(version);
      localStorage.setItem('psqlBuddy-ignored-versions', JSON.stringify(ignored));
    }
    setUpdateInfo(null);
  };

  const handleStartDownload = () => {
    const electron = (window as any).electron;
    if (electron) { 
      setDownloadProgress(0); 
      electron.send('start-download');
      if (settings.updateBranch === 'main' || !(window as any).electron.isPackaged) {
        toast("Download manual: visite o repositório GitHub para baixar a branch main.");
      }
    }
  };

  const handleInstallUpdate = () => {
    const electron = (window as any).electron;
    if (electron) electron.send('install-update');
  };

  const handleSchemaLoaded = (loadedSchema: DatabaseSchema, creds: DbCredentials) => {
    setSchema(loadedSchema);
    setCredentials(creds);
    if (loadedSchema.connectionSource === 'simulated') setSimulationData(initializeSimulation(loadedSchema));
    setCurrentStep('builder');
  };

  const handleGenerateSql = async () => {
    if (!schema) return;
    setIsGenerating(true);
    try {
      let result = settings.enableAiGeneration 
        ? await generateSqlFromBuilderState(schema, builderState, settings.enableAiTips)
        : generateLocalSql(schema, builderState);
      setQueryResult(result);
      setCurrentStep('preview');
    } catch (error: any) {
      toast.error(error.message || "Erro ao gerar SQL");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleExecuteQuery = async (sqlOverride?: string) => {
    if (!credentials || !schema) return;
    const sqlToRun = sqlOverride || queryResult?.sql;
    if (!sqlToRun) return;
    setIsExecuting(true);
    try {
       let data = credentials.host === 'simulated'
          ? executeOfflineQuery(schema, simulationData, builderState)
          : await executeQueryReal(credentials, sqlToRun);
       setExecutionResult(data);
       setCurrentStep('results');
    } catch (error: any) {
       toast.error(error.message || "Erro na execução");
    } finally {
       setIsExecuting(false);
    }
  };

  const handleRunSqlExternal = (sql: string) => {
    setQueryResult({ sql, explanation: 'Carregado de ferramenta externa.', tips: [] });
    setCurrentStep('preview');
  };

  return (
    <div className="flex h-screen w-screen bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-slate-100 overflow-hidden font-sans transition-colors duration-500">
      <Toaster position="top-right" />
      
      <Sidebar 
        currentStep={currentStep} 
        onNavigate={setCurrentStep} 
        schema={schema} 
        hasResults={executionResult.length > 0}
        onOpenSettings={() => setShowSettings(true)} 
        onOpenDiagram={() => setShowDiagram(true)}
        onOpenHistory={() => setShowHistory(true)}
        onOpenShortcuts={() => setShowShortcuts(true)}
        onOpenCheatSheet={() => setShowCheatSheet(true)}
        onOpenVirtualRelations={() => setShowVirtualRelations(true)}
        onOpenLogAnalyzer={() => setShowLogAnalyzer(true)}
        onOpenTemplates={() => setShowTemplates(true)}
        onOpenSqlExtractor={() => setShowSqlExtractor(true)}
        onCheckUpdate={handleCheckUpdate}
      />

      <main className="flex-1 overflow-hidden relative flex flex-col">
        <div className="flex-1 p-6 overflow-hidden h-full">
           {currentStep === 'connection' && <ConnectionStep onSchemaLoaded={handleSchemaLoaded} settings={settings} />}
           {currentStep === 'builder' && schema && (
              <BuilderStep schema={schema} state={builderState} onStateChange={setBuilderState} onGenerate={handleGenerateSql} isGenerating={isGenerating} settings={settings} />
           )}
           {currentStep === 'preview' && queryResult && (
              <PreviewStep queryResult={queryResult} onExecute={handleExecuteQuery} onBack={() => setCurrentStep('builder')} isExecuting={isExecuting} isValidating={false} schema={schema || undefined} />
           )}
           {currentStep === 'results' && (
              <ResultsStep data={executionResult} sql={queryResult?.sql || ''} onBackToBuilder={() => setCurrentStep('builder')} onNewConnection={() => setCurrentStep('connection')} settings={settings} onShowToast={(m) => toast(m)} credentials={credentials} schema={schema || undefined} />
           )}
           {currentStep === 'datadiff' && schema && <DataDiffStep schema={schema} credentials={credentials} simulationData={simulationData} settings={settings} />}
           {currentStep === 'dashboard' && (
              <DashboardStep 
                items={dashboardItems} 
                onRemoveItem={(id) => setDashboardItems(prev => prev.filter(i => i.id !== id))} 
                onClearAll={() => setDashboardItems([])} 
              />
           )}
           {currentStep === 'roadmap' && <Rocket className="w-8 h-8 text-indigo-600 animate-bounce" />}
        </div>
      </main>

      {showSettings && (
        <SettingsModal 
          settings={settings} 
          onSave={setSettings} 
          onClose={() => setShowSettings(false)} 
          simulationData={simulationData} 
          schema={schema} 
          credentials={credentials}
          remoteVersions={remoteVersions}
        />
      )}
      
      {showDiagram && schema && (
        <SchemaDiagramModal schema={schema} onClose={() => setShowDiagram(false)} credentials={credentials} />
      )}
      
      {showHistory && (
        <HistoryModal onClose={() => setShowHistory(false)} onLoadQuery={handleRunSqlExternal} />
      )}
      
      {showShortcuts && <ShortcutsModal onClose={() => setShowShortcuts(false)} />}
      
      {showCheatSheet && <SqlCheatSheetModal onClose={() => setShowCheatSheet(false)} />}
      
      {showVirtualRelations && schema && (
        <VirtualRelationsModal 
           schema={schema} 
           existingRelations={virtualRelations} 
           onAddRelation={(r) => setVirtualRelations(prev => [...prev, r])}
           onRemoveRelation={(id) => setVirtualRelations(prev => prev.filter(r => r.id !== id))}
           onClose={() => setShowVirtualRelations(false)}
           credentials={credentials}
        />
      )}
      
      {showLogAnalyzer && schema && (
        <LogAnalyzerModal schema={schema} onClose={() => setShowLogAnalyzer(false)} onRunSql={handleRunSqlExternal} />
      )}
      
      {showTemplates && (
        <TemplateModal onClose={() => setShowTemplates(false)} onRunTemplate={handleRunSqlExternal} />
      )}
      
      {showSqlExtractor && (
        <SqlExtractorModal onClose={() => setShowSqlExtractor(false)} onRunSql={handleRunSqlExternal} settings={settings} />
      )}
      
      {updateInfo && (
        <UpdateModal 
          updateInfo={updateInfo} 
          downloadProgress={downloadProgress} 
          isReady={updateReady} 
          onClose={() => setUpdateInfo(null)} 
          onStartDownload={handleStartDownload}
          onInstall={handleInstallUpdate} 
          onIgnore={() => handleIgnoreUpdate(updateInfo.version)}
        />
      )}
    </div>
  );
};

export default App;