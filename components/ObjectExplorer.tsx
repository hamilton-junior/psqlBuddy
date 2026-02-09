
import React, { useState, useEffect, useMemo } from 'react';
import { DatabaseObject, DbCredentials } from '../types';
import { fetchDatabaseObjects } from '../services/dbService';
import { Boxes, Search, Filter, Code2, Play, Hash, Terminal, Box, Cog, ChevronRight, Loader2, Copy, Check, FileCode, Workflow } from 'lucide-react';
import Editor from '@monaco-editor/react';
import { toast } from 'react-hot-toast';

interface ObjectExplorerProps {
  credentials: DbCredentials | null;
}

const ObjectExplorer: React.FC<ObjectExplorerProps> = ({ credentials }) => {
  const [objects, setObjects] = useState<DatabaseObject[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedObjectId, setSelectedObjectId] = useState<string | null>(null);
  const [filterType, setFilterType] = useState<string>('all');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const load = async () => {
      if (!credentials) return;
      setLoading(true);
      console.log("[OBJECT_EXPLORER] Iniciando carga de objetos...");
      try {
        const data = await fetchDatabaseObjects(credentials);
        setObjects(data);
        console.log(`[OBJECT_EXPLORER] ${data.length} objetos carregados.`);
      } catch (e: any) {
        toast.error(e.message);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [credentials]);

  const filteredObjects = useMemo(() => {
    return objects.filter(obj => {
      const matchesSearch = obj.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                            obj.schema.toLowerCase().includes(searchTerm.toLowerCase()) ||
                            (obj.tableName || '').toLowerCase().includes(searchTerm.toLowerCase());
      const matchesType = filterType === 'all' || obj.type === filterType;
      return matchesSearch && matchesType;
    });
  }, [objects, searchTerm, filterType]);

  const selectedObject = useMemo(() => 
    objects.find(o => o.id === selectedObjectId), 
  [objects, selectedObjectId]);

  const handleCopy = () => {
    if (selectedObject) {
      navigator.clipboard.writeText(selectedObject.definition);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      toast.success("Código DDL copiado!");
    }
  };

  const getObjectIcon = (type: string) => {
    switch (type) {
      case 'function': return <Code2 className="w-4 h-4 text-indigo-500" />;
      case 'procedure': return <Terminal className="w-4 h-4 text-amber-500" />;
      case 'trigger': return <Workflow className="w-4 h-4 text-emerald-500" />;
      default: return <Box className="w-4 h-4 text-slate-400" />;
    }
  };

  if (credentials?.host === 'simulated') {
    return (
      <div className="flex flex-col items-center justify-center h-full text-slate-400 gap-4 opacity-50">
        <Boxes className="w-16 h-16" />
        <p className="font-bold uppercase tracking-widest text-sm">Objetos indisponíveis em modo simulação.</p>
      </div>
    );
  }

  return (
    <div className="flex h-full gap-6 animate-in fade-in duration-500 overflow-hidden">
      {/* Sidebar de Objetos */}
      <div className="w-80 flex flex-col bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-[2.5rem] shadow-sm overflow-hidden shrink-0">
        <div className="p-5 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/20">
           <h3 className="text-xs font-black text-slate-400 uppercase tracking-[0.2em] mb-4 flex items-center gap-2">
             <Boxes className="w-4 h-4 text-indigo-500" /> Explorador de Objetos
           </h3>
           <div className="space-y-3">
              <div className="relative">
                <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
                <input 
                  type="text"
                  placeholder="Filtrar por nome..."
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
                />
              </div>
              <div className="flex gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-lg border border-slate-200 dark:border-slate-700">
                 {['all', 'function', 'trigger', 'procedure'].map(t => (
                    <button 
                      key={t}
                      onClick={() => setFilterType(t)}
                      className={`flex-1 py-1 rounded-md text-[9px] font-black uppercase transition-all ${filterType === t ? 'bg-white dark:bg-slate-700 text-indigo-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                    >
                      {t === 'all' ? 'Tudo' : t.charAt(0)}
                    </button>
                 ))}
              </div>
           </div>
        </div>

        <div className="flex-1 overflow-y-auto custom-scrollbar p-3 space-y-1">
           {loading ? (
              <div className="flex flex-col items-center justify-center h-full gap-3 opacity-50">
                 <Loader2 className="w-6 h-6 animate-spin text-indigo-500" />
                 <span className="text-[10px] font-black uppercase tracking-widest">Indexando...</span>
              </div>
           ) : filteredObjects.length === 0 ? (
              <div className="text-center py-10 opacity-30">
                 <Search className="w-8 h-8 mx-auto mb-2" />
                 <p className="text-[10px] font-black uppercase">Nenhum objeto encontrado</p>
              </div>
           ) : filteredObjects.map(obj => (
              <button
                key={obj.id}
                onClick={() => setSelectedObjectId(obj.id)}
                className={`w-full text-left p-3 rounded-2xl transition-all border flex items-center gap-3 group
                  ${selectedObjectId === obj.id 
                    ? 'bg-indigo-600 border-indigo-500 text-white shadow-lg shadow-indigo-900/20' 
                    : 'bg-transparent border-transparent text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 hover:border-slate-100 dark:hover:border-slate-700'}
                `}
              >
                <div className={`p-2 rounded-xl transition-colors ${selectedObjectId === obj.id ? 'bg-white/20' : 'bg-slate-100 dark:bg-slate-800'}`}>
                   {getObjectIcon(obj.type)}
                </div>
                <div className="flex-1 min-w-0">
                   <div className="font-bold text-xs truncate">{obj.name}</div>
                   <div className={`text-[9px] font-black uppercase tracking-tighter mt-0.5 ${selectedObjectId === obj.id ? 'text-indigo-200' : 'text-slate-400'}`}>
                      {obj.schema} • {obj.type}
                   </div>
                </div>
                <ChevronRight className={`w-4 h-4 transition-transform ${selectedObjectId === obj.id ? 'translate-x-1 opacity-100' : 'opacity-0'}`} />
              </button>
           ))}
        </div>
      </div>

      {/* Área de Visualização do DDL */}
      <div className="flex-1 flex flex-col bg-slate-900 rounded-[2.5rem] shadow-2xl border border-slate-800 overflow-hidden relative group">
         {selectedObject ? (
            <>
               <div className="px-8 py-5 border-b border-white/5 bg-white/5 backdrop-blur-md flex justify-between items-center shrink-0">
                  <div className="flex items-center gap-4">
                     <div className="p-3 bg-indigo-500/20 rounded-2xl">
                        {getObjectIcon(selectedObject.type)}
                     </div>
                     <div>
                        <div className="flex items-center gap-2">
                           <h3 className="text-lg font-black text-white tracking-tight leading-none">{selectedObject.name}</h3>
                           <span className="px-2 py-0.5 bg-indigo-500 text-white text-[9px] font-black rounded-full uppercase tracking-widest">{selectedObject.type}</span>
                        </div>
                        <p className="text-[10px] text-slate-400 font-bold uppercase mt-1 tracking-widest">
                           Definição SQL DDL • Localizado em {selectedObject.schema}
                           {selectedObject.tableName && ` • Referencia tabela ${selectedObject.tableName}`}
                        </p>
                     </div>
                  </div>
                  <div className="flex gap-2">
                     <button 
                        onClick={handleCopy}
                        className="flex items-center gap-2 px-4 py-2 bg-white/5 hover:bg-white/10 text-white rounded-xl text-xs font-bold transition-all border border-white/10"
                     >
                        {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                        {copied ? 'Copiado!' : 'Copiar DDL'}
                     </button>
                  </div>
               </div>

               <div className="flex-1 relative">
                  <Editor 
                    theme="vs-dark"
                    defaultLanguage="sql"
                    value={selectedObject.definition}
                    options={{
                       readOnly: true,
                       fontSize: 14,
                       fontFamily: "'Fira Code', monospace",
                       minimap: { enabled: false },
                       scrollBeyondLastLine: false,
                       automaticLayout: true,
                       padding: { top: 20, bottom: 20 },
                       lineNumbers: 'on',
                       renderLineHighlight: 'all',
                       scrollbar: { verticalScrollbarSize: 10 }
                    }}
                  />
               </div>

               {selectedObject.args && (
                  <div className="px-8 py-4 bg-black/40 border-t border-white/5 shrink-0">
                     <div className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] mb-2 flex items-center gap-2">
                        <Hash className="w-3 h-3" /> Assinatura de Argumentos
                     </div>
                     <code className="text-xs font-mono text-indigo-300 bg-indigo-500/10 px-3 py-1.5 rounded-lg border border-indigo-500/20 block">
                        ({selectedObject.args})
                        {selectedObject.returnType && <span className="text-white ml-2">RETURNS {selectedObject.returnType}</span>}
                     </code>
                  </div>
               )}
            </>
         ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-slate-600 gap-6 opacity-30">
               <div className="p-10 bg-white/5 rounded-full border border-white/5">
                  <FileCode className="w-24 h-24" />
               </div>
               <div className="text-center max-w-sm">
                  <h4 className="text-xl font-black uppercase tracking-tight mb-2 text-white">Nenhum objeto selecionado</h4>
                  <p className="text-sm font-bold leading-relaxed">Selecione uma função ou trigger na lista lateral para visualizar sua definição SQL completa e metadados de execução.</p>
               </div>
            </div>
         )}
      </div>
    </div>
  );
};

export default ObjectExplorer;
