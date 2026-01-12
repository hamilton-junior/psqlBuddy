
import React, { useState, useMemo } from 'react';
import { DatabaseSchema, VirtualRelation, DbCredentials } from '../types';
import { Link, Unlink, Plus, Trash2, ArrowRight, X, AlertCircle, CheckCircle2, Search, Loader2, Sparkles, Database, Copy, Play } from 'lucide-react';
import { suggestRelationships } from '../services/geminiService';
import { executeQueryReal } from '../services/dbService';
import Dialog from './common/Dialog';

interface VirtualRelationsModalProps {
  schema: DatabaseSchema;
  existingRelations: VirtualRelation[];
  onAddRelation: (rel: VirtualRelation) => void;
  onRemoveRelation: (id: string) => void;
  onClose: () => void;
  onCheckOverlap?: (tableA: string, colA: string, tableB: string, colB: string) => Promise<number>;
  credentials?: DbCredentials | null;
}

const VirtualRelationsModal: React.FC<VirtualRelationsModalProps> = ({ 
  schema, existingRelations, onAddRelation, onRemoveRelation, onClose, onCheckOverlap, credentials 
}) => {
  // Form State
  const [sourceTable, setSourceTable] = useState('');
  const [sourceColumn, setSourceColumn] = useState('');
  const [targetTable, setTargetTable] = useState('');
  const [targetColumn, setTargetColumn] = useState('');
  const [overlapResult, setOverlapResult] = useState<{count: number, checking: boolean} | null>(null);
  
  // AI Suggestions State
  const [isSuggesting, setIsSuggesting] = useState(false);
  const [suggestions, setSuggestions] = useState<VirtualRelation[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);

  // SQL Export State
  const [showSqlModal, setShowSqlModal] = useState(false);
  const [generatedSql, setGeneratedSql] = useState('');
  const [isExecutingSql, setIsExecutingSql] = useState(false);
  
  // Dialog State
  const [confirmDialog, setConfirmDialog] = useState<boolean>(false);

  const getTableOptions = () => schema.tables.map(t => ({ label: `${t.schema}.${t.name}`, value: `${t.schema}.${t.name}` }));
  const getColumns = (fullTableName: string) => {
     if (!fullTableName) return [];
     const [s, t] = fullTableName.split('.');
     const table = schema.tables.find(tbl => tbl.name === t && (tbl.schema || 'public') === s);
     return table ? table.columns.map(c => c.name) : [];
  };

  const handleAdd = () => {
     if (!sourceTable || !sourceColumn || !targetTable || !targetColumn) return;
     onAddRelation({ id: crypto.randomUUID(), sourceTable, sourceColumn, targetTable, targetColumn });
     setOverlapResult(null);
  };

  const handleAutoDetect = async () => {
     setIsSuggesting(true);
     setShowSuggestions(true);
     setSuggestions([]);
     try {
        const results = await suggestRelationships(schema);
        const uniqueResults = results.filter(r => !existingRelations.some(ex => ex.sourceTable === r.sourceTable && ex.sourceColumn === r.sourceColumn && ex.targetTable === r.targetTable && ex.targetColumn === r.targetColumn));
        setSuggestions(uniqueResults);
     } catch (e) { /* ignored */ } finally { setIsSuggesting(false); }
  };

  const handleGenerateSql = () => {
     if (existingRelations.length === 0) return;
     const parseTable = (str: string) => {
        const parts = str.split('.');
        return parts.length >= 2 ? { schema: parts[0], table: parts[1] } : { schema: 'public', table: parts[0] };
     };
     const statements = existingRelations.map(rel => {
        const src = parseTable(rel.sourceTable);
        const tgt = parseTable(rel.targetTable);
        const constraintName = `fk_${src.table}_${tgt.table}_${rel.sourceColumn}`;
        return `ALTER TABLE "${src.schema}"."${src.table}"\nADD CONSTRAINT "${constraintName}"\nFOREIGN KEY ("${rel.sourceColumn}")\nREFERENCES "${tgt.schema}"."${tgt.table}" ("${rel.targetColumn}");`;
     });
     setGeneratedSql(statements.join('\n\n'));
     setShowSqlModal(true);
  };

  const handleExecuteSql = async () => {
     if (!credentials || !generatedSql) return;
     setIsExecutingSql(true);
     try {
        await executeQueryReal(credentials, generatedSql);
        setShowSqlModal(false);
        setConfirmDialog(false);
     } catch (e: any) {
        alert("Erro na execução: " + e.message);
     } finally {
        setIsExecutingSql(false);
     }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4 animate-in fade-in duration-200">
      
      {confirmDialog && (
         <Dialog 
            isOpen={true}
            type="danger"
            title="Confirmar Execução DDL"
            message="Isso executará comandos de alteração de tabela no banco de dados. Certifique-se de que os dados são consistentes para evitar erros de integridade. Deseja continuar?"
            onConfirm={handleExecuteSql}
            onClose={() => setConfirmDialog(false)}
            confirmLabel="Executar SQL"
         />
      )}

      {showSqlModal && (
         <div className="absolute inset-0 z-[110] bg-slate-900/50 flex items-center justify-center p-4">
            <div className="bg-white dark:bg-slate-800 w-full max-w-2xl rounded-xl shadow-2xl border border-slate-200 dark:border-slate-700 flex flex-col overflow-hidden max-h-[80vh]">
               <div className="p-4 border-b border-slate-100 dark:border-slate-700 flex justify-between items-center bg-slate-50 dark:bg-slate-900/50">
                  <h3 className="font-bold text-slate-800 dark:text-white flex items-center gap-2">
                     <Database className="w-5 h-5 text-indigo-500" /> Exportar para o Banco
                  </h3>
                  <button onClick={() => setShowSqlModal(false)} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"><X className="w-5 h-5" /></button>
               </div>
               <div className="p-4 bg-[#1e1e1e] flex-1 overflow-auto">
                  <pre className="font-mono text-sm text-green-400 whitespace-pre-wrap">{generatedSql}</pre>
               </div>
               <div className="p-4 border-t border-slate-100 dark:border-slate-700 flex justify-between items-center bg-white dark:bg-slate-800">
                  <div className="flex gap-2 text-xs text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 px-3 py-2 rounded-lg border border-amber-200 dark:border-amber-800 max-w-sm">
                     <AlertCircle className="w-4 h-4 shrink-0" />
                     <span>Atenção: A criação de FKs pode falhar se existirem registros órfãos.</span>
                  </div>
                  <div className="flex gap-2">
                     <button onClick={() => navigator.clipboard.writeText(generatedSql)} className="px-4 py-2 border border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-300 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700 flex items-center gap-2 text-sm font-medium">
                        <Copy className="w-4 h-4" /> Copiar SQL
                     </button>
                     {credentials && credentials.host !== 'simulated' && (
                        <button onClick={() => setConfirmDialog(true)} disabled={isExecutingSql} className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg flex items-center gap-2 text-sm font-bold disabled:opacity-50">
                           {isExecutingSql ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />} Executar Agora
                        </button>
                     )}
                  </div>
               </div>
            </div>
         </div>
      )}

      <div className="bg-white dark:bg-slate-800 w-full max-w-3xl rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700 flex flex-col overflow-hidden max-h-[85vh]">
        
        <div className="p-5 border-b border-slate-100 dark:border-slate-700 flex justify-between items-center bg-slate-50 dark:bg-slate-900/50">
          <div className="flex items-center gap-3">
             <div className="p-2 bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 rounded-lg">
                <Link className="w-6 h-6" />
             </div>
             <div>
                <h3 className="text-xl font-bold text-slate-800 dark:text-white">Relacionamentos Virtuais</h3>
                <p className="text-sm text-slate-500 dark:text-slate-400">Crie vínculos manuais para tabelas sem FK explícita.</p>
             </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors">
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 bg-slate-50/50 dark:bg-slate-900/50">
           {!showSuggestions && (
              <div className="mb-6 bg-gradient-to-r from-indigo-500 to-purple-600 p-4 rounded-xl text-white shadow-lg flex items-center justify-between">
                 <div>
                    <h4 className="font-bold flex items-center gap-2"><Sparkles className="w-4 h-4" /> Descoberta Automática (IA)</h4>
                    <p className="text-indigo-100 text-xs mt-1">Deixe a IA analisar os nomes das colunas e sugerir conexões prováveis.</p>
                 </div>
                 <button onClick={handleAutoDetect} className="px-4 py-2 bg-white text-indigo-600 font-bold text-xs rounded-lg hover:bg-indigo-50 transition-colors shadow-sm">
                    Detectar com IA
                 </button>
              </div>
           )}

           {showSuggestions && (
              <div className="mb-6 border border-indigo-200 dark:border-indigo-800 bg-indigo-50/50 dark:bg-indigo-900/20 rounded-xl p-4 animate-in fade-in slide-in-from-top-2">
                 <div className="flex justify-between items-center mb-3">
                    <h4 className="font-bold text-indigo-800 dark:text-indigo-200 text-sm flex items-center gap-2">
                       {isSuggesting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                       {isSuggesting ? 'Analisando Schema...' : `Sugestões Encontradas (${suggestions.length})`}
                    </h4>
                    {!isSuggesting && <button onClick={() => setShowSuggestions(false)} className="text-xs text-indigo-600 hover:underline">Fechar</button>}
                 </div>
                 <div className="space-y-2 max-h-48 overflow-y-auto pr-2 custom-scrollbar">
                    {suggestions.map(rel => (
                       <div key={rel.id} className="bg-white dark:bg-slate-800 p-2 rounded-lg border border-indigo-100 dark:border-indigo-900 flex justify-between items-center shadow-sm">
                          <div className="flex items-center gap-2 text-xs">
                             <span className="font-mono text-slate-600 dark:text-slate-400">{rel.sourceTable}.<strong>{rel.sourceColumn}</strong></span>
                             <ArrowRight className="w-3 h-3 text-indigo-400" />
                             <span className="font-mono text-slate-600 dark:text-slate-400">{rel.targetTable}.<strong>{rel.targetColumn}</strong></span>
                          </div>
                          <button onClick={() => { onAddRelation(rel); setSuggestions(s => s.filter(x => x.id !== rel.id)); }} className="text-xs bg-indigo-100 hover:bg-indigo-200 text-indigo-700 px-2 py-1 rounded font-bold transition-colors">
                             Aceitar
                          </button>
                       </div>
                    ))}
                 </div>
              </div>
           )}
           
           <div className="bg-white dark:bg-slate-800 p-5 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm mb-6">
              <h4 className="text-sm font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-4 flex items-center gap-2">
                 <Plus className="w-4 h-4 text-indigo-500" /> Novo Vínculo Manual
              </h4>
              <div className="flex flex-col md:flex-row items-end gap-4">
                 <div className="flex-1 w-full space-y-2">
                    <label className="text-xs font-semibold text-slate-500">Tabela de Origem</label>
                    <select value={sourceTable} onChange={e => { setSourceTable(e.target.value); setSourceColumn(''); }} className="w-full text-sm p-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none">
                       <option value="">Selecione Tabela...</option>
                       {getTableOptions().map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                    </select>
                    <select value={sourceColumn} onChange={e => setSourceColumn(e.target.value)} disabled={!sourceTable} className="w-full text-sm p-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none disabled:opacity-50">
                       <option value="">Selecione Coluna...</option>
                       {getColumns(sourceTable).map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                 </div>
                 <div className="flex justify-center pb-8 text-slate-300"><ArrowRight className="w-6 h-6" /></div>
                 <div className="flex-1 w-full space-y-2">
                    <label className="text-xs font-semibold text-slate-500">Tabela de Destino</label>
                    <select value={targetTable} onChange={e => { setTargetTable(e.target.value); setTargetColumn(''); }} className="w-full text-sm p-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none">
                       <option value="">Selecione Tabela...</option>
                       {getTableOptions().map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                    </select>
                    <select value={targetColumn} onChange={e => setTargetColumn(e.target.value)} disabled={!targetTable} className="w-full text-sm p-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none disabled:opacity-50">
                       <option value="">Selecione Coluna...</option>
                       {getColumns(targetTable).map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                 </div>
              </div>
              <div className="flex justify-end gap-3 mt-4 pt-4 border-t border-slate-100 dark:border-slate-700">
                 <button onClick={handleAdd} disabled={!sourceTable || !sourceColumn || !targetTable || !targetColumn} className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold rounded-lg shadow-md transition-all disabled:opacity-50 disabled:cursor-not-allowed">
                    <Link className="w-4 h-4" /> Criar Relacionamento
                 </button>
              </div>
           </div>

           <div className="space-y-3">
              <div className="flex justify-between items-center mb-2">
                 <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider">Vínculos Ativos ({existingRelations.length})</h4>
                 {existingRelations.length > 0 && (
                    <button onClick={handleGenerateSql} className="text-[10px] font-bold text-emerald-600 bg-emerald-50 hover:bg-emerald-100 px-2 py-1 rounded border border-emerald-200 flex items-center gap-1 transition-colors">
                       <Database className="w-3 h-3" /> Gerar SQL (DDL)
                    </button>
                 )}
              </div>
              {existingRelations.length === 0 ? (
                 <div className="text-center p-8 border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-xl text-slate-400">
                    <Unlink className="w-8 h-8 mx-auto mb-2 opacity-50" />
                    <p className="text-sm">Nenhum vínculo manual criado.</p>
                 </div>
              ) : (
                 existingRelations.map(rel => (
                    <div key={rel.id} className="bg-white dark:bg-slate-800 p-3 rounded-lg border border-slate-200 dark:border-slate-700 shadow-sm flex items-center justify-between group">
                       <div className="flex items-center gap-2 text-sm">
                          <div className="bg-slate-100 dark:bg-slate-700 px-2 py-1 rounded text-slate-700 dark:text-slate-300 font-mono text-xs">
                             {rel.sourceTable}.<span className="font-bold text-indigo-600 dark:text-indigo-400">{rel.sourceColumn}</span>
                          </div>
                          <ArrowRight className="w-4 h-4 text-slate-400" />
                          <div className="bg-slate-100 dark:bg-slate-700 px-2 py-1 rounded text-slate-700 dark:text-slate-300 font-mono text-xs">
                             {rel.targetTable}.<span className="font-bold text-emerald-600 dark:text-emerald-400">{rel.targetColumn}</span>
                          </div>
                       </div>
                       <button onClick={() => onRemoveRelation(rel.id)} className="text-slate-400 hover:text-red-500 p-1.5 hover:bg-slate-100 dark:hover:bg-slate-700 rounded transition-colors"><Trash2 className="w-4 h-4" /></button>
                    </div>
                 ))
              )}
           </div>
        </div>
      </div>
    </div>
  );
};

export default VirtualRelationsModal;
