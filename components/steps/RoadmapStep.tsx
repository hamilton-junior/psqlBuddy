
import React, { useState } from 'react';
import { 
  Rocket, Bot, Database, Eye, Zap, 
  LayoutGrid, Share2, ShieldCheck, Github, 
  Sparkles, MousePointer2, Thermometer, Map,
  Palette, History, FileText, Terminal,
  ChevronDown, ChevronUp, Pin, Code2, Layers,
  Table, Cpu, FileCode, Search, ShieldAlert,
  BarChart, GitBranch, ListMusic
} from 'lucide-react';

// Safely get the version from Vite define or fallback
declare const __APP_VERSION__: string;
const APP_VERSION = typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : '0.1.10';

interface RoadmapItem {
  title: string;
  desc: string;
  status: string;
  implementationPlan?: string[];
}

const RoadmapStep: React.FC = () => {
  const [expandedItem, setExpandedItem] = useState<string | null>(null);

  const toggleItem = (title: string) => {
    console.log(`[ROADMAP] Consultando detalhes técnicos de: ${title}`);
    setExpandedItem(expandedItem === title ? null : title);
  };

  const categories = [
    {
      title: "Inteligência & Consultoria DBA",
      icon: <Bot className="w-6 h-6 text-indigo-600" />,
      items: [
        { 
          title: "Auto-Indexador Sugestivo", 
          desc: "Análise de query via IA para sugerir comandos 'CREATE INDEX' baseados no uso de WHERE/JOIN.",
          status: "Planejado",
          implementationPlan: [
            "Técnica: A IA analisa o plano de execução (EXPLAIN) em busca de 'Sequential Scans' em tabelas grandes.",
            "Comportamento: Botão 'Otimizar' sugere índices específicos para as colunas filtradas.",
            "UI: Painel lateral com código SQL pronto e botão 'Executar Agora'.",
            "Segurança: Validação de existência prévia de índices para evitar duplicidade."
          ]
        },
        { 
          title: "Tradução de Dialetos", 
          desc: "Converter queries de MySQL, SQL Server ou Oracle para sintaxe otimizada do PostgreSQL.",
          status: "Em Discussão",
          implementationPlan: [
            "Técnica: Prompt Engineering especializado em tradução de sintaxe SQL (Top-K, Window Functions, etc).",
            "UI: Modal de entrada 'From/To' com seleção do dialeto de origem.",
            "Visual: Diff visual entre a query original e a convertida para Postgres.",
            "Diferencial: Sugestão automática de substituição de funções proprietárias por equivalentes nativos."
          ]
        },
        { 
          title: "Gerador de Documentação", 
          desc: "Criação de arquivos Markdown/PDF documentando todo o Schema (IA infere o contexto de negócio).",
          status: "Em Discussão",
          implementationPlan: [
            "Técnica: Extração recursiva de comentários de tabelas e metadados de relacionamentos.",
            "Inteligência: IA descreve o 'Propósito de Negócio' de cada tabela baseada no nome e dados.",
            "Exportação: Suporte a Mermaid.js para inclusão de diagramas ER automáticos.",
            "Comportamento: Geração em background para schemas com mais de 500 tabelas."
          ]
        }
      ]
    },
    {
      title: "UX & Visualização Avançada",
      icon: <Eye className="w-6 h-6 text-emerald-600" />,
      items: [
        { 
          title: "Fixar Colunas (Column Pinning)", 
          desc: "Congele colunas identificadoras à esquerda para manter o contexto enquanto navega horizontalmente em tabelas largas.",
          status: "Em Desenvolvimento",
          implementationPlan: [
            "UI: Ícone de 'Pin' sutil em cada cabeçalho de coluna da VirtualTable que alterna entre estado fixo/solto.",
            "Comportamento: Empilhamento inteligente. Ao fixar múltiplas colunas, elas se organizam da esquerda para a direita automaticamente.",
            "Visual: Sombra interna (shadow-xl) e borda de destaque na última coluna fixada para criar separação visual clara da área de scroll.",
            "Técnica: Implementação via CSS 'sticky' com 'left' dinâmico calculado pela soma das larguras (getBoundingClientRect) das colunas fixadas precedentes.",
            "Persistência: Estado salvo via LocalStorage indexado pelo nome da tabela e do schema."
          ]
        },
        { 
          title: "Builder Visual 'Canvas'", 
          desc: "Arraste e solte tabelas em uma área central para montar relacionamentos e queries visualmente.",
          status: "Em Pesquisa",
          implementationPlan: [
            "Técnica: Integração com bibliotecas de grafos (ex: React Flow) para renderização performática de nós.",
            "UI: Área de trabalho infinita com mini-mapa de navegação.",
            "Comportamento: Conexão automática ao aproximar colunas com nomes idênticos.",
            "Sync: Mudanças no Canvas refletem instantaneamente no estado do Query Builder clássico."
          ]
        },
        { 
          title: "Heatmap de Resultados", 
          desc: "Coloração condicional automática para identificar anomalias e padrões nos resultados da tabela.",
          status: "Sugestão",
          implementationPlan: [
            "Lógica: Cálculo estatístico local (Min, Max, Média) por coluna numérica.",
            "Visual: Gradientes de cores (Verde para valores baixos, Vermelho para altos) aplicados no fundo da célula.",
            "UI: Toggle rápido no cabeçalho da coluna para ativar/desativar o modo heatmap.",
            "Performance: Virtualização garante que o heatmap não trave em tabelas com milhares de linhas."
          ]
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
          status: "Planejado",
          implementationPlan: [
            "UI: Modal flutuante centralizado com busca difusa (Fuzzy Search).",
            "Integração: Atalhos para abrir 'Mapa do Schema', 'Histórico' ou focar em uma tabela específica pelo nome.",
            "Comportamento: Histórico de comandos recentes exibido ao abrir sem busca.",
            "Acessibilidade: Suporte total a navegação via teclado (Setas + Enter)."
          ]
        },
        { 
          title: "Sandbox de Fuzzing", 
          desc: "Exportar schema real mas gerar 10.000 linhas de dados fictícios para testes de carga seguros.",
          status: "Em Discussão",
          implementationPlan: [
            "Técnica: Mapeamento de tipos Postgres para geradores aleatórios contextuais (Nomes, Emails, Valores Monetários).",
            "Comportamento: Opção de inserir dados simulados em tabelas reais ou gerar arquivo SQL de 'Seed'.",
            "Segurança: Garantia de não-utilização de dados reais (Anonimização total).",
            "Diferencial: Preservação de integridade referencial (FKs simuladas)."
          ]
        },
        { 
          title: "Versionamento de Queries", 
          desc: "Histórico Git interno para salvar versões de templates SQL e restaurar alterações antigas.",
          status: "Planejado",
          implementationPlan: [
            "Persistência: Uso de IndexedDB para armazenar commits locais com comentários.",
            "Visual: Ferramenta de Diff integrada para comparar o que mudou entre a Versão 1 e Versão 2.",
            "UI: Timeline vertical na lateral do Editor SQL.",
            "Funcionalidade: Branching experimental para testar grandes refatorações de queries complexas."
          ]
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
          status: "Planejado",
          implementationPlan: [
            "UI: Sistema de abas dinâmicas estilo navegador no topo do ResultsStep.",
            "Técnica: Cada aba possui seu próprio Worker de execução e cache de resultados.",
            "Comportamento: Possibilidade de 'Renomear Aba' para organizar auditorias longas.",
            "Recurso: 'Pin Tab' para impedir o fechamento acidental de resultados importantes."
          ]
        },
        { 
          title: "Drill-Down Breadcrumbs", 
          desc: "Caminho de navegação (Clientes > Pedidos > Itens) para não se perder em auditorias profundas.",
          status: "Sugestão",
          implementationPlan: [
            "Lógica: Rastreamento do stack de modais de Drill-down abertos.",
            "UI: Trilha de migalhas interativa que permite voltar para qualquer nível da auditoria.",
            "Persistência: Cache temporário dos filtros aplicados em cada nível do Breadcrumb.",
            "Visual: Animação de transição suave ao entrar em novos níveis de dados."
          ]
        },
        { 
          title: "Report Builder", 
          desc: "Interface para exportar dashboards e tabelas em relatórios formatados compartilháveis.",
          status: "Em Discussão",
          implementationPlan: [
            "UI: Drag-and-drop de elementos do Dashboard para um canvas de folha A4.",
            "Exportação: Geração de PDF via jspdf com cabeçalho personalizado e logomarca.",
            "Comportamento: Agendamento simulado (Local) para geração periódica de relatórios.",
            "Técnica: Captura de alta resolução de gráficos Recharts via Canvas."
          ]
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
            Acompanhe a visão técnica para transformar o <span className="font-bold text-indigo-600">PSQL Buddy</span> em uma ferramenta Enterprise.
          </p>
        </div>
        
        <div className="hidden md:flex bg-white dark:bg-slate-800 p-4 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm items-center gap-4">
           <div className="text-right">
              <span className="block text-xs font-black text-slate-400 uppercase tracking-widest">Versão Atual</span>
              <span className="text-sm font-bold text-slate-700 dark:text-slate-200">v{APP_VERSION}</span>
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
                   {cat.items.map((item, iIdx) => {
                     const isExpanded = expandedItem === item.title;
                     return (
                        <div 
                           key={iIdx} 
                           onClick={() => toggleItem(item.title)}
                           className={`group bg-white dark:bg-slate-800 p-5 rounded-3xl border transition-all duration-300 relative overflow-hidden cursor-pointer
                              ${isExpanded ? 'border-indigo-500 shadow-2xl ring-1 ring-indigo-500/20' : 'border-slate-200 dark:border-slate-700 hover:border-indigo-400 dark:hover:border-indigo-500 hover:shadow-xl'}
                           `}
                        >
                           <div className={`absolute top-0 left-0 w-1.5 h-full transition-colors ${isExpanded ? 'bg-indigo-600' : 'bg-slate-100 dark:bg-slate-700 group-hover:bg-indigo-500'}`}></div>
                           
                           <div className="flex justify-between items-start mb-3">
                              <h4 className={`text-base font-black transition-colors ${isExpanded ? 'text-indigo-600 dark:text-indigo-400' : 'text-slate-800 dark:text-white group-hover:text-indigo-600 dark:group-hover:text-indigo-400'}`}>
                                 {item.title}
                              </h4>
                              <div className="flex items-center gap-2">
                                 <span className={`px-2.5 py-1 rounded-full text-[9px] font-black uppercase tracking-widest border
                                    ${item.status === 'Em Desenvolvimento' ? 'bg-emerald-50 text-emerald-600 border-emerald-200 dark:bg-emerald-950 dark:text-emerald-400' :
                                      item.status === 'Planejado' ? 'bg-indigo-50 text-indigo-600 border-indigo-100' : 
                                      item.status === 'Em Discussão' ? 'bg-cyan-50 text-cyan-600 border-cyan-100' :
                                      item.status === 'Em Pesquisa' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' :
                                      'bg-slate-50 text-slate-500 border-slate-100'}
                                 `}>
                                    {item.status}
                                 </span>
                                 {isExpanded ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
                              </div>
                           </div>
                           
                           <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed">
                              {item.desc}
                           </p>

                           {isExpanded && item.implementationPlan && (
                              <div className="mt-6 pt-6 border-t border-slate-100 dark:border-slate-700 space-y-4 animate-in fade-in slide-in-from-top-1 duration-300">
                                 <div className="flex items-center gap-2 text-xs font-black text-indigo-600 dark:text-indigo-400 uppercase tracking-[0.2em]">
                                    <Code2 className="w-4 h-4" /> Visão de Implementação
                                 </div>
                                 <div className="bg-slate-50 dark:bg-slate-900/50 rounded-2xl p-4 space-y-3">
                                    {item.implementationPlan.map((step, sIdx) => (
                                       <div key={sIdx} className="flex items-start gap-3">
                                          <div className="mt-1.5 w-1.5 h-1.5 rounded-full bg-indigo-500 shrink-0"></div>
                                          <p className="text-xs text-slate-600 dark:text-slate-300 font-medium">{step}</p>
                                       </div>
                                    ))}
                                 </div>
                              </div>
                           )}
                           
                           {!isExpanded && (
                              <div className="mt-4 pt-4 border-t border-slate-50 dark:border-slate-700/50 flex justify-between items-center opacity-0 group-hover:opacity-100 transition-opacity">
                                 <span className="text-[10px] text-slate-400 font-bold uppercase flex items-center gap-1">Clique para ver detalhes técnicos</span>
                                 <button className="text-[10px] font-black uppercase text-indigo-500 hover:underline flex items-center gap-1">
                                    Votar Sugestão <Sparkles className="w-3 h-3" />
                                 </button>
                              </div>
                           )}
                        </div>
                     );
                   })}
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
