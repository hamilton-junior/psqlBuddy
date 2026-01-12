
import React, { useState, useMemo, useEffect, useCallback, memo, useDeferredValue, useRef } from 'react';
import { DatabaseSchema, Table, Column } from '../types';
import { Database, Table as TableIcon, Key, Search, ChevronDown, ChevronRight, Link, ArrowUpRight, ArrowDownLeft, X, ArrowUpDown, ArrowUp, ArrowDown, Pencil, Check, Filter, PlusCircle, Target, CornerDownRight, Loader2, ArrowRight, Folder, FolderOpen, Play, Info, Star, ListOrdered } from 'lucide-react';

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

// --- Sub-component Memoized: SchemaColumnItem ---

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

  if (isSelected) {
     bgClass = 'bg-indigo-100 dark:bg-indigo-900/40 ring-2 ring-indigo-500 font-bold';
  } else if (isHovered) {
     bgClass = 'bg-slate-100 dark:bg-slate-700 ring-1 ring-slate-300 dark:ring-slate-500';
  } else if (isRelTarget) {
     bgClass = 'bg-amber-100 dark:bg-amber-900/40 ring-1 ring-amber-400 font-bold';
     colBadge = (
       <span className="text-[9px] font-extrabold uppercase bg-amber-200 dark:bg-amber-800 text-amber-800 dark:text-amber-200 px-1.5 py-0.5 rounded-full flex items-center gap-0.5 shadow-sm ml-auto">
         <Target className="w-2.5 h-2.5" /> Alvo
       </span>
     );
  } else if (isRelSource) {
     bgClass = 'bg-emerald-100 dark:bg-emerald-900/40 ring-1 ring-emerald-400 font-bold';
     colBadge = (
       <span className="text-[9px] font-extrabold uppercase bg-emerald-200 dark:bg-emerald-800 text-emerald-800 dark:text-emerald-200 px-1.5 py-0.5 rounded-full flex items-center gap-0.5 shadow-sm ml-auto">
         <CornerDownRight className="w-2.5 h-2.5" /> Ref
       </span>
     );
  }

  return (
    <div 
       className={`flex items-center text-xs py-1.5 px-2 rounded group transition-all duration-75 cursor-pointer
          ${bgClass || `text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700`}
          ${isMatch && !bgClass ? 'bg-yellow-50 dark:bg-yellow-900/20' : ''}
       `}
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
              <span className={`font-mono truncate ${isRelTarget ? 'text-amber-800 dark:text-amber-200' : isRelSource ? 'text-emerald-800 dark:text-emerald-200' : 'text-slate-700 dark:text-slate-300'}`}>
                {col.name}
              </span>
              {col.isForeignKey && <Link className="w-3 h-3 ml-1.5 opacity-70 text-blue-500" />}
            </div>
         </div>
         {colBadge ? colBadge : <span className="text-[10px] text-slate-400 ml-2 font-mono shrink-0">{col.type.split('(')[0].toLowerCase()}</span>}
      </div>
    </div>
  );
});

// --- Sub-component Memoized: SchemaTableItem ---

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
  let containerClass = 'opacity-100 border-l-4 border-l-transparent border-slate-200 dark:border-slate-700 dark:bg-slate-800';

  if (visualState === 'dimmed') containerClass = 'opacity-40 grayscale-[0.5] border-slate-100 dark:border-slate-800 transition-opacity duration-300';
  else if (visualState === 'focused') containerClass = 'opacity-100 ring-1 ring-indigo-500 bg-indigo-50 dark:bg-indigo-900/20 border-l-indigo-600 shadow-md z-10';

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
          if (valA < valB) return sortDirection === 'asc' ? -1 : 1;
          if (valA > valB) return sortDirection === 'asc' ? 1 : -1;
          return 0;
        });
    }
    return cols;
  };

  return (
    <div 
      className={`border rounded-lg transition-all duration-200 relative group/table ${containerClass} ${isExpanded ? 'bg-white dark:bg-slate-800' : ''}`}
      onMouseEnter={() => onMouseEnter(tableId)}
    >
      <div className="flex items-center gap-2 p-3 cursor-pointer" onClick={() => onTableClick(tableId)}>
        {selectionMode && (
          <div className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 ${isSelected ? 'bg-indigo-600 border-indigo-600' : 'border-slate-300 dark:border-slate-600'}`}>
             {isSelected && <Check className="w-3 h-3 text-white" strokeWidth={3} />}
          </div>
        )}
        <div onClick={(e) => onToggleExpand(e, tableId)} className="p-0.5 hover:bg-slate-100 dark:hover:bg-slate-700 rounded text-slate-400">
          {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
        </div>
        <TableIcon className={`w-4 h-4 shrink-0 ${isSelected || isExpanded ? 'text-indigo-600 dark:text-indigo-400' : 'text-slate-400'}`} />
        <div className="flex-1 min-w-0 pr-2">
           <span className={`font-medium text-sm truncate ${isSelected ? 'text-indigo-700 dark:text-indigo-300 font-bold' : 'text-slate-700 dark:text-slate-200'}`}>{table.name}</span>
        </div>
      </div>
      {isExpanded && (
        <div className="px-3 pb-3 pt-0 border-t border-slate-50 dark:border-slate-700/50">
          <div className="space-y-0.5">
            {getColumns().map((col) => (
               <SchemaColumnItem 
                 key={col.name} col={col} tableId={tableId} tableName={table.name} 
                 isHovered={hoveredColumnKey === `${tableId}.${col.name}`} isSelected={selectedColumnKey === `${tableId}.${col.name}`}
                 isRelTarget={false} isRelSource={false} debouncedTerm={debouncedTerm}
                 onHover={onColumnHover} onHoverOut={onColumnHoverOut} onClick={onColumnClick}
               />
            ))}
          </div>
        </div>
      )}
    </div>
  );
});

// --- Main Component ---

const SchemaViewer: React.FC<SchemaViewerProps> = ({ 
  schema, onRegenerateClick, loading = false, onDescriptionChange,
  selectionMode = false, selectedTableIds = [], onToggleTable, onPreviewTable
}) => {
  const [inputValue, setInputValue] = useState('');
  const [debouncedTerm, setDebouncedTerm] = useState('');
  const [userMaxTablesLimit, setUserMaxTablesLimit] = useState(50);
  const [expandedTables, setExpandedTables] = useState<Set<string>>(new Set());
  const [expandedSchemas, setExpandedSchemas] = useState<Set<string>>(new Set(['public']));
  const [favoriteTables, setFavoriteTables] = useState<Set<string>>(new Set());
  const [sortField, setSortField] = useState<SortField>('key');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedTerm(inputValue), 300);
    return () => clearTimeout(timer);
  }, [inputValue]);

  const filteredTables = useMemo(() => {
    const term = debouncedTerm.toLowerCase().trim();
    let tables = schema.tables;
    if (term) {
      tables = tables.filter(t => t.name.toLowerCase().includes(term) || t.columns.some(c => c.name.toLowerCase().includes(term)));
    }
    return tables;
  }, [schema.tables, debouncedTerm]);

  const groupedTables = useMemo(() => {
    const groups: Record<string, Table[]> = {};
    filteredTables.slice(0, userMaxTablesLimit).forEach(table => {
      const s = table.schema || 'public';
      if (!groups[s]) groups[s] = [];
      groups[s].push(table);
    });
    return groups;
  }, [filteredTables, userMaxTablesLimit]);

  const handleSortChange = useCallback((field: SortField) => {
    if (sortField === field) setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    else { setSortField(field); setSortDirection('asc'); }
  }, [sortField]);

  return (
    <div className="h-full flex flex-col bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 overflow-hidden select-none">
      <div className="p-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 flex justify-between items-center shrink-0">
        <div className="flex items-center gap-2 text-slate-700 dark:text-slate-200">
          <Database className="w-5 h-5 text-indigo-600" />
          <h2 className="font-semibold text-sm uppercase truncate max-w-[120px]">{schema.name}</h2>
        </div>
        <button onClick={onRegenerateClick} className="text-xs text-indigo-600 hover:underline">Mudar BD</button>
      </div>
      <div className="p-2 border-b border-slate-100 dark:border-slate-800 shrink-0 space-y-2">
        <div className="relative">
          <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
          <input
            type="text" placeholder="Buscar tabelas..." value={inputValue} onChange={(e) => setInputValue(e.target.value)}
            className="w-full pl-9 pr-8 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded text-xs outline-none"
          />
        </div>
        <div className="flex items-center justify-between">
           <span className="text-[10px] text-slate-400 font-medium">{filteredTables.length} tabelas</span>
           <select 
             value={userMaxTablesLimit} 
             onChange={(e) => setUserMaxTablesLimit(parseInt(e.target.value))} 
             className="text-[10px] bg-transparent border-none outline-none text-slate-500 font-bold"
           >
              <option value={20}>20 regs</option>
              <option value={50}>50 regs</option>
              <option value={100}>100 regs</option>
              <option value={9999}>Tudo</option>
           </select>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto p-2 space-y-2 relative">
        {Object.keys(groupedTables).map(schemaName => (
          <div key={schemaName} className="mb-2">
            <div className="flex items-center gap-2 px-2 py-1.5 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 rounded">
              <Folder className="w-4 h-4 text-slate-400" />
              <span className="text-xs font-bold text-slate-500">{schemaName}</span>
            </div>
            <div className="pl-3 space-y-2 border-l border-slate-100 dark:border-slate-800 ml-2">
              {groupedTables[schemaName].map(table => {
                const tId = getTableId(table);
                return (
                   <SchemaTableItem
                      key={tId} table={table} visualState="normal"
                      isExpanded={expandedTables.has(tId)} isSelected={selectedTableIds.includes(tId)} isFavorite={favoriteTables.has(tId)}
                      selectionMode={selectionMode} editingTable={null} tempDesc="" debouncedTerm={debouncedTerm}
                      selectedTypeFilter="" sortField={sortField} sortDirection={sortDirection}
                      hoveredColumnKey={null} hoveredColumnRef={null} selectedColumnKey={null}
                      onToggleExpand={(e, id) => {
                         setExpandedTables(prev => {
                            const n = new Set(prev);
                            if (n.has(id)) n.delete(id); else n.add(id);
                            return n;
                         });
                      }}
                      onTableClick={(id) => onToggleTable && onToggleTable(id)} onMouseEnter={() => {}}
                      onStartEditing={() => {}} onSaveDescription={() => {}} onDescChange={() => {}} onSetEditing={() => {}}
                      onSortChange={handleSortChange} onColumnHover={() => {}} onColumnHoverOut={() => {}} onColumnClick={() => {}}
                      onToggleFavorite={() => {}}
                   />
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default SchemaViewer;
