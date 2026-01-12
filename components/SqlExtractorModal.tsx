import React, { useState, useEffect } from 'react';
import { X, Scissors, Sparkles, Loader2, Play, Copy, Check, FileCode, Trash2, History as HistoryIcon, Zap, Info } from 'lucide-react';
import { extractSqlFromLogs } from '../services/geminiService';
import { AppSettings } from '../types';
import Dialog from './common/Dialog';
import { toast } from 'react-hot-toast';

interface SqlExtractorModalProps {
  onClose: () => void;
  onRunSql: (sql: string) => void;
  settings: AppSettings;
}

const SqlExtractorModal: React.FC<SqlExtractorModalProps> = ({ onClose, onRunSql, settings }) => {
  const [logInput, setLogInput] = useState(() => localStorage.getItem('psql-buddy-extractor-log') || '');
  const [isExtractingAi, setIsExtractingAi] = useState(false);
  const [queries, setQueries] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('psql-buddy-extractor-results');
      return saved ? JSON.parse(saved) : [];
    } catch { return []; }
  });
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);

  // Dialog System
  const [dialogConfig, setDialogConfig] = useState<{ 
    isOpen: boolean, 
    type: 'confirm' | 'danger' | 'info', 
    title: string, 
    message: string, 
    onConfirm: () => void 
  } | null>(null);

  useEffect(() => {
    localStorage.setItem('psql-buddy-extractor-log', logInput);
  }, [logInput]);

  useEffect(() => {
    localStorage.setItem('psql-buddy-extractor-results', JSON.stringify(queries));
  }, [queries]);

  const handleLocalExtract = () => {
    if (!logInput.trim()) return;
    
    const lines = logInput.split(/\r?\n/);
    const keywords = ['SELECT', 'INSERT', 'UPDATE', 'DELETE', 'WITH', 'CREATE', 'ALTER', 'DROP', 'TRUNCATE'];
    const extracted: string[] = [];

    lines.forEach(line => {
      const keywordRegex = new RegExp(`\\b(${keywords.join('|')})\\b`, 'i');
      const match = line.match(keywordRegex);
      if (match && match.index !== undefined) {
        const query = line.substring(match.index).trim();
        if (query.length > 10) extracted.push(query);
      }
    });
    
    if (extracted.length > 0) {
      setQueries(prev => [...extracted, ...prev].slice(0, 50));
      toast.success("SQL extraído com sucesso!");
    } else {
      setDialogConfig({
        isOpen: true,
        type: 'info',
        title: 'Nenhum SQL encontrado',
        message: 'Não foi possível identificar comandos SQL padrão neste texto.',
        onConfirm: () => {}
      });
    }
  };

  const handleAiExtract = async () => {
    if (!logInput.trim() || isExtractingAi) return;
    setIsExtractingAi(true);
    try {
      const extracted = await extractSqlFromLogs(logInput);
      if (extracted.length > 0) {
        setQueries(prev => [...extracted, ...prev].slice(0, 50));
        toast.success("IA processou os logs com sucesso!");
      }
    } catch (error) {
      toast.error("Falha na comunicação com a IA.");
    } finally {
      setIsExtractingAi(false);
    }
  };

  const handleClearAll = () => {
    setDialogConfig({
      isOpen: true,
      type: 'danger',
      title: 'Limpar Resultados',
      message: 'Deseja realmente limpar todo o histórico de consultas extraídas?',
      onConfirm: () => {
        setQueries([]);
        localStorage.removeItem('psql-buddy-extractor-results');
        toast.success("Histórico limpo.");
      }
    });
  };

  const handleCopy = (sql: string, index: number) => {
    navigator.clipboard.writeText(sql);
    setCopiedIndex(index);
    setTimeout(() => setCopiedIndex(null), 2000);
    toast.success("Copiado!");
  };

  return (
    <div className="fixed inset-0 z-[100] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200" onClick={onClose}>
      {dialogConfig && (
        <Dialog 
          isOpen={dialogConfig.isOpen}
          type={dialogConfig.type}
          title={dialogConfig.title}
          message={dialogConfig.message}
          onConfirm={dialogConfig.onConfirm}
          onClose={() => setDialogConfig(null)}
          confirmLabel={dialogConfig.type === 'danger' ? 'Limpar Tudo' : 'OK'}
        />
      )}
      
      <div className="bg-white dark:bg-slate-800 w-full max-w-3xl rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700 flex flex-col overflow-hidden max-h-[85vh]" onClick={e => e.stopPropagation()}>
        <div className="p-5 border-b border-slate-100 dark:border-slate-700 flex justify-between items-center bg-indigo-50 dark:bg-indigo-900/20">
          <div className="flex items-center gap-3">
             <div className="p-2 bg-white dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 rounded-lg shadow-sm">
                <Scissors className="w-5 h-5" />
             </div>
             <div>
                <h3 className="font-bold text-slate-800 dark:text-white">Extrator de SQL</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">Recupere consultas de logs de sistemas.</p>
             </div>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-white/50 dark:hover:bg-slate-800 rounded text-slate-500 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-auto p-6 space-y-6 custom-scrollbar">
          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Entrada de Log / Texto</label>
            <div className="relative">
              <textarea 
                value={logInput}
                onChange={e => setLogInput(e.target.value)}
                placeholder="Cole logs do Sequelize, Hibernate, etc..."
                className="w-full h-36 p-4 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-mono outline-none focus:ring-2 focus:ring-indigo-500 resize-none transition-all"
              />
              <div className="absolute bottom-4 right-4 flex gap-2">
                {settings.enableAiGeneration && (
                  <button onClick={handleAiExtract} disabled={isExtractingAi || !logInput.trim()} className="bg-white dark:bg-slate-800 hover:bg-slate-50 text-slate-600 dark:text-slate-300 border border-slate-200 px-4 py-2 rounded-lg text-xs font-bold flex items-center gap-2 shadow-sm transition-all disabled:opacity-50">
                    {isExtractingAi ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3 text-amber-500" />}
                    IA
                  </button>
                )}
                <button onClick={handleLocalExtract} disabled={isExtractingAi || !logInput.trim()} className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2 shadow-lg transition-all">
                  <Zap className="w-4 h-4 fill-current" /> Extrair
                </button>
              </div>
            </div>
          </div>

          <div className="space-y-4">
             <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-700 pb-2">
                <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                  <HistoryIcon className="w-4 h-4" /> Resultados ({queries.length})
                </h4>
                {queries.length > 0 && (
                  <button onClick={handleClearAll} className="flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-black text-red-500 hover:bg-red-50 rounded-lg transition-all uppercase border border-red-100 dark:border-red-900/50">
                    <Trash2 className="w-3.5 h-3.5" /> Limpar Tudo
                  </button>
                )}
             </div>
             
             {queries.length > 0 ? (
               <div className="grid grid-cols-1 gap-3">
                  {queries.map((sql, idx) => (
                    <div key={idx} className="bg-slate-950 rounded-xl border border-slate-800 overflow-hidden group relative">
                       <div className="absolute top-2 right-2 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity z-10">
                          <button onClick={() => handleCopy(sql, idx)} className="p-2 bg-slate-800 text-slate-400 hover:text-white rounded-lg">
                             {copiedIndex === idx ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                          </button>
                          <button onClick={() => { onRunSql(sql); onClose(); }} className="p-2 bg-indigo-600 text-white hover:bg-indigo-500 rounded-lg text-xs font-bold shadow-lg flex items-center gap-1.5">
                             <Play className="w-3.5 h-3.5 fill-current" /> Abrir
                          </button>
                       </div>
                       <pre className="p-4 font-mono text-[11px] text-emerald-400 overflow-x-auto whitespace-pre-wrap max-h-40 overflow-y-auto leading-relaxed">
                          {sql}
                       </pre>
                    </div>
                  ))}
               </div>
             ) : (
               <div className="p-12 text-center text-slate-400 flex flex-col items-center gap-3 bg-slate-50 dark:bg-slate-900/30 rounded-2xl border-2 border-dashed border-slate-100 dark:border-slate-800">
                  <FileCode className="w-6 h-6 opacity-20" />
                  <p className="text-sm">Nenhuma query extraída.</p>
               </div>
             )}
          </div>
        </div>
        <div className="p-4 bg-slate-50 dark:bg-slate-900 border-t border-slate-100 dark:border-slate-800 flex justify-end shrink-0">
           <button onClick={onClose} className="px-6 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 rounded-xl text-xs font-bold hover:bg-slate-50 transition-all shadow-sm">
              Fechar
           </button>
        </div>
      </div>
    </div>
  );
};

export default SqlExtractorModal;