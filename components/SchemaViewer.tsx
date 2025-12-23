
import React, { useState, useMemo, useEffect, useCallback, memo, useDeferredValue, useRef } from 'react';
import { DatabaseSchema, Table, Column } from '../types';
import { Database, Table as TableIcon, Key, Search, ChevronDown, ChevronRight, Link, ArrowUpRight, ArrowDownLeft, X, ArrowUpDown, ArrowUp, ArrowDown, Pencil, Check, Filter, PlusCircle, Target, CornerDownRight, Loader2, ArrowRight, Folder, FolderOpen, Play, Info, Star } from 'lucide-react';

interface SchemaViewerProps {
  schema: DatabaseSchema;
  onRegenerateClick?: () => void;
  loading?: boolean;
  onDescriptionChange?: (tableName: string, newDescription: string) => void;
  selectionMode?: boolean;
  selectedTableIds?: string[];
  onToggleTable?: (tableId: string) => void;
  onPreviewTable?: (tableName: string) => void;
}

type VisualState = 'normal' | 'focused' | 'dimmed' | 'parent' | 'child' | 'target' | 'source';

const getTableId = (t: any) => `${t.schema || 'public'}.${t.name}`;

const getRefTableId = (ref: string, currentSchema: string) => {
  const parts = ref.split('.');
  if (parts.length === 3) return `${parts[0]}.${parts[1]}`;
  if (parts.length === 2) return `${currentSchema || 'public'}.${parts[0]}`;
  return '';
};

const SchemaColumnItem = memo(({ 
  col, tableId, isHovered, isSelected, isRelTarget, isRelSource, debouncedTerm, onHover, onHoverOut, onClick 
}: any) => {
  const isMatch = debouncedTerm && col.name.toLowerCase().includes(debouncedTerm.toLowerCase());
  
  // Cores mais vibrantes para os estados de relacionamento
  let bgClass = '';
  if (isSelected) bgClass = 'bg-indigo-500/30 ring-2 ring-indigo-500 font-bold';
  else if (isRelTarget) bgClass = 'bg-amber-500/40 ring-1 ring-amber-400 font-bold text-amber-100 shadow-[0_0_10px_rgba(251,191,36,0.2)]';
  else if (isRelSource) bgClass = 'bg-emerald-500/40 ring-1 ring-emerald-400 font-bold text-emerald-100 shadow-[0_0_10px_rgba(52,211,153,0.2)]';
  else if (isHovered) bgClass = 'bg-slate-700 ring-1 ring-slate-500';

  return (
    <div 
       className={`flex items-center text-xs py-1.5 px-2 rounded group transition-all duration-150 cursor-pointer ${bgClass || `text-slate-300 hover:bg-slate-700`} ${isMatch && !bgClass ? 'bg-yellow-900/20' : ''}`} 
       onMouseEnter={() => onHover(tableId, col.name, col.references)} 
       onMouseLeave={onHoverOut} 
       onClick={e => { e.stopPropagation(); onClick(tableId, col.name, col.references); }}
    >
      <div className="w-5 flex justify-center shrink-0">{col.isPrimaryKey && <Key className={`w-3.5 h-3.5 transform rotate-45 ${isRelTarget ? 'text-amber-200' : 'text-amber-500'}`} />}</div>
      <div className="flex-1 flex items-center min-w-0">
         <div className="flex flex-col truncate flex-1">
            <div className="flex items-center">
              <span className={`font-mono truncate ${isRelTarget ? 'text-amber-100' : isRelSource ? 'text-emerald-100' : col.isForeignKey ? 'text-blue-400 font-medium' : 'text-slate-300'}`}>{col.name}</span>
              {col.isForeignKey && <Link className="w-3 h-3 ml-1.5 opacity-70" />}
            </div>
            {col.isForeignKey && !isRelSource && <span className="text-[9px] flex items-center gap-0.5 mt-0.5 truncate text-blue-400 opacity-60"><ArrowRight className="w-2 h-2" /> {col.references}</span>}
         </div>
         <span className={`text-[10px] ml-2 font-mono shrink-0 ${isRelTarget || isRelSource ? 'text-white/60' : 'text-slate-500'}`}>{col.type.toLowerCase()}</span>
      </div>
    </div>
  );
});

const SchemaTableItem = memo(({ 
  table, visualState, isExpanded, isSelected, isFavorite, selectionMode, editingTable, tempDesc, debouncedTerm, hoveredColumnKey, hoveredColumnRef, selectedColumnKey, 
  onToggleExpand, onTableClick, onMouseEnter, onStartEditing, onSaveDescription, onColumnHover, onColumnHoverOut, onColumnClick, onPreview, onToggleFavorite 
}: any) => {
  const tableId = getTableId(table);
  const isEditing = editingTable === table.name;
  
  // Definição de estilos baseados no estado visual com cores vibrantes
  let containerClass = 'border-slate-700 bg-slate-800';
  let badge = null;

  if (visualState === 'dimmed') {
    containerClass = 'opacity-40 grayscale-[0.5] border-slate-800 bg-slate-900 scale-[0.98]';
  } else if (visualState === 'focused' || visualState === 'source') {
    containerClass = 'ring-2 ring-indigo-500 bg-indigo-500/10 border-indigo-500 shadow-[0_0_15px_rgba(99,102,241,0.2)] z-10';
  } else if (visualState === 'target' || visualState === 'parent') {
    containerClass = 'ring-2 ring-amber-500 bg-amber-500/10 border-amber-500 shadow-[0_0_15px_rgba(245,158,11,0.25)] z-20 scale-[1.02]';
    badge = <span className="px-1.5 py-0.5 bg-amber-500 text-amber-950 text-[9px] font-black uppercase rounded flex items-center gap-1 shadow-sm"><Target className="w-2.5 h-2.5" /> PAI</span>;
  } else if (visualState === 'child') {
    containerClass = 'ring-2 ring-emerald-500 bg-emerald-500/10 border-emerald-500 shadow-[0_0_15px_rgba(16,185,129,0.25)] z-20 scale-[1.02]';
    badge = <span className="px-1.5 py-0.5 bg-emerald-500 text-emerald-950 text-[9px] font-black uppercase rounded flex items-center gap-1 shadow-sm"><ArrowRight className="w-2.5 h-2.5" /> FILHO</span>;
  } else if (selectionMode && isSelected) {
    containerClass = 'border-indigo-500 bg-indigo-500/10 ring-1 ring-indigo-500';
  }

  return (
    <div 
      className={`border rounded-lg transition-all duration-200 relative group/table ${containerClass} ${visualState === 'normal' ? 'hover:bg-slate-700 hover:border-slate-500' : ''}`} 
      onMouseEnter={() => onMouseEnter(tableId)}
    >
      <div className="flex items-center gap-2 p-3 cursor-pointer" onClick={() => onTableClick(tableId)}>
        {selectionMode && <div className={`w-4 h-4 rounded border flex items-center justify-center transition-all shrink-0 ${isSelected ? 'bg-indigo-600 border-indigo-600 shadow-[0_0_8px_rgba(79,70,229,0.4)]' : 'border-slate-600 bg-slate-800'}`}>{isSelected && <Check className="w-3 h-3 text-white" strokeWidth={3} />}</div>}
        <div onClick={e => { e.stopPropagation(); onToggleExpand(e, tableId); }} className="p-0.5 hover:bg-slate-700 rounded text-slate-500 shrink-0">{isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}</div>
        <TableIcon className={`w-4 h-4 shrink-0 ${isSelected || isExpanded || visualState !== 'normal' ? 'text-indigo-400' : 'text-slate-500'}`} />
        
        <div className="flex-1 min-w-0 pr-2">
           <div className="flex items-center gap-2 flex-wrap">
              <span className={`font-bold text-sm truncate ${isSelected || visualState !== 'normal' ? 'text-white' : 'text-slate-200'}`}>{table.name}</span>
              {badge}
           </div>
           {!isEditing && <p className="text-[10px] truncate text-slate-500 cursor-text" onClick={e => { e.stopPropagation(); onStartEditing(e, table); }}>{table.description || 'Adicionar descrição...'}</p>}
           {isEditing && <input type="text" defaultValue={table.description || ''} className="w-full text-xs bg-slate-700 rounded px-1 text-slate-200 outline-none" autoFocus onBlur={e => onSaveDescription(e, table.name)} onKeyDown={e => e.key === 'Enter' && onSaveDescription(e, table.name)} />}
        </div>
        <div className="flex gap-1">
           <button onClick={e => { e.stopPropagation(); onToggleFavorite(tableId); }} className={`p-1 rounded transition-opacity ${isFavorite ? 'opacity-100 text-amber-400' : 'opacity-0 group-hover/table:opacity-100 text-slate-600 hover:text-amber-400'}`}><Star className={`w-3.5 h-3.5 ${isFavorite ? 'fill-current' : ''}`} /></button>
        </div>
      </div>
      {isExpanded && (
        <div className="px-3 pb-3 pt-0 border-t border-slate-700/50 space-y-0.5">
          {table.columns.map((col: any) => {
             const colKey = `${tableId}.${col.name}`;
             // Checar se esta coluna é o alvo da Foreign Key sendo hoverizada
             const isTargetCol = hoveredColumnRef && (
                hoveredColumnRef === colKey || 
                hoveredColumnRef === `${table.name}.${col.name}`
             );

             return (
               <SchemaColumnItem 
                  key={col.name} 
                  col={col} 
                  tableId={tableId} 
                  isHovered={hoveredColumnKey === colKey} 
                  isSelected={selectedColumnKey === colKey} 
                  isRelTarget={isTargetCol} 
                  isRelSource={col.references && (selectedColumnKey === col.references || hoveredColumnKey === col.references)} 
                  debouncedTerm={debouncedTerm} 
                  onHover={onColumnHover} 
                  onHoverOut={onColumnHoverOut} 
                  onClick={onColumnClick} 
               />
             );
          })}
        </div>
      )}
    </div>
  );
});

const SchemaViewer: React.FC<SchemaViewerProps> = ({ 
  schema, onRegenerateClick, loading = false, onDescriptionChange, selectionMode = false, selectedTableIds = [], onToggleTable, onPreviewTable 
}) => {
  const [inputValue, setInputValue] = useState('');
  const [debouncedTerm, setDebouncedTerm] = useState('');
  const [selectedTypeFilter, setSelectedTypeFilter] = useState<string>('');
  const [renderLimit, setRenderLimit] = useState(40);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const [expandedTables, setExpandedTables] = useState<Set<string>>(new Set());
  const [expandedSchemas, setExpandedSchemas] = useState<Set<string>>(new Set(['public', '__favorites__']));
  
  const [favoriteTables, setFavoriteTables] = useState<Set<string>>(() => {
     try {
        const stored = localStorage.getItem(`psql-buddy-favorites-${schema.name}`);
        return stored ? new Set(JSON.parse(stored)) : new Set();
     } catch { return new Set(); }
  });

  useEffect(() => { localStorage.setItem(`psql-buddy-favorites-${schema.name}`, JSON.stringify(Array.from(favoriteTables))); }, [favoriteTables, schema.name]);

  const [editingTable, setEditingTable] = useState<string | null>(null);
  const [hoveredTableId, setHoveredTableId] = useState<string | null>(null);
  const [hoveredColumnKey, setHoveredColumnKey] = useState<string | null>(null);
  const [hoveredColumnRef, setHoveredColumnRef] = useState<string | null>(null);
  const [selectedColumnKey, setSelectedColumnKey] = useState<string | null>(null);
  
  const deferredHoveredTableId = useDeferredValue(hoveredTableId);
  const deferredHoveredColumnRef = useDeferredValue(hoveredColumnRef);
  const deferredHoveredColumnKey = useDeferredValue(hoveredColumnKey);
  const deferredSelectedColumnKey = useDeferredValue(selectedColumnKey);

  const neighborhood = useMemo(() => {
    const parents: Record<string, Set<string>> = {};
    const children: Record<string, Set<string>> = {};
    
    schema.tables.forEach(t => {
      const tId = getTableId(t);
      t.columns.forEach(c => {
        if (c.isForeignKey && c.references) {
          const refTableId = getRefTableId(c.references, t.schema);
          if (refTableId && refTableId !== tId) {
             if (!parents[tId]) parents[tId] = new Set();
             parents[tId].add(refTableId);
             if (!children[refTableId]) children[refTableId] = new Set();
             children[refTableId].add(tId);
          }
        }
      });
    });
    return { parents, children };
  }, [schema.tables]);

  const handleScroll = useCallback(() => {
    if (!scrollContainerRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = scrollContainerRef.current;
    if (scrollTop + clientHeight >= scrollHeight - 300) {
      setRenderLimit(prev => prev + 40);
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
       setDebouncedTerm(inputValue);
       setRenderLimit(40);
       if (inputValue) {
          const schemasWithResults = new Set(schema.tables.filter(t => t.name.toLowerCase().includes(inputValue.toLowerCase())).map(t => t.schema || 'public'));
          setExpandedSchemas(prev => new Set([...prev, ...schemasWithResults]));
       }
    }, 300);
    return () => clearTimeout(timer);
  }, [inputValue, schema.tables]);

  const allColumnTypes = useMemo(() => {
    const types = new Set<string>();
    schema.tables.forEach(t => t.columns.forEach(c => types.add(c.type.split('(')[0].toUpperCase())));
    return Array.from(types).sort();
  }, [schema.tables]);

  const filteredTables = useMemo(() => {
    const term = debouncedTerm.toLowerCase().trim();
    let tables = schema.tables;
    if (term || selectedTypeFilter) {
      tables = tables.filter(table => {
        const matchesSearch = !term || table.name.toLowerCase().includes(term) || (table.description && table.description.toLowerCase().includes(term)) || table.columns.some(col => col.name.toLowerCase().includes(term));
        const matchesType = !selectedTypeFilter || table.columns.some(col => col.type.toUpperCase().includes(selectedTypeFilter));
        return matchesSearch && matchesType;
      });
    }
    return [...tables].sort((a, b) => a.name.localeCompare(b.name));
  }, [schema.tables, debouncedTerm, selectedTypeFilter]);

  const groupedTables = useMemo(() => {
    const groups: Record<string, Table[]> = {};
    const matchingFavorites = filteredTables.filter(t => favoriteTables.has(getTableId(t)));
    if (matchingFavorites.length > 0) {
       groups['__favorites__'] = matchingFavorites;
    }
    const otherTables = filteredTables.filter(t => !favoriteTables.has(getTableId(t)));
    const visibleOthers = otherTables.slice(0, renderLimit);
    visibleOthers.forEach(table => {
       const s = table.schema || 'public';
       if (!groups[s]) groups[s] = [];
       groups[s].push(table);
    });
    return { groups, totalFiltered: filteredTables.length, totalVisible: matchingFavorites.length + visibleOthers.length };
  }, [filteredTables, renderLimit, favoriteTables]);

  const sortedSchemaNames = useMemo(() => {
     return Object.keys(groupedTables.groups).sort((a, b) => {
        if (a === '__favorites__') return -1;
        if (b === '__favorites__') return 1;
        return a.localeCompare(b);
     });
  }, [groupedTables.groups]);

  const handleToggleFavorite = useCallback((tableId: string) => {
    setFavoriteTables(prev => {
      const next = new Set(prev);
      if (next.has(tableId)) next.delete(tableId);
      else next.add(tableId);
      return next;
    });
  }, []);

  const visualStateMap = useMemo(() => {
    const map = new Map<string, VisualState>();
    
    const activeColumnKey = deferredSelectedColumnKey || deferredHoveredColumnKey;
    const activeColumnRef = deferredSelectedColumnKey ? (deferredSelectedColumnKey === deferredHoveredColumnKey ? deferredHoveredColumnRef : null) : deferredHoveredColumnRef;
    
    const activeTableId = deferredSelectedColumnKey ? (activeColumnKey?.split('.').slice(0, 2).join('.')) : deferredHoveredTableId;
    
    if (!activeTableId && !activeColumnRef) return map;

    // Caso 1: Foco em coluna específica (Relacionamento Direto via FK)
    if (activeColumnKey && activeColumnRef) {
       const sourceTableId = activeColumnKey.split('.').slice(0, 2).join('.');
       const refParts = activeColumnRef.split('.');
       const targetTableId = refParts.length === 3 ? `${refParts[0]}.${refParts[1]}` : `${activeTableId.split('.')[0]}.${refParts[0]}`;

       schema.tables.forEach(table => {
          const tId = getTableId(table);
          if (tId === targetTableId) map.set(tId, 'target');
          else if (tId === sourceTableId) map.set(tId, 'source');
          else map.set(tId, 'dimmed');
       });
       return map;
    }

    // Caso 2: Foco em Tabela (Relacionamentos de vizinhança)
    if (activeTableId) {
       map.set(activeTableId, 'focused');
       neighborhood.parents[activeTableId]?.forEach(p => map.set(p, 'parent'));
       neighborhood.children[activeTableId]?.forEach(c => map.set(c, 'child'));
       
       schema.tables.forEach(table => {
          const tId = getTableId(table);
          if (!map.has(tId)) map.set(tId, 'dimmed');
       });
    }
    
    return map;
  }, [deferredHoveredTableId, deferredHoveredColumnRef, deferredHoveredColumnKey, deferredSelectedColumnKey, neighborhood, schema.tables]);

  // Efeito para auto-expandir a tabela alvo ao hoverar uma FK
  useEffect(() => {
    if (deferredHoveredColumnRef) {
       const parts = deferredHoveredColumnRef.split('.');
       const targetTableId = parts.length === 3 ? `${parts[0]}.${parts[1]}` : `public.${parts[0]}`;
       setExpandedTables(prev => {
          if (prev.has(targetTableId)) return prev;
          const next = new Set(prev);
          next.add(targetTableId);
          return next;
       });
    }
  }, [deferredHoveredColumnRef]);

  return (
    <div id="schema-viewer-container" className="h-full flex flex-col bg-slate-900 border-r border-slate-800 overflow-hidden select-none" onClick={() => setSelectedColumnKey(null)}>
      {!selectionMode && (
        <div className="p-4 border-b border-slate-800 bg-slate-900 flex justify-between items-center shrink-0">
          <div className="flex items-center gap-2 text-slate-200">
            <Database className="w-5 h-5 text-indigo-400" />
            <div className="overflow-hidden">
              <h2 className="font-semibold text-sm uppercase tracking-wider truncate max-w-[120px]">{loading ? 'Carregando...' : schema.name}</h2>
              <p className="text-[10px] text-slate-500">{schema.tables.length} tabelas</p>
            </div>
          </div>
          {onRegenerateClick && <button onClick={onRegenerateClick} disabled={loading} className="text-xs text-indigo-400 hover:text-indigo-300 hover:underline">Mudar BD</button>}
        </div>
      )}
      <div className="p-2 border-b border-slate-800 shrink-0 space-y-2 bg-slate-900">
        <div className="flex gap-2">
           <div className="relative flex-1">
             <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-500" />
             <input type="text" placeholder="Buscar tabelas..." value={inputValue} onChange={e => setInputValue(e.target.value)} disabled={loading} className="w-full pl-9 pr-8 py-2 bg-slate-800 border border-slate-700 rounded text-xs outline-none focus:ring-2 focus:ring-indigo-500 transition-all text-slate-200 placeholder-slate-600" />
           </div>
           <select value={selectedTypeFilter} onChange={e => { setSelectedTypeFilter(e.target.value); setRenderLimit(40); }} className="w-[100px] h-full p-2 bg-slate-800 border border-slate-700 rounded text-xs outline-none text-slate-400 cursor-pointer">
              <option value="">Tipos</option>
              {allColumnTypes.map(t => <option key={t} value={t}>{t}</option>)}
           </select>
        </div>
      </div>
      <div ref={scrollContainerRef} onScroll={handleScroll} className="flex-1 overflow-y-auto p-2 space-y-2 relative custom-scrollbar" onMouseLeave={() => { setHoveredTableId(null); setHoveredColumnKey(null); setHoveredColumnRef(null); }}>
        {sortedSchemaNames.map(schemaName => {
           const tablesInSchema = groupedTables.groups[schemaName];
           if (!tablesInSchema || tablesInSchema.length === 0) return null;
           const isFavoritesGroup = schemaName === '__favorites__';
           const isExpanded = expandedSchemas.has(schemaName);
           return (
              <div key={schemaName} className="mb-2">
                 <div className={`flex items-center gap-2 px-2 py-1.5 cursor-pointer hover:bg-slate-800 rounded select-none group sticky top-0 z-10 bg-slate-900/95 backdrop-blur ${isExpanded ? 'border-b border-slate-800' : ''}`} onClick={() => setExpandedSchemas(prev => { const n = new Set(prev); if (n.has(schemaName)) n.delete(schemaName); else n.add(schemaName); return n; })}>
                    {isFavoritesGroup ? <Star className="w-4 h-4 text-amber-400 fill-amber-400" /> : isExpanded ? <FolderOpen className="w-4 h-4 text-indigo-400 fill-indigo-900/30" /> : <Folder className="w-4 h-4 text-slate-600" />}
                    <span className={`text-xs font-bold ${isFavoritesGroup ? 'text-amber-400' : 'text-slate-400'}`}>{isFavoritesGroup ? 'Favoritos' : schemaName}</span>
                    <span className="text-[10px] text-slate-500 ml-auto bg-slate-800 px-1.5 rounded-full border border-slate-700">{tablesInSchema.length}</span>
                 </div>
                 {isExpanded && (
                    <div className="pl-3 pt-1 space-y-2 border-l border-slate-800 ml-2">
                       {tablesInSchema.map((table) => (
                          <SchemaTableItem
                             key={getTableId(table)} table={table} 
                             visualState={visualStateMap.has(getTableId(table)) ? visualStateMap.get(getTableId(table)) : (visualStateMap.size > 0 ? 'dimmed' : 'normal')}
                             isExpanded={expandedTables.has(getTableId(table))} isSelected={selectedTableIds.includes(getTableId(table))} isFavorite={favoriteTables.has(getTableId(table))}
                             selectionMode={selectionMode} editingTable={editingTable} debouncedTerm={debouncedTerm} 
                             hoveredColumnKey={deferredHoveredColumnKey}
                             hoveredColumnRef={deferredHoveredColumnRef}
                             selectedColumnKey={deferredSelectedColumnKey}
                             onToggleExpand={(e: any, id: string) => { e.stopPropagation(); setExpandedTables(prev => { const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n; }); }}
                             onTableClick={id => selectionMode ? onToggleTable?.(id) : setExpandedTables(prev => { const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n; })} 
                             onMouseEnter={setHoveredTableId} 
                             onStartEditing={(e: any, t: any) => { e.stopPropagation(); setEditingTable(t.name); }}
                             onSaveDescription={(e: any, name: string) => { onDescriptionChange?.(name, e.target.value); setEditingTable(null); }}
                             onColumnHover={(tid: string, col: string, ref?: string) => { setHoveredColumnKey(`${tid}.${col}`); setHoveredColumnRef(ref || null); }}
                             onColumnHoverOut={() => { setHoveredColumnKey(null); setHoveredColumnRef(null); }} onColumnClick={(tid: string, col: string) => setSelectedColumnKey(`${tid}.${col}`)}
                             onPreview={onPreviewTable} onToggleFavorite={handleToggleFavorite}
                          />
                       ))}
                    </div>
                 )}
              </div>
           );
        })}
        {groupedTables.totalFiltered > groupedTables.totalVisible && (
           <div className="py-4 text-center text-slate-600 text-[10px] italic flex items-center justify-center gap-2">
              <Loader2 className="w-3 h-3 animate-spin" /> 
              Carregando mais {groupedTables.totalFiltered - groupedTables.totalVisible} resultados...
           </div>
        )}
      </div>
      <div className="p-3 bg-slate-900 border-t border-slate-800 text-[10px] text-slate-500 shrink-0">
        <p className="flex items-center gap-3">
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-indigo-500"></span> Sel</span>
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-500 shadow-[0_0_5px_rgba(245,158,11,0.5)]"></span> Pai</span>
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_5px_rgba(16,185,129,0.5)]"></span> Filho</span>
        </p>
      </div>
    </div>
  );
};

export default SchemaViewer;
