
import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { DatabaseSchema, Table } from '../types';
import { X, ZoomIn, ZoomOut, Maximize, MousePointer2, Loader2, Search, Activity, HelpCircle, Key, Link, Target, CornerDownRight } from 'lucide-react';

interface SchemaDiagramModalProps {
  schema: DatabaseSchema;
  onClose: () => void;
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

const TABLE_WIDTH = 220;
const HEADER_HEIGHT = 42; // Altura do cabeçalho da tabela
const ROW_HEIGHT = 28;    // Altura de cada linha de coluna
const COL_SPACING = 300;
const ROW_SPACING_GAP = 60;

const SchemaDiagramModal: React.FC<SchemaDiagramModalProps> = ({ schema, onClose }) => {
  const [positions, setPositions] = useState<Record<string, NodePosition>>({});
  const [scale, setScale] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isDraggingCanvas, setIsDraggingCanvas] = useState(false);
  const [draggedNode, setDraggedNode] = useState<string | null>(null);
  
  // Interaction States
  const [hoveredNode, setHoveredNode] = useState<string | null>(null);
  const [hoveredColumn, setHoveredColumn] = useState<HoveredColumnState | null>(null);

  const [containerSize, setContainerSize] = useState({ w: 0, h: 0 });
  const [isLayoutReady, setIsLayoutReady] = useState(false);
  
  // Interaction Performance State
  const [isInteracting, setIsInteracting] = useState(false);
  const interactionTimeout = useRef<any>(null);
  
  // Search State
  const [inputValue, setInputValue] = useState('');
  const [debouncedTerm, setDebouncedTerm] = useState('');
  
  const containerRef = useRef<HTMLDivElement>(null);
  const lastMousePos = useRef({ x: 0, y: 0 });

  // 1. Debounce Search Input
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedTerm(inputValue);
    }, 400); 
    return () => clearTimeout(timer);
  }, [inputValue]);

  // 2. Interaction Throttler
  const triggerInteraction = useCallback(() => {
     if (!isInteracting) setIsInteracting(true);
     if (interactionTimeout.current) clearTimeout(interactionTimeout.current);
     interactionTimeout.current = setTimeout(() => {
        setIsInteracting(false);
     }, 150);
  }, [isInteracting]);

  // 3. Pre-calculate Relationship Graph
  const relationshipGraph = useMemo(() => {
    const adj: Record<string, Set<string>> = {};
    schema.tables.forEach(t => {
       if (!adj[t.name]) adj[t.name] = new Set();
       t.columns.forEach(c => {
          if (c.isForeignKey && c.references) {
             const parts = c.references.split('.'); 
             const targetTable = parts.length === 3 ? parts[1] : parts[0];
             
             if (!adj[t.name]) adj[t.name] = new Set();
             if (!adj[targetTable]) adj[targetTable] = new Set();
             
             adj[t.name].add(targetTable);
             adj[targetTable].add(t.name);
          }
       });
    });
    return adj;
  }, [schema.tables]);

  // 4. Layout Calculation Engine
  const calculateLayout = useCallback((tablesToLayout: Table[]) => {
      const newPositions: Record<string, NodePosition> = {};
      const count = tablesToLayout.length;
      
      const cols = Math.ceil(Math.sqrt(count * 1.5)); 
      const rowMaxHeights: number[] = [];
      
      tablesToLayout.forEach((table, index) => {
        const row = Math.floor(index / cols);
        // Estimate height
        const tableHeight = HEADER_HEIGHT + (Math.min(table.columns.length, 15) * ROW_HEIGHT); 
        
        if (!rowMaxHeights[row]) rowMaxHeights[row] = 0;
        if (tableHeight > rowMaxHeights[row]) rowMaxHeights[row] = tableHeight;
      });

      tablesToLayout.forEach((table, index) => {
        const col = index % cols;
        const row = Math.floor(index / cols);

        let currentY = 50;
        for (let r = 0; r < row; r++) {
           currentY += rowMaxHeights[r] + ROW_SPACING_GAP;
        }

        newPositions[table.name] = {
          x: col * COL_SPACING + 50,
          y: currentY
        };
      });
      return newPositions;
  }, []);

  useEffect(() => {
    setIsLayoutReady(false);
    const timer = setTimeout(() => {
      let tablesToRender = schema.tables;

      if (debouncedTerm.trim()) {
        const term = debouncedTerm.toLowerCase();
        tablesToRender = schema.tables.filter(t => 
          t.name.toLowerCase().includes(term) || 
          t.columns.some(c => c.name.toLowerCase().includes(term))
        );
      }

      const newPos = calculateLayout(tablesToRender);
      setPositions(newPos);
      
      if (debouncedTerm.trim()) {
         setPan({ x: 50, y: 50 });
         setScale(1);
      }
      
      setIsLayoutReady(true);
    }, 50);

    return () => clearTimeout(timer);
  }, [debouncedTerm, schema.tables, calculateLayout]);

  // Update container size
  useEffect(() => {
    if (!containerRef.current) return;
    const updateSize = () => {
      if (containerRef.current) {
        setContainerSize({
          w: containerRef.current.clientWidth,
          h: containerRef.current.clientHeight
        });
      }
    };
    updateSize();
    window.addEventListener('resize', updateSize);
    return () => window.removeEventListener('resize', updateSize);
  }, []);

  const lodLevel = useMemo(() => {
    if (isInteracting) {
        if (scale < 0.4) return 'low';    
        if (scale < 0.8) return 'medium'; 
        return 'high';                    
    }
    if (scale < 0.35) return 'low';       
    if (scale < 0.5) return 'medium';     
    return 'high';                        
  }, [scale, isInteracting]);

  const visibleTables = useMemo(() => {
     if (!isLayoutReady) return [];
     if (debouncedTerm.trim()) return schema.tables.filter(t => !!positions[t.name]);
     // Simple optimization: show all if under 100, otherwise could viewport cull
     // For smooth lines, we usually want to render all unless massive
     return schema.tables.filter(t => !!positions[t.name]);
  }, [positions, isLayoutReady, schema.tables, debouncedTerm]);

  // --- INTERACTION HANDLERS ---
  const handleMouseDown = (e: React.MouseEvent, tableName?: string) => {
    e.stopPropagation();
    if (e.button !== 0) return;
    lastMousePos.current = { x: e.clientX, y: e.clientY };
    if (tableName) setDraggedNode(tableName);
    else setIsDraggingCanvas(true);
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDraggingCanvas && !draggedNode) return;
    
    triggerInteraction(); 
    
    const dx = e.clientX - lastMousePos.current.x;
    const dy = e.clientY - lastMousePos.current.y;
    lastMousePos.current = { x: e.clientX, y: e.clientY };

    if (draggedNode) {
      setPositions(prev => ({
        ...prev,
        [draggedNode]: {
          x: prev[draggedNode].x + dx / scale,
          y: prev[draggedNode].y + dy / scale
        }
      }));
    } else if (isDraggingCanvas) {
      setPan(prev => ({ x: prev.x + dx, y: prev.y + dy }));
    }
  };

  const handleMouseUp = () => {
    setDraggedNode(null);
    setIsDraggingCanvas(false);
  };

  const handleWheel = (e: React.WheelEvent) => {
    e.stopPropagation();
    triggerInteraction();
    const zoomSensitivity = 0.001;
    const newScale = Math.min(Math.max(0.05, scale - e.deltaY * zoomSensitivity), 2);
    setScale(newScale);
  };

  // --- SMART PATH CALCULATION ---
  const getSmartPath = (
    start: {x: number, y: number}, 
    end: {x: number, y: number}
  ) => {
    const isTargetRight = end.x > start.x + TABLE_WIDTH;
    const isTargetLeft = end.x + TABLE_WIDTH < start.x;
    
    // Anchors
    let startX: number, endX: number;
    let cp1x: number, cp2x: number;
    
    // Default curve strength
    const distX = Math.abs(end.x - start.x);
    let curve = Math.max(distX * 0.4, 80);

    if (isTargetRight) {
       // Standard: Source [Right] -> Target [Left]
       startX = start.x + TABLE_WIDTH;
       endX = end.x;
       cp1x = startX + curve;
       cp2x = endX - curve;
    } else if (isTargetLeft) {
       // Standard: Source [Left] -> Target [Right]
       startX = start.x;
       endX = end.x + TABLE_WIDTH;
       cp1x = startX - curve;
       cp2x = endX + curve;
    } else {
       // Vertical Stacking or Overlap
       // Route around: Source [Right] -> Target [Right] OR Source [Left] -> Target [Left]
       // Use "Right side" routing by default for cleanliness unless target is slightly left
       if (end.x > start.x) {
          startX = start.x + TABLE_WIDTH;
          endX = end.x + TABLE_WIDTH;
          curve = 60 + (Math.abs(end.y - start.y) * 0.1); // Add bulge for distance
          cp1x = startX + curve;
          cp2x = endX + curve;
       } else {
          startX = start.x;
          endX = end.x;
          curve = 60 + (Math.abs(end.y - start.y) * 0.1);
          cp1x = startX - curve;
          cp2x = endX - curve;
       }
    }
    
    return `M ${startX} ${start.y} C ${cp1x} ${start.y}, ${cp2x} ${end.y}, ${endX} ${end.y}`;
  };

  const connections = useMemo(() => {
    // Hide connections if clutter is too high
    if (isInteracting && visibleTables.length > 50) return []; 
    if (visibleTables.length > 200 && !hoveredNode && !hoveredColumn) return []; 

    const lines: React.ReactElement[] = [];
    const visibleSet = new Set(visibleTables.map(t => t.name));

    visibleTables.forEach(table => {
      const startPos = positions[table.name];
      if (!startPos) return;
      
      if (hoveredNode) {
         const isRelated = table.name === hoveredNode || relationshipGraph[hoveredNode]?.has(table.name);
         if (!isRelated) return;
      }

      table.columns.forEach((col, colIndex) => {
        if (col.isForeignKey && col.references) {
          const parts = col.references.split('.');
          const targetTable = parts.length === 3 ? parts[1] : parts[0];
          const targetColName = parts.length === 3 ? parts[2] : parts[1];
          
          if (!visibleSet.has(targetTable) && !hoveredNode) return;

          // Focus logic
          if (hoveredNode) {
             const isLineRelevant = table.name === hoveredNode || targetTable === hoveredNode;
             if (!isLineRelevant) return;
          }

          let isHighlighted = false;
          if (hoveredColumn) {
             if (hoveredColumn.isPk && hoveredColumn.table === targetTable && hoveredColumn.col === targetColName) {
                isHighlighted = true;
             } else if (!hoveredColumn.isPk && hoveredColumn.table === table.name && hoveredColumn.col === col.name) {
                isHighlighted = true;
             } else {
                return; // Hide non-relevant lines
             }
          }

          const endPos = positions[targetTable];
          if (!endPos) return;

          // Find target table object to get PK index for precise line anchoring
          const targetTableObj = schema.tables.find(t => t.name === targetTable);
          let targetColIndex = 0;
          if (targetTableObj) {
             targetColIndex = targetTableObj.columns.findIndex(c => c.name === targetColName);
             if (targetColIndex === -1) targetColIndex = 0; // Fallback to header if col not found
          }

          // Calculate precise anchors (middle of the row)
          const sourceAnchorY = startPos.y + HEADER_HEIGHT + (colIndex * ROW_HEIGHT) + (ROW_HEIGHT / 2);
          
          // If detailed view, point to row. If zoomed out, point to header center to reduce noise
          let targetAnchorY = endPos.y + (HEADER_HEIGHT / 2); // Default to header
          if (lodLevel === 'high' || hoveredNode) {
              targetAnchorY = endPos.y + HEADER_HEIGHT + (targetColIndex * ROW_HEIGHT) + (ROW_HEIGHT / 2);
          }

          const pathD = getSmartPath(
             {x: startPos.x, y: sourceAnchorY}, 
             {x: endPos.x, y: targetAnchorY}
          );
          
          const strokeColor = isHighlighted ? "#f59e0b" : (hoveredNode ? "#6366f1" : "#94a3b8");
          const strokeWidth = isHighlighted ? 3 : (hoveredNode ? 2 : 1.5);
          const opacity = isHighlighted ? 1 : (hoveredNode ? 0.8 : 0.35);

          lines.push(
            <path 
              key={`${table.name}-${col.name}`}
              d={pathD} 
              stroke={strokeColor} 
              strokeWidth={strokeWidth} 
              fill="none" 
              opacity={opacity} 
              className="pointer-events-none transition-all duration-300"
              markerEnd={isHighlighted || hoveredNode ? "url(#arrowhead)" : undefined}
            />
          );
        }
      });
    });
    return lines;
  }, [visibleTables, positions, lodLevel, isInteracting, schema.tables, hoveredNode, hoveredColumn, relationshipGraph]);

  return (
    <div className="fixed inset-0 z-[70] bg-slate-900/90 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-slate-100 dark:bg-slate-900 w-full h-full rounded-xl shadow-2xl overflow-hidden relative border border-slate-700 flex flex-col">
        
        {!isLayoutReady && (
           <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-slate-900/50 text-white backdrop-blur-[2px]">
              <Loader2 className="w-10 h-10 animate-spin mb-2 text-indigo-500" />
              <p className="text-sm font-bold">Organizando visualização...</p>
           </div>
        )}

        {/* Toolbar */}
        <div className="absolute top-4 left-4 z-10 flex flex-col gap-2 pointer-events-none">
           <div className="bg-white dark:bg-slate-800 p-1.5 rounded-lg shadow-md border border-slate-200 dark:border-slate-700 flex gap-1 pointer-events-auto">
              <button onClick={() => setScale(s => Math.min(s + 0.1, 2))} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded text-slate-600 dark:text-slate-300" title="Zoom In"><ZoomIn className="w-5 h-5" /></button>
              <button onClick={() => setScale(s => Math.max(s - 0.1, 0.05))} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded text-slate-600 dark:text-slate-300" title="Zoom Out"><ZoomOut className="w-5 h-5" /></button>
              <button onClick={() => { setScale(1); setPan({x:0, y:0}); }} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded text-slate-600 dark:text-slate-300" title="Resetar Visualização"><Maximize className="w-5 h-5" /></button>
           </div>
           
           <div className="bg-white dark:bg-slate-800 p-2 rounded-lg shadow-md border border-slate-200 dark:border-slate-700 flex items-center gap-2 w-64 pointer-events-auto">
              <Search className={`w-4 h-4 ${inputValue !== debouncedTerm ? 'text-indigo-500 animate-pulse' : 'text-slate-400'}`} />
              <input 
                type="text" 
                placeholder="Buscar tabela..." 
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                className="bg-transparent border-none outline-none text-xs text-slate-700 dark:text-slate-200 w-full placeholder-slate-400"
              />
              {inputValue && (
                 <button onClick={() => setInputValue('')} className="text-slate-400 hover:text-slate-600"><X className="w-3 h-3" /></button>
              )}
           </div>

           <div className="bg-white/90 dark:bg-slate-800/90 px-3 py-2 rounded-lg shadow-md border border-slate-200 dark:border-slate-700 pointer-events-auto">
              <div className="flex items-center gap-2 text-xs font-medium text-slate-500 mb-1">
                 {isInteracting ? <Activity className="w-3 h-3 text-amber-500 animate-pulse" /> : <MousePointer2 className="w-3 h-3" />}
                 <span>Estatísticas</span>
              </div>
              <div className="text-[10px] text-slate-400 space-y-1">
                 <p>• Visíveis: {visibleTables.length}</p>
                 <p className="capitalize">• Detalhe: {lodLevel}</p>
                 <p>• Zoom: {(scale * 100).toFixed(0)}%</p>
                 {hoveredNode && <p className="text-indigo-400 font-bold">• Foco: {hoveredNode}</p>}
              </div>
           </div>
        </div>

        <button onClick={onClose} className="absolute top-4 right-4 z-10 p-2 bg-white dark:bg-slate-800 hover:bg-red-50 dark:hover:bg-red-900/20 text-slate-500 hover:text-red-500 rounded-lg shadow-md transition-colors border border-slate-200 dark:border-slate-700">
           <X className="w-6 h-6" />
        </button>

        {/* Canvas */}
        <div 
          ref={containerRef}
          className="flex-1 overflow-hidden cursor-move bg-[radial-gradient(#cbd5e1_1px,transparent_1px)] dark:bg-[radial-gradient(#334155_1px,transparent_1px)] [background-size:20px_20px]"
          onMouseDown={(e) => handleMouseDown(e)}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          onWheel={handleWheel}
        >
          <div 
             style={{ 
               transform: `translate(${pan.x}px, ${pan.y}px) scale(${scale})`,
               transformOrigin: '0 0',
               width: '100%',
               height: '100%',
             }}
             className={`relative w-full h-full ${isInteracting ? '' : 'transition-transform duration-200 ease-out'}`}
          >
             <svg className="absolute inset-0 pointer-events-none overflow-visible w-full h-full" style={{ zIndex: 0 }}>
               <defs>
                  <marker id="arrowhead" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">
                    <polygon points="0 0, 10 3.5, 0 7" fill={hoveredColumn ? "#f59e0b" : "#6366f1"} />
                  </marker>
               </defs>
               {connections}
             </svg>

             {visibleTables.map(table => {
                const pos = positions[table.name];
                if (!pos) return null;
                
                const isTableHovered = hoveredNode === table.name;
                const isRelated = !hoveredNode || hoveredNode === table.name || relationshipGraph[hoveredNode]?.has(table.name);
                const displayLOD = isTableHovered ? 'high' : lodLevel;
                
                let opacity = isRelated ? 1 : 0.2;
                if (hoveredColumn) {
                   const isSource = hoveredColumn.table === table.name;
                   let isTarget = false;
                   if (hoveredColumn.isPk) {
                      isTarget = table.columns.some(c => c.references?.includes(hoveredColumn.table));
                   } else {
                      const refParts = hoveredColumn.ref?.split('.') || [];
                      const targetTable = refParts.length === 3 ? refParts[1] : refParts[0];
                      isTarget = table.name === targetTable;
                   }
                   if (!isSource && !isTarget) opacity = 0.1;
                   else opacity = 1;
                }

                return (
                   <div
                      key={table.name}
                      onMouseDown={(e) => handleMouseDown(e, table.name)}
                      onMouseEnter={() => !isInteracting && setHoveredNode(table.name)}
                      onMouseLeave={() => setHoveredNode(null)}
                      style={{
                         transform: `translate(${pos.x}px, ${pos.y}px)`,
                         width: TABLE_WIDTH,
                         opacity,
                         zIndex: isTableHovered || opacity === 1 ? 50 : 10,
                      }}
                      className={`absolute rounded-lg cursor-grab active:cursor-grabbing transition-all duration-200
                         ${lodLevel === 'low' && !isTableHovered ? 'bg-indigo-200 dark:bg-indigo-900 border border-indigo-300 dark:border-indigo-800 h-10 flex items-center justify-center' : 'bg-white dark:bg-slate-800 shadow-lg border border-slate-200 dark:border-slate-700'}
                         ${isTableHovered ? 'border-indigo-500 ring-2 ring-indigo-500 shadow-xl scale-105' : ''}
                      `}
                   >
                      {lodLevel === 'low' && !isTableHovered ? (
                         <span className="text-xs font-bold text-indigo-900 dark:text-indigo-200 truncate px-2">{table.name}</span>
                      ) : (
                         <>
                            <div className={`
                               flex items-center justify-between px-3 py-2 border-b border-slate-100 dark:border-slate-700/50 h-[42px]
                               ${debouncedTerm ? 'bg-indigo-50 dark:bg-indigo-900/50' : 'bg-slate-50 dark:bg-slate-900/50'}
                            `}>
                               <span className="font-bold text-sm text-slate-700 dark:text-slate-200 truncate" title={table.name}>{table.name}</span>
                               <span className="text-[9px] text-slate-400">{table.schema}</span>
                            </div>
                            
                            {displayLOD === 'high' && (
                               <div className="py-1">
                                  {table.columns.slice(0, 15).map(col => {
                                     let colBgClass = 'hover:bg-slate-50 dark:hover:bg-slate-700/50';
                                     let colTextClass = 'text-slate-600 dark:text-slate-400';
                                     let showBadge = false;

                                     if (hoveredColumn) {
                                        if (hoveredColumn.table === table.name && hoveredColumn.col === col.name) {
                                           colBgClass = 'bg-yellow-100 dark:bg-yellow-900/30';
                                           colTextClass = 'text-slate-900 dark:text-white font-bold';
                                        } else if (hoveredColumn.isPk && col.isForeignKey && col.references?.includes(hoveredColumn.table)) {
                                           colBgClass = 'bg-emerald-100 dark:bg-emerald-900/30';
                                           colTextClass = 'text-emerald-800 dark:text-emerald-200 font-bold';
                                           showBadge = true;
                                        } else if (!hoveredColumn.isPk && hoveredColumn.ref && col.isPrimaryKey) {
                                           const refParts = hoveredColumn.ref.split('.');
                                           const targetTable = refParts.length === 3 ? refParts[1] : refParts[0];
                                           if (targetTable === table.name) {
                                              colBgClass = 'bg-amber-100 dark:bg-amber-900/30';
                                              colTextClass = 'text-amber-800 dark:text-amber-200 font-bold';
                                              showBadge = true;
                                           }
                                        }
                                     }

                                     return (
                                       <div 
                                          key={col.name} 
                                          className={`px-3 flex items-center justify-between text-[11px] cursor-pointer transition-colors h-[28px] ${colBgClass}`}
                                          onMouseEnter={(e) => {
                                             e.stopPropagation();
                                             setHoveredColumn({ table: table.name, col: col.name, isPk: !!col.isPrimaryKey, ref: col.references });
                                          }}
                                          onMouseLeave={() => setHoveredColumn(null)}
                                       >
                                          <div className={`flex items-center gap-1.5 overflow-hidden ${colTextClass}`}>
                                             {col.isPrimaryKey && <Key className="w-3 h-3 text-amber-500 shrink-0" />}
                                             {col.isForeignKey && <Link className="w-3 h-3 text-blue-500 shrink-0" />}
                                             <span className="truncate">{col.name}</span>
                                          </div>
                                          {showBadge ? (
                                             <span className="flex items-center gap-0.5 text-[8px] font-bold uppercase tracking-wide">
                                                {col.isPrimaryKey ? <Target className="w-2.5 h-2.5" /> : <CornerDownRight className="w-2.5 h-2.5" />}
                                             </span>
                                          ) : (
                                             <span className="text-slate-300 font-mono text-[9px]">{col.type.split('(')[0]}</span>
                                          )}
                                       </div>
                                     );
                                  })}
                                  {table.columns.length > 15 && <div className="px-3 py-1 text-[9px] text-slate-400 italic">...mais {table.columns.length - 15}</div>}
                               </div>
                            )}

                            {displayLOD === 'medium' && (
                               <div className="px-3 py-2 text-[10px] text-slate-400 flex justify-between">
                                  <span>{table.columns.length} cols</span>
                                  {table.columns.some(c => c.isPrimaryKey) && <span className="text-amber-500 flex items-center gap-0.5"><Key className="w-2.5 h-2.5" /> PK</span>}
                               </div>
                            )}
                         </>
                      )}
                   </div>
                );
             })}
          </div>
        </div>
      </div>
    </div>
  );
};

export default SchemaDiagramModal;
