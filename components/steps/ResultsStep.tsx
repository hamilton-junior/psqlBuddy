import React, { useState, useEffect } from 'react';
import { Table, ArrowLeft, Database, Download, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, FileSpreadsheet, Search, Copy, Check, BarChart2, MessageSquare } from 'lucide-react';
import { AppSettings } from '../../types';
import DataVisualizer from '../DataVisualizer';
import DataAnalysisChat from '../DataAnalysisChat';
import { addToHistory } from '../../services/historyService';

interface ResultsStepProps {
  data: any[];
  sql: string;
  onBackToBuilder: () => void;
  onNewConnection: () => void;
  settings?: AppSettings;
}

type ResultTab = 'table' | 'chart' | 'analysis';

const ResultsStep: React.FC<ResultsStepProps> = ({ data, sql, onBackToBuilder, onNewConnection, settings }) => {
  const [activeTab, setActiveTab] = useState<ResultTab>('table');
  const columns = data.length > 0 ? Object.keys(data[0]) : [];
  
  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(settings?.defaultRowsPerPage || 10);
  const [localSearch, setLocalSearch] = useState('');
  
  const [sqlCopied, setSqlCopied] = useState(false);

  // Auto-save history on mount
  useEffect(() => {
     if (data) {
        addToHistory({
           sql,
           rowCount: data.length,
           durationMs: 0, // Mock duration
           status: 'success',
           schemaName: 'Database' 
        });
     }
  }, []);

  useEffect(() => {
    setCurrentPage(1);
  }, [data]);

  useEffect(() => {
    if (settings?.defaultRowsPerPage) {
       setRowsPerPage(settings.defaultRowsPerPage);
    }
  }, [settings?.defaultRowsPerPage]);

  const filteredData = data.filter(row => {
     if (!localSearch) return true;
     return Object.values(row).some(val => 
       String(val).toLowerCase().includes(localSearch.toLowerCase())
     );
  });

  const totalRows = filteredData.length;
  const totalPages = Math.ceil(totalRows / rowsPerPage);
  const startIndex = (currentPage - 1) * rowsPerPage;
  const endIndex = Math.min(startIndex + rowsPerPage, totalRows);
  const currentData = filteredData.slice(startIndex, endIndex);

  const handlePageChange = (newPage: number) => {
    if (newPage >= 1 && newPage <= totalPages) {
      setCurrentPage(newPage);
    }
  };

  const downloadCsv = () => {
    if (data.length === 0) return;
    const headers = columns.join(',');
    const rows = data.map(row => 
      columns.map(col => {
        const val = row[col];
        if (typeof val === 'string' && val.includes(',')) return `"${val.replace(/"/g, '""')}"`;
        return val;
      }).join(',')
    );
    const csvContent = [headers, ...rows].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', 'query_results.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleCopySql = () => {
    navigator.clipboard.writeText(sql);
    setSqlCopied(true);
    setTimeout(() => setSqlCopied(false), 2000);
  };

  const highlightMatch = (text: string) => {
    if (!localSearch.trim()) return text;
    const escapedSearch = localSearch.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const parts = text.split(new RegExp(`(${escapedSearch})`, 'gi'));
    return (
      <>
        {parts.map((part, i) => 
          part.toLowerCase() === localSearch.toLowerCase() ? (
            <span key={i} className="bg-yellow-200 dark:bg-yellow-600/50 text-slate-900 dark:text-white font-semibold rounded px-0.5 box-decoration-clone">{part}</span>
          ) : part
        )}
      </>
    );
  };

  return (
    <div className="h-full flex flex-col space-y-4">
      
      {/* Header Section */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 shrink-0">
        <div>
          <h2 className="text-xl font-bold text-slate-800 dark:text-white flex items-center gap-3">
             Resultados da Query
             <span className="text-xs font-normal text-slate-500 bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded-full">{data.length} linhas</span>
          </h2>
        </div>
        
        {/* Tabs */}
        <div className="flex bg-white dark:bg-slate-800 p-1 rounded-lg border border-slate-200 dark:border-slate-700 shadow-sm">
           <button onClick={() => setActiveTab('table')} className={`flex items-center gap-2 px-4 py-1.5 rounded-md text-sm font-medium transition-all ${activeTab === 'table' ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/50 dark:text-indigo-300' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}>
              <Table className="w-4 h-4" /> Tabela
           </button>
           <button onClick={() => setActiveTab('chart')} className={`flex items-center gap-2 px-4 py-1.5 rounded-md text-sm font-medium transition-all ${activeTab === 'chart' ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/50 dark:text-indigo-300' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}>
              <BarChart2 className="w-4 h-4" /> Gráficos
           </button>
           <button onClick={() => setActiveTab('analysis')} className={`flex items-center gap-2 px-4 py-1.5 rounded-md text-sm font-medium transition-all ${activeTab === 'analysis' ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/50 dark:text-indigo-300' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}>
              <MessageSquare className="w-4 h-4" /> AI Analyst
           </button>
        </div>

        <div className="flex items-center gap-2">
           {activeTab === 'table' && (
             <div className="relative group">
                <Search className="absolute left-3 top-2.5 w-3.5 h-3.5 text-slate-400 group-focus-within:text-indigo-500 transition-colors" />
                <input 
                  type="text" 
                  placeholder="Filtrar..." 
                  value={localSearch}
                  onChange={(e) => { setLocalSearch(e.target.value); setCurrentPage(1); }}
                  className="pl-8 pr-4 py-1.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none w-48"
                />
             </div>
           )}
           <button onClick={downloadCsv} disabled={data.length === 0} className="p-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors" title="Exportar CSV">
             <FileSpreadsheet className="w-4 h-4" />
           </button>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden flex flex-col relative">
        
        {data.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center text-slate-400 p-8">
             <Database className="w-12 h-12 opacity-30 mb-4" />
             <p>Nenhum resultado retornado</p>
          </div>
        ) : (
          <>
            {/* --- TAB: TABLE --- */}
            {activeTab === 'table' && (
               <>
                  <div className="flex-1 overflow-auto scrollbar-thin scrollbar-thumb-slate-200 dark:scrollbar-thumb-slate-700">
                     <table className="w-full text-left border-collapse">
                     <thead className="bg-slate-50/90 dark:bg-slate-900/90 backdrop-blur-sm sticky top-0 z-10">
                        <tr>
                           {columns.map((col, idx) => (
                           <th key={col} className={`px-6 py-3 text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider whitespace-nowrap border-b border-slate-200 dark:border-slate-700 ${idx === 0 ? 'pl-8' : ''}`}>
                              {col.replace(/_/g, ' ')}
                           </th>
                           ))}
                        </tr>
                     </thead>
                     <tbody className="divide-y divide-slate-100 dark:divide-slate-700/50">
                        {currentData.map((row, idx) => (
                           <tr key={idx} className="group hover:bg-indigo-50/50 dark:hover:bg-indigo-900/20 transition-colors">
                           {columns.map((col, cIdx) => (
                              <td key={col} className={`px-6 py-3 text-sm text-slate-600 dark:text-slate-300 whitespace-nowrap group-hover:text-slate-900 dark:group-hover:text-white transition-colors ${cIdx === 0 ? 'pl-8 font-medium' : ''}`}>
                                 {row[col] === null ? <span className="text-slate-300 text-xs bg-slate-100 dark:bg-slate-800 px-1 rounded">null</span> : highlightMatch(String(row[col]))}
                              </td>
                           ))}
                           </tr>
                        ))}
                     </tbody>
                     </table>
                  </div>
                  
                  {/* Pagination Footer */}
                  <div className="border-t border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-2 flex items-center justify-between text-xs text-slate-500">
                     <div className="flex items-center gap-4 pl-4">
                        <span>{startIndex + 1}-{endIndex} de {totalRows}</span>
                        <select value={rowsPerPage} onChange={(e) => { setRowsPerPage(Number(e.target.value)); setCurrentPage(1); }} className="bg-transparent border border-slate-200 dark:border-slate-700 rounded py-0.5 px-1 font-bold">
                           <option value={10}>10/pág</option>
                           <option value={50}>50/pág</option>
                           <option value={100}>100/pág</option>
                        </select>
                     </div>
                     <div className="flex gap-1 pr-2">
                        <button onClick={() => handlePageChange(currentPage - 1)} disabled={currentPage === 1} className="p-1 hover:bg-slate-100 dark:hover:bg-slate-700 rounded disabled:opacity-30"><ChevronLeft className="w-4 h-4" /></button>
                        <span className="px-2 py-1 font-mono">{currentPage}/{totalPages}</span>
                        <button onClick={() => handlePageChange(currentPage + 1)} disabled={currentPage === totalPages} className="p-1 hover:bg-slate-100 dark:hover:bg-slate-700 rounded disabled:opacity-30"><ChevronRight className="w-4 h-4" /></button>
                     </div>
                  </div>
               </>
            )}

            {/* --- TAB: CHART --- */}
            {activeTab === 'chart' && (
               <div className="p-6 h-full w-full">
                  <DataVisualizer data={data} />
               </div>
            )}

            {/* --- TAB: ANALYSIS --- */}
            {activeTab === 'analysis' && (
               <div className="flex-1 h-full">
                  <DataAnalysisChat data={data} sql={sql} />
               </div>
            )}
          </>
        )}
      </div>

      {/* Footer / SQL Snippet */}
      <div className="bg-slate-100 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 rounded-xl flex items-center gap-3 p-3 shadow-inner relative group shrink-0">
         <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 bg-slate-200 dark:bg-slate-800 px-2 py-1 rounded">SQL</span>
         <div className="flex-1 font-mono text-xs text-slate-600 dark:text-slate-300 truncate">{sql}</div>
         <button onClick={handleCopySql} className="text-slate-400 hover:text-indigo-600 p-1 transition-colors" title="Copiar SQL">
             {sqlCopied ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
         </button>
      </div>

      <div className="flex items-center justify-between shrink-0">
         <button onClick={onNewConnection} className="text-slate-400 hover:text-slate-600 text-sm flex items-center gap-2 px-2 py-1">
           <Database className="w-4 h-4" /> Nova Conexão
         </button>
         <button onClick={onBackToBuilder} className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-bold shadow-lg shadow-indigo-200 dark:shadow-none transition-all flex items-center gap-2">
           <ArrowLeft className="w-4 h-4" /> Voltar
         </button>
      </div>
    </div>
  );
};

export default ResultsStep;