import React, { useState, useEffect } from 'react';
import { DatabaseSchema, DbCredentials, AppSettings, SAMPLE_SCHEMA } from '../../types';
import { connectToDatabase } from '../../services/dbService';
import { generateSchemaFromTopic } from '../../services/geminiService';
import { Server, Shield, Info, Loader2, Database, AlertCircle, Bot, Wand2, HardDrive, Save, Trash2, Bookmark, Tag } from 'lucide-react';
import Dialog from '../common/Dialog';

interface ConnectionStepProps {
  onSchemaLoaded: (schema: DatabaseSchema, credentials: DbCredentials) => void;
  settings: AppSettings;
}

type ConnectMode = 'real' | 'simulation';

interface SavedConnection {
  id: string;
  name: string;
  host: string;
  port: string;
  user: string;
  database: string;
}

declare const __APP_VERSION__: string;
const CURRENT_APP_VERSION = typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : '0.1.10';

const formatVersionDisplay = (v: string): string => {
  const parts = v.split('.');
  if (parts.length !== 3) return v;
  return `${parts[0]}.${parts[1].padStart(2, '0')}.${parts[2].padStart(2, '0')}`;
};

const ConnectionStep: React.FC<ConnectionStepProps> = ({ onSchemaLoaded, settings }) => {
  const [mode, setMode] = useState<ConnectMode>('real');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  
  const [host, setHost] = useState(settings.defaultDbHost);
  const [port, setPort] = useState(settings.defaultDbPort);
  const [user, setUser] = useState(settings.defaultDbUser);
  const [password, setPassword] = useState('');
  const [dbName, setDbName] = useState(settings.defaultDbName);
  
  const [savedConnections, setSavedConnections] = useState<SavedConnection[]>([]);
  const [selectedProfileId, setSelectedProfileId] = useState<string>('');

  const [dialogConfig, setDialogConfig] = useState<{ 
     isOpen: boolean, 
     type: 'confirm' | 'danger' | 'prompt', 
     title: string, 
     message: string, 
     placeholder?: string,
     defaultValue?: string,
     onConfirm: (val?: string) => void 
  } | null>(null);

  const [simName, setSimName] = useState('');
  const [simDescription, setSimDescription] = useState('');
  const [useOfflineSample, setUseOfflineSample] = useState(false);
  
  useEffect(() => {
    try {
      const saved = localStorage.getItem('psqlBuddy-saved-connections');
      if (saved) setSavedConnections(JSON.parse(saved));
    } catch (e) { console.error("Failed to load saved connections", e); }
  }, []);

  useEffect(() => {
    if (!selectedProfileId) {
        setHost(settings.defaultDbHost);
        setPort(settings.defaultDbPort);
        setUser(settings.defaultDbUser);
        setDbName(settings.defaultDbName);
    }
  }, [settings, selectedProfileId]);

  const handleSaveProfile = () => {
    if (!dbName || !host || !user) {
        setError("Preencha Host, Usuário e Nome do Banco para salvar.");
        return;
    }
    
    setDialogConfig({
      isOpen: true,
      type: 'prompt',
      title: 'Novo Perfil de Conexão',
      message: 'Defina um nome amigável para identificar este servidor.',
      placeholder: 'Servidor Produção / Localhost',
      defaultValue: dbName,
      onConfirm: (name) => {
         if (!name) return;
         const newProfile: SavedConnection = {
            id: crypto.randomUUID(),
            name,
            host,
            port,
            user,
            database: dbName
         };
         const updatedList = [...savedConnections, newProfile];
         setSavedConnections(updatedList);
         localStorage.setItem('psqlBuddy-saved-connections', JSON.stringify(updatedList));
         setSelectedProfileId(newProfile.id);
      }
    });
  };

  const handleDeleteProfile = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    setDialogConfig({
      isOpen: true,
      type: 'danger',
      title: 'Excluir Perfil',
      message: 'Deseja remover esta conexão salva? Esta ação é permanente.',
      onConfirm: () => {
         const updatedList = savedConnections.filter(c => c.id !== id);
         setSavedConnections(updatedList);
         localStorage.setItem('psqlBuddy-saved-connections', JSON.stringify(updatedList));
         if (selectedProfileId === id) setSelectedProfileId('');
      }
    });
  };

  const handleSelectProfile = (id: string) => {
    setSelectedProfileId(id);
    if (!id) return;
    const profile = savedConnections.find(c => c.id === id);
    if (profile) {
        setHost(profile.host);
        setPort(profile.port);
        setUser(profile.user);
        setDbName(profile.database);
        setPassword('');
    }
  };

  const handleConnect = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      if (mode === 'real') {
        if (!dbName) throw new Error("Nome do banco é obrigatório");
        const finalPassword = password || 'postgres';
        const creds: DbCredentials = { host, port, user, password: finalPassword, database: dbName };
        const schema = await connectToDatabase(creds);
        onSchemaLoaded(schema, creds);
      } else {
        if (!settings.enableAiGeneration || useOfflineSample) {
           const schema: DatabaseSchema = JSON.parse(JSON.stringify(SAMPLE_SCHEMA));
           const fakeCreds: DbCredentials = { host: 'simulated', port: '0000', user: 'offline_user', database: schema.name };
           await new Promise(resolve => setTimeout(resolve, 600));
           onSchemaLoaded(schema, fakeCreds);
           return;
        }
        if (!simName) throw new Error("Nome para a simulação é obrigatório");
        const context = simDescription || `A database named ${simName}`;
        const schema = await generateSchemaFromTopic(simName, context);
        schema.name = simName;
        const fakeCreds: DbCredentials = { host: 'simulated', port: '0000', user: 'ai_user', database: simName };
        onSchemaLoaded(schema, fakeCreds);
      }
    } catch (err: any) {
      setError(err.message === "QUOTA_ERROR" ? "Cota da API da IA excedida." : err.message || "Falha na conexão.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto">
      {dialogConfig && (
        <Dialog 
          isOpen={dialogConfig.isOpen}
          type={dialogConfig.type}
          title={dialogConfig.title}
          message={dialogConfig.message}
          placeholder={dialogConfig.placeholder}
          defaultValue={dialogConfig.defaultValue}
          onConfirm={dialogConfig.onConfirm}
          onClose={() => setDialogConfig(null)}
        />
      )}

      <div className="mb-8 flex justify-between items-start">
        <div>
          <h2 className="text-2xl font-bold text-slate-800 dark:text-white flex items-center gap-2">
            {mode === 'real' ? <Server className="w-6 h-6 text-indigo-600" /> : <Bot className="w-6 h-6 text-indigo-600" />}
            {mode === 'real' ? 'Conexão ao Banco de Dados' : 'Simulação de Banco'}
          </h2>
          <p className="text-slate-500 dark:text-slate-400 mt-2">
            {mode === 'real' 
              ? 'Conecte-se a instância de seu Banco de Dados PostgreSQL local.' 
              : 'Gere ou carregue um banco de dados virtual para testar queries.'}
          </p>
        </div>
        <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-3 py-1 rounded-full flex items-center gap-2 shadow-sm">
           <Tag className="w-3.5 h-3.5 text-indigo-500" />
           <span className="text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest">{formatVersionDisplay(CURRENT_APP_VERSION)}</span>
        </div>
      </div>

      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden">
        {/* Tabs */}
        <div className="flex border-b border-slate-200 dark:border-slate-700">
          <button
            onClick={() => setMode('real')}
            className={`flex-1 py-4 text-sm font-bold uppercase tracking-wide transition-colors ${mode === 'real' ? 'text-indigo-600 border-b-2 border-indigo-600 bg-indigo-50 dark:bg-indigo-900/20' : 'text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700'}`}
          >
             <div className="flex items-center justify-center gap-2">
                <Server className="w-4 h-4" /> Conexão Real
             </div>
          </button>
          <button
            onClick={() => setMode('simulation')}
            className={`flex-1 py-4 text-sm font-bold uppercase tracking-wide transition-colors ${mode === 'simulation' ? 'text-indigo-600 border-b-2 border-indigo-600 bg-indigo-50 dark:bg-indigo-900/20' : 'text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700'}`}
          >
             <div className="flex items-center justify-center gap-2">
                {settings.enableAiGeneration ? <Bot className="w-4 h-4" /> : <HardDrive className="w-4 h-4" />}
                {settings.enableAiGeneration ? 'Modo Simulação (IA)' : 'Modo Simulação (Offline)'}
             </div>
          </button>
        </div>

        <form onSubmit={handleConnect} className="p-8 space-y-6">
          {mode === 'real' ? (
            <div className="grid grid-cols-2 gap-6 animate-in fade-in slide-in-from-right-4 duration-300">
              <div className="col-span-2">
                 <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-1">
                    <Bookmark className="w-3.5 h-3.5" /> Conexões Salvas
                 </label>
                 <div className="flex gap-2">
                     <select 
                        value={selectedProfileId} 
                        onChange={(e) => handleSelectProfile(e.target.value)}
                        className="flex-1 px-4 py-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-700 dark:text-slate-200 focus:ring-2 focus:ring-indigo-500 text-sm outline-none"
                     >
                        <option value="">-- Nova Conexão --</option>
                        {savedConnections.map(c => (
                           <option key={c.id} value={c.id}>{c.name} ({c.user}@{c.host}/{c.database})</option>
                        ))}
                     </select>
                     {selectedProfileId && (
                        <button 
                           type="button"
                           onClick={(e) => handleDeleteProfile(e, selectedProfileId)}
                           className="p-2.5 text-slate-400 hover:text-red-500 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl transition-colors"
                           title="Excluir conexão salva"
                        >
                           <Trash2 className="w-4 h-4" />
                        </button>
                     )}
                 </div>
              </div>

              <div className="col-span-2 border-t border-slate-100 dark:border-slate-700 my-1"></div>

              <div className="col-span-2 sm:col-span-1">
                <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">Host</label>
                <input 
                  type="text" 
                  value={host} 
                  onChange={e => setHost(e.target.value)}
                  className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-800 dark:text-white focus:ring-2 focus:ring-indigo-500 transition-all"
                  placeholder="localhost" 
                />
              </div>
              <div className="col-span-2 sm:col-span-1">
                <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">Usuário</label>
                <input 
                  type="text" 
                  value={user} 
                  onChange={e => setUser(e.target.value)}
                  className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-800 dark:text-white focus:ring-2 focus:ring-indigo-500 transition-all"
                  placeholder="postgres" 
                />
              </div>
              <div className="col-span-2">
                <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">Nome do Banco de Dados</label>
                <div className="relative">
                  <Database className="absolute left-4 top-3.5 w-5 h-5 text-slate-400" />
                  <input 
                    type="text" 
                    value={dbName} 
                    onChange={e => setDbName(e.target.value)}
                    className="w-full pl-11 pr-4 py-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-800 dark:text-white focus:ring-2 focus:ring-indigo-500 transition-all"
                    placeholder="ex: ecommerce, analytics_db"
                    required 
                  />
                </div>
              </div>
              <div className="col-span-2 sm:col-span-1">
                <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">Senha</label>
                <input 
                  type="password" 
                  value={password} 
                  onChange={e => setPassword(e.target.value)}
                  className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-800 dark:text-white focus:ring-2 focus:ring-indigo-500 transition-all"
                  placeholder="••••••••" 
                />
                <p className="text-[10px] text-slate-400 mt-1 flex items-center gap-1">
                  <Shield className="w-3 h-3" /> Nunca salva | Senha vazia = 'postgres'
                </p>
              </div>
              <div className="col-span-2 sm:col-span-1">
                <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">Porta</label>
                <input 
                  type="number" 
                  value={port} 
                  onChange={e => setPort(e.target.value)}
                  className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-800 dark:text-white focus:ring-2 focus:ring-indigo-500 transition-all"
                  placeholder="5432" 
                />
              </div>

              <div className="col-span-2 flex justify-end">
                 <button 
                   type="button" 
                   onClick={handleSaveProfile}
                   className="text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1.5"
                 >
                    <Save className="w-3.5 h-3.5" /> Salvar Perfil (Sem Senha)
                 </button>
              </div>
            </div>
          ) : (
            <div className="space-y-6 animate-in fade-in slide-in-from-left-4 duration-300">
              {settings.enableAiGeneration && (
                  <div className="flex items-center justify-between bg-indigo-50/50 dark:bg-indigo-900/10 p-3 rounded-xl border border-indigo-100 dark:border-indigo-900/30">
                     <div className="flex items-center gap-3 text-sm text-slate-700 dark:text-slate-300">
                        <HardDrive className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                        <div>
                           <span className="font-bold block">Modo Offline (Exemplo)</span>
                           <span className="text-xs text-slate-500">Usar base pronta sem IA</span>
                        </div>
                     </div>
                     <label className="relative inline-flex items-center cursor-pointer">
                       <input 
                         type="checkbox" 
                         checked={useOfflineSample} 
                         onChange={(e) => setUseOfflineSample(e.target.checked)} 
                         className="sr-only peer" 
                       />
                       <div className="w-11 h-6 bg-slate-300 dark:bg-slate-700 rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
                     </label>
                  </div>
              )}

              {useOfflineSample || !settings.enableAiGeneration ? (
                <div className="animate-in fade-in duration-300">
                   <div className="p-6 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl flex flex-col items-center text-center gap-4">
                      <div className="w-16 h-16 bg-white dark:bg-slate-800 rounded-full flex items-center justify-center shadow-sm text-slate-400">
                         <HardDrive className="w-8 h-8" />
                      </div>
                      <div>
                        <h4 className="font-bold text-slate-700 dark:text-white text-lg">Modo Simulação Offline</h4>
                        <p className="text-slate-500 dark:text-slate-400 text-sm mt-1 max-w-sm mx-auto">
                           Carregaremos um banco de dados de exemplo padrão (E-Commerce) instantaneamente para você testar.
                        </p>
                      </div>
                   </div>
                </div>
              ) : (
                <div className="space-y-6 animate-in fade-in duration-300">
                  <div className="p-4 bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-100 dark:border-indigo-800 rounded-xl flex gap-3 text-indigo-900 dark:text-indigo-200 text-sm">
                    <Bot className="w-5 h-5 shrink-0 mt-0.5" />
                    <p>A IA pode criar uma <strong>estrutura simulada</strong> baseada na sua ideia.</p>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">Nome do Projeto / Banco</label>
                    <div className="relative">
                      <Database className="absolute left-4 top-3.5 w-5 h-5 text-slate-400" />
                      <input 
                        type="text" 
                        value={simName} 
                        onChange={e => setSimName(e.target.value)}
                        className="w-full pl-11 pr-4 py-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-800 dark:text-white focus:ring-2 focus:ring-indigo-500 transition-all"
                        placeholder="ex: startup_saas, pizzaria_delivery, biblioteca"
                        required 
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">Descrição do Negócio (Contexto)</label>
                    <textarea 
                      value={simDescription} 
                      onChange={e => setSimDescription(e.target.value)}
                      className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-800 dark:text-white focus:ring-2 focus:ring-indigo-500 h-32 resize-none"
                      placeholder="Ex: Um sistema de delivery que tem clientes, entregadores, pedidos e itens de pedido..."
                      required
                    />
                  </div>
                </div>
              )}
            </div>
          )}

          {error && (
            <div className="bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 p-3 rounded-lg text-sm flex items-center gap-2 border border-red-100 dark:border-red-800">
              <AlertCircle className="w-4 h-4 shrink-0" />
              {error}
            </div>
          )}

          <div className="pt-6 border-t border-slate-100 dark:border-slate-700 flex items-center justify-between">
            <div className="flex items-center gap-2 text-slate-400 text-xs">
                {mode === 'real' ? (
                  <><Shield className="w-4 h-4" /><span>Credenciais salvas apenas localmente.</span></>
                ) : (
                  <><Info className="w-4 h-4" /><span>Nenhum dado real será armazenado.</span></>
                )}
            </div>
            <div className="flex gap-3">
              <button 
                type="submit" 
                disabled={loading}
                className="px-8 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-lg shadow-lg transition-all flex items-center gap-2"
              >
                {loading ? (
                  <><Loader2 className="w-4 h-4 animate-spin" />{mode === 'real' ? 'Conectando...' : 'Carregando...'}</>
                ) : (
                  mode === 'real' ? 'Conectar ao BD Local' : (
                    <>{(!settings.enableAiGeneration || useOfflineSample) ? <HardDrive className="w-4 h-4" /> : <Wand2 className="w-4 h-4" />}
                       {(!settings.enableAiGeneration || useOfflineSample) ? 'Carregar Exemplo' : 'Criar Simulação'}
                    </>
                  )
                )}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ConnectionStep;