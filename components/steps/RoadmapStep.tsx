
import React from 'react';
import { 
  Rocket, Bot, Database, Eye, Zap, 
  LayoutGrid, Share2, ShieldCheck, Github, 
  Sparkles, MousePointer2, Thermometer, Map,
  Palette, History, FileText, Terminal
} from 'lucide-react';

const RoadmapStep: React.FC = () => {
  const categories = [
    {
      title: "Inteligência & Consultoria DBA",
      icon: <Bot className="w-6 h-6 text-indigo-600" />,
      items: [
        { 
          title: "Auto-Indexador Sugestivo", 
          desc: "Análise de query via IA para sugerir comandos 'CREATE INDEX' baseados no uso de WHERE/JOIN.",
          status: "Planejado"
        },
        { 
          title: "Tradução de Dialetos", 
          desc: "Converter queries de MySQL, SQL Server ou Oracle para sintaxe otimizada do PostgreSQL.",
          status: "Em Discussão"
        },
        { 
          title: "Gerador de Documentação", 
          desc: "Criação de arquivos Markdown/PDF documentando todo o Schema (IA infere o contexto de negócio).",
          status: "Em Discussão"
        }
      ]
    },
    {
      title: "UX & Visualização Avançada",
      icon: <Eye className="w-6 h-6 text-emerald-600" />,
      items: [
        { 
          title: "Builder Visual 'Canvas'", 
          desc: "Arraste e solte tabelas em uma área central para montar relacionamentos e queries visualmente.",
          status: "Em Pesquisa"
        },
        { 
          title: "Heatmap de Resultados", 
          desc: "Coloração condicional automática para identificar anomalias e padrões nos resultados da tabela.",
          status: "Sugestão"
        },
        { 
          title: "Snapshot de Comparação", 
          desc: "Salvar o estado de uma tabela hoje para comparar com mudanças futuras no Data Diff.",
          status: "Sugestão"
        }
      ]
    },
    {
      title: "Produtividade & DevTools",
      icon: <Zap className="w-6 h-6 text-amber-600" />,
      items: [
        { 
          title: "Command Palette (Ctrl+P)", 
          desc: "Barra de comando global estilo VS Code para navegar instantaneamente entre tabelas e ferramentas.",
          status: "Planejado"
        },
        { 
          title: "Sandbox de Fuzzing", 
          desc: "Exportar schema real mas gerar 10.000 linhas de dados fictícios para testes de carga seguros.",
          status: "Em Discussão"
        },
        { 
          title: "Versionamento de Queries", 
          desc: "Histórico Git interno para salvar versões de templates SQL e restaurar alterações antigas.",
          status: "Planejado"
        }
      ]
    },
    {
      title: "Performance & Relatórios",
      icon: <Terminal className="w-6 h-6 text-rose-600" />,
      items: [
        { 
          title: "Multitasking de Resultados", 
          desc: "Abas na tela de Results para manter múltiplas queries rodando simultaneamente.",
          status: "Planejado"
        },
        { 
          title: "Drill-Down Breadcrumbs", 
          desc: "Caminho de navegação (Clientes > Pedidos > Itens) para não se perder em auditorias profundas.",
          status: "Sugestão"
        },
        { 
          title: "Report Builder", 
          desc: "Interface para exportar dashboards e tabelas em relatórios formatados compartilháveis.",
          status: "Em Discussão"
        }
      ]
    }
  ];

  return (
    <div className="flex flex-col h-full animate-in fade-in duration-500">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-black text-slate-800 dark:text-white flex items-center gap-3">
            <Rocket className="w-8 h-8 text-indigo-600 animate-bounce-slow" />
            Roadmap do Produto
          </h2>
          <p className="text-slate-500 dark:text-slate-400 mt-2 text-lg">
            Acompanhe o que está por vir para transformar o <span className="font-bold text-indigo-600">PSQL Buddy</span> em uma ferramenta Enterprise.
          </p>
        </div>
        
        <div className="hidden md:flex bg-white dark:bg-slate-800 p-4 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm items-center gap-4">
           <div className="text-right">
              <span className="block text-xs font-black text-slate-400 uppercase tracking-widest">Versão Atual</span>
              <span className="text-sm font-bold text-slate-700 dark:text-slate-200">v1.4.0-beta</span>
           </div>
           <div className="w-px h-8 bg-slate-100 dark:bg-slate-700"></div>
           <Github className="w-6 h-6 text-slate-400" />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto custom-scrollbar pr-2 pb-20">
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
           {categories.map((cat, idx) => (
             <div key={idx} className="space-y-4">
                <div className="flex items-center gap-3 px-2">
                   <div className="p-2 bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-100 dark:border-slate-700">
                      {cat.icon}
                   </div>
                   <h3 className="text-xl font-bold text-slate-700 dark:text-slate-200 uppercase tracking-tight">
                      {cat.title}
                   </h3>
                </div>

                <div className="grid grid-cols-1 gap-4">
                   {cat.items.map((item, iIdx) => (
                     <div 
                        key={iIdx} 
                        className="group bg-white dark:bg-slate-800 p-5 rounded-3xl border border-slate-200 dark:border-slate-700 hover:border-indigo-400 dark:hover:border-indigo-500 hover:shadow-xl transition-all duration-300 relative overflow-hidden"
                     >
                        <div className="absolute top-0 left-0 w-1.5 h-full bg-slate-100 dark:bg-slate-700 group-hover:bg-indigo-500 transition-colors"></div>
                        
                        <div className="flex justify-between items-start mb-3">
                           <h4 className="text-base font-black text-slate-800 dark:text-slate-100 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                              {item.title}
                           </h4>
                           <span className={`px-2.5 py-1 rounded-full text-[9px] font-black uppercase tracking-widest border
                              ${item.status === 'Planejado' ? 'bg-indigo-50 text-indigo-600 border-indigo-100' : 
                                item.status === 'Em Discussão' ? 'bg-cyan-50 text-cyan-600 border-cyan-100' :
                                item.status === 'Em Pesquisa' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' :
                                'bg-slate-50 text-slate-500 border-slate-100'}
                           `}>
                              {item.status}
                           </span>
                        </div>
                        
                        <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed">
                           {item.desc}
                        </p>
                        
                        <div className="mt-4 pt-4 border-t border-slate-50 dark:border-slate-700/50 flex justify-end opacity-0 group-hover:opacity-100 transition-opacity">
                           <button className="text-[10px] font-black uppercase text-indigo-500 hover:underline flex items-center gap-1">
                              Votar Sugestão <Sparkles className="w-3 h-3" />
                           </button>
                        </div>
                     </div>
                   ))}
                </div>
             </div>
           ))}
        </div>
      </div>

      <style>{`
        @keyframes bounce-slow {
           0%, 100% { transform: translateY(0); }
           50% { transform: translateY(-5px); }
        }
        .animate-bounce-slow {
           animation: bounce-slow 3s infinite;
        }
      `}</style>
    </div>
  );
};

export default RoadmapStep;
