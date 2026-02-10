import React, { useMemo, useState, useEffect, useRef } from 'react';
import { DatabaseSchema, BuilderState } from '../../types';
import { 
  Database, Link2, Filter, Calculator, ListOrdered, 
  Table2, Braces, Terminal, 
  Sparkles, Info, Activity, Zap, X, ChevronUp, ChevronDown
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface VisualQueryFlowStepProps {
  schema: DatabaseSchema;
  state: BuilderState;
}

const FlowNode = React.forwardRef<HTMLDivElement, { 
  id: string;
  title: string; 
  icon: React.ReactNode; 
  colorClass: string; 
  children: React.ReactNode;
  isActive?: boolean;
  onHover: (id: string | null) => void;
  isHighlighted?: boolean;
}>(({ id, title, icon, colorClass, children, isActive = true, onHover, isHighlighted }, ref) => {
  const colors: Record<string, string> = {
    indigo: 'border-indigo-50 text-indigo-600 bg-indigo-50 dark:bg-indigo-900/30',
    cyan: 'border-cyan-500 text-cyan-600 bg-cyan-50 dark:bg-cyan-900/30',
    rose: 'border-rose-500 text-rose-600 bg-rose-50 dark:bg-rose-900/30',
    amber: 'border-amber-500 text-amber-600 bg-amber-50 dark:bg-amber-900/30',
    emerald: 'border-emerald-500 text-emerald-600 bg-emerald-50 dark:bg-emerald-900/30',
  };

  return (
    <motion.div 
      ref={ref}
      initial={{ opacity: 0, y: 15 }}
      animate={{ 
        opacity: isActive ? 1 : 0.2, 
        scale: isHighlighted ? 1.02 : 1,
      }}
      onMouseEnter={() => onHover(id)}
      onMouseLeave={() => onHover(null)}
      className="relative flex flex-col w-64 shrink-0"
    >
      <div className={`p-4 rounded-[1.8rem] border-2 shadow-xl bg-white dark:bg-slate-800 transition-all duration-500
        ${isActive ? `border-slate-200 dark:border-slate-700` : 'border-slate-100 dark:border-slate-800'}
        ${isHighlighted ? `ring-4 ring-indigo-500/10 border-indigo-500 shadow-indigo-500/30 z-20` : ''}
      `}>
         <div className="flex items-center gap-3 mb-3">
            <div className={`p-2 rounded-xl transition-colors ${isHighlighted ? 'bg-indigo-600 text-white' : colors[colorClass] || colors.indigo}`}>
               {/* Fix: Validate element and cast to ReactElement<any> to allow 'size' prop for Lucide icons */}
               {React.isValidElement(icon) ? React.cloneElement(icon as React.ReactElement<any>, { size: 18 }) : icon}
            </div>
            <h4 className="font-black text-[11px] uppercase tracking-widest text-slate-800 dark:text-white truncate">{title}</h4>
         </div>
         <div className="space-y-2 min-h-[80px] max-h-[180px] overflow-y-auto custom-scrollbar pr-1.5">
            {children}
         </div>
      </div>
    </motion.div>
  );
});

const VisualQueryFlowStep: React.FC<VisualQueryFlowStepProps> = ({ schema, state }) => {
  const [hoveredNode, setHoveredNode] = useState<string | null>(null);
  const [coords, setCoords] = useState<Record<string, { x: number, y: number }>>({});
  const [showFooterInfo, setShowFooterInfo] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  
  const nodeRefs = {
    sources: useRef<HTMLDivElement>(null),
    joins: useRef<HTMLDivElement>(null),
    filters: useRef<HTMLDivElement>(null),
    aggregations: useRef<HTMLDivElement>(null),
    calculated: useRef<HTMLDivElement>(null),
    projection: useRef<HTMLDivElement>(null),
  };

  const updateCoords = () => {
    if (!containerRef.current) return;
    const containerRect = containerRef.current.getBoundingClientRect();
    const newCoords: Record<string, { x: number, y: number }> = {};

    Object.entries(nodeRefs).forEach(([id, ref]) => {
      if (ref.current) {
        const rect = ref.current.getBoundingClientRect();
        newCoords[id] = {
          x: rect.left - containerRect.left + rect.width / 2,
          y: rect.top - containerRect.top + rect.height / 2
        };
      }
    });
    setCoords(newCoords);
  };

  useEffect(() => {
    updateCoords();
    window.addEventListener('resize', updateCoords);
    const timer = setTimeout(updateCoords, 800); 
    return () => {
      window.removeEventListener('resize', updateCoords);
      clearTimeout(timer);
    };
  }, [state]);

  const hasTables = state.selectedTables.length > 0;
  const hasJoins = state.joins.length > 0;
  const hasFilters = state.filters.length > 0;
  const hasAggs = Object.values(state.aggregations).some(a => a !== 'NONE') || state.groupBy.length > 0;
  const hasCalculated = state.calculatedColumns && state.calculatedColumns.length > 0;

  const nodeOrder = ['sources', 'joins', 'filters', 'aggregations', 'calculated', 'projection'];
  
  const activeNodes = useMemo(() => {
    const active = new Set(['projection']);
    if (hasTables) active.add('sources');
    if (hasJoins) active.add('joins');
    if (hasFilters) active.add('filters');
    if (hasAggs) active.add('aggregations');
    if (hasCalculated) active.add('calculated');
    return active;
  }, [hasTables, hasJoins, hasFilters, hasAggs, hasCalculated]);

  const getTransformationText = (id: string) => {
    switch (id) {
      case 'sources': return "Mapeamento";
      case 'joins': return `Merging ${state.joins.length} tabelas`;
      case 'filters': return `Poda de registros`;
      case 'aggregations': return `Agregação`;
      case 'calculated': return `Cálculo escalar`;
      default: return "Entrega final";
    }
  };

  return (
    <div className="h-full flex flex-col overflow-hidden animate-in fade-in duration-700 bg-slate-50/50 dark:bg-slate-950/20">
      <div className="p-6 pb-0 shrink-0">
        <div className="flex items-center justify-between">
           <div>
              <h2 className="text-2xl font-black text-slate-800 dark:text-white flex items-center gap-3 tracking-tighter">
                <Activity className="w-7 h-7 text-indigo-600 animate-pulse" />
                Pipeline de Execução
              </h2>
              <p className="text-slate-500 dark:text-slate-400 text-sm font-medium mt-1">
                Acompanhe o trajeto lógico dos seus dados.
              </p>
           </div>
           {/* Badge removida conforme solicitado */}
        </div>
      </div>

      <div ref={containerRef} className="flex-1 relative overflow-y-auto custom-scrollbar p-10">
        
        {/* Camada SVG de Conexão Zig-Zag */}
        <svg className="absolute inset-0 pointer-events-none w-full h-full" style={{ zIndex: 0, minHeight: '800px' }}>
          <defs>
            <filter id="ultra-glow" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation="8" result="blur" />
              <feComposite in="SourceGraphic" in2="blur" operator="over" />
            </filter>
            <linearGradient id="path-grad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#6366f1" />
              <stop offset="100%" stopColor="#a855f7" />
            </linearGradient>
          </defs>

          {nodeOrder.map((id, idx) => {
            if (idx === nodeOrder.length - 1) return null;
            const nextId = nodeOrder[idx + 1];
            const p1 = coords[id];
            const p2 = coords[nextId];

            if (!p1 || !p2) return null;

            const isPathActive = activeNodes.has(id) && activeNodes.has(nextId);
            const isHovered = hoveredNode === id || hoveredNode === nextId;
            
            const midY = p1.y + (p2.y - p1.y) / 2;
            const pathD = `M ${p1.x} ${p1.y} C ${p1.x} ${midY}, ${p2.x} ${midY}, ${p2.x} ${p2.y}`;

            return (
              <g key={`link-${id}`}>
                <path d={pathD} stroke={isPathActive ? "#818cf8" : "#cbd5e1"} strokeWidth={isHovered ? 6 : 3} fill="none" opacity={isPathActive ? 0.3 : 0.05} />
                
                {isPathActive && (
                  <motion.path
                    initial={{ pathLength: 0 }}
                    animate={{ pathLength: 1 }}
                    d={pathD}
                    stroke="url(#path-grad)"
                    strokeWidth={isHovered ? 4 : 2}
                    fill="none"
                    filter={isHovered ? "url(#ultra-glow)" : ""}
                    className="transition-all duration-500"
                  />
                )}

                {isPathActive && (
                  <motion.path
                    d={pathD}
                    stroke="white"
                    strokeWidth={isHovered ? 4 : 2}
                    fill="none"
                    strokeDasharray="4, 60"
                    animate={{ strokeDashoffset: [0, -120] }}
                    transition={{ duration: isHovered ? 0.6 : 1.2, repeat: Infinity, ease: "linear" }}
                  />
                )}

                {isHovered && isPathActive && (
                  <foreignObject x={(p1.x + p2.x) / 2 - 60} y={midY - 12} width="120" height="24">
                    <div className="flex items-center justify-center">
                       <div className="bg-indigo-600 text-white text-[8px] font-black uppercase px-2 py-1 rounded-full shadow-lg border border-indigo-400 flex items-center gap-1.5">
                          <Zap size={8} fill="currentColor" /> {getTransformationText(id)}
                       </div>
                    </div>
                  </foreignObject>
                )}
              </g>
            );
          })}
        </svg>

        {/* Grade de Blocos em Zig-Zag com tamanhos reduzidos */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-16 gap-y-20 relative z-10 max-w-4xl mx-auto">
          
          <FlowNode 
            id="sources" ref={nodeRefs.sources} title="Origens (FROM)" 
            icon={<Database />} colorClass="indigo" isActive={hasTables}
            onHover={setHoveredNode} isHighlighted={hoveredNode === 'sources'}
          >
             {state.selectedTables.length > 0 ? state.selectedTables.map(t => (
                <div key={t} className="flex items-center gap-3 px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl shadow-sm">
                   <Table2 size={14} className="text-indigo-500 shrink-0" />
                   <span className="text-xs font-bold text-slate-700 dark:text-slate-300 truncate">{t}</span>
                </div>
             )) : <p className="text-[10px] text-slate-400 italic p-3 text-center border-2 border-dashed rounded-2xl uppercase font-black opacity-30">Sem definição</p>}
          </FlowNode>

          <FlowNode 
            id="joins" ref={nodeRefs.joins} title="Junções (JOIN)" 
            icon={<Link2 />} colorClass="cyan" isActive={hasJoins}
            onHover={setHoveredNode} isHighlighted={hoveredNode === 'joins'}
          >
             {state.joins.length > 0 ? state.joins.map(j => (
                <div key={j.id} className="p-3 bg-cyan-50/50 dark:bg-cyan-900/10 border border-cyan-100 dark:border-cyan-800 rounded-2xl">
                   <div className="flex items-center justify-between mb-2">
                      <span className="text-[9px] font-black text-white bg-cyan-600 px-2 py-0.5 rounded-full uppercase">{j.type}</span>
                      <span className="text-[9px] text-slate-500 font-mono font-bold truncate">→ {j.toTable.split('.').pop()}</span>
                   </div>
                   <div className="text-[10px] font-mono font-bold text-slate-600 dark:text-slate-300 flex items-center justify-center gap-2 bg-white dark:bg-slate-950 p-1.5 rounded-xl border border-white/10 shadow-inner">
                      <span className="truncate">{j.fromColumn}</span>
                      <span className="text-cyan-500">==</span>
                      <span className="truncate">{j.toColumn}</span>
                   </div>
                </div>
             )) : <div className="text-center p-6 opacity-20"><Info size={32} className="mx-auto" /></div>}
          </FlowNode>

          <div className="order-4 md:order-3">
            <FlowNode 
              id="aggregations" ref={nodeRefs.aggregations} title="Agrupamento" 
              icon={<ListOrdered />} colorClass="amber" isActive={hasAggs}
              onHover={setHoveredNode} isHighlighted={hoveredNode === 'aggregations'}
            >
               {hasAggs ? (
                  <div className="space-y-3">
                     {state.groupBy.length > 0 && (
                        <div className="p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-2xl shadow-inner">
                           <span className="text-[9px] font-black text-amber-700 dark:text-amber-400 uppercase tracking-widest block mb-1.5">Grão:</span>
                           <div className="flex flex-wrap gap-1.5">
                              {state.groupBy.map(g => <span key={g} className="text-[10px] bg-white dark:bg-slate-900 px-2 py-0.5 rounded-xl border border-amber-200 font-bold">BY {g.split('.').pop()}</span>)}
                           </div>
                        </div>
                     )}
                     {Object.entries(state.aggregations).map(([col, func]) => func !== 'NONE' && (
                        <div key={col} className="flex items-center gap-3 px-3 py-2 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl shadow-md">
                           <Calculator size={16} className="text-amber-500" />
                           <div className="flex flex-col min-w-0">
                              <span className="text-xs font-black text-slate-800 dark:text-slate-200 uppercase leading-none mb-0.5">{func}</span>
                              <span className="text-[9px] text-slate-400 font-mono truncate">{col.split('.').pop()}</span>
                           </div>
                        </div>
                     ))}
                  </div>
               ) : <div className="text-center p-6 opacity-20"><Info size={32} className="mx-auto" /></div>}
            </FlowNode>
          </div>

          <div className="order-3 md:order-4">
            <FlowNode 
              id="filters" ref={nodeRefs.filters} title="Restrições (WHERE)" 
              icon={<Filter />} colorClass="rose" isActive={hasFilters}
              onHover={setHoveredNode} isHighlighted={hoveredNode === 'filters'}
            >
               {state.filters.length > 0 ? state.filters.map(f => {
                  const isUnary = f.operator === 'IS NULL' || f.operator === 'IS NOT NULL';
                  return (
                    <div key={f.id} className="flex flex-col gap-1 p-3 bg-rose-50/50 dark:bg-rose-900/10 border border-rose-100 dark:border-rose-800 rounded-2xl">
                       <div className="flex items-center gap-2">
                          <span className="text-[10px] font-mono text-rose-600 dark:text-rose-400 font-black uppercase">{f.column.split('.').pop()}</span>
                          <span className="text-xs font-black text-rose-700 dark:text-rose-300 px-1.5 py-0.5 bg-white dark:bg-slate-900 rounded-lg">{f.operator}</span>
                       </div>
                       {!isUnary && (
                          <span className="text-[10px] text-slate-500 italic font-bold ml-4">"{f.value}"</span>
                       )}
                    </div>
                  );
               }) : <p className="text-[10px] text-slate-400 font-black uppercase text-center p-6 opacity-40 leading-relaxed border-2 border-dashed rounded-2xl">Dataset Sem Poda</p>}
            </FlowNode>
          </div>

          <FlowNode 
            id="calculated" ref={nodeRefs.calculated} title="Cálculos" 
            icon={<Braces />} colorClass="emerald" isActive={hasCalculated}
            onHover={setHoveredNode} isHighlighted={hoveredNode === 'calculated'}
          >
             {hasCalculated ? state.calculatedColumns?.map(calc => (
                <div key={calc.id} className="p-3 bg-emerald-50 dark:bg-emerald-900/10 border border-emerald-100 dark:border-emerald-800 rounded-2xl group transition-all">
                   <div className="text-[10px] font-black text-emerald-600 truncate mb-1.5 uppercase tracking-tighter">AS {calc.alias}</div>
                   <div className="bg-white/90 dark:bg-slate-950 p-2 rounded-xl border border-emerald-100 dark:border-emerald-800 shadow-inner">
                      <code className="text-[10px] font-mono text-emerald-800 dark:text-emerald-300 leading-tight block break-all">{calc.expression}</code>
                   </div>
                </div>
             )) : <div className="text-center p-6 opacity-20"><Info size={32} className="mx-auto" /></div>}
          </FlowNode>

          <FlowNode 
            id="projection" ref={nodeRefs.projection} title="Saída (SELECT)" 
            icon={<Terminal />} colorClass="indigo"
            onHover={setHoveredNode} isHighlighted={hoveredNode === 'projection'}
          >
             <div className="p-6 bg-slate-900 rounded-[2.5rem] border-4 border-slate-800 shadow-[0_20px_40px_rgba(0,0,0,0.4)] overflow-hidden relative group">
                <div className="absolute -top-10 -right-10 w-32 h-32 bg-indigo-500/10 rounded-full blur-3xl group-hover:scale-150 transition-transform duration-1000"></div>
                <div className="flex items-center gap-3 mb-6 relative z-10">
                   <div className="w-3 h-3 rounded-full bg-emerald-500 shadow-[0_0_15px_rgba(16,185,129,0.8)] animate-pulse"></div>
                   <span className="text-[10px] font-black text-emerald-400 uppercase tracking-[0.2em]">Buffer Ready</span>
                </div>
                <div className="space-y-4 relative z-10">
                   <div className="flex justify-between items-center bg-white/5 p-3 rounded-2xl border border-white/5 backdrop-blur-sm">
                      <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Colunas:</span>
                      <span className="text-white font-mono text-xl font-black">{state.selectedColumns.length || '*'}</span>
                   </div>
                   <div className="flex justify-between items-center bg-white/5 p-3 rounded-2xl border border-white/5 backdrop-blur-sm">
                      <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Limite:</span>
                      <span className="text-white font-mono text-xl font-black">{state.limit}</span>
                   </div>
                </div>
                <div className="mt-6 pt-5 border-t border-slate-800 flex items-center gap-2">
                   <Database size={16} className="text-indigo-400" />
                   <span className="text-[11px] font-black text-indigo-200 truncate uppercase tracking-tighter">{schema.name}</span>
                </div>
             </div>
          </FlowNode>
        </div>
      </div>

      {/* Footer Info Otimizado */}
      <div className="mt-auto relative z-[60]">
         <div className="flex justify-center -mb-px">
            <button 
               onClick={() => setShowFooterInfo(!showFooterInfo)}
               className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 border-b-0 rounded-t-xl px-5 py-1.5 flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-slate-500 hover:text-indigo-600 transition-all shadow-sm"
            >
               {showFooterInfo ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronUp className="w-3.5 h-3.5" />}
               Análise do Fluxo
            </button>
         </div>
         
         <AnimatePresence>
            {showFooterInfo && (
               <motion.div 
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="overflow-hidden bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 shadow-[0_-15px_40px_rgba(0,0,0,0.1)]"
               >
                  <div className="p-6 flex items-center justify-between gap-8">
                     <div className="flex items-center gap-8">
                        <div className="p-5 bg-indigo-50 dark:bg-indigo-900/30 rounded-[2rem] shadow-inner border border-indigo-100 dark:border-indigo-800 shrink-0">
                           <Zap className="w-6 h-6 text-indigo-600 dark:text-indigo-400" />
                        </div>
                        <div className="max-w-2xl">
                           <h4 className="text-base font-black text-slate-800 dark:text-white uppercase tracking-widest mb-1">Trajeto dos Dados</h4>
                           <p className="text-xs text-slate-500 dark:text-slate-400 font-medium leading-relaxed">
                              Visualização serpentinada do processamento relacional: extração, acoplagem (JOIN), filtragem seletiva, computação escalar e projeção final.
                           </p>
                        </div>
                     </div>
                     <div className="flex flex-col items-end gap-2 shrink-0">
                        <div className="px-4 py-2 bg-slate-100 dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 flex items-center gap-2.5">
                           <div className="w-2 h-2 rounded-full bg-emerald-500 animate-ping"></div>
                           <span className="text-[9px] font-black uppercase tracking-widest text-slate-600 dark:text-slate-300">Sincronizado</span>
                        </div>
                     </div>
                  </div>
               </motion.div>
            )}
         </AnimatePresence>
      </div>
    </div>
  );
};

export default VisualQueryFlowStep;
