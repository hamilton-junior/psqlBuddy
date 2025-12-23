
import React, { useState, useEffect } from 'react';
import { X, Search, Database, CheckCircle2, AlertCircle, Loader2, Sparkles, Link, ArrowRight, Table2 } from 'lucide-react';
import { IntersectionResult, DbCredentials, VirtualRelation } from '../types';
import { fetchIntersectionDetail } from '../services/dbService';

interface IntersectionValidatorModalProps {
  tableA: string;
  columnA: string;
  tableB: string;
  columnB: string;
  credentials: DbCredentials | null;
  onClose: () => void;
  onCreateRelation: (rel: VirtualRelation) => void;
}

const IntersectionValidatorModal: React.FC<IntersectionValidatorModalProps> = ({ 
  tableA, columnA, tableB, columnB, credentials, onClose, onCreateRelation 
}) => {
  const [loading, setLoading] = useState(true);
  const [result, setResult] = useState<IntersectionResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const runCheck = async () => {
      if (!credentials) return;
      setLoading(true);
      try {
        const data = await fetchIntersectionDetail(credentials, tableA, columnA, tableB, columnB);
        setResult(data);
      } catch (e: any) {
        setError(e.message);
      } finally {
        setLoading(false);
      }
    };
    runCheck();
  }, [tableA, columnA, tableB, columnB, credentials]);

  const handleCreate = () => {
    onCreateRelation({
      id: crypto.randomUUID(),
      sourceTable: tableA,
      sourceColumn: columnA,
      targetTable: tableB,
      targetColumn: columnB
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[120] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="bg-white dark:bg-slate-800 w-full max-w-2xl rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700 overflow-hidden flex flex-col animate-in zoom-in-95 duration-200">
        
        <div className="p-4 border-b border-slate-100 dark:border-slate-700 flex justify-between items-center bg-slate-50 dark:bg-slate-900/50">
          <div className="flex items-center gap-3">
             <div className="p-2 bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 rounded-lg">
                <Sparkles className="w-5 h-5" />
             </div>
             <h3 className="font-bold text-slate-800 dark:text-white">Validador de Relacionamento</h3>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-slate-200 dark:hover:bg-slate-700 rounded text-slate-500 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto">
          {loading ? (
             <div className="py-12 flex flex-col items-center justify-center gap-4 text-slate-400">
                <Loader2 className="w-10 h-10 animate-spin text-indigo-500" />
                <p className="text-sm font-medium">Analisando interseção de dados real...</p>
             </div>
          ) : error ? (
             <div className="bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-800 p-4 rounded-xl text-red-600 flex items-start gap-3">
                <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
                <p className="text-sm">{error}</p>
             </div>
          ) : result ? (
             <div className="space-y-6">
                <div className="flex items-center justify-center gap-4 p-4 bg-slate-50 dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700">
                   <div className="text-center flex-1 min-w-0">
                      <div className="text-[10px] font-bold text-slate-400 uppercase truncate">{tableA}</div>
                      <div className="text-sm font-mono font-bold text-indigo-600 dark:text-indigo-400 truncate">{columnA}</div>
                   </div>
                   <div className="flex flex-col items-center shrink-0">
                      <ArrowRight className="w-5 h-5 text-slate-300" />
                      <span className="text-[9px] font-extrabold text-slate-400 uppercase tracking-tighter">Match</span>
                   </div>
                   <div className="text-center flex-1 min-w-0">
                      <div className="text-[10px] font-bold text-slate-400 uppercase truncate">{tableB}</div>
                      <div className="text-sm font-mono font-bold text-emerald-600 dark:text-emerald-400 truncate">{columnB}</div>
                   </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                   <div className="p-4 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-sm">
                      <div className="text-xs text-slate-400 font-bold uppercase mb-1">Registros em Comum</div>
                      <div className="text-3xl font-bold text-slate-800 dark:text-white">{result.count}</div>
                      <div className="mt-2 flex items-center gap-1.5">
                         {result.count > 0 ? <CheckCircle2 className="w-3 h-3 text-emerald-500" /> : <AlertCircle className="w-3 h-3 text-red-500" />}
                         <span className="text-[10px] font-bold text-slate-500 uppercase">{result.count > 0 ? 'Conexão Viável' : 'Nenhuma Interseção'}</span>
                      </div>
                   </div>
                   <div className="p-4 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-sm">
                      <div className="text-xs text-slate-400 font-bold uppercase mb-1">Confiança</div>
                      <div className={`text-3xl font-bold ${result.count > 10 ? 'text-emerald-500' : result.count > 0 ? 'text-amber-500' : 'text-slate-400'}`}>
                         {result.count > 10 ? 'Alta' : result.count > 0 ? 'Média' : 'Nula'}
                      </div>
                      <p className="text-[10px] text-slate-400 mt-2 uppercase font-bold">Baseado na amostra</p>
                   </div>
                </div>

                {result.sample.length > 0 && (
                   <div>
                      <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 flex items-center gap-2">
                         <Table2 className="w-3.5 h-3.5" /> Amostra de Valores Correspondentes
                      </h4>
                      <div className="flex flex-wrap gap-2 p-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl">
                         {result.sample.map((val, i) => (
                            <span key={i} className="px-2 py-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded text-xs font-mono text-slate-600 dark:text-slate-300">
                               {String(val)}
                            </span>
                         ))}
                         {result.count > 20 && <span className="text-xs text-slate-400 self-center">...e mais {result.count - 20}</span>}
                      </div>
                   </div>
                )}
             </div>
          ) : null}
        </div>

        <div className="p-4 bg-slate-50 dark:bg-slate-900 border-t border-slate-200 dark:border-slate-700 flex justify-end gap-3 shrink-0">
          <button onClick={onClose} className="px-4 py-2 text-sm text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-xl transition-colors font-medium">Cancelar</button>
          <button 
             onClick={handleCreate}
             disabled={!result || result.count === 0}
             className="px-6 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold rounded-xl shadow-lg disabled:opacity-50 transition-all flex items-center gap-2"
          >
            <Link className="w-4 h-4" /> Criar FK Virtual
          </button>
        </div>

      </div>
    </div>
  );
};

export default IntersectionValidatorModal;
