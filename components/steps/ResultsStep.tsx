

import React, { useState, useEffect } from 'react';
import { Table, ArrowLeft, Database, Download, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, FileSpreadsheet, Search, Copy, Check } from 'lucide-react';
import { AppSettings } from '../../types';

interface ResultsStepProps {
  data: any[];
  sql: string;
  onBackToBuilder: () => void;
  onNewConnection: () => void;
  settings?: AppSettings;
}

const ResultsStep: React.FC<ResultsStepProps> = ({ data, sql, onBackToBuilder, onNewConnection, settings }) => {
  const columns = data.length > 0 ? Object.keys(data[0]) : [];
  
  // Pagination State - use default from settings or fallback to 10
  const [currentPage, setCurrentPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(settings?.defaultRowsPerPage || 10);
  const [localSearch, setLocalSearch] = useState('');
  
  // Copy SQL State
  const [sqlCopied, setSqlCopied] = useState(false);

  // Reset page when data changes
  useEffect(() => {
    setCurrentPage(1);
  }, [data]);

  // Update rows per page if settings change and user hasn't manually interacted (optional, but good for consistency)
  useEffect(() => {
    if (settings?.defaultRowsPerPage) {
       setRowsPerPage(settings.defaultRowsPerPage);
    }
  }, [settings?.defaultRowsPerPage]);

  // Filter Data locally (Visual search)
  const filteredData = data.filter(row => {
     if (!localSearch) return true;
     return Object.values(row).some(val => 
       String(val).toLowerCase().includes(localSearch.toLowerCase())
     );
  });

  // Calculate Pagination
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
        if (typeof val === 'string' && val.includes(',')) {
          return `"${val.replace(/"/g, '""')}"`;
        }
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

  // Helper function to highlight text matches
  const highlightMatch = (text: string) => {
    if (!localSearch.trim()) return text;

    // Escape regex characters to prevent crashes
    const escapedSearch = localSearch.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const parts = text.split(new RegExp(`(${escapedSearch})`, 'gi'));

    return (
      <>
        {parts.map((part, i) => 
          part.toLowerCase() === localSearch.toLowerCase() ? (
            <span key={i} className="bg-yellow-200 dark:bg-yellow-600/50 text-slate-900 dark:text-white font-semibold rounded px-0.5 box-decoration-clone">
              {part}
            </span>
          ) : (
            part
          )
        )}
      </>
    );
  };

  return (
    <div className="h-full flex flex-col space-y-6">
      
      {/* Header Section */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 shrink-0">
        <div>
          <h2 className="text-2xl font-bold text-slate-800 dark:text-white flex items-center gap-3">
            <div className="p-2 bg-indigo-100 dark:bg-indigo-900/50 rounded-lg">
               <Table className="w-6 h-6 text-indigo-600 dark:text-indigo-400" />
            </div>
            Resultados da Query
          </h2>
          <div className="flex items-center gap-3 mt-2">
             <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800">
               Status: 200 OK
             </span>
             <span className="text-sm text-slate-500 dark:text-slate-400">
               {data.length} registros encontrados
             </span>
          </div>
        </div>

        <div className="flex items-center gap-3">
           <div className="relative group">
              <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400 group-focus-within:text-indigo-500 transition-colors" />
              <input 
                type="text" 
                placeholder="Filtrar resultados..." 
                value={localSearch}
                onChange={(e) => { setLocalSearch(e.target.value); setCurrentPage(1); }}
                className="pl-9 pr-4 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none w-64 shadow-sm"
              />
           </div>
           <button 
             onClick={downloadCsv}
             disabled={data.length === 0}
             className="px-4 py-2 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 rounded-lg shadow-sm transition-all flex items-center gap-2 text-sm font-medium disabled:opacity-50" 
             title="Exportar CSV"
           >
             <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
             <span className="hidden sm:inline">Exportar CSV</span>
           </button>
        </div>
      </div>

      {/* Main Content Card */}
      <div className="flex-1 bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden flex flex-col relative">
        
        {data.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center text-slate-400 p-8">
             <div className="w-16 h-16 bg-slate-50 dark:bg-slate-900 rounded-full flex items-center justify-center mb-4">
                <Database className="w-8 h-8 opacity-50" />
             </div>
             <p className="text-lg font-medium">Nenhum resultado retornado</p>
             <p className="text-sm mt-1 max-w-xs text-center">Sua consulta foi executada com sucesso, mas não encontrou registros correspondentes.</p>
          </div>
        ) : (
          <>
            <div className="flex-1 overflow-auto scrollbar-thin scrollbar-thumb-slate-200 dark:scrollbar-thumb-slate-700">
               <table className="w-full text-left border-collapse">
                 <thead className="bg-slate-50/90 dark:bg-slate-900/90 backdrop-blur-sm sticky top-0 z-10">
                   <tr>
                     {columns.map((col, idx) => (
                       <th key={col} className={`px-6 py-4 text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider whitespace-nowrap border-b border-slate-200 dark:border-slate-700 ${idx === 0 ? 'pl-8' : ''}`}>
                         {col.replace(/_/g, ' ')}
                       </th>
                     ))}
                   </tr>
                 </thead>
                 <tbody className="divide-y divide-slate-100 dark:divide-slate-700/50">
                   {currentData.map((row, idx) => (
                     <tr key={idx} className="group hover:bg-indigo-50/50 dark:hover:bg-indigo-900/20 transition-colors">
                       {columns.map((col, cIdx) => (
                         <td key={col} className={`px-6 py-3.5 text-sm text-slate-600 dark:text-slate-300 whitespace-nowrap group-hover:text-slate-900 dark:group-hover:text-white transition-colors ${cIdx === 0 ? 'pl-8 font-medium' : ''}`}>
                           {row[col] === null ? (
                             <span className="text-slate-300 dark:text-slate-600 text-xs uppercase font-bold tracking-wide px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800">null</span>
                           ) : (
                             typeof row[col] === 'boolean' ? (
                                row[col] ? <span className="text-emerald-600 font-bold text-xs">TRUE</span> : <span className="text-red-500 font-bold text-xs">FALSE</span>
                             ) : (
                                highlightMatch(String(row[col]))
                             )
                           )}
                         </td>
                       ))}
                     </tr>
                   ))}
                 </tbody>
               </table>
            </div>
            
            {/* Integrated Pagination Footer */}
            <div className="border-t border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-4 flex flex-col sm:flex-row items-center justify-between text-sm text-slate-600 dark:text-slate-400 gap-4">
               
               <div className="flex items-center gap-6">
                 <span className="text-slate-500">
                    Exibindo <span className="font-bold text-slate-900 dark:text-white">{startIndex + 1}</span> - <span className="font-bold text-slate-900 dark:text-white">{endIndex}</span> de <span className="font-bold text-slate-900 dark:text-white">{totalRows}</span>
                 </span>
                 
                 <div className="flex items-center gap-2 pl-6 border-l border-slate-200 dark:border-slate-700">
                    <span className="text-xs text-slate-400 font-medium uppercase">Linhas:</span>
                    <select 
                      value={rowsPerPage} 
                      onChange={(e) => { setRowsPerPage(Number(e.target.value)); setCurrentPage(1); }}
                      className="bg-slate-50 dark:bg-slate-900 border-none rounded py-1 pl-2 pr-8 text-xs font-bold focus:ring-2 focus:ring-indigo-500 cursor-pointer text-slate-700 dark:text-slate-300"
                    >
                      <option value={10}>10</option>
                      <option value={25}>25</option>
                      <option value={50}>50</option>
                      <option value={100}>100</option>
                    </select>
                 </div>
               </div>

               <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-900/50 p-1 rounded-lg">
                  <button 
                    onClick={() => handlePageChange(1)} 
                    disabled={currentPage === 1}
                    className="p-1.5 rounded-md hover:bg-white dark:hover:bg-slate-800 hover:shadow-sm disabled:opacity-30 disabled:hover:shadow-none transition-all"
                    title="Primeira Página"
                  >
                    <ChevronsLeft className="w-4 h-4" />
                  </button>
                  <button 
                    onClick={() => handlePageChange(currentPage - 1)} 
                    disabled={currentPage === 1}
                    className="p-1.5 rounded-md hover:bg-white dark:hover:bg-slate-800 hover:shadow-sm disabled:opacity-30 disabled:hover:shadow-none transition-all"
                    title="Anterior"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  
                  <span className="px-3 py-1 font-mono text-xs font-bold text-slate-700 dark:text-slate-300 min-w-[3rem] text-center">
                    {currentPage} / {totalPages}
                  </span>

                  <button 
                    onClick={() => handlePageChange(currentPage + 1)} 
                    disabled={currentPage === totalPages}
                    className="p-1.5 rounded-md hover:bg-white dark:hover:bg-slate-800 hover:shadow-sm disabled:opacity-30 disabled:hover:shadow-none transition-all"
                    title="Próxima"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                  <button 
                    onClick={() => handlePageChange(totalPages)} 
                    disabled={currentPage === totalPages}
                    className="p-1.5 rounded-md hover:bg-white dark:hover:bg-slate-800 hover:shadow-sm disabled:opacity-30 disabled:hover:shadow-none transition-all"
                    title="Última Página"
                  >
                    <ChevronsRight className="w-4 h-4" />
                  </button>
               </div>
            </div>
          </>
        )}
      </div>

      {/* SQL Preview Snippet (Full Width & Copy) */}
      <div className="bg-slate-100 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 rounded-xl flex items-start gap-4 p-4 shadow-inner relative group">
         <div className="shrink-0 px-2 py-1 bg-slate-200 dark:bg-slate-800 rounded text-[10px] font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400 mt-0.5">
           SQL Executado
         </div>
         
         <div className="flex-1 font-mono text-xs text-slate-600 dark:text-slate-300 break-all whitespace-pre-wrap leading-relaxed select-all">
            {sql}
         </div>

         <div className="shrink-0 ml-2">
           <button 
             onClick={handleCopySql}
             className="p-2 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-all shadow-sm"
             title="Copiar SQL"
           >
             {sqlCopied ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
           </button>
         </div>
      </div>

      {/* Footer Actions */}
      <div className="flex items-center justify-between shrink-0 pt-2">
         <button 
           onClick={onNewConnection}
           className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 text-sm font-medium flex items-center gap-2 px-2 py-1 rounded hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
         >
           <Database className="w-4 h-4" />
           Nova Conexão
         </button>

         <button 
           onClick={onBackToBuilder}
           className="px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold shadow-lg shadow-indigo-200 dark:shadow-none hover:shadow-xl transition-all flex items-center gap-2 transform active:scale-95"
         >
           <ArrowLeft className="w-4 h-4" />
           Voltar e Modificar
         </button>
      </div>
    </div>
  );
};

export default ResultsStep;