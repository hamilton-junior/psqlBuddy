import React, { useState, useEffect, useRef } from 'react';
import { ArrowLeft, Database, ChevronLeft, ChevronRight, FileSpreadsheet, Search, Copy, Check, BarChart2, MessageSquare, Download, Activity, LayoutGrid, FileText, Pin, AlertCircle } from 'lucide-react';
import { AppSettings, DashboardItem, ExplainNode } from '../../types';
import DataVisualizer from '../DataVisualizer';
import DataAnalysisChat from '../DataAnalysisChat';
import { addToHistory } from '../../services/historyService';
import { explainQueryReal } from '../../services/dbService';
import { jsPDF } from "jspdf";
import html2canvas from 'html2canvas';

// --- VIRTUAL TABLE COMPONENT ---
// Simplified High Performance Table using fixed layout and minimal DOM
interface VirtualTableProps {
   data: any[];
   columns: string[];
   localSearch: string;
   highlightMatch: (text: string) => React.ReactNode;
}

const VirtualTable: React.FC<VirtualTableProps> = ({ data, columns, localSearch, highlightMatch }) => {
   // Use standard pagination for stability but optimized
   const [currentPage, setCurrentPage] = useState(1);
   const [rowsPerPage, setRowsPerPage] = useState(25);
   
   const totalRows = data.length;
   const totalPages = Math.ceil(totalRows / rowsPerPage);
   const startIndex = (currentPage - 1) * rowsPerPage;
   const currentData = data.slice(startIndex, startIndex + rowsPerPage);

   // Reset page on search/data change
   useEffect(() => { setCurrentPage(1); }, [data.length]);

   return (
      <div className="flex flex-col h-full">
         <div className="flex-1 overflow-auto scrollbar-thin scrollbar-thumb-slate-200 dark:scrollbar-thumb-slate-700 relative">
            <table className="w-full text-left border-collapse table-fixed">
               <thead className="bg-slate-50/90 dark:bg-slate-900/90 backdrop-blur-sm sticky top-0 z-10 shadow-sm">
                  <tr>
                     {columns.map((col, idx) => (
                        <th key={col} className={`px-4 py-3 text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider whitespace-nowrap border-b border-slate-200 dark:border-slate-700 w-[150px] overflow-hidden text-ellipsis ${idx === 0 ? 'pl-6' : ''}`} title={col}>
                           {col.replace(/_/g, ' ')}
                        </th>
                     ))}
                  </tr>
               </thead>
               <tbody className="divide-y divide-slate-100 dark:divide-slate-700/50">
                  {currentData.map((row, idx) => (
                     <tr key={idx} className="group hover:bg-indigo-50/50 dark:hover:bg-indigo-900/20 transition-colors h-[40px]">
                        {columns.map((col, cIdx) => (
                           <td key={col} className={`px-4 py-2 text-sm text-slate-600 dark:text-slate-300 whitespace-nowrap overflow-hidden text-ellipsis group-hover:text-slate-900 dark:group-hover:text-white transition-colors ${cIdx === 0 ? 'pl-6 font-medium' : ''}`}>
                              {row[col] === null ? <span className="text-slate-300 text-xs bg-slate-100 dark:bg-slate-800 px-1 rounded">null</span> : highlightMatch(String(row[col]))}
                           </td>
                        ))}
                     </tr>
                  ))}
               </tbody>
            </table>
         </div>
         <div className="border-t border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-2 flex items-center justify-between text-xs text-slate-500 shrink-0">
            <div className="flex items-center gap-4 pl-4">
               <span>{startIndex + 1}-{Math.min(startIndex + rowsPerPage, totalRows)} de {totalRows}</span>
               <select value={rowsPerPage} onChange={(e) => { setRowsPerPage(Number(e.target.value)); setCurrentPage(1); }} className="bg-transparent border border-slate-200 dark:border-slate-700 rounded py-0.5 px-1 font-bold">
                  <option value={10}>10</option>
                  <option value={25}>25</option>
                  <option value={100}>100</option>
                  <option value={500}>500</option>
               </select>
            </div>
            <div className="flex gap-1 pr-2">
               <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1} className="p-1 hover:bg-slate-100 dark:hover:bg-slate-700 rounded disabled:opacity-30"><ChevronLeft className="w-4 h-4" /></button>
               <span className="px-2 py-1 font-mono">{currentPage}/{totalPages}</span>
               <button onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages} className="p-1 hover:bg-slate-100 dark:hover:bg-slate-700 rounded disabled:opacity-30"><ChevronRight className="w-4 h-4" /></button>
            </div>
         </div>
      </div>
   );
};

// --- EXPLAIN VISUALIZER ---
const ExplainVisualizer: React.FC<{ plan: ExplainNode | null, loading: boolean, error: string | null }> = ({ plan, loading, error }) => {
   if (loading) return <div className="p-10 text-center"><div className="animate-spin w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full mx-auto mb-2"></div><p className="text-slate-500">Analisando performance...</p></div>;
   
   if (error) return (
      <div className="p-10 text-center flex flex-col items-center justify-center text-slate-400">
         <div className="w-16 h-16 bg-red-50 dark:bg-red-900/20 rounded-full flex items-center justify-center mb-4">
            <AlertCircle className="w-8 h-8 text-red-500" />
         </div>
         <h3 className="text-slate-700 dark:text-slate-200 font-bold mb-1">Falha na Análise</h3>
         <p className="text-sm max-w-md">{error}</p>
      </div>
   );

   if (!plan) return <div className="p-10 text-center text-slate-400">Nenhum plano disponível.</div>;

   const renderNode = (node: ExplainNode, depth: number = 0) => (
      <div key={Math.random()} style={{ marginLeft: depth * 20 }} className="mb-2">
         <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded p-2 shadow-sm inline-block min-w-[300px]">
            <div className="flex justify-between font-bold text-xs text-slate-700 dark:text-slate-200">
               <span>{node.type}</span>
               <span className="text-slate-400">{node.cost.total.toFixed(2)} cost</span>
            </div>
            {node.relation && <div className="text-[10px] text-indigo-600 dark:text-indigo-400 mt-0.5 font-mono">{node.relation}</div>}
            <div className="text-[10px] text-slate-500 mt-1 flex gap-3">
               <span>Rows: {node.rows}</span>
               <span>Width: {node.width}</span>
            </div>
         </div>
         {node.children && node.children.map(child => renderNode(child, depth + 1))}
      </div>
   );

   return <div className="p-6 overflow-auto bg-slate-50 dark:bg-slate-900 h-full">{renderNode(plan)}</div>;
};

// --- MAIN COMPONENT ---
interface ResultsStepProps {
  data: any[];
  sql: string;
  onBackToBuilder: () => void;
  onNewConnection: () => void;
  settings?: AppSettings;
  onAddToDashboard?: (item: Omit<DashboardItem, 'id' | 'createdAt'>) => void; // New Prop
  credentials?: any; // To run explain
}

type ResultTab = 'table' | 'chart' | 'analysis' | 'explain';

const ResultsStep: React.FC<ResultsStepProps> = ({ data, sql, onBackToBuilder, onNewConnection, settings, onAddToDashboard, credentials }) => {
  const [activeTab, setActiveTab] = useState<ResultTab>('table');
  const columns = data.length > 0 ? Object.keys(data[0]) : [];
  
  const [localSearch, setLocalSearch] = useState('');
  const [sqlCopied, setSqlCopied] = useState(false);
  const [explainPlan, setExplainPlan] = useState<ExplainNode | null>(null);
  const [loadingExplain, setLoadingExplain] = useState(false);
  const [explainError, setExplainError] = useState<string | null>(null);

  // Auto-save history on mount
  useEffect(() => {
     if (data) {
        addToHistory({
           sql, rowCount: data.length, durationMs: 0, status: 'success', schemaName: 'Database' 
        });
     }
  }, []);

  const filteredData = React.useMemo(() => data.filter(row => {
     if (!localSearch) return true;
     return Object.values(row).some(val => 
       String(val).toLowerCase().includes(localSearch.toLowerCase())
     );
  }), [data, localSearch]);

  const highlightMatch = (text: string) => {
    if (!localSearch.trim()) return text;
    const escapedSearch = localSearch.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const parts = text.split(new RegExp(`(${escapedSearch})`, 'gi'));
    return <>{parts.map((part, i) => part.toLowerCase() === localSearch.toLowerCase() ? <span key={i} className="bg-yellow-200 dark:bg-yellow-600/50 text-slate-900 dark:text-white font-semibold rounded px-0.5">{part}</span> : part)}</>;
  };

  // --- Handlers ---
  const handleExportCSV = () => {
    if (data.length === 0) return;
    const headers = columns.join(',');
    const rows = data.map(row => columns.map(col => {
        const val = row[col];
        if (typeof val === 'string' && val.includes(',')) return `"${val.replace(/"/g, '""')}"`;
        return val;
      }).join(','));
    const csvContent = [headers, ...rows].join('\n');
    const link = document.createElement('a');
    link.href = URL.createObjectURL(new Blob([csvContent], { type: 'text/csv;charset=utf-8;' }));
    link.setAttribute('download', 'results.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleExportJSON = () => {
     const jsonContent = JSON.stringify(data, null, 2);
     const link = document.createElement('a');
     link.href = URL.createObjectURL(new Blob([jsonContent], { type: 'application/json' }));
     link.setAttribute('download', 'results.json');
     document.body.appendChild(link);
     link.click();
     document.body.removeChild(link);
  };

  const handleExportPDF = () => {
     // Simple print-to-pdf style using html2canvas + jspdf
     const element = document.getElementById('results-content');
     if (!element) return;
     
     html2canvas(element).then(canvas => {
        const imgData = canvas.toDataURL('image/png');
        const pdf = new jsPDF();
        const imgProps = pdf.getImageProperties(imgData);
        const pdfWidth = pdf.internal.pageSize.getWidth();
        const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;
        pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
        pdf.save("report.pdf");
     });
  };

  const handleExplain = async () => {
     setActiveTab('explain');
     setExplainError(null);
     if (!explainPlan && credentials) {
        setLoadingExplain(true);
        try {
           const plan = await explainQueryReal(credentials, sql);
           setExplainPlan(plan);
        } catch (e: any) {
           console.error(e);
           setExplainError(e.message || "Erro desconhecido ao analisar performance.");
        } finally {
           setLoadingExplain(false);
        }
     }
  };

  const handlePinChart = (chartConfig: any) => {
     if (onAddToDashboard) {
        onAddToDashboard({
           title: `Gráfico ${new Date().toLocaleTimeString()}`,
           type: 'bar', // Visualizer needs to expose this, defaulting for now
           data: data, // In real app, store config + aggregation, not raw data if huge
           config: { xAxis: chartConfig.xAxis, yKeys: chartConfig.yKeys },
           sql: sql
        });
        alert("Gráfico adicionado ao Dashboard!");
     }
  };

  return (
    <div className="h-full flex flex-col space-y-4">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 shrink-0">
        <div>
          <h2 className="text-xl font-bold text-slate-800 dark:text-white flex items-center gap-3">
             Resultados da Query
             <span className="text-xs font-normal text-slate-500 bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded-full">{data.length} linhas</span>
          </h2>
        </div>
        
        {/* Tabs */}
        <div className="flex bg-white dark:bg-slate-800 p-1 rounded-lg border border-slate-200 dark:border-slate-700 shadow-sm">
           {[
              { id: 'table', icon: <FileSpreadsheet className="w-4 h-4" />, label: 'Tabela' },
              { id: 'chart', icon: <BarChart2 className="w-4 h-4" />, label: 'Gráficos' },
              { id: 'analysis', icon: <MessageSquare className="w-4 h-4" />, label: 'AI Analyst' },
              { id: 'explain', icon: <Activity className="w-4 h-4" />, label: 'Performance' },
           ].map(tab => (
              <button key={tab.id} onClick={() => { setActiveTab(tab.id as ResultTab); if(tab.id === 'explain') handleExplain(); }} className={`flex items-center gap-2 px-4 py-1.5 rounded-md text-sm font-medium transition-all ${activeTab === tab.id ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/50 dark:text-indigo-300' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}>
                 {tab.icon} {tab.label}
              </button>
           ))}
        </div>

        <div className="flex items-center gap-2">
           {activeTab === 'table' && (
             <div className="relative group">
                <Search className="absolute left-3 top-2.5 w-3.5 h-3.5 text-slate-400 group-focus-within:text-indigo-500 transition-colors" />
                <input type="text" placeholder="Filtrar..." value={localSearch} onChange={(e) => setLocalSearch(e.target.value)} className="pl-8 pr-4 py-1.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none w-48" />
             </div>
           )}
           {/* Advanced Export Dropdown */}
           <div className="flex bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700">
              <button onClick={handleExportCSV} disabled={data.length === 0} className="p-2 border-r border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300" title="CSV"><FileSpreadsheet className="w-4 h-4" /></button>
              <button onClick={handleExportJSON} disabled={data.length === 0} className="p-2 border-r border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300" title="JSON"><FileText className="w-4 h-4" /></button>
              <button onClick={handleExportPDF} disabled={data.length === 0} className="p-2 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300" title="PDF"><Download className="w-4 h-4" /></button>
           </div>
        </div>
      </div>

      {/* Main Content */}
      <div id="results-content" className="flex-1 bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden flex flex-col relative">
        {data.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center text-slate-400 p-8"><Database className="w-12 h-12 opacity-30 mb-4" /><p>Nenhum resultado retornado</p></div>
        ) : (
          <>
            {activeTab === 'table' && <VirtualTable data={filteredData} columns={columns} localSearch={localSearch} highlightMatch={highlightMatch} />}
            
            {activeTab === 'chart' && (
               <div className="p-6 h-full w-full relative">
                  <div className="absolute top-4 right-4 z-10">
                     <button className="flex items-center gap-2 text-xs bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-3 py-1.5 rounded-lg hover:text-indigo-500 shadow-sm" onClick={() => handlePinChart({xAxis: columns[0], yKeys: columns.slice(1,3)})}>
                        <Pin className="w-3.5 h-3.5" /> Pin to Dashboard
                     </button>
                  </div>
                  <DataVisualizer data={data} />
               </div>
            )}
            
            {activeTab === 'analysis' && <div className="flex-1 h-full"><DataAnalysisChat data={data} sql={sql} /></div>}
            
            {activeTab === 'explain' && <ExplainVisualizer plan={explainPlan} loading={loadingExplain} error={explainError} />}
          </>
        )}
      </div>

      {/* Footer */}
      <div className="bg-slate-100 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 rounded-xl flex items-center gap-3 p-3 shadow-inner relative group shrink-0">
         <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 bg-slate-200 dark:bg-slate-800 px-2 py-1 rounded">SQL</span>
         <div className="flex-1 font-mono text-xs text-slate-600 dark:text-slate-300 truncate">{sql}</div>
         <button onClick={() => { navigator.clipboard.writeText(sql); setSqlCopied(true); setTimeout(()=>setSqlCopied(false), 2000); }} className="text-slate-400 hover:text-indigo-600 p-1 transition-colors">{sqlCopied ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}</button>
      </div>

      <div className="flex items-center justify-between shrink-0">
         <button onClick={onNewConnection} className="text-slate-400 hover:text-slate-600 text-sm flex items-center gap-2 px-2 py-1"><Database className="w-4 h-4" /> Nova Conexão</button>
         <button onClick={onBackToBuilder} className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-bold shadow-lg shadow-indigo-200 dark:shadow-none transition-all flex items-center gap-2"><ArrowLeft className="w-4 h-4" /> Voltar</button>
      </div>
    </div>
  );
};

export default ResultsStep;