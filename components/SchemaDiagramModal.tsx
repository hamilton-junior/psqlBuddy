
import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { DatabaseSchema, Table } from '../types';
import { X, ZoomIn, ZoomOut, Maximize, MousePointer2, Loader2, Search, Activity, HelpCircle } from 'lucide-react';

interface SchemaDiagramModalProps {
  schema: DatabaseSchema;
  onClose: () => void;
}

interface NodePosition {
  x: number;
  y: number;
}

const TABLE_WIDTH = 200;
const HEADER_HEIGHT = 40;
const ROW_HEIGHT = 24;
const COL_SPACING = 300;
const ROW_SPACING_GAP = 80;

const SchemaDiagramModal: React.FC<SchemaDiagramModalProps> = ({ schema, onClose }) => {
  const [positions, setPositions] = useState<Record<string, NodePosition>>({});
  const [scale, setScale] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isDraggingCanvas, setIsDraggingCanvas] = useState(false);
  const [draggedNode, setDraggedNode] = useState<string | null>(null);
  const [hoveredNode, setHoveredNode] = useState<string | null>(null);
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

  // 2. Interaction Throttler (Fast Mode trigger)
  const triggerInteraction = useCallback(() => {
     if (!isInteracting) setIsInteracting(true);
     if (interactionTimeout.current) clearTimeout(interactionTimeout.current);
     interactionTimeout.current = setTimeout(() => {
        setIsInteracting(false);
     }, 150); // Reduced from 250ms for snappier detail restoration
  }, [isInteracting]);

  // 3. Pre-calculate Relationship Graph for Highlighting
  const relationshipGraph = useMemo(() => {
    const adj: Record<string, Set<string>> = {};
    schema.tables.forEach(t => {
       if (!adj[t.name]) adj[t.name] = new Set();
       t.columns.forEach(c => {
          if (c.isForeignKey && c.references) {
             const [target] = c.references.split('.'); // assume schema.table.col or table.col
             if (!adj[t.name]) adj[t.name] = new Set();
             if (!adj[target]) adj[target] = new Set();
             
             adj[t.name].add(target); // Outgoing
             adj[target].add(t.name); // Incoming (undirected for highlighting)
          }
       });
    });
    return adj;
  }, [schema.tables]);

  // 4. Layout Calculation Engine
  const calculateLayout = useCallback((tablesToLayout: Table[]) => {
      const newPositions: Record<string, NodePosition> = {};
      const count = tablesToLayout.length;
      
      const cols = Math.ceil(Math.sqrt(count * 1.5)); // Slightly wider aspect ratio
      const rowMaxHeights: number[] = [];
      
      tablesToLayout.forEach((table, index) => {
        const row = Math.floor(index / cols);
        // Estimate height roughly to avoid DOM measurement
        const tableHeight = HEADER_HEIGHT + (Math.min(table.columns.length, 15) * ROW_HEIGHT); // Cap height calc for layout
        
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

  // 5. Effect: Recalculate Layout
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

  // --- VIRTUALIZATION LOGIC ---
  const visibleBounds = useMemo(() => {
    if (containerSize.w === 0) return null;
    const xMin = -pan.x / scale;
    const yMin = -pan.y / scale;
    const xMax = (-pan.x + containerSize.w) / scale;
    const yMax = (-pan.y + containerSize.h) / scale;
    // Add generous buffer
    const buffer = 800 / scale;
    return { xMin: xMin - buffer, yMin: yMin - buffer, xMax: xMax + buffer, yMax: yMax + buffer };
  }, [pan, scale, containerSize]);

  const lodLevel = useMemo(() => {
    // During interaction, we degrade quality to maintain FPS, but not too aggressively if zoomed in.
    if (isInteracting) {
        if (scale < 0.4) return 'low';    // Box only
        if (scale < 0.8) return 'medium'; // Headers + Count
        return 'high';                    // Full detail (if very close)
    }

    // Static State Thresholds (Relaxed to show details earlier)
    if (scale < 0.35) return 'low';       // Box only (zoomed far out)
    if (scale < 0.5) return 'medium';     // Headers + Count
    return 'high';                        // Full detail (zoomed in > 0.5)
  }, [scale, isInteracting]);

  const visibleTables = useMemo(() => {
     if (!isLayoutReady) return [];
     if (debouncedTerm.trim()) return schema.tables.filter(t => !!positions[t.name]);

     const tablesWithName = schema.tables.filter(t => !!positions[t.name]);
     if (!visibleBounds) return tablesWithName;

     return tablesWithName.filter(t => {
        const pos = positions[t.name];
        if (!pos) return false;
        // Simple point check is faster than full rect intersection for culling
        return (
           pos.x + TABLE_WIDTH > visibleBounds.xMin &&
           pos.x < visibleBounds.xMax &&
           pos.y + 100 > visibleBounds.yMin && // Assume 100px min height for culling
           pos.y < visibleBounds.yMax
        );
     });
  }, [positions, visibleBounds, isLayoutReady, schema.tables, debouncedTerm]);

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
    
    triggerInteraction(); // Mark as interacting
    
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

  // Generate Connections (Optimized)
  const connections = useMemo(() => {
    // 1. Performance Gate: If interacting or too many tables, hide connections unless specifically focused
    if (isInteracting && visibleTables.length > 50) return []; 
    // If not hovering anything, and massive amount of tables, hide connections to prevent hairball
    if (visibleTables.length > 300 && !hoveredNode) return []; 

    const lines: React.ReactElement[] = [];
    // Fast lookup for visibility
    const visibleSet = new Set(visibleTables.map(t => t.name));

    visibleTables.forEach(table => {
      const startPos = positions[table.name];
      if (!startPos) return;
      
      // If focusing on a specific node, skip others to reduce noise
      if (hoveredNode) {
         const isRelated = table.name === hoveredNode || relationshipGraph[hoveredNode]?.has(table.name);
         if (!isRelated) return;
      }

      table.columns.forEach((col, colIndex) => {
        if (col.isForeignKey && col.references) {
          const [targetTable] = col.references.split('.');
          
          // Optimization: Only draw if target is visible OR if we are focused on this relationship
          if (!visibleSet.has(targetTable) && !hoveredNode) return;

          // Focus filter again for the specific line
          if (hoveredNode) {
             const isLineRelevant = table.name === hoveredNode || targetTable === hoveredNode;
             if (!isLineRelevant) return;
          }

          const endPos = positions[targetTable];
          if (!endPos) return;

          const opacity = hoveredNode ? 0.8 : (lodLevel === 'low' ? 0.3 : 0.6);
          const strokeColor = hoveredNode ? "#6366f1" : "#94a3b8"; // Indigo if focused, slate if not
          const strokeWidth = hoveredNode ? 3 : (lodLevel === 'low' ? 1 : 2);

          const startX = startPos.x + TABLE_WIDTH;
          const startY = lodLevel === 'high' || hoveredNode 
             ? startPos.y + HEADER_HEIGHT + (colIndex * ROW_HEIGHT) + (ROW_HEIGHT / 2)
             : startPos.y + (HEADER_HEIGHT / 2);
          
          const endX = endPos.x;
          // Approximate target Y to save loop time in low detail, unless focused
          const endY = endPos.y + (HEADER_HEIGHT / 2);

          const dist = Math.abs(endX - startX);
          const controlOffset = Math.max(dist * 0.5, 50);
          
          // Simplify path calculation
          const pathD = lodLevel === 'low' && !hoveredNode
            ? `M ${startX} ${startY} L ${endX} ${endY}`
            : `M ${startX} ${startY} C ${startX + controlOffset} ${startY}, ${endX - controlOffset} ${endY}, ${endX} ${endY}`;

          lines.push(
            <path 
              key={`${table.name}-${col.name}`}
              d={pathD} 
              stroke={strokeColor} 
              strokeWidth={strokeWidth} 
              fill="none" 
              opacity={opacity} 
              className="pointer-events-none transition-all duration-300"
              markerEnd={lodLevel === 'high' || hoveredNode ? "url(#arrowhead)" : undefined}
            />
          );
        }
      });
    });
    return lines;
  }, [visibleTables, positions, lodLevel, isInteracting, schema.tables, hoveredNode, relationshipGraph]);

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
                 {visibleTables.length > 300 && !hoveredNode && <p className="text-amber-500">• Conexões ocultas (+300)</p>}
              </div>
           </div>

           <div className="bg-indigo-50 dark:bg-indigo-900/30 px-3 py-2 rounded-lg shadow-sm border border-indigo-100 dark:border-indigo-800 pointer-events-auto flex gap-2 items-start max-w-[260px]">
              <HelpCircle className="w-4 h-4 text-indigo-500 shrink-0 mt-0.5" />
              <p className="text-[10px] text-indigo-800 dark:text-indigo-200">
                 Passe o mouse sobre uma tabela para entrar no <strong>Modo Foco</strong> e ver apenas as conexões relacionadas.
              </p>
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
               // willChange: 'transform' // Disabled to prevent blurriness on non-retina displays
             }}
             className={`relative w-full h-full ${isInteracting ? '' : 'transition-transform duration-200 ease-out'}`}
          >
             <svg className="absolute inset-0 pointer-events-none overflow-visible w-full h-full" style={{ zIndex: 0 }}>
               <defs>
                  <marker id="arrowhead" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">
                    <polygon points="0 0, 10 3.5, 0 7" fill={hoveredNode ? "#6366f1" : "#94a3b8"} />
                  </marker>
               </defs>
               {connections}
             </svg>

             {visibleTables.map(table => {
                const pos = positions[table.name];
                if (!pos) return null;
                
                const isHovered = hoveredNode === table.name;
                const isRelated = !hoveredNode || hoveredNode === table.name || relationshipGraph[hoveredNode]?.has(table.name);
                
                // Determine display mode: Hover always high, otherwise use LOD
                const displayLOD = isHovered ? 'high' : lodLevel;
                const isVeryLowDetail = lodLevel === 'low' && !isHovered;
                
                return (
                   <div
                      key={table.name}
                      onMouseDown={(e) => handleMouseDown(e, table.name)}
                      onMouseEnter={() => !isInteracting && setHoveredNode(table.name)}
                      onMouseLeave={() => setHoveredNode(null)}
                      style={{
                         transform: `translate(${pos.x}px, ${pos.y}px)`,
                         width: TABLE_WIDTH,
                         zIndex: isHovered ? 100 : (isRelated ? 20 : 10),
                      }}
                      className={`absolute rounded-lg cursor-grab active:cursor-grabbing transition-transform duration-200
                         ${!isRelated ? 'opacity-20 grayscale filter' : 'opacity-100'}
                         ${isVeryLowDetail ? 'bg-indigo-200 dark:bg-indigo-900 border border-indigo-300 dark:border-indigo-800 h-8 flex items-center justify-center' : 'bg-white dark:bg-slate-800 shadow-lg border border-slate-200 dark:border-slate-700'}
                         ${isHovered ? 'border-indigo-500 ring-2 ring-indigo-500 shadow-xl scale-105' : ''}
                      `}
                   >
                      {isVeryLowDetail ? (
                         // Low Detail Box
                         <span className="text-[10px] font-bold text-indigo-900 dark:text-indigo-200 truncate px-2">{table.name}</span>
                      ) : (
                         <>
                            {/* Header */}
                            <div className={`
                               flex items-center justify-between px-3 py-2 border-b border-slate-100 dark:border-slate-700/50
                               ${debouncedTerm ? 'bg-indigo-50 dark:bg-indigo-900/50' : 'bg-slate-50 dark:bg-slate-900/50'}
                            `}>
                               <span className="font-bold text-xs text-slate-700 dark:text-slate-200 truncate" title={table.name}>{table.name}</span>
                               <span className="text-[9px] text-slate-400">{table.schema}</span>
                            </div>
                            
                            {/* Columns - HIGH DETAIL */}
                            {displayLOD === 'high' && (
                               <div className="py-1">
                                  {table.columns.slice(0, 15).map(col => (
                                     <div key={col.name} className="px-3 py-1 flex items-center justify-between text-[10px] hover:bg-slate-50 dark:hover:bg-slate-700/50">
                                        <div className="flex items-center gap-1.5 overflow-hidden">
                                           {col.isPrimaryKey && <span className="text-amber-500 font-bold">PK</span>}
                                           {col.isForeignKey && <span className="text-blue-500 font-bold">FK</span>}
                                           <span className="truncate text-slate-600 dark:text-slate-400">{col.name}</span>
                                        </div>
                                        <span className="text-slate-300 font-mono text-[8px]">{col.type.split('(')[0]}</span>
                                     </div>
                                  ))}
                                  {table.columns.length > 15 && <div className="px-3 py-1 text-[9px] text-slate-400 italic">...mais {table.columns.length - 15}</div>}
                               </div>
                            )}

                            {/* Info - MEDIUM DETAIL */}
                            {displayLOD === 'medium' && (
                               <div className="px-3 py-2 text-[10px] text-slate-400 flex justify-between">
                                  <span>{table.columns.length} cols</span>
                                  {table.columns.some(c => c.isPrimaryKey) && <span className="text-amber-500">PK</span>}
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
