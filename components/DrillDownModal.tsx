
import React, { useState, useEffect } from 'react';
import { X, Database, ArrowRight, Loader2, AlertCircle } from 'lucide-react';
import { executeQueryReal } from '../services/dbService';
import { DbCredentials } from '../types';

interface DrillDownModalProps {
  targetTable: string; // "schema.table"
  filterColumn: string; // "id" usually
  filterValue: any;
  credentials: DbCredentials | null;
  onClose: () => void;
}

const DrillDownModal: React.FC<DrillDownModalProps> = ({ targetTable, filterColumn, filterValue, credentials, onClose }) => {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
       if (!credentials) return;
       setLoading(true);
       try {
          const sql = `SELECT * FROM ${targetTable} WHERE ${filterColumn} = '${filterValue}' LIMIT 50`;
          const res = await executeQueryReal(credentials, sql);
          setData(res);
       } catch (e: any) {
          setError(e.message);
       } finally {
          setLoading(false);
       }
    };
    fetchData();
  }, [targetTable, filterColumn, filterValue]);

  const columns = data.length > 0 ? Object.keys(data[0]) : [];

  return (
    <div className="fixed inset-0 z-[100] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200" onClick={onClose}>
      <div className="bg-white dark:bg-slate-900 w-full max-w-5xl max-h-[85vh] rounded-xl shadow-2xl border border-slate-200 dark:border-slate-700 flex flex-col overflow-hidden" onClick={e => e.stopPropagation()}>
        
        <div className="p-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50 flex justify-between items-center">
           <div className="flex items-center gap-3">
              <div className="p-2 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 rounded-lg">
                 <ArrowRight className="w-5 h-5" />
              </div>
              <div>
                 <h3 className="font-bold text-slate-800 dark:text-white text-sm">Drill-Down: {targetTable}</h3>
                 <p className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1">
                    Filtro: <code className="bg-slate-200 dark:bg-slate-800 px-1 rounded">{filterColumn} = {filterValue}</code>
                 </p>
              </div>
           </div>
           <button onClick={onClose} className="p-2 hover:bg-slate-200 dark:hover:bg-slate-800 rounded text-slate-500"><X className="w-5 h-5" /></button>
        </div>

        <div className="flex-1 overflow-auto bg-white dark:bg-slate-900 relative">
           {loading ? (
              <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-400">
                 <Loader2 className="w-8 h-8 animate-spin mb-2" />
                 <span className="text-xs">Buscando dados relacionados...</span>
              </div>
           ) : error ? (
              <div className="p-8 text-center text-red-500 flex flex-col items-center">
                 <AlertCircle className="w-10 h-10 mb-2 opacity-50" />
                 <p className="font-bold text-sm">Erro ao buscar dados</p>
                 <p className="text-xs opacity-70 mt-1">{error}</p>
              </div>
           ) : data.length === 0 ? (
              <div className="p-10 text-center text-slate-400">
                 <Database className="w-10 h-10 mx-auto mb-2 opacity-20" />
                 <p className="text-sm">Nenhum registro encontrado na tabela destino.</p>
              </div>
           ) : (
              <table className="w-full text-left text-sm border-collapse">
                 <thead className="bg-slate-50 dark:bg-slate-800 sticky top-0 shadow-sm z-10">
                    <tr>
                       {columns.map(col => (
                          <th key={col} className="px-4 py-2 font-semibold text-slate-600 dark:text-slate-300 text-xs uppercase tracking-wider whitespace-nowrap border-b border-slate-200 dark:border-slate-700">
                             {col}
                          </th>
                       ))}
                    </tr>
                 </thead>
                 <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {data.map((row, i) => (
                       <tr key={i} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                          {columns.map(col => (
                             <td key={col} className="px-4 py-2 text-slate-600 dark:text-slate-400 whitespace-nowrap text-xs">
                                {row[col] === null ? <span className="text-slate-400 italic">null</span> : String(row[col])}
                             </td>
                          ))}
                       </tr>
                    ))}
                 </tbody>
              </table>
           )}
        </div>
      </div>
    </div>
  );
};

export default DrillDownModal;
