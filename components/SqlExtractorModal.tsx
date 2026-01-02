
import React, { useState, useEffect } from 'react';
import { X, Scissors, Sparkles, Loader2, Play, Copy, Check, Terminal, FileCode, AlertCircle, Trash2, History as HistoryIcon } from 'lucide-react';
import { extractSqlFromLogs } from '../services/geminiService';

interface SqlExtractorModalProps {
  onClose: () => void;
  onRunSql: (sql: string) => void;
}

const SqlExtractorModal: React.FC<SqlExtractorModalProps> = ({ onClose, onRunSql }) => {
  const [logInput, setLogInput] = useState(() => localStorage.getItem('psql-buddy-extractor-log') || '');
  const [isExtracting, setIsExtracting] = useState(false);
  const [queries, setQueries] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('psql-buddy-extractor-results');
      return saved ? JSON.parse(saved) : [];
    } catch { return []; }
  });
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);

  // Persistir alterações no localStorage
  useEffect(() => {
    localStorage.setItem('psql-buddy-extractor-log', logInput);
  }, [logInput]);

  useEffect(() => {
    localStorage.setItem('psql-buddy-extractor-results', JSON.stringify(queries));
  }, [queries]);

  const handleExtract = async () => {
    if (!logInput.trim() || isExtracting) return;
    setIsExtracting(true);
    
    try {
      const extracted = await extractSqlFromLogs(logInput);
      if (extracted.length > 0) {
        // Adiciona ao início do histórico, removendo duplicatas
        setQueries(prev => {
          const combined = [...extracted, ...prev];
          return Array.from(new Set(combined)).slice(0, 50); // Limite de 50 no histórico
        });
      } else {
        alert("Nenhuma query SQL detectada no texto fornecido.");
      }
    } catch (error) {
      console.error(error);
      alert("Falha ao extrair SQL.");
    } finally {
      setIsExtracting(false);
    }
  };

  const handleCopy = (sql: string, index: number) => {
    navigator.clipboard.writeText(sql);
    setCopiedIndex(index);
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  const handleClearHistory = () => {
    if (confirm("Deseja limpar todo o histórico de extrações?")) {
      setQueries([]);
      setLogInput('');
    }
  };

  const handleRemoveItem = (index: number) => {
    setQueries(prev => prev.filter((_, i) => i !== index));
  };

  return (
    <div className="fixed inset-0 z-[100] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200" onClick={onClose}>
      <div className="bg-white dark:bg-slate-800 w-full max-w-3xl rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700 flex flex-col overflow-hidden max-h-[85vh]" onClick={e => e.stopPropagation()}>
        
        <div className="p-5 border-b border-slate-100 dark:border-slate-700 flex justify-between items-center bg-indigo-50 dark:bg-indigo-900/20">
          <div className="flex items-center gap-3">
             <div className="p-2 bg-white dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 rounded-lg shadow-sm">
                <Scissors className="w-5 h-5" />
             </div>
             <div>
                <h3 className="font-bold text-slate-800 dark:text-white">Extrator de SQL Inteligente</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">Estado persistente e histórico de resultados.</p>
             </div>
          </div>
          <div className="flex items-center gap-2">
            {queries.length > 0 && (
              <button 
                onClick={handleClearHistory}
                className="p-2 text-slate-400 hover:text-red-500 transition-colors"
                title="Limpar tudo"
              >
                <Trash2 className="w-5 h-5" />
              </button>
            )}
            <button onClick={onClose} className="p-1.5 hover:bg-white/50 dark:hover:bg-slate-800 rounded text-slate-500 transition-colors">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-auto p-6 space-y-6 custom-scrollbar">
          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Entrada de Log</label>
            <div className="relative">
              <textarea 
                value={logInput}
                onChange={e => setLogInput(e.target.value)}
                placeholder="Cole blocos de texto ou logs do sistema aqui..."
                className="w-full h-32 p-4 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-mono outline-none focus:ring-2 focus:ring-indigo-500 resize-none transition-all"
              />
              <button 
                onClick={handleExtract}
                disabled={isExtracting || !logInput.trim()}
                className="absolute bottom-4 right-4 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2 shadow-lg transition-all disabled:opacity-50"
              >
                {isExtracting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                Extrair e Salvar
              </button>
            </div>
          </div>

          <div className="space-y-4">
             <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-700 pb-2">
                <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                  <HistoryIcon className="w-4 h-4" /> Histórico de Queries ({queries.length})
                </h4>
             </div>
             
             {queries.length > 0 ? (
               <div className="space-y-3">
                  {queries.map((sql, idx) => (
                    <div key={`${idx}-${sql.substring(0, 20)}`} className="bg-slate-950 rounded-xl border border-slate-800 overflow-hidden group relative animate-in slide-in-from-left-2 duration-300">
                       <div className="absolute top-2 right-2 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity z-10">
                          <button 
                            onClick={() => handleCopy(sql, idx)}
                            className="p-2 bg-slate-800 text-slate-400 hover:text-white rounded-lg transition-colors border border-slate-700"
                            title="Copiar SQL"
                          >
                             {copiedIndex === idx ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                          </button>
                          <button 
                            onClick={() => { onRunSql(sql); onClose(); }}
                            className="p-2 bg-indigo-600 text-white hover:bg-indigo-500 rounded-lg transition-colors flex items-center gap-1.5 text-xs font-bold shadow-lg"
                          >
                             <Play className="w-3.5 h-3.5 fill-current" /> Abrir
                          </button>
                          <button 
                            onClick={() => handleRemoveItem(idx)}
                            className="p-2 bg-slate-800 text-slate-400 hover:text-red-400 rounded-lg transition-colors border border-slate-700"
                            title="Remover do histórico"
                          >
                             <Trash2 className="w-4 h-4" />
                          </button>
                       </div>
                       <div className="absolute top-2 left-3 flex items-center gap-2 pointer-events-none">
                          <span className="text-[10px] font-black text-slate-600 uppercase bg-slate-900 px-1.5 py-0.5 rounded border border-slate-800">Query #{queries.length - idx}</span>
                       </div>
                       <pre className="p-4 pt-10 font-mono text-xs text-emerald-400 overflow-x-auto whitespace-pre-wrap max-h-40 overflow-y-auto custom-scrollbar">
                          {sql}
                       </pre>
                    </div>
                  ))}
               </div>
             ) : (
               <div className="p-12 text-center text-slate-400 flex flex-col items-center gap-3 bg-slate-50 dark:bg-slate-900/30 rounded-2xl border-2 border-dashed border-slate-100 dark:border-slate-800">
                  <div className="w-12 h-12 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
                    <FileCode className="w-6 h-6 opacity-20" />
                  </div>
                  <p className="text-sm">O histórico está vazio. Extraia queries de logs para vê-las aqui.</p>
               </div>
             )}
          </div>
        </div>

        <div className="p-4 bg-slate-50 dark:bg-slate-900 border-t border-slate-100 dark:border-slate-800 flex justify-between items-center shrink-0">
           <div className="flex items-center gap-2">
             <span className="text-[10px] text-slate-400 uppercase font-bold tracking-tighter">Powered by Gemini AI</span>
             <span className="w-1 h-1 rounded-full bg-slate-300"></span>
             <span className="text-[10px] text-indigo-500 font-bold uppercase">Estado Ativo</span>
           </div>
           <button onClick={onClose} className="px-6 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 rounded-xl text-xs font-bold hover:bg-slate-50 transition-all shadow-sm">
              Fechar
           </button>
        </div>
      </div>
    </div>
  );
};

export default SqlExtractorModal;
