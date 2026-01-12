
import React, { useState, useRef, useEffect, useMemo, useCallback, memo } from 'react';
import { DatabaseSchema, Table, VirtualRelation, DbCredentials } from '../types';
import { X, ZoomIn, ZoomOut, Maximize, Loader2, Search, Key, Link, Target, CornerDownRight, Copy, Eye, Download, Map as MapIcon, Palette, FileCode, Upload, Save, Trash2, Tag, Filter, Eraser, Route, PlayCircle, StopCircle, ArrowRight, ChevronDown, ChevronUp, Sparkles, CheckCircle2, EyeOff, ListOrdered } from 'lucide-react';
import html2canvas from 'html2canvas';
import IntersectionValidatorModal from './IntersectionValidatorModal';

interface SchemaDiagramModalProps {
  schema: DatabaseSchema;
  onClose: () => void;
  onAddVirtualRelation?: (rel: VirtualRelation) => void;
  credentials?: DbCredentials | null;
}

interface NodePosition {
  x: number;
  y: number;
}

interface HoveredColumnState {
  table: string;
  col: string;
  isPk: boolean;
  ref?: string;
}

interface SelectedRelationship {
  source: string;
  target: string;
  colName: string;
  targetColName: string;
}

interface ContextMenuState {
  x: number;
  y: number;
  tableId: string;
  columnName?: string;
}

const TABLE_WIDTH = 250; 
const HEADER_HEIGHT = 44; 
const ROW_HEIGHT = 30;    
const COL_SPACING = 280;
const ROW_SPACING_GAP = 100;

const getTableId = (t: any) => `${t.schema || 'public'}.${t.name}`;

const TABLE_COLORS = [
  { id: 'default', bg: 'bg-slate-50', darkBg: 'dark:bg-slate-900/50', border: 'border-slate-200', text: 'text-slate-700' },
  { id: 'red', bg: 'bg-red-50', darkBg: 'dark:bg-red-900/30', border: 'border-red-200', text: 'text-red-800' },
  { id: 'orange', bg: 'bg-orange-50', darkBg: 'dark:bg-orange-900/30', border: 'border-orange-200', text: 'text-orange-800' },
  { id: 'amber', bg: 'bg-amber-50', darkBg: 'dark:bg-amber-900/30', border: 'border-amber-200', text: 'text-amber-800' },
  { id: 'green', bg: 'bg-emerald-50', darkBg: 'dark:bg-emerald-900/30', border: 'border-emerald-200', text: 'text-emerald-800' },
  { id: 'blue', bg: 'bg-blue-50', darkBg: 'dark:bg-blue-900/30', border: 'border-blue-200', text: 'text-blue-800' },
  { id: 'indigo', bg: 'bg-indigo-50', darkBg: 'dark:bg-indigo-900/30', border: 'border-indigo-200', text: 'text-indigo-800' },
  { id: 'violet', bg: 'bg-violet-50', darkBg: 'dark:bg-violet-900/30', border: 'border-violet-200', text: 'text-violet-800' },
];

const DiagramNode = memo(({
  table, pos, lodLevel, isHovered, opacity, isSelected, ringClass, 
  tableColors, columnColors, hasTags, userMaxColsLimit,
  onMouseDown, onMouseEnter, onMouseLeave, onContextMenu, onDoubleClick, onClearTableColor,
  onColumnEnter, onColumnLeave, onColumnClick, selectedColumn, secondSelectedColumn
}: any) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const tableId = getTableId(table);
  const colorId = tableColors[tableId] || 'default';
  const style = TABLE_COLORS.find(c => c.id === colorId) || TABLE_COLORS[0];
  
  const nodeStyle = useMemo(() => ({
     transform: `translate(${pos?.x || 0}px, ${pos?.y || 0}px)`,
     width: TABLE_WIDTH,
     opacity,
     zIndex: isHovered || opacity === 1 || isExpanded ? 50 : 10,
     pointerEvents: opacity < 0.2 ? 'none' : 'auto' as any,
     display: pos ? 'flex' : 'none'
  }), [pos, opacity, isHovered, isExpanded]);

  const displayLimit = userMaxColsLimit === 9999 ? table.columns.length : userMaxColsLimit;
  const visibleColumns = isExpanded ? table.columns : table.columns.slice(0, displayLimit);
  const hiddenCount = table.columns.length - displayLimit;

  if (!pos) return null;

  return (
     <div
        onMouseDown={(e) => onMouseDown(e, tableId)}
        onMouseEnter={() => onMouseEnter(tableId)}
        onMouseLeave={onMouseLeave}
        onContextMenu={(e) => onContextMenu(e, tableId)}
        onDoubleClick={(e) => onDoubleClick(e, tableId)}
        style={nodeStyle}
        className={`absolute flex flex-col rounded-xl transition-all duration-200
           ${lodLevel === 'low' && !isHovered && !isSelected 
              ? 'bg-indigo-100 dark:bg-slate-800 border-2 border-indigo-300 dark:border-indigo-700 h-10 items-center justify-center shadow-sm' 
              : 'bg-white dark:bg-slate-800 shadow-xl border border-slate-200 dark:border-slate-700'}
           ${ringClass}
           ${isSelected ? 'ring-2 ring-offset-2 ring-indigo-500 dark:ring-offset-slate-900 shadow-2xl scale-[1.02] z-50' : ''}
        `}
     >
        {lodLevel === 'low' && !isHovered && !isSelected ? (
           <span className="text-xs font-bold text-indigo-700 dark:text-indigo-300 truncate px-2">{table.name}</span>
        ) : (
           <>
              <div className={`flex items-center justify-between px-4 py-2.5 border-b shrink-0 relative group/header rounded-t-xl
                  ${style.bg} ${style.darkBg} ${style.border}
              `}>
                 <div className="flex flex-col min-w-0">
                    <span className={`font-bold text-sm truncate leading-tight ${style.text}`} title={table.name}>{table.name}</span>
                    <span className={`text-[10px] opacity-70 truncate ${style.text}`}>{table.schema}</span>
                 </div>
              </div>
              
              {(lodLevel === 'high' || lodLevel === 'medium' || isExpanded) && (
                 <div className="flex-1 min-h-0 bg-white dark:bg-slate-800 rounded-b-xl overflow-hidden flex flex-col">
                    <div className={`flex flex-col ${isExpanded ? 'max-h-[300px] overflow-y-auto custom-scrollbar' : 'py-1'}`}>
                        {visibleColumns.map((col: any) => {
                           const colKey = `${tableId}.${col.name}`;
                           const isSelectedCol = selectedColumn?.tableId === tableId && selectedColumn?.col === col.name;
                           const isSecondSelectedCol = secondSelectedColumn?.tableId === tableId && secondSelectedColumn?.col === col.name;
                           const colColorId = columnColors[colKey];
                           const colStyle = colColorId ? TABLE_COLORS.find(c => c.id === colColorId) : null;
                           const isKey = col.isPrimaryKey || col.isForeignKey;
                           
                           return (
                             <div key={col.name} className={`px-4 flex items-center justify-between text-xs h-[30px] transition-all border-b border-transparent hover:border-slate-100 dark:hover:border-slate-700 cursor-pointer
                                   ${isSelectedCol ? 'bg-indigo-100 dark:bg-indigo-900/40 ring-1 ring-inset ring-indigo-500 font-bold shadow-inner' : ''}
                                   ${isSecondSelectedCol ? 'bg-emerald-100 dark:bg-emerald-900/40 ring-1 ring-inset ring-emerald-500 font-bold shadow-inner' : ''}
                                   ${colStyle ? colStyle.bg : 'hover:bg-slate-50 dark:hover:bg-slate-700/50'}
                                   ${isKey && !isSelectedCol && !isSecondSelectedCol ? 'bg-slate-50/50 dark:bg-slate-800/80' : ''}
                                `}
                                onMouseEnter={() => onColumnEnter(tableId, col.name, col.references)}
                                onMouseLeave={onColumnLeave}
                                onClick={(e) => { e.stopPropagation(); onColumnClick(tableId, col.name, col.references); }}
                             >
                                <div className="flex items-center gap-2 overflow-hidden text-slate-700 dark:text-slate-300">
                                   <div className="w-3.5 flex justify-center shrink-0">
                                      {col.isPrimaryKey && <Key className="w-3 h-3 text-amber-500 fill-amber-500/20" />}
                                      {col.isForeignKey && <Link className="w-3 h-3 text-blue-500" />}
                                   </div>
                                   <span className={`truncate font-mono ${isKey ? 'font-semibold' : ''}`} title={col.name}>{col.name}</span>
                                </div>
                                <div className="flex items-center gap-1 pl-2">
                                   {(isSelectedCol || isSecondSelectedCol) && <CheckCircle2 className={`w-3 h-3 ${isSelectedCol ? 'text-indigo-500' : 'text-emerald-500'}`} />}
                                   <span className="text-slate-400 dark:text-slate-500 text-[10px] truncate max-w-[60px] text-right" title={col.type}>{col.type.split('(')[0].toLowerCase()}</span>
                                </div>
                             </div>
                           );
                        })}
                    </div>
                    {(hiddenCount > 0) && (
                       <div className="px-4 py-2 text-[10px] font-bold text-indigo-600 dark:text-indigo-400 uppercase cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors flex items-center justify-center gap-1 border-t border-slate-100 dark:border-slate-700"
                          onClick={(e) => { e.stopPropagation(); setIsExpanded(!isExpanded); }}
                       >
                          {isExpanded ? <><ChevronUp className="w-3 h-3" /> Recolher</> : <><ChevronDown className="w-3 h-3" /> Ver mais {hiddenCount} campos</>}
                       </div>
                    )}
                 </div>
              )}
           </>
        )}
     </div>
  );
});

const CanvasMinimap = memo(({ 
   positions, 
   bounds,
   pan, 
   scale,
   containerSize,
   tableColors
}: any) => {
   const canvasRef = useRef<HTMLCanvasElement>(null);

   useEffect(() => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const mapWidth = 200;
      const mapScale = mapWidth / Math.max(bounds.w, 1); 
      const mapHeight = Math.max(bounds.h * mapScale, 50);

      canvas.width = mapWidth;
      canvas.height = mapHeight;
      ctx.clearRect(0, 0, mapWidth, mapHeight);
      
      Object.entries(positions).forEach(([tableId, pos]: any) => {
         const x = (pos.x - bounds.minX) * mapScale;
         const y = (pos.y - bounds.minY) * mapScale;
         const w = TABLE_WIDTH * mapScale;
         const h = (HEADER_HEIGHT + 20) * mapScale;
         ctx.fillStyle = '#94a3b8';
         ctx.fillRect(x, y, w, h);
      });

      const viewportX = (-pan.x / scale - bounds.minX) * mapScale;
      const viewportY = (-pan.y / scale - bounds.minY) * mapScale;
      const viewportW = (containerSize.w / scale) * mapScale;
      const viewportH = (containerSize.h / scale) * mapScale;

      ctx.strokeStyle = '#ef4444';
      ctx.lineWidth = 2;
      ctx.strokeRect(viewportX, viewportY, viewportW, viewportH);
   }, [positions, bounds, pan, scale, containerSize]);

   return (
      <div className="absolute bottom-4 right-4 bg-white/90 dark:bg-slate-900/90 border border-slate-300 dark:border-slate-600 rounded-lg shadow-2xl overflow-hidden z-[60] backdrop-blur minimap-ignore">
         <canvas ref={canvasRef} className="block" />
      </div>
   );
});

const SchemaDiagramModal: React.FC<SchemaDiagramModalProps> = ({ schema, onClose, onAddVirtualRelation, credentials }) => {
  const [positions, setPositions] = useState<Record<string, NodePosition>>({});
  const [scale, setScale] = useState(0.8);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [containerSize, setContainerSize] = useState({ w: 1000, h: 800 });
  const [isLayoutReady, setIsLayoutReady] = useState(false);
  const [isDraggingCanvas, setIsDraggingCanvas] = useState(false);
  const [draggedNodeId, setDraggedNodeId] = useState<string | null>(null);
  const [isInteracting, setIsInteracting] = useState(false);
  const lastMousePos = useRef({ x: 0, y: 0 });
  const [inputValue, setInputValue] = useState('');
  const [debouncedTerm, setDebouncedTerm] = useState('');
  const [searchColumns, setSearchColumns] = useState(true);
  const [userMaxColsLimit, setUserMaxColsLimit] = useState(10);
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);
  const [hoveredColumn, setHoveredColumn] = useState<HoveredColumnState | null>(null);
  const [selectedColumn, setSelectedColumn] = useState<HoveredColumnState | null>(null);
  const [secondSelectedColumn, setSecondSelectedColumn] = useState<HoveredColumnState | null>(null);
  const [showValidator, setShowValidator] = useState(false);
  const [tableColors, setTableColors] = useState<Record<string, string>>({});
  const [columnColors, setColumnColors] = useState<Record<string, string>>({}); 
  const [pathMode, setPathMode] = useState(false);
  const [pathStartNodeId, setPathStartNodeId] = useState<string | null>(null);
  const [pathEndNodeId, setPathEndNodeId] = useState<string | null>(null);
  const [foundPathIds, setFoundPathIds] = useState<string[]>([]);
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedTerm(inputValue), 400); 
    return () => clearTimeout(timer);
  }, [inputValue]);

  const relationshipGraph = useMemo(() => {
    const adj: Record<string, Set<string>> = {};
    schema.tables.forEach(t => {
       const tId = getTableId(t);
       if (!adj[tId]) adj[tId] = new Set();
       t.columns.forEach(c => {
          if (c.isForeignKey && c.references) {
             const parts = c.references.split('.'); 
             let targetTableId = '';
             if (parts.length === 3) targetTableId = `${parts[0]}.${parts[1]}`;
             else if (parts.length === 2) targetTableId = `public.${parts[0]}`;
             if (targetTableId) {
                if (!adj[tId]) adj[tId] = new Set();
                if (!adj[targetTableId]) adj[targetTableId] = new Set();
                adj[tId].add(targetTableId);
                adj[targetTableId].add(tId);
             }
          }
       });
    });
    return adj;
  }, [schema.tables]);

  const calculateLayout = useCallback((tablesToLayout: Table[]) => {
      const newPositions: Record<string, NodePosition> = {};
      const count = tablesToLayout.length;
      const cols = Math.ceil(Math.sqrt(count * 1.5)); 
      let currentX = 50;
      let currentY = 50;
      let maxHeightInRow = 0;
      tablesToLayout.forEach((table, index) => {
        const tableId = getTableId(table);
        const tableHeight = HEADER_HEIGHT + (Math.min(table.columns.length, 12) * ROW_HEIGHT) + 20;
        newPositions[tableId] = { x: currentX, y: currentY };
        maxHeightInRow = Math.max(maxHeightInRow, tableHeight);
        currentX += COL_SPACING;
        if ((index + 1) % cols === 0) {
           currentX = 50;
           currentY += maxHeightInRow + ROW_SPACING_GAP;
           maxHeightInRow = 0;
        }
      });
      return newPositions;
  }, []);

  useEffect(() => {
    setIsLayoutReady(false);
    setTimeout(() => {
      let tablesToRender = [...schema.tables];
      if (debouncedTerm.trim()) {
        const term = debouncedTerm.toLowerCase();
        tablesToRender = schema.tables.filter(t => {
           const nameMatch = t.name.toLowerCase().includes(term);
           const colMatch = searchColumns && t.columns.some(c => c.name.toLowerCase().includes(term));
           return nameMatch || colMatch;
        });
        
        tablesToRender.sort((a, b) => {
           const getPriority = (t: Table) => {
              const n = t.name.toLowerCase();
              if (n === term) return 1;
              if (n.startsWith(term)) return 2;
              if (n.includes(term)) return 3;
              if (searchColumns && t.columns.some(c => c.name.toLowerCase().includes(term))) return 4;
              return 5;
           };
           return getPriority(a) - getPriority(b);
        });
      }
      setPositions(calculateLayout(tablesToRender));
      setIsLayoutReady(true);
    }, 50);
  }, [schema.tables, debouncedTerm, searchColumns, calculateLayout]);

  const bounds = useMemo(() => {
     const allKeys = Object.keys(positions);
     let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
     allKeys.forEach(k => {
        const p = positions[k];
        if (p.x < minX) minX = p.x;
        if (p.y < minY) minY = p.y;
        if (p.x > maxX) maxX = p.x;
        if (p.y > maxY) maxY = p.y;
     });
     if (allKeys.length === 0) return { minX: 0, minY: 0, maxX: 0, maxY: 0, w: 0, h: 0 };
     maxX += TABLE_WIDTH;
     maxY += 500;
     return { minX, minY, maxX, maxY, w: maxX - minX, h: maxY - minY };
  }, [positions]);

  const visibleTables = useMemo(() => {
     if (!isLayoutReady) return [];
     const vpX = -pan.x / scale;
     const vpY = -pan.y / scale;
     const vpW = containerSize.w / scale;
     const vpH = containerSize.h / scale;
     const buffer = 500 / scale; 
     return schema.tables.filter(t => {
        const pos = positions[getTableId(t)];
        if (!pos) return false;
        return pos.x < vpX + vpW + buffer && pos.x + TABLE_WIDTH > vpX - buffer &&
               pos.y < vpY + vpH + buffer && pos.y + 600 > vpY - buffer;
     });
  }, [positions, pan, scale, containerSize, schema.tables, isLayoutReady]);

  const handleMouseDown = (e: React.MouseEvent, tableId?: string) => {
    e.stopPropagation();
    if (e.button !== 0) return;
    setContextMenu(null);
    if (pathMode && tableId) {
       if (!pathStartNodeId) setPathStartNodeId(tableId);
       else if (!pathEndNodeId) setPathEndNodeId(tableId);
       else { setPathStartNodeId(tableId); setPathEndNodeId(null); }
       return;
    }
    lastMousePos.current = { x: e.clientX, y: e.clientY };
    if (tableId) setDraggedNodeId(tableId);
    else setIsDraggingCanvas(true);
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDraggingCanvas && !draggedNodeId) return;
    const dx = e.clientX - lastMousePos.current.x;
    const dy = e.clientY - lastMousePos.current.y;
    lastMousePos.current = { x: e.clientX, y: e.clientY };
    if (draggedNodeId) {
      setPositions(prev => ({
        ...prev,
        [draggedNodeId]: { x: prev[draggedNodeId].x + dx / scale, y: prev[draggedNodeId].y + dy / scale }
      }));
    } else if (isDraggingCanvas) {
      setPan(prev => ({ x: prev.x + dx, y: prev.y + dy }));
    }
  };

  const lodLevel = useMemo(() => {
    if (scale < 0.4) return 'low';
    if (scale < 0.7) return 'medium';
    return 'high';
  }, [scale]);

  const connections = useMemo(() => {
    const activeColumn = selectedColumn || hoveredColumn;
    const lines: React.ReactElement[] = [];
    const visibleSet = new Set(visibleTables.map(t => getTableId(t)));
    let sourceTables = visibleTables;
    if (pathMode && foundPathIds.length > 0) sourceTables = schema.tables.filter(t => foundPathIds.includes(getTableId(t)));
    else if (activeColumn?.ref) sourceTables = schema.tables.filter(t => getTableId(t) === activeColumn.table);
    else if (hoveredNodeId) sourceTables = schema.tables.filter(t => getTableId(t) === hoveredNodeId || relationshipGraph[hoveredNodeId]?.has(getTableId(t)));

    sourceTables.forEach(table => {
      const tableId = getTableId(table);
      const startPos = positions[tableId];
      if (!startPos) return;

      table.columns.forEach((col, colIndex) => {
        if (col.isForeignKey && col.references) {
          const parts = col.references.split('.');
          let targetTableId = parts.length === 3 ? `${parts[0]}.${parts[1]}` : `public.${parts[0]}`;
          let targetColName = parts.length === 3 ? parts[2] : parts[1];
          const endPos = positions[targetTableId];
          if (!endPos) return;

          let isPathLine = pathMode && foundPathIds.indexOf(tableId) !== -1 && foundPathIds.indexOf(targetTableId) !== -1;
          let isHighlighted = activeColumn && activeColumn.table === tableId && activeColumn.col === col.name;
          if (!isPathLine && !isHighlighted && hoveredNodeId !== tableId && hoveredNodeId !== targetTableId) return;

          const sourceY = startPos.y + HEADER_HEIGHT + (colIndex * ROW_HEIGHT) + (ROW_HEIGHT / 2);
          const targetTbl = schema.tables.find(t => getTableId(t) === targetTableId);
          let targetY = endPos.y + 20; 
          if (targetTbl) {
             const tColIdx = targetTbl.columns.findIndex(c => c.name === targetColName);
             if (tColIdx >= 0) targetY = endPos.y + HEADER_HEIGHT + (tColIdx * ROW_HEIGHT) + (ROW_HEIGHT / 2);
          }

          const isRight = endPos.x > startPos.x + TABLE_WIDTH;
          const sx = isRight ? startPos.x + TABLE_WIDTH : startPos.x;
          const ex = isRight ? endPos.x : endPos.x + TABLE_WIDTH;
          const dist = Math.abs(ex - sx) * 0.5;
          const pathD = `M ${sx} ${sourceY} C ${isRight ? sx + dist : sx - dist} ${sourceY}, ${isRight ? ex - dist : ex + dist} ${targetY}, ${ex} ${targetY}`;
          
          lines.push(
             <path key={`${tableId}-${col.name}`} d={pathD} stroke={isPathLine ? "#06b6d4" : isHighlighted ? "#f59e0b" : "#6366f1"} strokeWidth={isPathLine || isHighlighted ? 3 : 1.5} fill="none" opacity={0.8} markerEnd="url(#arrowhead)" />
          );
        }
      });
    });
    return lines;
  }, [visibleTables, positions, hoveredNodeId, hoveredColumn, selectedColumn, pathMode, foundPathIds, schema.tables]);

  return (
    <div className="fixed inset-0 z-[70] bg-slate-900/90 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-slate-100 dark:bg-slate-900 w-full h-full rounded-xl shadow-2xl overflow-hidden relative border border-slate-700 flex flex-col">
        
        {showValidator && selectedColumn && secondSelectedColumn && (
           <IntersectionValidatorModal 
              tableA={selectedColumn.table} columnA={selectedColumn.col}
              tableB={secondSelectedColumn.table} columnB={secondSelectedColumn.col}
              credentials={credentials || null} onClose={() => setShowValidator(false)}
              onCreateRelation={(rel) => { if (onAddVirtualRelation) onAddVirtualRelation(rel); setSelectedColumn(null); setSecondSelectedColumn(null); }}
           />
        )}

        <div className="absolute top-4 left-4 z-10 flex flex-col gap-2 pointer-events-none minimap-ignore">
           <div className="bg-white dark:bg-slate-800 p-1.5 rounded-lg shadow-md border border-slate-200 dark:border-slate-700 flex gap-1 pointer-events-auto">
              <button onClick={() => setScale(s => Math.min(s + 0.1, 2))} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded text-slate-600 dark:text-slate-300"><ZoomIn className="w-5 h-5" /></button>
              <button onClick={() => setScale(s => Math.max(s - 0.1, 0.05))} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded text-slate-600 dark:text-slate-300"><ZoomOut className="w-5 h-5" /></button>
              <button onClick={() => { setScale(1); setPan({x:0, y:0}); }} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded text-slate-600 dark:text-slate-300"><Maximize className="w-5 h-5" /></button>
           </div>
           
           <div className="bg-white dark:bg-slate-800 p-2 rounded-lg shadow-md border border-slate-200 dark:border-slate-700 flex items-center gap-2 pointer-events-auto w-72">
              <Search className="w-4 h-4 text-slate-400" />
              <input type="text" placeholder="Buscar no diagrama..." value={inputValue} onChange={(e) => setInputValue(e.target.value)} className="bg-transparent border-none outline-none text-xs text-slate-700 dark:text-slate-200 w-full" />
              <button 
                 onClick={() => setSearchColumns(!searchColumns)} 
                 className={`p-1.5 rounded transition-all ${searchColumns ? 'bg-indigo-50 text-indigo-600' : 'text-slate-400'}`}
                 title={searchColumns ? "Buscando em nomes e colunas" : "Buscando apenas nomes"}
              >
                 {searchColumns ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
              </button>
           </div>

           <div className="bg-white dark:bg-slate-800 p-2 rounded-lg shadow-md border border-slate-200 dark:border-slate-700 flex items-center gap-2 pointer-events-auto w-72">
              <ListOrdered className="w-4 h-4 text-slate-400" />
              <select 
                 value={userMaxColsLimit} 
                 onChange={(e) => setUserMaxColsLimit(parseInt(e.target.value))}
                 className="bg-transparent border-none outline-none text-[10px] font-bold text-slate-500 uppercase w-full cursor-pointer"
              >
                 <option value={5}>Mostrar 5 Colunas</option>
                 <option value={10}>Mostrar 10 Colunas</option>
                 <option value={20}>Mostrar 20 Colunas</option>
                 <option value={9999}>Mostrar Tudo</option>
              </select>
           </div>
        </div>

        <button onClick={onClose} className="absolute top-4 right-4 z-10 p-2 bg-white dark:bg-slate-800 text-slate-500 hover:text-red-500 rounded-lg shadow-md minimap-ignore"><X className="w-6 h-6" /></button>
        
        <div ref={containerRef} className="flex-1 overflow-hidden cursor-move bg-[radial-gradient(#cbd5e1_1px,transparent_1px)] dark:bg-[radial-gradient(#334155_1px,transparent_1px)] [background-size:20px_20px]" 
           onMouseDown={(e) => handleMouseDown(e)} onMouseMove={handleMouseMove} onMouseUp={() => { setDraggedNodeId(null); setIsDraggingCanvas(false); }}
           onWheel={(e) => setScale(s => Math.min(Math.max(0.05, s - e.deltaY * 0.001), 2))}
        >
          <div style={{ transform: `translate(${pan.x}px, ${pan.y}px) scale(${scale})`, transformOrigin: '0 0' }} className="relative w-full h-full">
             <svg className="absolute inset-0 pointer-events-none overflow-visible w-full h-full" style={{ zIndex: 0 }}>
               <defs>
                  <marker id="arrowhead" markerWidth="10" markerHeight="7" refX="10" refY="3.5" orient="auto"><polygon points="0 0, 10 3.5, 0 7" fill="#6366f1" /></marker>
               </defs>
               {connections}
             </svg>
             {visibleTables.map(table => {
                const tId = getTableId(table);
                return (
                  <DiagramNode 
                     key={tId} table={table} pos={positions[tId]} lodLevel={lodLevel} userMaxColsLimit={userMaxColsLimit}
                     isHovered={hoveredNodeId === tId} isSelected={selectedColumn?.table === tId || secondSelectedColumn?.table === tId} 
                     tableColors={tableColors} columnColors={columnColors} hasTags={!!tableColors[tId]} 
                     onMouseDown={handleMouseDown} onMouseEnter={setHoveredNodeId} onMouseLeave={() => setHoveredNodeId(null)} 
                     onContextMenu={(e: any, id: string) => { e.preventDefault(); setContextMenu({ x: e.clientX, y: e.clientY, tableId: id }); }} 
                     onDoubleClick={() => {}} onClearTableColor={() => {}} onColumnEnter={(t:string, c:string, r:string) => setHoveredColumn({table:t, col:c, isPk:false, ref:r})} 
                     onColumnLeave={() => setHoveredColumn(null)} onColumnClick={(t:string, c:string, r:string) => {
                        const target = { table: t, col: c, isPk: false, ref: r };
                        if (selectedColumn?.table === t && selectedColumn?.col === c) setSelectedColumn(null);
                        else if (!selectedColumn) setSelectedColumn(target);
                        else setSecondSelectedColumn(target);
                     }} 
                     selectedColumn={selectedColumn} secondSelectedColumn={secondSelectedColumn}
                  />
                );
             })}
          </div>
        </div>
        <CanvasMinimap positions={positions} bounds={bounds} pan={pan} scale={scale} containerSize={containerSize} />
      </div>
    </div>
  );
};

export default SchemaDiagramModal;
