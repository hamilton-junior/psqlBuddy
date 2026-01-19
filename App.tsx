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
  const [updateInfo, setUpdateInfo] = useState<{version: string, notes: string, branch?: string, updateType?: 'upgrade' | 'downgrade'} | null>(null);
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

  const handleUpdateDetection = useCallback((info: any) => {
    console.log(`[UPDATE] Detecção disparada: v${info.version}, Tipo: ${info.updateType}`);
    const ignoredVersions = JSON.parse(localStorage.getItem('psqlBuddy-ignored-versions') || '[]');
    const isManual = manualCheckRef.current || info.isManual;
    manualCheckRef.current = false;

    if (isManual || !ignoredVersions.includes(info.version)) {
      setUpdateInfo({
        version: info.version,
        notes: info.releaseNotes || 'Novas melhorias disponíveis.',
        branch: settings.updateBranch === 'main' ? 'Main/WIP' : 'Stable',
        updateType: info.updateType || 'upgrade'
      });
      
      if (isManual) {
        if (info.updateType === 'downgrade') {
          toast("A versão oficial é anterior à sua atual.", { icon: '⚠️' });
        } else {
          toast.success(`Versão v${info.version} encontrada!`);
        }
      }
    } else {
      console.log(`[UPDATE] Versão v${info.version} ignorada pelo usuário anteriormente.`);
    }
  }, [settings.updateBranch]);

  useEffect(() => {
    const electron = (window as any).electron;
    if (electron) {
      console.log("[ELECTRON-BRIDGE] Inicializando escuta de eventos...");
      
      electron.on('app-version', (v: string) => {
        console.log(`[ELECTRON-BRIDGE] Versão local: ${v}`);
        setCurrentAppVersion(v);
      });
      
      electron.on('sync-versions', (v: any) => {
        console.log("[ELECTRON-BRIDGE] Versões sincronizadas do GitHub:", v);
        setRemoteVersions(v);
      });

      electron.on('update-available', handleUpdateDetection);

      electron.on('update-not-available', () => {
        console.log("[ELECTRON-BRIDGE] Sistema já está atualizado.");
        if (manualCheckRef.current) {
          toast.success("Você já está na última versão!");
        }
        manualCheckRef.current = false;
        setUpdateInfo(null);
      });

      electron.on('update-downloading', (p: any) => {
        console.log(`[ELECTRON-BRIDGE] Progresso: ${p.percent.toFixed(2)}%`);
        setDownloadProgress(p.percent);
      });

      electron.on('update-ready', () => {
        console.log("[ELECTRON-BRIDGE] Download concluído. Pronto para instalar.");
        setUpdateReady(true);
        setDownloadProgress(100);
      });

      electron.on('update-error', (err: any) => {
        console.error("[ELECTRON-BRIDGE] Erro no processo de atualização:", err);
        manualCheckRef.current = false;
        toast.error("Falha ao buscar atualização.");
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

  const handleCheckUpdate = () => {
    const electron = (window as any).electron;
    if (electron) {
      manualCheckRef.current = true;
      console.log(`[UI] Solicitando verificação manual para o canal: ${settings.updateBranch}`);
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
      console.log("[UI] Iniciando download...");
      setDownloadProgress(0); 
      electron.send('start-download'); 
    }
  };

  const handleInstallUpdate = () => {
    const electron = (window as any).electron;
    if (electron) {
      console.log("[UI] Solicitando instalação e reinicialização...");
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