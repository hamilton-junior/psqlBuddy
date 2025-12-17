
import React, { useState, useMemo, useEffect, useCallback, memo, useDeferredValue, useRef } from 'react';
import { DatabaseSchema, Table, Column } from '../types';
import { Database, Table as TableIcon, Key, Search, ChevronDown, ChevronRight, Link, ArrowUpRight, ArrowDownLeft, X, ArrowUpDown, ArrowUp, ArrowDown, Pencil, Check, Filter, PlusCircle, Target, CornerDownRight, Loader2, ArrowRight, Folder, FolderOpen, Play, Info, Star, Eye } from 'lucide-react';

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

type SortField = 'name' | 'type' | 'key';
type SortDirection = 'asc' | 'desc';
type VisualState = 'normal' | 'focused' | 'dimmed' | 'parent' | 'child' | 'target' | 'source';

const getTableId = (t: Table) => `${t.schema || 'public'}.${t.name}`;

const getRefTableId = (ref: string, currentSchema: string) => {
  const parts = ref.split('.');
  if (parts.length === 3) return `${parts[0]}.${parts[1]}`;
  else if (parts.length === 2) return `${currentSchema || 'public'}.${parts[0]}`;
  return '';
};

// --- SchemaColumnItem ---
interface SchemaColumnItemProps {
  col: Column;
  tableId: string; 
  tableName: string;
  isHovered: boolean;
  isSelected: boolean; 
  isRelTarget: boolean;
  isRelSource: boolean;
  debouncedTerm: string;
  onHover: (tableId: string, col: string, ref?: string) => void;
  onHoverOut: () => void;
  onClick: (tableId: string, col: string, ref?: string) => void;
}

const SchemaColumnItem = memo(({ 
  col, tableId, tableName, isHovered, isSelected, isRelTarget, isRelSource, debouncedTerm, onHover, onHoverOut, onClick
}: SchemaColumnItemProps) => {
  const isMatch = debouncedTerm && col.name.toLowerCase().includes(debouncedTerm.toLowerCase());
  let bgClass = '';
  let colBadge = null;

  if (isSelected) bgClass = 'bg-indigo-100 dark:bg-indigo-900/40 ring-2 ring-indigo-500 font-bold';
  else if (isHovered) bgClass = 'bg-slate-100 dark:bg-slate-700 ring-1 ring-slate-300 dark:ring-slate-500';
  else if (isRelTarget) {
     bgClass = 'bg-amber-100 dark:bg-amber-900/40 ring-1 ring-amber-400 font-bold';
     colBadge = <span className="text-[9px] font-extrabold uppercase bg-amber-200 dark:bg-amber-800 text-amber-800 dark:text-amber-200 px-1.5 py-0.5 rounded-full flex items-center gap-0.5 ml-auto shadow-sm"><Target className="w-2.5 h-2.5" /> Alvo</span>;
  } else if (isRelSource) {
     bgClass = 'bg-emerald-100 dark:bg-emerald-900/40 ring-1 ring-emerald-400 font-bold';
     colBadge = <span className="text-[9px] font-extrabold uppercase bg-emerald-200 dark:bg-emerald-800 text-emerald-800 dark:text-emerald-200 px-1.5 py-0.5 rounded-full flex items-center gap-0.5 ml-auto shadow-sm"><CornerDownRight className="w-2.5 h-2.5" /> Ref</span>;
  }

  return (
    <div 
       className={`flex items-center text-xs py-1.5 px-2 rounded group transition-all cursor-pointer ${bgClass || `text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700`} ${isMatch && !bgClass ? 'bg-yellow-50 dark:bg-yellow-900/20' : ''}`}
       onMouseEnter={() => onHover(tableId, col.name, col.references)}
       onMouseLeave={onHoverOut}
       onClick={(e) => { e.stopPropagation(); onClick(tableId, col.name, col.references); }}
    >
      <div className="w-5 mr-1 flex justify-center shrink-0">
        {col.isPrimaryKey && <Key className="w-3.5 h-3.5 text-amber-500 transform rotate-45" />}
      </div>
      <div className="flex-1 flex items-center min-w-0">
         <div className="flex flex-col truncate flex-1">
            <div className="flex items-center">
              <span className={`font-mono truncate ${isRelTarget ? 'text-amber-800 dark:text-amber-200' : isRelSource ? 'text-emerald-800 dark:text-emerald-200' : col.isForeignKey ? 'text-blue-700 dark:text-blue-400 font-medium' : 'text-slate-700 dark:text-slate-300'}`}>{col.name}</span>
              {col.isForeignKey && <Link className={`w-3 h-3 ml-1.5 opacity-70 ${isRelSource ? 'text-emerald-600' : 'text-blue-500'}`} />}
            </div>
            {col.isForeignKey && !isRelSource && <span className="text-[9px] flex items-center gap-0.5 mt-0.5 truncate text-blue-400"><ArrowRight className="w-2 h-2" /> {col.references}</span>}
         </div>
         {colBadge ? colBadge : <span className="text-[10px] text-slate-400 ml-2 font-mono shrink-0">{col.type.toLowerCase()}</span>}
      </div>
    </div>
  );
});

// --- SchemaTableItem ---
interface SchemaTableItemProps {
  table: Table;
  visualState: VisualState;
  isExpanded: boolean;
  isSelected: boolean;
  isFavorite: boolean;
  selectionMode: boolean;
  editingTable: string | null;
  tempDesc: string;
  debouncedTerm: string;
  selectedTypeFilter: string;
  sortField: SortField;
  sortDirection: SortDirection;
  hoveredColumnKey: string | null; 
  hoveredColumnRef: string | null; 
  selectedColumnKey: string | null; 
  onToggleExpand: (e: React.MouseEvent, tableId: string) => void;
  onTableClick: (tableId: string) => void;
  onMouseEnter: (tableId: string) => void;
  onStartEditing: (e: React.MouseEvent, table: Table) => void;
  onSaveDescription: (e: React.MouseEvent | React.FormEvent, tableName: string) => void;
  onDescChange: (val: string) => void;
  onSetEditing: (name: string | null) => void;
  onSortChange: (field: SortField) => void;
  onColumnHover: (tableId: string, col: string, ref?: string) => void;
  onColumnHoverOut: () => void;
  onColumnClick: (tableId: string, col: string, ref?: string) => void;
  onPreview?: (tableName: string) => void;
  onToggleFavorite: (tableId: string) => void;
}

const SchemaTableItem = memo(({
  table, visualState, isExpanded, isSelected, isFavorite, selectionMode, editingTable, tempDesc, 
  debouncedTerm, selectedTypeFilter, sortField, sortDirection, hoveredColumnKey, hoveredColumnRef, selectedColumnKey,
  onToggleExpand, onTableClick, onMouseEnter, onStartEditing, onSaveDescription, onDescChange, onSetEditing, onSortChange, onColumnHover, onColumnHoverOut, onColumnClick, onPreview, onToggleFavorite
}: SchemaTableItemProps) => {

  const tableId = getTableId(table);
  const isView = table.type === 'view';

  let containerClass = 'opacity-100 border-l-4 border-l-transparent border-slate-200 dark:border-slate-700 dark:bg-slate-800';
  let label = null;

  switch (visualState) {
    case 'dimmed': containerClass = 'opacity-40 grayscale-[0.5] dark:bg-slate-900 transition-opacity duration-300'; break;
    case 'focused': containerClass = 'opacity-100 ring-1 ring-indigo-500 bg-indigo-50 dark:bg-indigo-900/20 border-l-4 border-l-indigo-600 shadow-md z-10'; break;
    case 'target': containerClass = 'opacity-100 ring-2 ring-amber-400 bg-amber-50 dark:bg-amber-900/20 border-l-4 border-l-amber-500 shadow-lg z-10'; break;
    case 'source': containerClass = 'opacity-100 ring-1 ring-indigo-500 bg-indigo-50 dark:bg-indigo-900/20 border-l-4 border-l-indigo-600 shadow-md z-10'; break;
    case 'parent': containerClass = 'opacity-100 border-amber-300 dark:border-amber-800 bg-amber-50/50 border-l-4 border-l-amber-400 shadow-sm'; break;
    case 'child': containerClass = 'opacity-100 border-emerald-300 dark:border-emerald-800 bg-emerald-50/50 border-l-4 border-l-emerald-400 shadow-sm'; break;
  }

  const getColumns = () => {
    let cols = [...table.columns];
    if (selectedTypeFilter) cols = cols.filter(c => c.type.toUpperCase().includes(selectedTypeFilter));
    if (sortField) {
        cols.sort((a, b) => {
          let valA: any = '', valB: any = '';
          switch (sortField) {
            case 'name': valA = a.name.toLowerCase(); valB = b.name.toLowerCase(); break;
            case 'type': valA = a.type.toLowerCase(); valB = b.type.toLowerCase(); break;
            case 'key': 
              valA = (a.isPrimaryKey ? 2 : 0) + (a.isForeignKey ? 1 : 0);
              valB = (b.isPrimaryKey ? 2 : 0) + (b.isForeignKey ? 1 : 0);
              if (sortDirection === 'asc') return valB - valA;
              else return valA - valB;
          }
          return valA < valB ? (sortDirection === 'asc' ? -1 : 1) : (sortDirection === 'asc' ? 1 : -1);
        });
    }
    return cols;
  };

  return (
    <div 
      className={`border rounded-lg transition-all relative group/table ${containerClass} ${isExpanded ? 'bg-white dark:bg-slate-800 shadow-inner' : ''} ${!isSelected && visualState === 'normal' ? 'bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700' : ''}`}
      onMouseEnter={() => onMouseEnter(tableId)}
    >
      <div className={`flex items-center gap-2 p-3 cursor-pointer`} onClick={() => onTableClick(tableId)}>
        {selectionMode && (
          <div className={`w-4 h-4 rounded border flex items-center justify-center transition-all shrink-0 ${isSelected ? 'bg-indigo-600 border-indigo-600 shadow-sm' : 'border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700'}`}>
             {isSelected && <Check className="w-3 h-3 text-white" strokeWidth={3} />}
          </div>
        )}
        <div onClick={(e) => onToggleExpand(e, tableId)} className="p-0.5 hover:bg-slate-100 dark:hover:bg-slate-700 rounded text-slate-400 shrink-0">
          {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
        </div>
        {isView ? <Eye className="w-4 h-4 shrink-0 text-cyan-500" title="View SQL" /> : <TableIcon className={`w-4 h-4 shrink-0 ${isSelected || isExpanded ? 'text-indigo-600 dark:text-indigo-400' : 'text-slate-400'}`} />}
        <div className="flex-1 min-w-0">
           <div className="flex items-center gap-2">
              <span className={`font-medium text-sm truncate ${isSelected ? 'text-indigo-700 dark:text-indigo-300 font-bold' : 'text-slate-700 dark:text-slate-200'}`}>{table.name}</span>
              <button onClick={(e) => { e.stopPropagation(); onToggleFavorite(tableId); }} className={`p-1 rounded opacity-0 group-hover/table:opacity-100 transition-opacity ${isFavorite ? 'opacity-100 text-amber-400' : 'text-slate-300'}`}><Star className={`w-3 h-3 ${isFavorite ? 'fill-current' : ''}`} /></button>
              {onPreview && <button onClick={(e) => { e.stopPropagation(); onPreview(table.name); }} className="p-1 text-slate-400 hover:text-emerald-500 rounded opacity-0 group-hover/table:opacity-100 transition-opacity"><Play className="w-3 h-3 fill-current" /></button>}
           </div>
           {!editingTable && <p className="text-[10px] text-slate-400 truncate max-w-[180px]">{table.description || (selectionMode ? '' : 'Sem descrição')}</p>}
        </div>
      </div>

      {isExpanded && (
        <div className="px-3 pb-3 border-t border-slate-50 dark:border-slate-700/50">
          <div className="flex gap-2 py-2 mb-1 justify-end border-b border-slate-50 dark:border-slate-700/50">
             <button onClick={() => onSortChange('name')} className="text-[9px] font-bold text-slate-400 uppercase tracking-widest hover:text-indigo-600">Nome</button>
             <button onClick={() => onSortChange('type')} className="text-[9px] font-bold text-slate-400 uppercase tracking-widest hover:text-indigo-600">Tipo</button>
          </div>
          <div className="space-y-0.5">
            {getColumns().map((col) => (
               <SchemaColumnItem 
                 key={col.name} col={col} tableId={tableId} tableName={table.name} 
                 isHovered={hoveredColumnKey === `${tableId}.${col.name}`} isSelected={selectedColumnKey === `${tableId}.${col.name}`}
                 isRelTarget={hoveredColumnRef === `${tableId}.${col.name}`} isRelSource={false} debouncedTerm={debouncedTerm}
                 onHover={onColumnHover} onHoverOut={onColumnHoverOut} onClick={onColumnClick}
               />
            ))}
          </div>
        </div>
      )}
    </div>
  );
});

// --- Main SchemaViewer ---
const SchemaViewer: React.FC<SchemaViewerProps> = ({ 
  schema, onRegenerateClick, loading = false, onDescriptionChange,
  selectionMode = false, selectedTableIds = [], onToggleTable, onPreviewTable
}) => {
  const [inputValue, setInputValue] = useState('');
  const [debouncedTerm, setDebouncedTerm] = useState('');
  const [selectedTypeFilter, setSelectedTypeFilter] = useState('');
  const [selectedObjType, setSelectedObjType] = useState<'all' | 'table' | 'view'>('all');
  const [sortField, setSortField] = useState<SortField>('key');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
  const [expandedTables, setExpandedTables] = useState<Set<string>>(new Set());
  const [expandedSchemas, setExpandedSchemas] = useState<Set<string>>(new Set(['public']));
  const [favoriteTables, setFavoriteTables] = useState<Set<string>>(new Set());
  const [hoveredTableId, setHoveredTableId] = useState<string | null>(null);
  const [hoveredColumnKey, setHoveredColumnKey] = useState<string | null>(null);
  const [hoveredColumnRef, setHoveredColumnRef] = useState<string | null>(null);
  const [selectedColumnKey, setSelectedColumnKey] = useState<string | null>(null);
  const [renderLimit, setRenderLimit] = useState(40);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const timer = setTimeout(() => {
       setDebouncedTerm(inputValue);
       if (inputValue) setExpandedSchemas(new Set(schema.tables.map(t => t.schema || 'public')));
    }, 300);
    return () => clearTimeout(timer);
  }, [inputValue, schema.tables]);

  const filteredTables = useMemo(() => {
    const term = debouncedTerm.toLowerCase().trim();
    let tables = schema.tables;
    if (term || selectedTypeFilter || selectedObjType !== 'all') {
      tables = tables.filter(t => {
        const matchesSearch = !term || t.name.toLowerCase().includes(term) || t.columns.some(c => c.name.toLowerCase().includes(term));
        const matchesType = !selectedTypeFilter || t.columns.some(c => c.type.toUpperCase().includes(selectedTypeFilter));
        const matchesObjType = selectedObjType === 'all' || t.type === selectedObjType;
        return matchesSearch && matchesType && matchesObjType;
      });
    }
    return tables.sort((a, b) => a.name.localeCompare(b.name));
  }, [schema.tables, debouncedTerm, selectedTypeFilter, selectedObjType]);

  const groupedTables = useMemo(() => {
    const groups: Record<string, Table[]> = {};
    const visible = filteredTables.slice(0, renderLimit);
    visible.forEach(t => {
      const s = t.schema || 'public';
      if (!groups[s]) groups[s] = [];
      groups[s].push(t);
    });
    return groups;
  }, [filteredTables, renderLimit]);

  const handleToggleExpand = useCallback((e: React.MouseEvent, tableId: string) => {
    e.stopPropagation();
    setExpandedTables(prev => {
      const next = new Set(prev);
      if (next.has(tableId)) next.delete(tableId); else next.add(tableId);
      return next;
    });
  }, []);

  return (
    <div className="h-full flex flex-col bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 overflow-hidden select-none">
      <div className="p-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 flex justify-between items-center shrink-0">
        <div className="flex items-center gap-2">
          <Database className="w-5 h-5 text-indigo-600" />
          <div><h2 className="font-bold text-sm uppercase tracking-wider">{loading ? 'Carregando...' : schema.name}</h2></div>
        </div>
        <div className="flex bg-slate-200 dark:bg-slate-800 p-1 rounded-lg">
           <button onClick={() => setSelectedObjType('all')} className={`p-1 rounded text-[9px] font-bold ${selectedObjType === 'all' ? 'bg-white dark:bg-slate-600 shadow' : 'text-slate-500'}`}>TUDO</button>
           <button onClick={() => setSelectedObjType('table')} className={`p-1 rounded text-[9px] font-bold ${selectedObjType === 'table' ? 'bg-white dark:bg-slate-600 shadow' : 'text-slate-500'}`}>TAB</button>
           <button onClick={() => setSelectedObjType('view')} className={`p-1 rounded text-[9px] font-bold ${selectedObjType === 'view' ? 'bg-white dark:bg-slate-600 shadow' : 'text-slate-500'}`}>VIEW</button>
        </div>
      </div>

      <div className="p-2 border-b border-slate-100 dark:border-slate-800 space-y-2">
        <div className="relative">
          <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
          <input type="text" placeholder="Buscar tabelas/views..." value={inputValue} onChange={e => setInputValue(e.target.value)} className="w-full pl-9 pr-4 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded text-xs focus:ring-1 focus:ring-indigo-500 outline-none" />
        </div>
      </div>

      <div ref={scrollContainerRef} className="flex-1 overflow-y-auto p-2 space-y-4 custom-scrollbar">
        {Object.entries(groupedTables).map(([schemaName, tables]) => (
          <div key={schemaName} className="space-y-2">
            <div className="flex items-center gap-2 px-2 py-1 text-[10px] font-extrabold text-slate-400 uppercase tracking-widest bg-slate-50/50 dark:bg-slate-800/50 rounded-lg sticky top-0 z-10 backdrop-blur">
              <Folder className="w-3 h-3" /> {schemaName}
            </div>
            <div className="space-y-1.5 pl-1 pr-0.5">
              {/* Fix: Explicitly cast 'tables' to 'Table[]' to resolve TypeScript 'Property map does not exist on type unknown' error */}
              {(tables as Table[]).map(table => (
                <SchemaTableItem 
                  key={table.name} table={table} visualState={hoveredTableId === getTableId(table) ? 'focused' : 'normal'}
                  isExpanded={expandedTables.has(getTableId(table))} isSelected={selectedTableIds.includes(getTableId(table))}
                  isFavorite={favoriteTables.has(getTableId(table))} selectionMode={selectionMode} editingTable={null} tempDesc="" debouncedTerm={debouncedTerm}
                  selectedTypeFilter={selectedTypeFilter} sortField={sortField} sortDirection={sortDirection}
                  hoveredColumnKey={hoveredColumnKey} hoveredColumnRef={hoveredColumnRef} selectedColumnKey={selectedColumnKey}
                  onToggleExpand={handleToggleExpand} onTableClick={(id) => onToggleTable && onToggleTable(id)} 
                  onMouseEnter={setHoveredTableId} onStartEditing={() => {}} onSaveDescription={() => {}} onDescChange={() => {}}
                  onSetEditing={() => {}} onSortChange={(f) => setSortField(f)} onColumnHover={(tid, col, ref) => { setHoveredColumnKey(`${tid}.${col}`); setHoveredColumnRef(ref || null); }}
                  onColumnHoverOut={() => { setHoveredColumnKey(null); setHoveredColumnRef(null); }} onColumnClick={setSelectedColumnKey}
                  onPreview={onPreviewTable} onToggleFavorite={(id) => { const n = new Set(favoriteTables); if(n.has(id)) n.delete(id); else n.add(id); setFavoriteTables(n); }}
                />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default SchemaViewer;
