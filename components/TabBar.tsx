
import React from 'react';
import { Plus, X, MessageSquare, Database, Terminal, Table } from 'lucide-react';
import { QueryTab } from '../types';

interface TabBarProps {
  tabs: QueryTab[];
  activeTabId: string;
  onSwitch: (id: string) => void;
  onClose: (id: string) => void;
  onAdd: () => void;
}

const TabBar: React.FC<TabBarProps> = ({ tabs, activeTabId, onSwitch, onClose, onAdd }) => {
  const getIcon = (step: string) => {
    switch (step) {
      case 'builder': return <MessageSquare className="w-3 h-3" />;
      case 'preview': return <Terminal className="w-3 h-3" />;
      case 'results': return <Table className="w-3 h-3" />;
      default: return <Database className="w-3 h-3" />;
    }
  };

  return (
    <div className="flex items-center bg-slate-100 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-4 gap-1 overflow-x-auto no-scrollbar shrink-0 h-11 transition-colors duration-300">
      {tabs.map((tab) => {
        const isActive = tab.id === activeTabId;
        const contextColor = tab.contextColor || '';
        
        return (
          <div
            key={tab.id}
            onClick={() => onSwitch(tab.id)}
            className={`group relative flex items-center h-8 px-4 rounded-t-lg text-xs font-bold cursor-pointer transition-all min-w-[120px] max-w-[200px] border-x border-t
              ${isActive 
                ? 'bg-white dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 border-slate-200 dark:border-slate-700 z-10 shadow-sm' 
                : 'bg-transparent text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-800/50 border-transparent'}
            `}
          >
            {/* Indicador de Contexto (Cor do Ambiente) */}
            {contextColor && (
              <div 
                className="absolute top-0 left-0 right-0 h-0.5 rounded-t-lg" 
                style={{ backgroundColor: contextColor }}
                title="Cor do Ambiente de Conexão"
              />
            )}
            
            <div className={`mr-2 shrink-0 ${isActive ? 'text-indigo-500' : 'text-slate-400'}`}>
              {getIcon(tab.currentStep)}
            </div>
            <span className="truncate flex-1 pr-4">{tab.name}</span>
            {tabs.length > 1 && (
              <button
                onClick={(e) => { e.stopPropagation(); onClose(tab.id); }}
                className={`absolute right-1.5 p-1 rounded-md hover:bg-slate-200 dark:hover:bg-slate-700 transition-opacity ${isActive ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}
              >
                <X className="w-3 h-3" />
              </button>
            )}
            {isActive && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-indigo-500"></div>
            )}
          </div>
        );
      })}
      <button
        onClick={onAdd}
        className="p-1.5 ml-2 rounded-lg text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800 hover:text-indigo-500 transition-all shrink-0"
        title="Nova Aba (Ctrl+T)"
      >
        <Plus className="w-4 h-4" />
      </button>
    </div>
  );
};

export default TabBar;
