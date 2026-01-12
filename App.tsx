
import React, { useState, useEffect } from 'react';
import { 
  DatabaseSchema, AppStep, BuilderState, QueryResult, DbCredentials, 
  AppSettings, DEFAULT_SETTINGS, VirtualRelation
} from './types';
import Sidebar from './components/Sidebar';
import ConnectionStep from './components/steps/ConnectionStep';
import BuilderStep from './components/steps/BuilderStep';
import PreviewStep from './components/steps/PreviewStep';
import ResultsStep from './components/steps/ResultsStep';
import DataDiffStep from './components/steps/DataDiffStep';
import RoadmapStep from './components/steps/RoadmapStep';
import SettingsModal from './components/SettingsModal';
import SchemaDiagramModal from './components/SchemaDiagramModal';
import SqlExtractorModal from './components/SqlExtractorModal';
import UpdateModal from './components/UpdateModal';
import { generateSqlFromBuilderState } from './services/geminiService';
import { generateLocalSql } from './services/localSqlService';
import { executeQueryReal } from './services/dbService';
import { executeOfflineQuery, initializeSimulation, SimulationData } from './services/simulationService';
import { Toaster, toast } from 'react-hot-toast';
import { Info } from 'lucide-react';

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
      const stored = localStorage.getItem('psql-buddy-settings');
      return stored ? { ...DEFAULT_SETTINGS, ...JSON.parse(stored) } : DEFAULT_SETTINGS;
    } catch { return DEFAULT_SETTINGS; }
  });

  const [showSettings, setShowSettings] = useState(false);
  const [showSqlExtractor, setShowSqlExtractor] = useState(false);
  
  // Update States
  const [updateInfo, setUpdateInfo] = useState<{version: string, notes: string, branch?: string} | null>(null);
  const [downloadProgress, setDownloadProgress] = useState<number | null>(null);
  const [updateReady, setUpdateReady] = useState(false);

  useEffect(() => {
    if (settings.theme === 'dark') document.documentElement.classList.add('dark');
    else document.documentElement.classList.remove('dark');
    localStorage.setItem('psql-buddy-settings', JSON.stringify(settings));
  }, [settings.theme, settings.updateBranch]);

  // Listener para IPC do Electron (Atualização)
  useEffect(() => {
    const electron = (window as any).electron;
    if (electron) {
      electron.on('update-available', (info: any) => setUpdateInfo(info));
      electron.on('update-downloading', (progress: any) => setDownloadProgress(progress.percent));
      electron.on('update-ready', () => setUpdateReady(true));
    }
  }, []);

  const handleCheckUpdate = () => {
    const electron = (window as any).electron;
    if (electron) electron.send('check-update', settings.updateBranch);
    else toast("Atualizações só estão disponíveis na versão Desktop.");
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

  return (
    <div className="flex h-screen w-screen bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-slate-100 overflow-hidden font-sans transition-colors duration-500">
      <Toaster position="top-right" />
      
      <Sidebar 
        currentStep={currentStep} onNavigate={setCurrentStep} schema={schema} hasResults={executionResult.length > 0}
        onOpenSettings={() => setShowSettings(true)} onOpenSqlExtractor={() => setShowSqlExtractor(true)}
        onCheckUpdate={handleCheckUpdate}
      />

      <main className="flex-1 overflow-hidden relative flex flex-col">
        <div className="flex-1 p-6 overflow-hidden h-full">
           {currentStep === 'connection' && <ConnectionStep onSchemaLoaded={handleSchemaLoaded} settings={settings} />}
           {currentStep === 'builder' && schema && (
              <BuilderStep schema={schema} state={builderState} onStateChange={setBuilderState} onGenerate={handleGenerateSql} isGenerating={isGenerating} settings={settings} />
           )}
           {currentStep === 'preview' && queryResult && (
              <PreviewStep queryResult={queryResult} onExecute={handleExecuteQuery} onBack={() => setCurrentStep('builder')} isExecuting={isExecuting} isValidating={false} />
           )}
           {currentStep === 'results' && (
              <ResultsStep data={executionResult} sql={queryResult?.sql || ''} onBackToBuilder={() => setCurrentStep('builder')} onNewConnection={() => setCurrentStep('connection')} settings={settings} onShowToast={(m) => toast(m)} credentials={credentials} schema={schema || undefined} />
           )}
           {currentStep === 'datadiff' && schema && <DataDiffStep schema={schema} credentials={credentials} simulationData={simulationData} settings={settings} />}
           {currentStep === 'roadmap' && <RoadmapStep />}
        </div>
      </main>

      {showSettings && <SettingsModal settings={settings} onSave={setSettings} onClose={() => setShowSettings(false)} simulationData={simulationData} schema={schema} credentials={credentials} />}
      {showSqlExtractor && <SqlExtractorModal onClose={() => setShowSqlExtractor(false)} onRunSql={(sql) => { setQueryResult({sql, explanation: 'Extraído do log', tips: []}); setCurrentStep('preview'); }} settings={settings} />}
      
      {updateInfo && (
        <UpdateModal 
          updateInfo={updateInfo} downloadProgress={downloadProgress} isReady={updateReady} 
          onClose={() => setUpdateInfo(null)} onInstall={handleInstallUpdate} 
        />
      )}
    </div>
  );
};

export default App;
