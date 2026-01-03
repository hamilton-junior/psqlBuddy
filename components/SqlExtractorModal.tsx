
import React, { useState, useEffect } from 'react';
import { X, Scissors, Sparkles, Loader2, Play, Copy, Check, Terminal, FileCode, AlertCircle, Trash2, History as HistoryIcon, Zap, Info } from 'lucide-react';
import { extractSqlFromLogs } from '../services/geminiService';
import { AppSettings } from '../types';

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

  // Persistir alterações no localStorage
  useEffect(() => {
    if (logInput) {
      localStorage.setItem('psql-buddy-extractor-log', logInput);
    } else {
      localStorage.removeItem('psql-buddy-extractor-log');
    }
  }, [logInput]);

  useEffect(() => {
    if (queries.length > 0) {
      localStorage.setItem('psql-buddy-extractor-results', JSON.stringify(queries));
    } else {
      localStorage.removeItem('psql-buddy-extractor-results');
    }
  }, [queries]);

  /**
   * Extração Local Refinada
   * Processa o texto linha a linha para identificar o início de comandos SQL
   * e determinar os limites baseados em aspas de log ou quebras de linha.
   */
  const extractSqlLocally = () => {
    if (!logInput.trim()) return;
    
    const lines = logInput.split(/\r?\n/);
    const keywords = ['SELECT', 'INSERT', 'UPDATE', 'DELETE', 'WITH', 'CREATE', 'ALTER', 'DROP', 'TRUNCATE'];
    const extracted: string[] = [];

    lines.forEach(line => {
      // 1. Identifica a primeira ocorrência de uma palavra-chave SQL na linha
      const keywordRegex = new RegExp(`\\b(${keywords.join('|')})\\b`, 'i');
      const match = line.match(keywordRegex);
      
      if (match && match.index !== undefined) {
        const startPos = match.index;
        
        // 2. Tenta detectar se a query está envolta em aspas (padrão comum de logs)
        // Olha 1 ou 2 caracteres antes do início do comando SQL
        let quoteChar = '';
        const prefix = line.substring(Math.max(0, startPos - 2), startPos);
        if (prefix.includes('"')) quoteChar = '"';
        else if (prefix.includes("'")) quoteChar = "'";
        
        let query = '';
        if (quoteChar) {
           // Se achou uma aspa de abertura, procura a última ocorrência da mesma aspa na linha
           const endQuotePos = line.lastIndexOf(quoteChar);
           if (endQuotePos > startPos) {
              query = line.substring(startPos, endQuotePos);
           } else {
              query = line.substring(startPos);
           }
        } else {
           // Se não há aspas óbvias, pega do comando até o fim da linha ou ponto e vírgula
           const semiPos = line.indexOf(';', startPos);
           query = semiPos !== -1 ? line.substring(startPos, semiPos + 1) : line.substring(startPos);
        }
        
        // Limpeza básica de caracteres de escape comuns em logs JSON/String
        const cleaned = query.trim()
           .replace(/\\n/g, '\n')
           .replace(/\\"/g, '"')
           .replace(/\\'/g, "'");

        if (cleaned.length > 10) {
           extracted.push(cleaned);
        }
      }
    });
    
    if (extracted.length > 0) {
      setQueries(prev => {
        const combined = [...extracted, ...prev];
        const unique = combined.filter((item, index) => combined.indexOf(item) === index);
        return unique.slice(0, 50);
      });
      return true;
    }
    return false;
  };

  const handleLocalExtract = () => {
    const success = extractSqlLocally();
    if (!success) {
      alert("Nenhuma query SQL reconhecida. Verifique se o texto contém comandos SELECT, INSERT, etc.");
    }
  };

  const handleAiExtract = async () => {
    if (!logInput.trim() || isExtractingAi) return;
    
    setIsExtractingAi(true);
    try {
      const extracted = await extractSqlFromLogs(logInput);
      if (extracted && Array.isArray(extracted) && extracted.length > 0) {
        setQueries(prev => {
          const combined = [...extracted, ...prev];
          const unique = combined.filter((item, index) => combined.indexOf(item) === index);
          return unique.slice(0, 50);
        });
      } else {
        alert("A IA não conseguiu identificar queries SQL válidas neste texto.");
      }
    } catch (error) {
      console.error(error);
      alert("Falha na comunicação com a IA.");
    } finally {
      setIsExtractingAi(false);
    }
  };

  const handleCopy = (sql: string, index: number) => {
    navigator.clipboard.writeText(sql);
    setCopiedIndex(index);
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  const handleClearHistory = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (window.confirm("Deseja realmente limpar todo o histórico de consultas extraídas?")) {
      setQueries([]);
      localStorage.removeItem('psql-buddy-extractor-results');
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
            <div className="flex justify-between items-center">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Entrada de Log / Texto</label>
              <span className="text-[10px] text-slate-400 flex items-center gap-1"><Info className="w-3 h-3" /> Cole logs do Sequelize, Hibernate, PG-Node, etc.</span>
            </div>
            <div className="relative">
              <textarea 
                value={logInput}
                onChange={e => setLogInput(e.target.value)}
                placeholder="Cole blocos de texto ou logs do sistema aqui..."
                className="w-full h-36 p-4 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-mono outline-none focus:ring-2 focus:ring-indigo-500 resize-none transition-all"
              />
              <div className="absolute bottom-4 right-4 flex gap-2">
                {settings.enableAiGeneration && (
                  <button 
                    onClick={handleAiExtract}
                    disabled={isExtractingAi || !logInput.trim()}
                    className="bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-600 px-4 py-2 rounded-lg text-xs font-bold flex items-center gap-2 shadow-sm transition-all disabled:opacity-50"
                    title="Usa inteligência artificial para limpar logs complexos"
                  >
                    {isExtractingAi ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3 text-amber-500" />}
                    Extrair c/ IA
                  </button>
                )}
                <button 
                  onClick={handleLocalExtract}
                  disabled={isExtractingAi || !logInput.trim()}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2 shadow-lg transition-all disabled:opacity-50"
                >
                  <Zap className="w-4 h-4 fill-current" />
                  Extração Rápida
                </button>
              </div>
            </div>
          </div>

          <div className="space-y-4">
             <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-700 pb-2">
                <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                  <HistoryIcon className="w-4 h-4" /> Resultados Extraídos ({queries.length})
                </h4>
                {queries.length > 0 && (
                  <button 
                    onClick={handleClearHistory}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-black text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg transition-all uppercase tracking-tight border border-red-100 dark:border-red-900/50"
                  >
                    <Trash2 className="w-3.5 h-3.5" /> Limpar Tudo
                  </button>
                )}
             </div>
             
             {queries.length > 0 ? (
               <div className="grid grid-cols-1 gap-3">
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
                             <Play className="w-3.5 h-3.5 fill-current" /> Abrir no Editor
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
                       <pre className="p-4 pt-10 font-mono text-[11px] text-emerald-400 overflow-x-auto whitespace-pre-wrap max-h-40 overflow-y-auto custom-scrollbar leading-relaxed">
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
                  <p className="text-sm">Nenhuma query extraída ainda.</p>
               </div>
             )}
          </div>
        </div>

        <div className="p-4 bg-slate-50 dark:bg-slate-900 border-t border-slate-100 dark:border-slate-800 flex justify-between items-center shrink-0">
           <div className="flex items-center gap-2">
             <span className="text-[10px] text-slate-400 uppercase font-bold tracking-tighter">O histórico é salvo localmente no navegador</span>
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
