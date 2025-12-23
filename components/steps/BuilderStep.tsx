
import React, { useState, useMemo, useEffect, useCallback, memo, useRef } from 'react';
import { DatabaseSchema, BuilderState, ExplicitJoin, JoinType, Filter, Operator, OrderBy, AppSettings, SavedQuery, AggregateFunction, Column, Table, CalculatedColumn, WildcardPosition } from '../../types';
import { Layers, ChevronRight, Settings2, RefreshCw, Search, X, Plus, Trash2, ArrowRightLeft, Filter as FilterIcon, ArrowDownAZ, List, Link2, ChevronDown, Save, FolderOpen, Calendar, Clock, Key, Combine, ArrowRight, ArrowLeft, FastForward, Target, CornerDownRight, Wand2, Loader2, Undo2, Redo2, Calculator, Sparkles, LayoutTemplate, PlayCircle, Eye, Info, ChevronUp, Link as LinkIcon, AlignLeft, AlignCenter, AlignRight, CheckCircle2 } from 'lucide-react';
import SchemaViewer from '../SchemaViewer';
import { generateBuilderStateFromPrompt } from '../../services/geminiService';
import { generateLocalSql } from '../../services/localSqlService';
import BeginnerTip from '../BeginnerTip';
import FormulaModal from '../FormulaModal';
import TieredColumnSelector from '../TieredColumnSelector';

interface BuilderStepProps {
  schema: DatabaseSchema;
  state: BuilderState;
  onStateChange: (state: BuilderState) => void;
  onGenerate: () => void;
  onSkipAi?: () => void;
  isGenerating: boolean;
  progressMessage?: string;
  settings: AppSettings;
  onDescriptionChange?: (tableName: string, newDesc: string) => void;
  onPreviewTable?: (tableName: string) => void; 
}

type TabType = 'columns' | 'joins' | 'filters' | 'sortgroup';

const getTableId = (t: Table) => `${t.schema || 'public'}.${t.name}`;
const getColId = (tableId: string, colName: string) => `${tableId}.${colName}`;

const ColumnItem = memo(({ col, tableId, isSelected, aggregation, isHovered, isRelTarget, isRelSource, onToggle, onAggregationChange, onHover, onHoverOut }: any) => {
  let containerClasses = "bg-slate-800 border-slate-700 hover:border-slate-500 hover:bg-slate-700/50 hover:scale-[1.01]";
  let textClasses = "text-slate-300";
  
  if (isSelected) {
     containerClasses = "bg-indigo-500/10 border-indigo-500 ring-1 ring-indigo-500 shadow-[0_0_10px_rgba(79,70,229,0.15)] z-10";
     textClasses = "text-indigo-300 font-bold";
  }

  // Destaques Visuais de Relacionamento com cores vibrantes
  if (isHovered) {
    containerClasses = "bg-slate-700 border-slate-500 ring-1 ring-slate-500 z-20";
  } else if (isRelTarget) {
    containerClasses = "bg-amber-500/20 border-amber-400 ring-1 ring-amber-400 shadow-[0_0_15px_rgba(245,158,11,0.2)] z-20";
    textClasses = "text-amber-100 font-bold";
  } else if (isRelSource) {
    containerClasses = "bg-emerald-500/20 border-emerald-400 ring-1 ring-emerald-400 shadow-[0_0_15px_rgba(16,185,129,0.2)] z-20";
    textClasses = "text-emerald-100 font-bold";
  }

  return (
    <div 
      onClick={() => onToggle(tableId, col.name)}
      onMouseEnter={() => onHover(tableId, col.name, col.references)}
      onMouseLeave={onHoverOut}
      className={`flex items-center p-2.5 rounded-lg border cursor-pointer transition-all duration-200 ease-in-out relative group ${containerClasses}`}
    >
      <div className={`w-4 h-4 rounded border flex items-center justify-center mr-2 transition-all shrink-0 ${isSelected ? 'bg-indigo-600 border-indigo-600 shadow-[0_0_8px_rgba(79,70,229,0.5)]' : 'border-slate-600 bg-slate-800'}`}>
        {isSelected && <div className="w-1.5 h-1.5 bg-white rounded-[1px]"></div>}
      </div>
      <div className="flex-1 min-w-0 pr-8">
         <div className={`text-sm font-medium truncate transition-colors flex items-center gap-1.5 ${textClasses}`}>
            {col.name}
            {col.isPrimaryKey && <Key className={`w-3 h-3 shrink-0 transform rotate-45 ${isRelTarget ? 'text-amber-300' : 'text-amber-500'}`} />}
            {col.isForeignKey && <Link2 className={`w-3 h-3 shrink-0 ${isRelSource ? 'text-emerald-300' : 'text-blue-400'}`} />}
         </div>
         <div className="flex items-center gap-2 mt-0.5">
            <span className={`text-[10px] font-mono ${isRelTarget || isRelSource ? 'text-white/60' : 'text-slate-500'}`}>{col.type}</span>
         </div>
      </div>
      {isSelected && (
         <div className="absolute right-1 top-1/2 -translate-y-1/2" onClick={e => e.stopPropagation()}>
            <select 
               value={aggregation}
               onChange={(e) => onAggregationChange(tableId, col.name, e.target.value as AggregateFunction)}
               className={`text-[10px] font-bold uppercase rounded px-1.5 py-1 outline-none border cursor-pointer transition-colors ${aggregation !== 'NONE' ? 'bg-indigo-600 text-white border-indigo-600 shadow-md' : 'bg-slate-700 text-slate-300 border-slate-600'}`}
            >
               <option value="NONE">--</option>
               <option value="COUNT">CNT</option>
               <option value="SUM">SUM</option>
               <option value="AVG">AVG</option>
               <option value="MIN">MIN</option>
               <option value="MAX">MAX</option>
            </select>
         </div>
      )}
    </div>
  );
});

const TableCard = memo(({ 
  table, selectedColumns, aggregations, isCollapsed, colSearchTerm, hoveredColumn, relationType,
  onToggleCollapse, onToggleColumn, onAggregationChange, onSelectAll, onSelectNone, onSearchChange, onClearSearch, onSearchBlur, onHoverColumn, onHoverOutColumn
}: any) => {
  const tableId = getTableId(table);
  const filteredColumns = useMemo(() => {
    if (!colSearchTerm.trim()) return table.columns;
    return table.columns.filter((col: any) => col.name.toLowerCase().includes(colSearchTerm.toLowerCase()));
  }, [table.columns, colSearchTerm]);

  const selectedCount = selectedColumns.filter((c: string) => c.startsWith(`${tableId}.`)).length;

  let borderColorClass = "border-slate-600";
  let ringClass = "ring-1 ring-slate-700";
  let badge = null;

  if (relationType === 'pivot') {
    borderColorClass = "border-indigo-500";
    ringClass = "ring-2 ring-indigo-500/20 shadow-[0_0_15px_rgba(79,70,229,0.1)]";
    badge = <span className="px-1.5 py-0.5 bg-indigo-600 text-white text-[9px] font-black uppercase rounded flex items-center gap-1 shadow-md border border-indigo-400/30"><CheckCircle2 className="w-2.5 h-2.5" /> SELECIONADA</span>;
  } else if (relationType === 'parent') {
    borderColorClass = "border-amber-500";
    ringClass = "ring-2 ring-amber-500/20 shadow-[0_0_20px_rgba(245,158,11,0.15)]";
    badge = <span className="px-1.5 py-0.5 bg-amber-500 text-amber-950 text-[9px] font-black uppercase rounded flex items-center gap-1 shadow-md border border-amber-300/30"><Target className="w-2.5 h-2.5" /> PAI</span>;
  } else if (relationType === 'child') {
    borderColorClass = "border-emerald-500";
    ringClass = "ring-2 ring-emerald-500/20 shadow-[0_0_20px_rgba(16,185,129,0.15)]";
    badge = <span className="px-1.5 py-0.5 bg-emerald-500 text-emerald-950 text-[9px] font-black uppercase rounded flex items-center gap-1 shadow-md border border-emerald-300/30"><ArrowRight className="w-2.5 h-2.5" /> FILHO</span>;
  } else if (relationType === 'selected') {
    borderColorClass = "border-indigo-500/60";
    badge = <span className="px-1.5 py-0.5 bg-indigo-500/20 text-indigo-300 text-[9px] font-black uppercase rounded border border-indigo-500/30">SELECIONADA</span>;
  }

  return (
    <div className={`bg-slate-800 rounded-xl border overflow-hidden shadow-sm transition-all duration-300 ${isCollapsed ? 'border-slate-700' : `${borderColorClass} ${ringClass}`}`}>
       <div 
         className={`px-4 py-3 border-b border-slate-700 flex justify-between items-center cursor-pointer transition-colors ${relationType === 'pivot' ? 'bg-indigo-500/5' : 'bg-slate-900/50'} hover:bg-slate-700/50`}
         onClick={() => onToggleCollapse(tableId)}
       >
         <div className="flex items-center gap-4">
            {isCollapsed ? <ChevronRight className="w-4 h-4 text-slate-500" /> : <ChevronDown className="w-4 h-4 text-slate-500" />}
            <div className="flex flex-col">
               <div className="flex items-center gap-2">
                  <h4 className="font-black text-sm text-slate-100 tracking-tight">
                     <span className="text-[10px] font-normal text-slate-500 mr-1">{table.schema}.</span>
                     {table.name}
                  </h4>
                  {badge}
               </div>
               <span className="text-[10px] text-slate-400 font-bold mt-0.5">{selectedCount} de {table.columns.length} colunas</span>
            </div>
         </div>
         <div className="flex gap-2" onClick={e => e.stopPropagation()}>
            <button onClick={() => onSelectAll(tableId, filteredColumns.map((c: any) => c.name))} className="text-[10px] font-black uppercase tracking-tighter text-indigo-400 hover:text-indigo-300 px-2 py-1 bg-indigo-500/5 rounded transition-all">Todas</button>
            <button onClick={() => onSelectNone(tableId, filteredColumns.map((c: any) => c.name))} className="text-[10px] font-black uppercase tracking-tighter text-slate-500 hover:text-slate-400 px-2 py-1 bg-slate-500/5 rounded transition-all">Limpar</button>
         </div>
       </div>
       
       {!isCollapsed && (
         <>
            <div className="px-4 py-2 bg-slate-900/30 border-b border-slate-700">
               <div className="relative group/search">
                  <Search className="absolute left-3 top-2 w-3.5 h-3.5 text-slate-500 group-focus-within/search:text-indigo-400 transition-colors" />
                  <input 
                     type="text" 
                     value={colSearchTerm}
                     onChange={(e) => onSearchChange(tableId, e.target.value)}
                     onBlur={() => onSearchBlur(tableId)}
                     placeholder={`Buscar em ${table.name}...`}
                     className="w-full pl-10 pr-3 py-1.5 bg-slate-900/50 border border-slate-700 rounded-lg text-xs outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 text-slate-300 transition-all"
                  />
               </div>
            </div>
            <div className="p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
               {filteredColumns.length === 0 ? (
                  <div className="col-span-full text-center py-6 text-xs text-slate-500 italic flex flex-col items-center gap-2">
                     <Search className="w-5 h-5 opacity-20" />
                     Nenhuma coluna encontrada
                  </div>
               ) : (
                  filteredColumns.map((col: any) => (
                     <ColumnItem 
                        key={col.name} 
                        col={col} 
                        tableId={tableId} 
                        isSelected={selectedColumns.includes(getColId(tableId, col.name))}
                        aggregation={aggregations[getColId(tableId, col.name)] || 'NONE'}
                        isHovered={hoveredColumn?.tableId === tableId && hoveredColumn?.col === col.name}
                        isRelTarget={hoveredColumn?.ref === getColId(tableId, col.name) || hoveredColumn?.ref === `${table.name}.${col.name}`}
                        isRelSource={col.references && (hoveredColumn?.colId === col.references)}
                        onToggle={onToggleColumn}
                        onAggregationChange={onAggregationChange}
                        onHover={onHoverColumn}
                        onHoverOut={onHoverOutColumn}
                     />
                  ))
               )}
            </div>
         </>
       )}
    </div>
  );
});

const BuilderStep: React.FC<BuilderStepProps> = ({ 
  schema, state, onStateChange, onGenerate, onSkipAi, isGenerating, progressMessage, settings, onDescriptionChange, onPreviewTable 
}) => {
  const [activeTab, setActiveTab] = useState<TabType>('columns');
  const [columnSearchTerms, setColumnSearchTerms] = useState<Record<string, string>>({});
  const [collapsedTables, setCollapsedTables] = useState<Set<string>>(new Set());
  const [hoveredColumn, setHoveredColumn] = useState<any>(null);
  const [showFormulaModal, setShowFormulaModal] = useState(false);
  const [magicPrompt, setMagicPrompt] = useState('');
  const [isMagicFilling, setIsMagicFilling] = useState(false);

  // Determinar o contexto de vizinhança entre tabelas selecionadas
  const relationshipContext = useMemo(() => {
    const parents = new Set<string>();
    const children = new Set<string>();
    
    // Pivô é a primeira tabela selecionada (contexto principal)
    const pivotId = state.selectedTables[0];
    if (!pivotId) return { parents, children };

    schema.tables.forEach(t => {
      const tId = getTableId(t);
      t.columns.forEach(c => {
        if (c.isForeignKey && c.references) {
          const parts = c.references.split('.');
          const refTableId = parts.length === 3 ? `${parts[0]}.${parts[1]}` : `public.${parts[0]}`;
          
          if (tId === pivotId && state.selectedTables.includes(refTableId)) {
            parents.add(refTableId);
          }
          if (refTableId === pivotId && state.selectedTables.includes(tId)) {
            children.add(tId);
          }
        }
      });
    });

    return { parents, children };
  }, [state.selectedTables, schema.tables]);

  const toggleTable = useCallback((tableId: string) => {
    const isSelected = state.selectedTables.includes(tableId);
    if (isSelected) {
      onStateChange({
        ...state,
        selectedTables: state.selectedTables.filter(t => t !== tableId),
        selectedColumns: state.selectedColumns.filter(c => !c.startsWith(`${tableId}.`))
      });
    } else {
      onStateChange({
        ...state,
        selectedTables: [...state.selectedTables, tableId]
      });
    }
  }, [state, onStateChange]);

  const toggleColumn = useCallback((tableId: string, colName: string) => {
    const fullId = getColId(tableId, colName);
    const isSelected = state.selectedColumns.includes(fullId);
    let newCols;
    if (isSelected) {
      newCols = state.selectedColumns.filter(c => c !== fullId);
    } else {
      newCols = [...state.selectedColumns, fullId];
    }
    onStateChange({ ...state, selectedColumns: newCols });
  }, [state, onStateChange]);
  
  const updateAggregation = useCallback((tableId: string, colName: string, func: AggregateFunction) => {
    const fullId = getColId(tableId, colName);
    onStateChange({
      ...state,
      aggregations: {
        ...state.aggregations,
        [fullId]: func
      }
    });
  }, [state, onStateChange]);

  const addFilter = () => {
    const newFilter: Filter = { id: crypto.randomUUID(), column: '', operator: '=', value: '' };
    onStateChange({ ...state, filters: [...state.filters, newFilter] });
  };

  const updateFilter = (id: string, updates: Partial<Filter>) => {
    onStateChange({
      ...state,
      filters: state.filters.map(f => f.id === id ? { ...f, ...updates } : f)
    });
  };

  const removeFilter = (id: string) => {
    onStateChange({ ...state, filters: state.filters.filter(f => f.id !== id) });
  };

  const addSort = () => {
     const newOrder: OrderBy = { id: crypto.randomUUID(), column: '', direction: 'ASC' };
     onStateChange({ ...state, orderBy: [...state.orderBy, newOrder] });
  };

  const updateSort = (id: string, updates: Partial<OrderBy>) => {
     onStateChange({ ...state, orderBy: state.orderBy.map(o => o.id === id ? { ...o, ...updates } : o) });
  };

  const removeSort = (id: string) => {
     onStateChange({ ...state, orderBy: state.orderBy.filter(o => o.id !== id) });
  };

  const addJoin = () => {
     const newJoin: ExplicitJoin = { id: crypto.randomUUID(), fromTable: '', fromColumn: '', toTable: '', toColumn: '', type: 'INNER' };
     onStateChange({ ...state, joins: [...state.joins, newJoin] });
  };

  const updateJoin = (id: string, updates: Partial<ExplicitJoin>) => {
     onStateChange({ ...state, joins: state.joins.map(j => j.id === id ? { ...j, ...updates } : j) });
  };

  const removeJoin = (id: string) => {
     onStateChange({ ...state, joins: state.joins.filter(j => j.id !== id) });
  };

  const handleMagicFill = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!magicPrompt.trim() || isMagicFilling) return;
    setIsMagicFilling(true);
    try {
       const newStatePartial = await generateBuilderStateFromPrompt(schema, magicPrompt);
       if (newStatePartial) {
          onStateChange({
             ...state,
             ...newStatePartial as BuilderState
          });
       }
    } catch (e) {
       alert("Erro ao preencher com IA.");
    } finally {
       setIsMagicFilling(false);
    }
  };

  return (
    <div className="w-full h-full flex flex-col relative">
      
      <FormulaModal 
         isOpen={showFormulaModal} 
         onClose={() => setShowFormulaModal(false)}
         onSave={(alias, expr) => onStateChange({
            ...state,
            calculatedColumns: [...(state.calculatedColumns || []), { id: crypto.randomUUID(), alias, expression: expr }]
         })}
         availableColumns={state.selectedTables.flatMap(tId => {
            const t = schema.tables.find(tbl => getTableId(tbl) === tId);
            return t ? t.columns.map(c => ({ table: t.name, column: c.name, fullId: `${tId}.${c.name}`, type: c.type })) : [];
         })}
      />

      <div className="flex justify-between items-end mb-4 shrink-0">
        <div>
          <h2 className="text-2xl font-bold text-white flex items-center gap-2">
            <Layers className="w-6 h-6 text-indigo-50" />
            Query Builder
          </h2>
          <p className="text-slate-400 text-sm mt-1 font-medium">Construa consultas robustas com relacionamentos inteligentes.</p>
        </div>
      </div>
      
      {settings.enableAiGeneration && (
        <form onSubmit={handleMagicFill} className="mb-4 relative shrink-0" id="magic-fill-bar">
          <div className="relative group flex items-center bg-slate-900 rounded-xl border border-slate-700 focus-within:border-indigo-500 focus-within:ring-2 focus-within:ring-indigo-500/20 p-1 transition-all shadow-inner">
             <Wand2 className="absolute left-4 w-4 h-4 text-indigo-400" />
             <input 
               type="text" 
               value={magicPrompt}
               onChange={e => setMagicPrompt(e.target.value)}
               placeholder="Pergunte à IA: 'Vendas mensais por vendedor' ou 'Status dos últimos 50 pedidos'..."
               className="w-full pl-11 pr-32 py-2.5 bg-transparent outline-none text-sm text-slate-200 placeholder-slate-500 font-medium"
               disabled={isMagicFilling}
             />
             <button 
               type="submit" 
               disabled={!magicPrompt.trim() || isMagicFilling}
               className="absolute right-1 px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-black uppercase tracking-tight transition-all flex items-center gap-2 disabled:opacity-50 shadow-lg"
             >
                {isMagicFilling ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                IA Preencher
             </button>
          </div>
        </form>
      )}

      <div className="flex-1 flex gap-6 min-h-0">
        {/* Left Navigator */}
        <div className="w-1/4 bg-slate-900 rounded-2xl border border-slate-700 overflow-hidden shadow-2xl flex flex-col" id="schema-viewer-panel">
          <SchemaViewer 
            schema={schema} 
            selectionMode={true} 
            selectedTableIds={state.selectedTables}
            onToggleTable={toggleTable}
            onDescriptionChange={onDescriptionChange}
            onPreviewTable={onPreviewTable}
          />
        </div>

        {/* Builder Content */}
        <div className="flex-1 bg-slate-900 rounded-2xl border border-slate-700 flex flex-col overflow-hidden shadow-2xl" id="builder-main-panel">
           
           {/* Tabs */}
           <div className="flex border-b border-slate-700 bg-slate-900/50 p-1">
             {[
               {id: 'columns', label: 'Colunas', icon: List},
               {id: 'joins', label: 'Joins', icon: Link2},
               {id: 'filters', label: 'Filtros', icon: FilterIcon},
               {id: 'sortgroup', label: 'Ordenação', icon: ArrowDownAZ}
             ].map(tab => (
               <button 
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as TabType)}
                  className={`flex-1 flex items-center justify-center gap-2 py-2.5 text-xs font-black uppercase tracking-wider rounded-lg transition-all
                     ${activeTab === tab.id 
                       ? 'bg-indigo-500/10 text-indigo-400 ring-1 ring-indigo-500/50 shadow-inner' 
                       : 'text-slate-500 hover:text-slate-300 hover:bg-slate-800'
                     }
                  `}
               >
                  <tab.icon className="w-4 h-4" />
                  {tab.label}
               </button>
             ))}
           </div>

           <div className="flex-1 overflow-y-auto p-6 custom-scrollbar bg-[radial-gradient(#1e293b_1px,transparent_1px)] [background-size:32px_32px]">
              
              {state.selectedTables.length === 0 ? (
                 <div className="h-full flex flex-col items-center justify-center text-slate-500 opacity-40 animate-pulse">
                    <LayoutTemplate className="w-16 h-16 mb-4" />
                    <p className="text-sm font-bold uppercase tracking-widest">Nenhuma tabela ativa</p>
                    <p className="text-xs mt-2">Ative tabelas no painel lateral</p>
                 </div>
              ) : (
                <>
                  {activeTab === 'columns' && (
                    <div className="space-y-6">
                      <div className="flex justify-between items-center mb-2">
                         <BeginnerTip settings={settings} title="Gestão de Campos" className="mb-0 flex-1">
                            Selecione as colunas desejadas. A ordem de seleção define a ordem das colunas no resultado.
                         </BeginnerTip>
                         <button 
                           onClick={() => setShowFormulaModal(true)}
                           className="flex items-center gap-2 px-5 py-2.5 bg-slate-800 hover:bg-slate-700 text-indigo-400 rounded-xl text-xs font-black uppercase tracking-tighter shadow-xl transition-all shrink-0 ml-4 border border-indigo-500/30"
                         >
                            <Calculator className="w-4 h-4" /> Nova Fórmula
                         </button>
                      </div>

                      {state.calculatedColumns && state.calculatedColumns.length > 0 && (
                         <div className="space-y-2 animate-in slide-in-from-top-2">
                            <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Fórmulas Manuais</h4>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                               {state.calculatedColumns.map(calc => (
                                  <div key={calc.id} className="bg-indigo-500/5 border border-indigo-500/40 p-3.5 rounded-xl flex justify-between items-center group shadow-lg backdrop-blur">
                                     <div className="min-w-0">
                                        <div className="text-indigo-200 font-black text-sm truncate uppercase tracking-tight">{calc.alias}</div>
                                        <div className="text-[10px] text-slate-400 font-mono truncate mt-0.5 opacity-80">{calc.expression}</div>
                                     </div>
                                     <button onClick={() => onStateChange({...state, calculatedColumns: state.calculatedColumns?.filter(c => c.id !== calc.id)})} className="p-2 text-slate-500 hover:text-red-500 hover:bg-red-500/10 rounded-lg opacity-0 group-hover:opacity-100 transition-all">
                                        <Trash2 className="w-4 h-4" />
                                     </button>
                                  </div>
                               ))}
                            </div>
                         </div>
                      )}

                      <div className="space-y-5">
                        {state.selectedTables.map((tId, index) => {
                           const t = schema.tables.find(tbl => getTableId(tbl) === tId);
                           if (!t) return null;
                           
                           const relType = index === 0 ? 'pivot' : 
                                          relationshipContext.parents.has(tId) ? 'parent' :
                                          relationshipContext.children.has(tId) ? 'child' : 'selected';

                           return (
                             <TableCard 
                                key={tId} 
                                table={t}
                                relationType={relType}
                                selectedColumns={state.selectedColumns}
                                aggregations={state.aggregations}
                                isCollapsed={collapsedTables.has(tId)}
                                colSearchTerm={columnSearchTerms[tId] || ''}
                                hoveredColumn={hoveredColumn}
                                onToggleCollapse={(id: string) => setCollapsedTables(prev => {
                                   const n = new Set(prev);
                                   if (n.has(id)) n.delete(id); else n.add(id);
                                   return n;
                                })}
                                onToggleColumn={toggleColumn}
                                onAggregationChange={updateAggregation}
                                onSelectAll={(id: any, cols: any) => onStateChange({...state, selectedColumns: Array.from(new Set([...state.selectedColumns, ...cols.map((c: any) => getColId(id, c))]))})}
                                onSelectNone={(id: any, cols: any) => onStateChange({...state, selectedColumns: state.selectedColumns.filter(c => !cols.map((cn: any) => getColId(id, cn)).includes(c))})}
                                onSearchChange={(id: any, val: string) => setColumnSearchTerms({...columnSearchTerms, [id]: val})}
                                onSearchBlur={() => {}}
                                onHoverColumn={(tid: string, col: string, ref?: string) => setHoveredColumn({ tableId: tid, col, ref, colId: getColId(tid, col) })}
                                onHoverOutColumn={() => setHoveredColumn(null)}
                             />
                           );
                        })}
                      </div>
                    </div>
                  )}

                  {activeTab === 'joins' && (
                    <div className="space-y-4">
                       <BeginnerTip settings={settings} title="Vínculos entre Dados">
                          Relacionamentos conectam tabelas através de colunas comuns. O <strong>PSQL Buddy</strong> sugere caminhos automáticos baseado em chaves primárias.
                       </BeginnerTip>
                       
                       <div className="space-y-3">
                          {state.joins.map(join => (
                             <div key={join.id} className="bg-slate-800/80 backdrop-blur border border-slate-700 p-5 rounded-2xl flex flex-wrap items-center gap-4 animate-in slide-in-from-left-4 duration-300 shadow-xl">
                                <TieredColumnSelector 
                                   schema={schema} 
                                   availableTablesOnly={state.selectedTables} 
                                   value={`${join.fromTable}.${join.fromColumn}`} 
                                   onChange={(val) => {
                                      const parts = val.split('.');
                                      updateJoin(join.id, { fromTable: `${parts[0]}.${parts[1]}`, fromColumn: parts[2] });
                                   }}
                                />
                                <div className="flex flex-col items-center px-4">
                                   <select 
                                      value={join.type}
                                      onChange={(e) => updateJoin(join.id, { type: e.target.value as JoinType })}
                                      className="bg-indigo-600 text-white border-none text-[9px] font-black uppercase rounded-lg px-2.5 py-1.5 outline-none shadow-lg tracking-tighter"
                                   >
                                      <option value="INNER">INNER JOIN</option>
                                      <option value="LEFT">LEFT JOIN</option>
                                      <option value="RIGHT">RIGHT JOIN</option>
                                      <option value="FULL">FULL JOIN</option>
                                   </select>
                                   <ArrowRightLeft className="w-5 h-5 text-slate-600 mt-2" />
                                </div>
                                <TieredColumnSelector 
                                   schema={schema} 
                                   availableTablesOnly={state.selectedTables} 
                                   value={`${join.toTable}.${join.toColumn}`} 
                                   onChange={(val) => {
                                      const parts = val.split('.');
                                      updateJoin(join.id, { toTable: `${parts[0]}.${parts[1]}`, toColumn: parts[2] });
                                   }}
                                />
                                <button onClick={() => removeJoin(join.id)} className="ml-auto p-2.5 text-slate-500 hover:text-red-500 hover:bg-red-500/10 rounded-xl transition-all shadow-sm"><Trash2 className="w-5 h-5" /></button>
                             </div>
                          ))}
                       </div>
                       <button onClick={addJoin} className="flex items-center gap-2 px-4 py-4 border-2 border-dashed border-slate-700 hover:border-indigo-500 hover:text-indigo-400 rounded-2xl text-slate-500 text-sm font-black uppercase tracking-widest transition-all w-full justify-center bg-slate-800/20">
                          <Plus className="w-5 h-5" /> Adicionar Join Manual
                       </button>
                    </div>
                  )}

                  {activeTab === 'filters' && (
                    <div className="space-y-4">
                       <BeginnerTip settings={settings} title="Precisão de Resultados">
                          Refine sua busca. Utilize <strong>ILIKE</strong> para buscas de texto ignorando maiúsculas e minúsculas.
                       </BeginnerTip>

                       <div className="space-y-3">
                          {state.filters.map(filter => (
                             <div key={filter.id} className="bg-slate-800/80 backdrop-blur border border-slate-700 p-5 rounded-2xl flex flex-wrap items-center gap-4 animate-in slide-in-from-right-4 duration-300 shadow-xl">
                                <TieredColumnSelector 
                                   schema={schema} 
                                   availableTablesOnly={state.selectedTables} 
                                   value={filter.column} 
                                   onChange={(val) => updateFilter(filter.id, { column: val })}
                                />
                                <select 
                                   value={filter.operator}
                                   onChange={(e) => updateFilter(filter.id, { operator: e.target.value as Operator })}
                                   className="bg-slate-900 border border-slate-600 text-xs font-black rounded-xl px-4 py-2.5 outline-none text-indigo-400 shadow-inner"
                                >
                                   <option value="=">=</option>
                                   <option value="!=">!=</option>
                                   <option value=">">&gt;</option>
                                   <option value="<">&lt;</option>
                                   <option value=">=">&gt;=</option>
                                   <option value="<=">&lt;=</option>
                                   <option value="LIKE">LIKE</option>
                                   <option value="ILIKE">ILIKE</option>
                                   <option value="IN">IN</option>
                                   <option value="IS NULL">NULO</option>
                                   <option value="IS NOT NULL">NÃO NULO</option>
                                </select>
                                
                                {filter.operator !== 'IS NULL' && filter.operator !== 'IS NOT NULL' && (
                                   <input 
                                      type="text"
                                      value={filter.value}
                                      onChange={(e) => updateFilter(filter.id, { value: e.target.value })}
                                      placeholder="Valor de comparação..."
                                      className="flex-1 min-w-[150px] px-4 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-sm outline-none focus:ring-2 focus:ring-indigo-500/50 text-slate-200 font-medium shadow-inner"
                                   />
                                )}

                                {(filter.operator === 'LIKE' || filter.operator === 'ILIKE') && (
                                   <div className="flex bg-slate-900 p-1 rounded-xl border border-slate-700 shadow-inner">
                                      <button onClick={() => updateFilter(filter.id, { wildcardPosition: 'start' })} className={`px-2.5 py-1.5 text-[9px] font-black rounded-lg transition-all ${filter.wildcardPosition === 'start' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-500'}`} title="Começa com">%abc</button>
                                      <button onClick={() => updateFilter(filter.id, { wildcardPosition: 'both' })} className={`px-2.5 py-1.5 text-[9px] font-black rounded-lg transition-all ${filter.wildcardPosition === 'both' || !filter.wildcardPosition ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-500'}`} title="Contém">%abc%</button>
                                      <button onClick={() => updateFilter(filter.id, { wildcardPosition: 'end' })} className={`px-2.5 py-1.5 text-[9px] font-black rounded-lg transition-all ${filter.wildcardPosition === 'end' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-500'}`} title="Termina com">abc%</button>
                                   </div>
                                )}
                                <button onClick={() => removeFilter(filter.id)} className="p-2.5 text-slate-500 hover:text-red-500 hover:bg-red-500/10 rounded-xl transition-all shadow-sm"><Trash2 className="w-5 h-5" /></button>
                             </div>
                          ))}
                       </div>
                       <button onClick={addFilter} className="flex items-center gap-2 px-4 py-4 border-2 border-dashed border-slate-700 hover:border-indigo-500 hover:text-indigo-400 rounded-2xl text-slate-500 text-sm font-black uppercase tracking-widest transition-all w-full justify-center bg-slate-800/20">
                          <Plus className="w-5 h-5" /> Adicionar Novo Filtro
                       </button>
                    </div>
                  )}

                  {activeTab === 'sortgroup' && (
                    <div className="space-y-8">
                       <div className="space-y-4">
                          <div className="flex items-center justify-between ml-1">
                             <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-2">
                                <ArrowDownAZ className="w-4 h-4" /> Ordem de Apresentação
                             </h3>
                          </div>
                          <div className="grid grid-cols-1 gap-3">
                             {state.orderBy.map(order => (
                                <div key={order.id} className="bg-slate-800/80 backdrop-blur border border-slate-700 p-5 rounded-2xl flex items-center gap-4 animate-in slide-in-from-bottom-4 duration-300 shadow-xl">
                                   <div className="flex-1">
                                      <TieredColumnSelector 
                                         schema={schema} 
                                         availableTablesOnly={state.selectedTables} 
                                         value={order.column} 
                                         onChange={(val) => updateSort(order.id, { column: val })}
                                      />
                                   </div>
                                   <div className="flex bg-slate-900 p-1 rounded-xl border border-slate-700 shrink-0 shadow-inner">
                                      <button 
                                         onClick={() => updateSort(order.id, { direction: 'ASC' })}
                                         className={`flex items-center gap-2 px-5 py-2 rounded-lg text-xs font-black uppercase tracking-tighter transition-all ${order.direction === 'ASC' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-500 hover:text-slate-300'}`}
                                      >
                                         <AlignLeft className="w-4 h-4" /> A → Z
                                      </button>
                                      <button 
                                         onClick={() => updateSort(order.id, { direction: 'DESC' })}
                                         className={`flex items-center gap-2 px-5 py-2 rounded-lg text-xs font-black uppercase tracking-tighter transition-all ${order.direction === 'DESC' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-500 hover:text-slate-300'}`}
                                      >
                                         <AlignRight className="w-4 h-4" /> Z → A
                                      </button>
                                   </div>
                                   <button onClick={() => removeSort(order.id)} className="p-2.5 text-slate-500 hover:text-red-500 hover:bg-red-500/10 rounded-xl transition-all shadow-sm"><Trash2 className="w-5 h-5" /></button>
                                </div>
                             ))}
                             <button onClick={addSort} className="flex items-center gap-2 px-4 py-4 border-2 border-dashed border-slate-700 hover:border-indigo-500 hover:text-indigo-400 rounded-2xl text-slate-500 text-sm font-black uppercase tracking-widest transition-all justify-center bg-slate-800/20">
                                <Plus className="w-5 h-5" /> Adicionar Regra de Ordenação
                             </button>
                          </div>
                       </div>

                       <div className="pt-8 border-t border-slate-800">
                          <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-2 mb-4 ml-1">
                             <FastForward className="w-4 h-4" /> Limite de Registros
                          </h3>
                          <div className="flex items-center gap-6 bg-slate-800/30 p-6 rounded-2xl border border-slate-700/50 w-full md:w-fit backdrop-blur shadow-inner">
                             <input 
                                type="range" 
                                min="10" 
                                max="2000" 
                                step="10" 
                                value={state.limit} 
                                onChange={(e) => onStateChange({ ...state, limit: parseInt(e.target.value) })}
                                className="w-64 h-2.5 bg-slate-700 rounded-full appearance-none cursor-pointer accent-indigo-500 shadow-sm"
                             />
                             <div className="flex items-center gap-3 bg-slate-900 px-6 py-2.5 rounded-xl border border-slate-600 shadow-2xl ring-1 ring-white/5">
                                <span className="text-xl font-mono font-black text-indigo-400">{state.limit}</span>
                                <span className="text-[10px] text-slate-500 uppercase font-black tracking-widest">Linhas</span>
                             </div>
                          </div>
                       </div>
                    </div>
                  )}
                </>
              )}
           </div>
        </div>
      </div>

      {/* Footer Actions */}
      <div className="mt-6 bg-slate-800/90 backdrop-blur-md p-5 rounded-2xl flex items-center justify-between border border-slate-700 shadow-[0_-10px_40px_rgba(0,0,0,0.3)] shrink-0 z-20" id="builder-footer-actions">
         <div className="flex items-center gap-8">
            {[
               {label: 'Tabelas', value: state.selectedTables.length, color: 'text-indigo-400'},
               {label: 'Colunas', value: state.selectedColumns.length + (state.calculatedColumns?.length || 0), color: 'text-emerald-400'},
               {label: 'Filtros', value: state.filters.length, color: 'text-amber-400'}
            ].map(stat => (
               <div key={stat.label} className="flex flex-col">
                  <span className="text-[9px] text-slate-500 uppercase font-black tracking-widest">{stat.label}</span>
                  <span className={`font-mono text-2xl font-black ${stat.color} leading-none mt-1`}>{stat.value}</span>
               </div>
            ))}
         </div>
         
         <div className="flex items-center gap-4">
            {isGenerating && (
               <div className="flex flex-col items-end mr-3 animate-pulse">
                  <span className="text-[10px] font-black text-indigo-400 uppercase tracking-tighter">{progressMessage || "Analisando..."}</span>
                  <span className="text-[9px] text-slate-500 font-bold">Processando via Gemini AI...</span>
               </div>
            )}
            <button 
              onClick={onGenerate}
              disabled={state.selectedTables.length === 0 || isGenerating}
              className={`
                bg-indigo-600 hover:bg-indigo-500 text-white px-10 py-3.5 rounded-2xl font-black uppercase tracking-wider shadow-2xl shadow-indigo-900/40 transition-all flex items-center gap-3 group
                ${(state.selectedTables.length === 0 || isGenerating) ? 'opacity-50 cursor-not-allowed grayscale' : 'hover:scale-105 active:scale-95 hover:shadow-indigo-500/20'}
              `}
            >
               {isGenerating ? (
                 <RefreshCw className="w-6 h-6 animate-spin" />
               ) : (
                 <ChevronRight className="w-6 h-6 group-hover:translate-x-1.5 transition-transform" />
               )}
               Gerar & Executar
            </button>
         </div>
      </div>
    </div>
  );
};

export default BuilderStep;
