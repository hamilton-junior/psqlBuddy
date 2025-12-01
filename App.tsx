
import React, { useState, useEffect } from 'react';
import { DatabaseSchema, AppStep, BuilderState, QueryResult, DbCredentials, AppSettings, DEFAULT_SETTINGS } from './types';
import Sidebar from './components/Sidebar';
import ConnectionStep from './components/steps/ConnectionStep';
import BuilderStep from './components/steps/BuilderStep';
import PreviewStep from './components/steps/PreviewStep';
import ResultsStep from './components/steps/ResultsStep';
import SettingsModal from './components/SettingsModal';
import AiPreferenceModal from './components/AiPreferenceModal';
import { generateSqlFromBuilderState, validateSqlQuery, generateMockData } from './services/geminiService';
import { generateLocalSql } from './services/localSqlService';
import { initializeSimulation, executeOfflineQuery, SimulationData } from './services/simulationService';
import { executeQueryReal } from './services/dbService';
import { AlertTriangle, X } from 'lucide-react';

function App() {
  // Settings State
  const [settings, setSettings] = useState<AppSettings>(() => {
    const saved = localStorage.getItem('psql-buddy-settings');
    return saved ? JSON.parse(saved) : DEFAULT_SETTINGS;
  });
  const [showSettings, setShowSettings] = useState(false);
  
  // Onboarding State
  const [showOnboarding, setShowOnboarding] = useState(false);

  // Check if it's first run to show onboarding
  useEffect(() => {
    const saved = localStorage.getItem('psql-buddy-settings');
    if (!saved) {
       setShowOnboarding(true);
    }
  }, []);

  // Global State for Quota Limits
  const [quotaExhausted, setQuotaExhausted] = useState(false);

  // Apply Theme - STRICT MODE for Tailwind
  useEffect(() => {
    const root = window.document.documentElement;
    root.classList.remove('dark'); // Clean slate first
    if (settings.theme === 'dark') {
      root.classList.add('dark');
    }
    localStorage.setItem('psql-buddy-settings', JSON.stringify(settings));
  }, [settings, settings.theme]); 

  const handleAiPreferenceSelect = (enableAi: boolean) => {
    const newSettings = { ...settings, enableAiGeneration: enableAi };
    setSettings(newSettings);
    localStorage.setItem('psql-buddy-settings', JSON.stringify(newSettings));
    setShowOnboarding(false);
  };

  // Navigation State
  const [currentStep, setCurrentStep] = useState<AppStep>('connection');
  
  // App Data State
  const [schema, setSchema] = useState<DatabaseSchema | null>(null);
  const [credentials, setCredentials] = useState<DbCredentials | null>(null);
  const [simulationData, setSimulationData] = useState<SimulationData | null>(null);

  const [builderState, setBuilderState] = useState<BuilderState>({
    selectedTables: [],
    selectedColumns: [],
    aggregations: {},
    joins: [],
    filters: [],
    groupBy: [],
    orderBy: [],
    limit: settings.defaultLimit
  });
  
  const [queryResult, setQueryResult] = useState<QueryResult | null>(null);
  const [dbResults, setDbResults] = useState<any[]>([]);
  
  const [isProcessing, setIsProcessing] = useState(false); // For SQL Gen & Execution
  const [isValidating, setIsValidating] = useState(false); // For Background Validation
  const [error, setError] = useState<string | null>(null);

  // --- Handlers ---

  const handleSchemaLoaded = (newSchema: DatabaseSchema, creds: DbCredentials) => {
    setError(null);
    setSchema(newSchema);
    setCredentials(creds);
    
    // If we are connecting to a simulated DB, initialize its data immediately
    if (creds.host === 'simulated') {
       const simData = initializeSimulation(newSchema);
       setSimulationData(simData);
    } else {
       setSimulationData(null);
    }

    // Reset downstream state
    setBuilderState({ 
      selectedTables: [], 
      selectedColumns: [], 
      aggregations: {},
      joins: [],
      filters: [],
      groupBy: [],
      orderBy: [],
      limit: settings.defaultLimit
    });
    setQueryResult(null);
    setDbResults([]);
    setCurrentStep('builder');
  };

  const handleBuilderChange = (newState: BuilderState) => {
    setBuilderState(newState);
  };

  const handleGeneratePreview = async () => {
    if (!schema) return;
    setError(null);
    setIsProcessing(true);
    
    try {
      let result: QueryResult;

      // BRANCH: Check if AI is enabled or Quota exhausted
      if (settings.enableAiGeneration && !quotaExhausted) {
         // Use Gemini AI
         result = await generateSqlFromBuilderState(schema, builderState, settings.enableAiTips);
         
         if (result.sql === 'NO_RELATIONSHIP') {
            setError("A IA não encontrou relacionamento entre estas tabelas. Vá para a aba 'Joins' e defina a conexão manualmente.");
            setIsProcessing(false);
            return;
         }
      } else {
         // Use Local Logic (Offline Mode)
         result = generateLocalSql(schema, builderState);
      }
      
      // 2. Update UI Immediately
      setQueryResult(result);
      setCurrentStep('preview');
      setIsProcessing(false);

      // 3. Run Validation in Background (ONLY if enabled, allowed, and not already exhausted)
      if (settings.enableAiGeneration && settings.enableAiValidation && !quotaExhausted) {
        setIsValidating(true);
        validateSqlQuery(result.sql, schema)
          .then(validation => {
            setQueryResult(prev => prev ? { ...prev, validation } : null);
          })
          .catch(err => {
             console.error("Validação em segundo plano falhou:", err);
             if (err.message === "QUOTA_ERROR") {
                setQuotaExhausted(true);
                // We don't error out the user flow, just stop validating
             }
          })
          .finally(() => {
            setIsValidating(false);
          });
      }

    } catch (e: any) {
      console.error(e);
      if (e.message === "QUOTA_ERROR") {
        setQuotaExhausted(true);
        // Fallback to local gen if AI fails mid-flight due to quota? 
        // Ideally yes, but for now let's notify user.
        setError("Você atingiu o limite gratuito da IA. Desative a 'Geração com IA' nas configurações para continuar offline.");
      } else {
        setError(e.message || "Falha ao gerar SQL a partir da seleção.");
      }
      setIsProcessing(false);
    }
  };

  const handleExecuteQuery = async () => {
    if (!schema || !queryResult || !credentials) return;
    setError(null);
    setIsProcessing(true);
    try {
      let data: any[] = [];
      
      // Check if we are in simulation mode
      if (credentials.host === 'simulated') {
         // Priority 1: Use local offline simulation data if available (faster, reliable, offline)
         // We use this if AI is disabled OR if we want consistent data for this session
         // Since the user asked for "initial values that are kept", we should prioritize the local sim data
         // UNLESS the user explicitly wants AI generation for some reason. 
         // But for consistency, let's stick to the local sim data we generated on load.
         if (simulationData) {
            data = executeOfflineQuery(schema, simulationData, builderState);
         } else if (settings.enableAiGeneration && !quotaExhausted) {
            // Fallback to AI generation if for some reason local data is missing (shouldn't happen in sim mode)
            data = await generateMockData(schema, queryResult.sql);
         } else {
            data = [{ info: "Erro: Dados de simulação não inicializados." }];
         }
      } else {
         // Execute on real DB via backend
         data = await executeQueryReal(credentials, queryResult.sql);
      }

      setDbResults(data);
      setCurrentStep('results');
    } catch (e: any) {
      console.error(e);
      if (e.message === "QUOTA_ERROR") {
         setQuotaExhausted(true);
         setError("Cota excedida durante geração de dados simulados.");
      } else {
         setError("Falha na execução: " + e.message);
      }
    } finally {
      setIsProcessing(false);
    }
  };

  const handleReset = () => {
    setError(null);
    setCurrentStep('connection');
    setSchema(null);
    setCredentials(null);
    setSimulationData(null);
    setQueryResult(null);
    setDbResults([]);
  };

  const handleNavigate = (step: AppStep) => {
    setError(null);
    setCurrentStep(step);
  };

  return (
    <div className="flex h-screen bg-slate-900 text-slate-100 overflow-hidden font-sans">
      
      {showOnboarding && <AiPreferenceModal onSelect={handleAiPreferenceSelect} />}

      {/* Left Navigation Sidebar */}
      <Sidebar 
        currentStep={currentStep} 
        onNavigate={handleNavigate} 
        hasSchema={!!schema}
        onOpenSettings={() => setShowSettings(true)}
      />

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col min-w-0 bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-slate-100 overflow-hidden rounded-tl-3xl shadow-2xl my-2 mr-2 relative">
        
        {/* Progress Bar (Visual Top) */}
        <div className="h-1.5 bg-slate-200 dark:bg-slate-800 w-full shrink-0">
          <div 
            className="h-full bg-indigo-600 transition-all duration-500 ease-out"
            style={{ 
              width: currentStep === 'connection' ? '25%' : 
                     currentStep === 'builder' ? '50%' : 
                     currentStep === 'preview' ? '75%' : '100%' 
            }}
          />
        </div>

        {/* Global Error Banner */}
        {error && (
          <div className="bg-red-50 dark:bg-red-900/30 border-b border-red-200 dark:border-red-800 p-4 flex items-center justify-between animate-in slide-in-from-top-2">
            <div className="flex items-center gap-3">
              <AlertTriangle className="w-5 h-5 text-red-600 dark:text-red-400" />
              <span className="text-sm font-medium text-red-800 dark:text-red-200">{error}</span>
            </div>
            <button 
              onClick={() => setError(null)}
              className="text-red-400 hover:text-red-600 p-1 rounded-full hover:bg-red-100 dark:hover:bg-red-900/50"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        <div className="flex-1 overflow-y-auto p-6 sm:p-8">
          {currentStep === 'connection' && (
            <ConnectionStep 
              onSchemaLoaded={handleSchemaLoaded}
              settings={settings}
            />
          )}

          {currentStep === 'builder' && schema && (
            <BuilderStep 
              schema={schema}
              state={builderState}
              onStateChange={handleBuilderChange}
              onGenerate={handleGeneratePreview}
              isGenerating={isProcessing}
              settings={settings}
            />
          )}

          {currentStep === 'preview' && queryResult && (
            <PreviewStep 
              queryResult={queryResult}
              onExecute={handleExecuteQuery}
              onBack={() => handleNavigate('builder')}
              isExecuting={isProcessing}
              isValidating={isValidating}
              validationDisabled={!settings.enableAiGeneration || !settings.enableAiValidation || quotaExhausted}
            />
          )}

          {currentStep === 'results' && (
            <ResultsStep 
              data={dbResults}
              sql={queryResult?.sql || ''}
              onBackToBuilder={() => handleNavigate('builder')}
              onNewConnection={handleReset}
            />
          )}
        </div>
      </main>

      {/* Settings Modal */}
      {showSettings && (
        <SettingsModal 
          settings={settings}
          onClose={() => setShowSettings(false)}
          onSave={(newSettings) => setSettings(newSettings)}
          quotaExhausted={quotaExhausted}
        />
      )}
    </div>
  );
}

export default App;
