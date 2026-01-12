
import React, { useState } from 'react';
import { Database, Server, ShieldCheck, Loader2, AlertTriangle, Info, FileCode, Bot, Wand2, HardDrive } from 'lucide-react';
import { DatabaseSchema, SAMPLE_SCHEMA, DbCredentials } from '../types';
import { generateSchemaFromTopic, parseSchemaFromDDL } from '../services/geminiService';
import { toast } from 'react-hot-toast';

interface ConnectModalProps {
  onClose: () => void;
  onSchemaLoaded: (schema: DatabaseSchema) => void;
}

type ConnectMode = 'real' | 'simulation' | 'ddl';

const ConnectModal: React.FC<ConnectModalProps> = ({ onClose, onSchemaLoaded }) => {
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState<ConnectMode>('real');
  
  // DB Connection State
  const [host, setHost] = useState('localhost');
  const [port, setPort] = useState('5432');
  const [user, setUser] = useState('postgres');
  const [password, setPassword] = useState('');
  const [dbName, setDbName] = useState('');
  const [description, setDescription] = useState('');
  
  // Simulation Options
  const [useOfflineSample, setUseOfflineSample] = useState(false);
  
  // DDL / File State
  const [ddlText, setDdlText] = useState('');

  const handleConnect = async (e: React.FormEvent) => {
    e.preventDefault();

    if (mode === 'real' && !dbName) {
      toast.error("Por favor, insira o nome do Banco de Dados");
      return;
    }

    setLoading(true);

    if (mode === 'simulation') {
      try {
        if (useOfflineSample) {
           const schema: DatabaseSchema = JSON.parse(JSON.stringify(SAMPLE_SCHEMA));
           await new Promise(r => setTimeout(r, 500));
           onSchemaLoaded(schema);
        } else {
           if (!dbName) {
              toast.error("Por favor, insira um nome para o banco simulado.");
              setLoading(false);
              return;
           }
           const context = description || `A database named ${dbName}`;
           const schema = await generateSchemaFromTopic(dbName, context);
           schema.name = dbName;
           schema.connectionSource = 'simulated';
           onSchemaLoaded(schema);
        }
        onClose();
      } catch (error) {
        toast.error("Falha ao gerar simulação.");
      } finally {
        setLoading(false);
      }
      return;
    }
    
    // Para Conexão Real no modal, este componente é um auxiliar. 
    // Em App.tsx, a conexão real principal é feita via ConnectionStep.
    toast.error("Para conexões reais, utilize a tela principal de Conexão.");
    setLoading(false);
  };

  const handleDdlImport = async () => {
    if (!ddlText.trim()) return;
    setLoading(true);
    try {
      const schema = await parseSchemaFromDDL(ddlText);
      if (dbName) schema.name = dbName;
      onSchemaLoaded(schema);
      toast.success("DDL importado com sucesso!");
      onClose();
    } catch (error) {
      toast.error("Falha ao processar DDL.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-sm z-50 flex items-center justify-center p-4 font-sans">
      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-2xl w-full max-w-md flex flex-col overflow-hidden border border-slate-200 dark:border-slate-700">
        
        {/* Header */}
        <div className="bg-slate-800 p-4 flex items-center gap-3 border-b border-slate-700">
          <div className="p-2 bg-indigo-500 rounded-lg">
            <Database className="w-5 h-5 text-white" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-white">Nova Conexão</h3>
            <p className="text-xs text-slate-400">Configurar Fonte de Dados</p>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-slate-200 dark:border-slate-700">
          {['real', 'simulation', 'ddl'].map(m => (
             <button
               key={m}
               onClick={() => setMode(m as any)}
               className={`flex-1 py-3 text-[10px] font-bold uppercase tracking-wide transition-colors ${mode === m ? 'text-indigo-600 border-b-2 border-indigo-600 bg-indigo-50 dark:bg-indigo-900/20' : 'text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-700'}`}
             >
                {m === 'real' ? 'Real' : m === 'simulation' ? 'Simulação' : 'DDL'}
             </button>
          ))}
        </div>

        {/* Form */}
        <div className="p-6 overflow-y-auto max-h-[80vh]">
          {mode === 'simulation' && (
             <div className="space-y-4">
               <div className="flex items-center justify-between bg-slate-50 dark:bg-slate-900/50 p-3 rounded-lg border border-slate-200 dark:border-slate-700">
                  <div className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300">
                     <HardDrive className="w-4 h-4" />
                     <span className="font-medium text-xs">Modo Offline (Exemplo)</span>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input type="checkbox" checked={useOfflineSample} onChange={(e) => setUseOfflineSample(e.target.checked)} className="sr-only peer" />
                    <div className="w-11 h-6 bg-slate-300 dark:bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
                  </label>
               </div>

               {!useOfflineSample && (
                  <>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Nome do Banco</label>
                      <input type="text" value={dbName} onChange={(e) => setDbName(e.target.value)} className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-sm outline-none focus:ring-2 focus:ring-indigo-500" placeholder="ex: pizzaria_db" />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Descrição</label>
                      <textarea value={description} onChange={(e) => setDescription(e.target.value)} className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-sm outline-none focus:ring-2 focus:ring-indigo-500 resize-none h-24" placeholder="Ex: E-commerce de moda..." />
                    </div>
                  </>
               )}
             </div>
          )}

          {mode === 'ddl' && (
             <div className="space-y-4">
                <div>
                   <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Nome</label>
                   <input type="text" value={dbName} onChange={(e) => setDbName(e.target.value)} className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-sm outline-none focus:ring-2 focus:ring-indigo-500" />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">SQL DDL</label>
                  <textarea value={ddlText} onChange={(e) => setDdlText(e.target.value)} placeholder="CREATE TABLE..." className="w-full h-40 p-3 text-xs font-mono border border-slate-200 dark:border-slate-700 dark:bg-slate-900 rounded outline-none focus:ring-2 focus:ring-indigo-500" />
                </div>
             </div>
          )}

          {mode === 'real' && (
             <div className="p-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl text-amber-700 dark:text-amber-300 text-xs">
                <AlertTriangle className="w-4 h-4 mb-2" />
                Para conexões reais, utilize a tela principal de configurações de conexão para gerenciar credenciais e SSL.
             </div>
          )}

          <div className="pt-6 flex gap-3">
             <button onClick={onClose} className="flex-1 py-2.5 text-slate-500 font-bold rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700 text-sm">Fechar</button>
             {mode !== 'real' && (
                <button 
                  onClick={mode === 'ddl' ? handleDdlImport : handleConnect}
                  disabled={loading}
                  className="flex-[2] py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-lg transition-all flex items-center justify-center gap-2 text-sm"
                >
                   {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Confirmar'}
                </button>
             )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ConnectModal;
