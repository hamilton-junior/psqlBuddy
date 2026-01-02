
import React, { useState, useMemo, useEffect } from 'react';
import { 
  ArrowLeft, Database, ChevronLeft, ChevronRight, FileSpreadsheet, 
  Search, Copy, Check, BarChart2, MessageSquare, Download, 
  Activity, LayoutGrid, FileText, Pin, AlertCircle, Info, 
  MoreHorizontal, FileJson, FileCode, Hash, Type, Filter, 
  Plus, X, Trash2, SlidersHorizontal, Clock, Maximize2, 
  Minimize2, ExternalLink, Braces, PenTool, Save, Eye, 
  Anchor, Link as LinkIcon, Settings2, Loader2, Folder, 
  Terminal as TerminalIcon, ChevronDown, ChevronUp, Layers, 
  Target, CornerDownRight, AlertTriangle, Undo2, ShieldAlert 
} from 'lucide-react';
import { 
  AppSettings, DashboardItem, ExplainNode, DatabaseSchema, 
  Table, DbCredentials 
} from '../../types';
import DataVisualizer from '../DataVisualizer';
import DataAnalysisChat from '../DataAnalysisChat';
import CodeSnippetModal from '../CodeSnippetModal';
import JsonViewerModal from '../JsonViewerModal'; 
import DrillDownModal from '../DrillDownModal'; 
import { addToHistory } from '../../services/historyService';
import { executeQueryReal } from '../../services/dbService';
import BeginnerTip from '../BeginnerTip';

interface ResultsStepProps {
  data: any[];
  sql: string;
  onBackToBuilder: () => void;
  onNewConnection: () => void;
  settings: AppSettings;
  onAddToDashboard: (item: Omit<DashboardItem, 'id' | 'createdAt'>) => void;
  onShowToast: (msg: string, type?: 'success' | 'error' | 'info') => void;
  credentials: DbCredentials | null;
  executionDuration: number;
  schema?: DatabaseSchema;
}

type TabType = 'table' | 'chart' | 'analysis' | 'explain' | 'terminal';

const ResultsStep: React.FC<ResultsStepProps> = ({ 
  data, sql, onBackToBuilder, onNewConnection, settings, 
  onAddToDashboard, onShowToast, credentials, executionDuration, schema 
}) => {
  const [activeTab, setActiveTab] = useState<TabType>('table');
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [rowsPerPage] = useState(settings.defaultRowsPerPage || 10);
  const [copied, setCopied] = useState(false);
  const [showCodeModal, setShowCodeModal] = useState(false);
  const [showJsonModal, setShowJsonModal] = useState(false);
  const [drillDown, setDrillDown] = useState<{ col: string, val: any } | null>(null);

  const columns = useMemo(() => (data.length > 0 ? Object.keys(data[0]) : []), [data]);

  const filteredData = useMemo(() => {
    if (!searchTerm.trim()) return data;
    const term = searchTerm.toLowerCase();
    return data.filter(row => 
      Object.values(row).some(val => String(val).toLowerCase().includes(term))
    );
  }, [data, searchTerm]);

  const totalPages = Math.ceil(filteredData.length / rowsPerPage);
  const paginatedData = filteredData.slice((currentPage - 1) * rowsPerPage, currentPage * rowsPerPage);

  useEffect(() => {
    addToHistory({
      sql,
      rowCount: data.length,
      durationMs: executionDuration,
      status: 'success',
      schemaName: schema?.name || 'unknown'
    });
  }, [sql, data.length, executionDuration, schema]);

  const handleCopySql = () => {
    navigator.clipboard.writeText(sql);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleExportCsv = () => {
    if (data.length === 0) return;
    const headers = columns.join(',');
    const rows = data.map(row => columns.map(c => `"${String(row[c]).replace(/"/g, '""')}"`).join(','));
    const csvContent = "data:text/csv;charset=utf-8," + [headers, ...rows].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "query_results.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    onShowToast("CSV exportado com sucesso!", "success");
  };

  const generateAnsiTable = () => {
    if (data.length === 0) return "No results.";
    const colWidths: Record<string, number> = {};
    columns.forEach(col => {
      let max = col.length;
      data.slice(0, 10).forEach(row => {
        const val = row[col] === null ? 'NULL' : String(row[col]);
        if (val.length > max) max = val.length;
      });
      colWidths[col] = Math.min(max, 30);
    });

    let output = "";
    const separator = "+" + columns.map(c => "-".repeat(colWidths[c] + 2)).join("+") + "+\n";
    
    // Header
    output += separator;
    output += "|" + columns.map(c => ` \x1b[36m${c.padEnd(colWidths[c])}\x1b[0m `).join("|") + "|\n";
    output += separator;

    // Body
    data.slice(0, 50).forEach(row => {
      output += "|" + columns.map(c => {
        const val = row[c] === null ? '\x1b[33mNULL\x1b[0m' : String(row[c]);
        const cleanVal = val.replace(/\x1b\[\d+m/g, '');
        const padding = colWidths[c] - cleanVal.length;
        return ` ${val}${' '.repeat(Math.max(0, padding))} `;
      }).join("|") + "|\n";
    });
    output += separator;
    if (data.length > 50) output += `... and ${data.length - 50} more rows.`;
    return output;
  };

  return (
    <div className="h-full flex flex-col space-y-4 animate-in fade-in duration-500">
      <div className="flex justify-between items-center shrink-0">
        <div className="flex items-center gap-4">
          <button onClick={onBackToBuilder} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl text-slate-500 transition-colors">
            <ArrowLeft className="w-6 h-6" />
          </button>
          <div>
            <h2 className="text-2xl font-bold text-slate-800 dark:text-white flex items-center gap-2">
              <Database className="w-6 h-6 text-indigo-600" /> Resultados
            </h2>
            <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">
              {data.length} registros encontrados em <span className="font-mono text-indigo-600 dark:text-indigo-400">{executionDuration.toFixed(0)}ms</span>
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button onClick={() => setShowCodeModal(true)} className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-50 transition-all shadow-sm">
            <FileCode className="w-4 h-4" /> Exportar Código
          </button>
          <button onClick={handleExportCsv} className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-sm font-bold transition-all shadow-lg shadow-emerald-900/20">
            <FileSpreadsheet className="w-4 h-4" /> CSV
          </button>
        </div>
      </div>

      <div className="flex-1 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden flex flex-col">
        <div className="flex border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/50">
          <button onClick={() => setActiveTab('table')} className={`px-6 py-3 text-sm font-bold flex items-center gap-2 border-b-2 transition-all ${activeTab === 'table' ? 'border-indigo-600 text-indigo-600 bg-white dark:bg-slate-900' : 'border-transparent text-slate-500 hover:text-slate-700'}`}>
            <LayoutGrid className="w-4 h-4" /> Tabela
          </button>
          <button onClick={() => setActiveTab('chart')} className={`px-6 py-3 text-sm font-bold flex items-center gap-2 border-b-2 transition-all ${activeTab === 'chart' ? 'border-indigo-600 text-indigo-600 bg-white dark:bg-slate-900' : 'border-transparent text-slate-500 hover:text-slate-700'}`}>
            <BarChart2 className="w-4 h-4" /> Gráfico
          </button>
          <button onClick={() => setActiveTab('analysis')} className={`px-6 py-3 text-sm font-bold flex items-center gap-2 border-b-2 transition-all ${activeTab === 'analysis' ? 'border-indigo-600 text-indigo-600 bg-white dark:bg-slate-900' : 'border-transparent text-slate-500 hover:text-slate-700'}`}>
            <MessageSquare className="w-4 h-4" /> Análise IA
          </button>
          <button onClick={() => setActiveTab('terminal')} className={`px-6 py-3 text-sm font-bold flex items-center gap-2 border-b-2 transition-all ${activeTab === 'terminal' ? 'border-indigo-600 text-indigo-600 bg-white dark:bg-slate-900' : 'border-transparent text-slate-500 hover:text-slate-700'}`}>
            <TerminalIcon className="w-4 h-4" /> Terminal
          </button>
        </div>

        <div className="flex-1 overflow-hidden relative">
          {activeTab === 'table' && (
            <div className="h-full flex flex-col">
              <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-white dark:bg-slate-900">
                <div className="relative w-64">
                  <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
                  <input 
                    type="text" 
                    placeholder="Filtrar resultados..." 
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                    className="w-full pl-9 pr-4 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
                  />
                </div>
                <div className="flex items-center gap-4">
                   <span className="text-xs text-slate-400">Página {currentPage} de {totalPages || 1}</span>
                   <div className="flex gap-1">
                      <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1} className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-30"><ChevronLeft className="w-4 h-4" /></button>
                      <button onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages || totalPages === 0} className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-30"><ChevronRight className="w-4 h-4" /></button>
                   </div>
                </div>
              </div>
              <div className="flex-1 overflow-auto custom-scrollbar">
                <table className="w-full text-left border-collapse min-w-max">
                  <thead className="bg-slate-50 dark:bg-slate-950 sticky top-0 z-10 shadow-sm">
                    <tr>
                      {columns.map(col => (
                        <th key={col} className="px-6 py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950">
                          {col}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {paginatedData.map((row, i) => (
                      <tr key={i} className="hover:bg-indigo-50/30 dark:hover:bg-indigo-900/10 transition-colors group">
                        {columns.map(col => (
                          <td key={col} className="px-6 py-3 text-sm text-slate-600 dark:text-slate-300 font-mono">
                            {row[col] === null ? <span className="text-slate-300 italic">null</span> : String(row[col])}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {activeTab === 'chart' && (
            <div className="h-full p-6">
              <DataVisualizer data={data} onDrillDown={(col, val) => setDrillDown({ col, val })} />
            </div>
          )}

          {activeTab === 'analysis' && (
            <div className="h-full">
              <DataAnalysisChat data={data} sql={sql} />
            </div>
          )}

          {activeTab === 'terminal' && (
            <div className="h-full p-4 bg-slate-950">
              <pre className="font-mono text-xs text-emerald-400 whitespace-pre overflow-auto h-full custom-scrollbar">
                {generateAnsiTable()}
              </pre>
            </div>
          )}
        </div>
      </div>

      <div className="bg-slate-100 dark:bg-slate-800 p-4 rounded-2xl border border-slate-200 dark:border-slate-700">
        <div className="flex justify-between items-center mb-2">
          <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
            <FileCode className="w-3.5 h-3.5" /> SQL Executado
          </h4>
          <button onClick={handleCopySql} className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1">
            {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
            {copied ? 'Copiado' : 'Copiar SQL'}
          </button>
        </div>
        <pre className="text-xs font-mono text-slate-600 dark:text-slate-400 bg-white dark:bg-slate-900 p-3 rounded-xl border border-slate-200 dark:border-slate-700 overflow-x-auto whitespace-pre-wrap">
          {sql}
        </pre>
      </div>

      {showCodeModal && <CodeSnippetModal sql={sql} onClose={() => setShowCodeModal(false)} />}
      {showJsonModal && <JsonViewerModal json={data} onClose={() => setShowJsonModal(false)} />}
      {drillDown && credentials && (
        <DrillDownModal 
          targetTable={schema?.tables[0]?.name || ''}
          filterColumn={drillDown.col}
          filterValue={drillDown.val}
          credentials={credentials}
          onClose={() => setDrillDown(null)}
          schema={schema}
          settings={settings}
        />
      )}
    </div>
  );
};

export default ResultsStep;
