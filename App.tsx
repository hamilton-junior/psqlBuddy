import React, { useState, useEffect, useRef } from 'react';
import { 
  DatabaseSchema, AppStep, BuilderState, QueryResult, DbCredentials, 
  AppSettings, DEFAULT_SETTINGS, VirtualRelation, DashboardItem
} from './types';
import { Rocket } from 'lucide-react';
import Sidebar from './components/Sidebar';
import ConnectionStep from './components/steps/ConnectionStep';
import BuilderStep from './components/steps/BuilderStep';
import PreviewStep from './components/steps/PreviewStep';
import ResultsStep from './components/steps/ResultsStep';
import DataDiffStep from './components/steps/DataDiffStep';
import DashboardStep from './components/steps/DashboardStep';
import RoadmapStep from './components/steps/RoadmapStep';
import SettingsModal from './components/SettingsModal';
import SchemaDiagramModal from './components/SchemaDiagramModal';
import HistoryModal from './components/HistoryModal';
import ShortcutsModal from './components/ShortcutsModal';
import SqlCheatSheetModal from './components/SqlCheatSheetModal';
import VirtualRelationsModal from './components/VirtualRelationsModal';
import LogAnalyzerModal from './components/LogAnalyzerModal';
import TemplateModal from './components/TemplateModal';
import SqlExtractorModal from './components/SqlExtractorModal';
import UpdateModal from './components/UpdateModal';
import { generateSqlFromBuilderState } from './services/geminiService';
import { generateLocalSql } from './services/localSqlService';
import { executeQueryReal } from './services/dbService';
import { executeOfflineQuery, initializeSimulation, SimulationData } from './services/simulationService';
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
  
  // Update States (Refatorados para Electron-Updater)
  const [updateInfo, setUpdateInfo] = useState<{version: string, notes: string, branch?: string} | null>(null);
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

  // Listener para IPC do Electron (AutoUpdater)
  useEffect(() => {
    const electron = (window as any).electron;
    if (electron) {
      // Receber versão atual do processo principal
      electron.on('app-version', (v: string) => setCurrentAppVersion(v));

      const handleUpdateAvailable = (info: any) => {
        console.log(`[UPDATE] Disponível: ${info.version}`);
        
        const ignoredVersions = JSON.parse(localStorage.getItem('psqlBuddy-ignored-versions') || '[]');
        const isManual = manualCheckRef.current;
        manualCheckRef.current = false;

        if (isManual || !ignoredVersions.includes(info.version)) {
          setUpdateInfo({
            version: info.version,
            notes: info.releaseNotes || 'Novas melhorias disponíveis.',
            branch: settings.updateBranch === 'main' ? 'Main' : 'Stable'
          });
          if (isManual) toast.success(`Atualização v${info.version} encontrada!`, { id: 'update-toast' });
        }
      };

      const handleUpdateNotAvailable = () => {
        if (manualCheckRef.current) {
          toast.success("Você já está na última versão!", { id: 'update-toast' });
        }
        manualCheckRef.current = false;
        setUpdateInfo(null);
      };

      const handleUpdateError = (err: any) => {
        console.error("[UPDATE] Erro:", err);
        manualCheckRef.current = false;
        if (manualCheckRef.current) toast.error(`Falha ao buscar updates: ${err.message}`, { id: 'update-toast' });
      };

      electron.on('update-available', handleUpdateAvailable);
      electron.on('update-not-available', handleUpdateNotAvailable);
      electron.on('update-error', handleUpdateError);
      electron.on('update-downloading', (p: any) => {
        setDownloadProgress(p.percent);
      });
      electron.on('update-ready', () => {
        setUpdateReady(true);
        setDownloadProgress(100);
        toast.success("Update pronto para instalar!", { id: 'update-toast' });
      });

      return () => {
         electron.removeAllListeners('update-available');
         electron.removeAllListeners('update-not-available');
         electron.removeAllListeners('update-error');
         electron.removeAllListeners('update-downloading');
         electron.removeAllListeners('update-ready');
      }
    }
  }, [settings.updateBranch]);

  const handleCheckUpdate = () => {
    const electron = (window as any).electron;
    if (electron) {
      manualCheckRef.current = true;
      toast.loading("Verificando atualizações no GitHub...", { id: 'update-toast' });
      electron.send('check-update');
    } else {
      toast.error("Atualização disponível apenas na versão Desktop.");
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
    }
  };

  const handleInstallUpdate = () => {
    const electron = (window as any).electron;
    if (electron) {
      electron.send('install-update');
    }
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
      let result: QueryResult;
      if (settings.enableAiGeneration) {
         result = await generateSqlFromBuilderState(schema, builderState, settings.enableAiTips);
      } else {
         result = generateLocalSql(schema, builderState);
      }
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
       let data: any[] = [];
       if (credentials.host === 'simulated') {
          data = executeOfflineQuery(schema, simulationData, builderState);
          await new Promise(r => setTimeout(r, 600));
       } else {
          data = await executeQueryReal(credentials, sqlToRun);
       }
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

      {/* Modals */}
      {showSettings && (
        <SettingsModal 
          settings={settings} 
          onSave={setSettings} 
          onClose={() => setShowSettings(false)} 
          simulationData={simulationData} 
          schema={schema} 
          credentials={credentials} 
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