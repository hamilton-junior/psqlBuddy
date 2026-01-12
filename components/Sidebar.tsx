import React, { useState, useEffect } from 'react';
import { AppStep, DatabaseSchema } from '../types';
import { Database, Layers, Terminal, Table, Server, ArrowRight, Settings, ChevronLeft, ChevronRight, Map, History, GitCompare, Link, FileSearch, FileText, Scissors, BookOpen, Rocket, Tag, CloudDownload } from 'lucide-react';

interface SidebarProps {
  currentStep: AppStep;
  onNavigate: (step: AppStep) => void;
  schema: DatabaseSchema | null;
  hasResults?: boolean;
  onOpenSettings: () => void;
  onOpenDiagram?: () => void; 
  onOpenHistory?: () => void; 
  onRegenerateClick?: () => void;
  onDescriptionChange?: (tableName: string, newDesc: string) => void;
  onOpenShortcuts?: () => void;
  onOpenCheatSheet?: () => void;
  onOpenVirtualRelations?: () => void;
  onOpenLogAnalyzer?: () => void;
  onOpenTemplates?: () => void;
  onOpenSqlExtractor?: () => void;
  onCheckUpdate?: () => void;
}

declare const __APP_VERSION__: string;
const APP_VERSION = typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : '0.1.10';

const Sidebar: React.FC<SidebarProps> = ({ 
  currentStep, onNavigate, schema, hasResults = false, onOpenSettings, onOpenDiagram, onOpenHistory, onRegenerateClick, onDescriptionChange, onOpenShortcuts, onOpenCheatSheet, onOpenVirtualRelations, onOpenLogAnalyzer, onOpenTemplates, onOpenSqlExtractor, onCheckUpdate
}) => {
  const [isCollapsed, setIsCollapsed] = useState(false);

  const toggleSidebar = () => setIsCollapsed(!isCollapsed);

  const navItem = (step: AppStep, label: string, icon: React.ReactNode, disabled: boolean = false, tooltip: string) => {
    const isActive = currentStep === step;
    return (
      <button
        onClick={() => !disabled && onNavigate(step)}
        disabled={disabled}
        title={isCollapsed ? tooltip : undefined}
        className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 text-sm font-bold relative group
          ${isActive 
            ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-900/20' 
            : disabled 
              ? 'text-slate-300 dark:text-slate-700 cursor-not-allowed opacity-50' 
              : 'text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-indigo-600 dark:hover:text-slate-200'
          }
          ${isCollapsed ? 'justify-center px-2' : ''}
        `}
      >
        <div className="shrink-0">{icon}</div>
        {!isCollapsed && <span className="truncate animate-in fade-in">{label}</span>}
        {!isCollapsed && isActive && <ArrowRight className="w-4 h-4 ml-auto opacity-60" />}
      </button>
    );
  };

  return (
    <div className={`${isCollapsed ? 'w-20' : 'w-72'} shrink-0 flex flex-col border-r border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-slate-600 dark:text-slate-200 h-full transition-all duration-300 relative`}>
      
      <button onClick={toggleSidebar} className="absolute -right-3 top-8 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-400 hover:text-indigo-600 rounded-full p-1 shadow-md z-50 transition-all">
         {isCollapsed ? <ChevronRight className="w-3 h-3" /> : <ChevronLeft className="w-3 h-3" />}
      </button>

      <div className={`p-6 shrink-0 ${isCollapsed ? 'px-2 flex flex-col items-center' : ''}`}>
        <div className={`flex items-center gap-3 mb-8 px-2 overflow-hidden ${isCollapsed ? 'justify-center px-0' : ''}`}>
          <div className="p-2.5 bg-indigo-600 rounded-2xl shadow-lg shadow-indigo-500/30 shrink-0">
            <Database className="w-6 h-6 text-white" />
          </div>
          {!isCollapsed && (
             <div className="min-w-0">
               <h1 className="font-black text-lg tracking-tight text-slate-800 dark:text-white truncate">PSQL Buddy</h1>
               <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest truncate">AI Query Engine</p>
             </div>
          )}
        </div>

        <div className="space-y-1">
          {navItem('connection', 'Conexão', <Server className="w-4.5 h-4.5" />, false, "Configurar conexão")}
          {navItem('builder', 'Construtor', <Layers className="w-4.5 h-4.5" />, !schema, "Construir queries")}
          {navItem('preview', 'Visualização', <Terminal className="w-4.5 h-4.5" />, !schema, "Visualizar SQL")}
          {navItem('results', 'Resultados', <Table className="w-4.5 h-4.5" />, !hasResults, "Ver resultados")}
          <div className="my-4 border-t border-slate-100 dark:border-slate-800/50"></div>
          {navItem('datadiff', 'Comparador', <GitCompare className="w-4.5 h-4.5" />, !schema, "Comparar dados")}
        </div>
        
        {schema && !isCollapsed && (
           <div className="mt-8 mb-2 px-4 text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-[0.2em]">Ferramentas</div>
        )}
        
        <div className="space-y-1 mt-2">
           {schema && (
             <>
               <button onClick={onOpenTemplates} className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-bold text-slate-500 dark:text-slate-400 hover:bg-cyan-50 dark:hover:bg-cyan-900/20 hover:text-cyan-600 transition-colors ${isCollapsed ? 'justify-center px-2' : ''}`}>
                  <FileText className="w-4 h-4" />
                  {!isCollapsed && <span>Templates SQL</span>}
               </button>
               <button onClick={onOpenSqlExtractor} className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-bold text-slate-500 dark:text-slate-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 hover:text-indigo-600 transition-colors ${isCollapsed ? 'justify-center px-2' : ''}`}>
                  <Scissors className="w-4 h-4" />
                  {!isCollapsed && <span>Extrator de SQL</span>}
               </button>
             </>
           )}
        </div>
      </div>

      <div className="flex-1"></div>

      <div className={`px-4 pb-6 shrink-0 space-y-1 ${isCollapsed ? 'px-2' : ''}`}>
        <button onClick={onCheckUpdate} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 text-sm font-bold text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/30 ${isCollapsed ? 'justify-center px-2' : ''}`}>
           <CloudDownload className="w-4 h-4 animate-pulse" />
           {!isCollapsed && <span>Atualizar App</span>}
        </button>

        <button onClick={onOpenSettings} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 text-sm font-bold text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 ${isCollapsed ? 'justify-center px-2' : ''}`}>
           <Settings className="w-4 h-4" />
           {!isCollapsed && <span>Configurações</span>}
         </button>

         {!isCollapsed && (
            <div className="px-4 py-2 flex items-center gap-2 text-[10px] font-black text-slate-400/60 uppercase tracking-widest mt-2 border-t border-slate-100 dark:border-slate-800/50">
               <Tag className="w-2.5 h-2.5" /> v{APP_VERSION}
            </div>
         )}
      </div>
    </div>
  );
};

export default Sidebar;