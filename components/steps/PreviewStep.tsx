

import React, { useState } from 'react';
import { QueryResult } from '../../types';
import { Terminal, Play, ArrowLeft, CheckCircle2, ShieldAlert, Info, Copy, Check, Loader2, Lightbulb, ShieldOff, AlertCircle } from 'lucide-react';

interface PreviewStepProps {
  queryResult: QueryResult;
  onExecute: () => void;
  onBack: () => void;
  isExecuting: boolean;
  isValidating: boolean;
  validationDisabled?: boolean;
}

const PreviewStep: React.FC<PreviewStepProps> = ({ queryResult, onExecute, onBack, isExecuting, isValidating, validationDisabled }) => {
  const [copied, setCopied] = useState(false);
  
  // If validation is undefined yet, assume valid until proven otherwise, but show loader
  const isValid = queryResult.validation?.isValid ?? true;
  const validationError = queryResult.validation?.error;
  const detailedError = queryResult.validation?.detailedError;
  const correctedSql = queryResult.validation?.correctedSql;
  const errorLine = queryResult.validation?.errorLine;

  const handleCopy = () => {
    navigator.clipboard.writeText(queryResult.sql);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const sqlLines = queryResult.sql.split('\n');

  return (
    <div className="w-full h-full">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-800 dark:text-white flex items-center gap-2">
            <Terminal className="w-6 h-6 text-indigo-600" />
            Visualização da Query
          </h2>
          <p className="text-slate-500 dark:text-slate-400 mt-1">Revise o SQL gerado antes da execução</p>
        </div>
      </div>

      <div className="space-y-6">
        
        {/* 1. SQL Code Block (Shown First) with Line Numbers */}
        <div className="rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700 shadow-sm bg-slate-900 flex flex-col">
           <div className="px-4 py-2 bg-slate-800 border-b border-slate-700 flex justify-between items-center shrink-0">
             <span className="text-xs font-mono text-slate-400 uppercase tracking-wider">SQL Gerado</span>
             <button 
               onClick={handleCopy}
               className="text-slate-400 hover:text-white transition-colors flex items-center gap-1 text-xs"
             >
               {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
               {copied ? 'Copiado!' : 'Copiar'}
             </button>
           </div>
           
           <div className="flex overflow-x-auto">
             {/* Line Numbers Column */}
             <div className="bg-slate-800/50 py-4 px-2 text-right border-r border-slate-700 select-none shrink-0 min-w-[3rem]">
                {sqlLines.map((_, i) => (
                  <div 
                    key={i} 
                    className={`font-mono text-xs leading-6 ${
                       // Highlight line number if error
                       errorLine === i + 1 ? 'text-red-400 font-bold' : 'text-slate-600'
                    }`}
                  >
                    {i + 1}
                  </div>
                ))}
             </div>
             
             {/* Code Content */}
             <div className="py-4 px-4 flex-1 min-w-0">
                {sqlLines.map((line, i) => (
                  <div 
                    key={i} 
                    className={`font-mono text-sm leading-6 whitespace-pre ${
                       // Highlight line background if error
                       errorLine === i + 1 ? 'bg-red-900/20 -mx-4 px-4 border-l-2 border-red-500' : 'text-indigo-100'
                    }`}
                  >
                     {line || ' '} {/* Empty lines need content to render height */}
                  </div>
                ))}
             </div>
           </div>
        </div>

        {/* 2. Validation Status (Shown Second) */}
        {validationDisabled ? (
           <div className="p-4 rounded-xl border flex items-start gap-3 bg-slate-100 border-slate-200 dark:bg-slate-800 dark:border-slate-700">
             <ShieldOff className="w-5 h-5 text-slate-400 mt-0.5" />
             <div>
               <h4 className="font-bold text-sm text-slate-600 dark:text-slate-300">Validação Desativada</h4>
               <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">A verificação de sintaxe por IA está desligada nas configurações.</p>
             </div>
           </div>
        ) : (
          <div className={`rounded-xl border overflow-hidden transition-all duration-300 ${
            isValidating 
              ? 'bg-indigo-50 border-indigo-100 dark:bg-indigo-900/20 dark:border-indigo-800' 
              : isValid 
                ? 'bg-emerald-50 border-emerald-200 dark:bg-emerald-900/20 dark:border-emerald-800' 
                : 'bg-red-50 border-red-200 dark:bg-red-900/10 dark:border-red-800'
          }`}>
            <div className="p-4 flex items-start gap-3">
               {isValidating ? (
                  <Loader2 className="w-5 h-5 text-indigo-600 dark:text-indigo-400 animate-spin mt-0.5" />
               ) : isValid ? (
                  <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400 mt-0.5" />
               ) : (
                  <ShieldAlert className="w-5 h-5 text-red-600 dark:text-red-400 mt-0.5" />
               )}
               
               <div className="flex-1">
                  <h4 className={`font-bold text-sm ${
                  isValidating ? 'text-indigo-800 dark:text-indigo-200' : isValid ? 'text-emerald-800 dark:text-emerald-200' : 'text-red-800 dark:text-red-200'
                  }`}>
                  {isValidating ? 'Validando Sintaxe...' : isValid ? 'Sintaxe Validada' : 'Erro de Sintaxe Detectado'}
                  </h4>
                  
                  {/* Detailed Error Box */}
                  {!isValidating && !isValid && (
                     <div className="mt-4 flex flex-col gap-4">
                        
                        {/* 1. What Went Wrong (Short) */}
                        {validationError && (
                           <div className="flex items-center gap-2 text-red-700 dark:text-red-300 bg-red-100/50 dark:bg-red-900/30 px-3 py-2 rounded border border-red-200 dark:border-red-800 text-xs font-mono">
                              <AlertCircle className="w-3.5 h-3.5" />
                              <span>{validationError}</span>
                              {errorLine && <span className="ml-auto font-bold opacity-70">Linha {errorLine}</span>}
                           </div>
                        )}

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                           {/* 2. Why it Happened (Detailed) */}
                           {detailedError && (
                              <div className="p-3 bg-white/60 dark:bg-slate-800/60 rounded border border-red-100 dark:border-red-900/30">
                                 <h5 className="text-[10px] font-bold text-red-600/80 dark:text-red-400/80 uppercase mb-2 flex items-center gap-1">
                                    <Info className="w-3 h-3" /> Diagnóstico
                                 </h5>
                                 <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed">
                                    {detailedError}
                                 </p>
                              </div>
                           )}

                           {/* 3. Suggested Fix */}
                           {correctedSql && (
                              <div className="p-3 bg-white/60 dark:bg-slate-800/60 rounded border border-emerald-100 dark:border-emerald-900/30">
                                 <h5 className="text-[10px] font-bold text-emerald-600/80 dark:text-emerald-400/80 uppercase mb-2 flex items-center gap-1">
                                    <Lightbulb className="w-3 h-3" /> Sugestão de Correção
                                 </h5>
                                 <code className="block font-mono text-xs text-slate-700 dark:text-slate-200 break-all bg-emerald-50 dark:bg-emerald-900/20 p-2 rounded border border-emerald-100 dark:border-emerald-800/30">
                                    {correctedSql}
                                 </code>
                              </div>
                           )}
                        </div>
                     </div>
                  )}
               </div>
            </div>
          </div>
        )}

        {/* 4. Logic Explanation & Tips (Shown Last) */}
        <div className="bg-white dark:bg-slate-800 p-6 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm">
           <div className="flex items-center gap-2 mb-3">
             <Info className="w-4 h-4 text-indigo-500" />
             <h4 className="font-bold text-slate-700 dark:text-slate-300 text-sm uppercase tracking-wider">Explicação da Lógica</h4>
           </div>
           <p className="text-slate-600 dark:text-slate-400 leading-relaxed text-sm">{queryResult.explanation}</p>
           
           {queryResult.tips && queryResult.tips.length > 0 && (
             <div className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-700">
                <h5 className="text-xs font-bold text-slate-500 dark:text-slate-400 mb-2">DICAS DE OTIMIZAÇÃO</h5>
                <ul className="list-disc pl-4 space-y-1">
                  {queryResult.tips.map((tip, i) => (
                    <li key={i} className="text-xs text-slate-600 dark:text-slate-400">{tip}</li>
                  ))}
                </ul>
             </div>
           )}
        </div>

        {/* Actions */}
        <div className="flex items-center justify-between pt-4 pb-10">
           <button 
             onClick={onBack}
             className="px-6 py-3 text-slate-600 dark:text-slate-400 font-semibold hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors flex items-center gap-2"
           >
             <ArrowLeft className="w-4 h-4" />
             Voltar ao Construtor
           </button>

           <button 
             onClick={onExecute}
             disabled={(!isValid && !validationDisabled) || isExecuting || isValidating}
             className="bg-red-500 hover:bg-red-600 text-white px-8 py-3 rounded-xl font-bold shadow-lg shadow-red-200 dark:shadow-none transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
           >
             {isExecuting ? 'Executando...' : 'Executar Query'}
             <Play className="w-4 h-4 fill-current" />
           </button>
        </div>
      </div>
    </div>
  );
};

export default PreviewStep;