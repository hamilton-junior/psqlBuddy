import React, { useState, useRef, useEffect, useMemo } from 'react';
import { DatabaseSchema } from '../types';
import { X, ZoomIn, ZoomOut, Move, Maximize, MousePointer2 } from 'lucide-react';

interface SchemaDiagramModalProps {
  schema: DatabaseSchema;
  onClose: () => void;
}

interface NodePosition {
  x: number;
  y: number;
}

const TABLE_WIDTH = 180;
const HEADER_HEIGHT = 36;
const ROW_HEIGHT = 24;

const SchemaDiagramModal: React.FC<SchemaDiagramModalProps> = ({ schema, onClose }) => {
  const [positions, setPositions] = useState<Record<string, NodePosition>>({});
  const [scale, setScale] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isDraggingCanvas, setIsDraggingCanvas] = useState(false);
  const [draggedNode, setDraggedNode] = useState<string | null>(null);
  
  const containerRef = useRef<HTMLDivElement>(null);
  const lastMousePos = useRef({ x: 0, y: 0 });

  // Initial Auto-Layout
  useEffect(() => {
    const newPositions: Record<string, NodePosition> = {};
    const cols = Math.ceil(Math.sqrt(schema.tables.length));
    const spacingX = 250;
    const spacingY = 300; // More vertical space for columns

    schema.tables.forEach((table, index) => {
      const col = index % cols;
      const row = Math.floor(index / cols);
      newPositions[table.name] = {
        x: col * spacingX + 50,
        y: row * spacingY + 50
      };
    });
    setPositions(newPositions);
  }, [schema]);

  const handleMouseDown = (e: React.MouseEvent, tableName?: string) => {
    e.stopPropagation();
    lastMousePos.current = { x: e.clientX, y: e.clientY };
    if (tableName) {
      setDraggedNode(tableName);
    } else {
      setIsDraggingCanvas(true);
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
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
    const zoomSensitivity = 0.001;
    const newScale = Math.min(Math.max(0.1, scale - e.deltaY * zoomSensitivity), 3);
    setScale(newScale);
  };

  // Generate Connections (SVG Paths)
  const connections = useMemo(() => {
    const lines: React.ReactElement[] = [];
    schema.tables.forEach(table => {
      const startPos = positions[table.name];
      if (!startPos) return;

      table.columns.forEach((col, colIndex) => {
        if (col.isForeignKey && col.references) {
          const [targetTable, targetCol] = col.references.split('.');
          const endPos = positions[targetTable];
          if (!endPos) return;

          // Simple anchor points
          const startX = startPos.x + TABLE_WIDTH;
          const startY = startPos.y + HEADER_HEIGHT + (colIndex * ROW_HEIGHT) + (ROW_HEIGHT / 2);
          
          // Find target column index for better Y precision
          const targetTableDef = schema.tables.find(t => t.name === targetTable);
          const targetColIndex = targetTableDef?.columns.findIndex(c => c.name === targetCol) ?? 0;
          
          const endX = endPos.x;
          const endY = endPos.y + HEADER_HEIGHT + (targetColIndex * ROW_HEIGHT) + (ROW_HEIGHT / 2);

          // Bezier Curve
          const pathD = `M ${startX} ${startY} C ${startX + 50} ${startY}, ${endX - 50} ${endY}, ${endX} ${endY}`;
          
          lines.push(
            <g key={`${table.name}-${col.name}`}>
               <path 
                  d={pathD} 
                  stroke="#6366f1" 
                  strokeWidth="2" 
                  fill="none" 
                  opacity="0.6" 
                  markerEnd="url(#arrowhead)"
               />
               <circle cx={startX} cy={startY} r="3" fill="#6366f1" />
               <circle cx={endX} cy={endY} r="3" fill="#6366f1" />
            </g>
          );
        }
      });
    });
    return lines;
  }, [schema, positions]);

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/90 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-slate-100 dark:bg-slate-900 w-full h-full rounded-xl shadow-2xl overflow-hidden relative border border-slate-700 flex flex-col">
        
        {/* Toolbar */}
        <div className="absolute top-4 left-4 z-10 flex gap-2">
           <div className="bg-white dark:bg-slate-800 p-1.5 rounded-lg shadow-md border border-slate-200 dark:border-slate-700 flex gap-1">
              <button onClick={() => setScale(s => Math.min(s + 0.1, 3))} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded text-slate-600 dark:text-slate-300"><ZoomIn className="w-5 h-5" /></button>
              <button onClick={() => setScale(s => Math.max(s - 0.1, 0.1))} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded text-slate-600 dark:text-slate-300"><ZoomOut className="w-5 h-5" /></button>
              <button onClick={() => { setScale(1); setPan({x:0, y:0}); }} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded text-slate-600 dark:text-slate-300"><Maximize className="w-5 h-5" /></button>
           </div>
           <div className="bg-white/90 dark:bg-slate-800/90 px-3 py-2 rounded-lg shadow-md border border-slate-200 dark:border-slate-700 flex items-center gap-2 text-xs font-medium text-slate-500">
              <MousePointer2 className="w-4 h-4" />
              <span>Arraste tabelas para organizar</span>
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
               height: '100%'
             }}
             className="relative w-full h-full"
          >
             <svg className="absolute inset-0 pointer-events-none overflow-visible w-full h-full" style={{ zIndex: 0 }}>
               <defs>
                  <marker id="arrowhead" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">
                    <polygon points="0 0, 10 3.5, 0 7" fill="#6366f1" />
                  </marker>
               </defs>
               {connections}
             </svg>

             {/* Nodes */}
             {schema.tables.map(table => {
                const pos = positions[table.name] || {x: 0, y: 0};
                return (
                   <div
                      key={table.name}
                      onMouseDown={(e) => handleMouseDown(e, table.name)}
                      style={{
                         transform: `translate(${pos.x}px, ${pos.y}px)`,
                         width: TABLE_WIDTH,
                      }}
                      className="absolute bg-white dark:bg-slate-800 rounded-lg shadow-xl border-2 border-slate-200 dark:border-slate-700 cursor-grab active:cursor-grabbing hover:border-indigo-400 dark:hover:border-indigo-500 transition-colors z-10"
                   >
                      {/* Node Header */}
                      <div className="h-9 bg-slate-100 dark:bg-slate-900/50 border-b border-slate-200 dark:border-slate-700 px-3 flex items-center justify-between rounded-t-md">
                         <span className="text-xs font-bold text-slate-700 dark:text-slate-200 truncate" title={table.name}>
                            {table.name}
                         </span>
                         <span className="text-[9px] text-slate-400 uppercase">{table.schema}</span>
                      </div>
                      
                      {/* Columns */}
                      <div className="py-1">
                         {table.columns.map(col => (
                            <div key={col.name} className="px-3 py-1 flex items-center justify-between text-[10px] hover:bg-slate-50 dark:hover:bg-slate-700/50">
                               <div className="flex items-center gap-1.5 overflow-hidden">
                                  {col.isPrimaryKey && <span className="text-amber-500 font-bold text-[8px]">PK</span>}
                                  {col.isForeignKey && <span className="text-blue-500 font-bold text-[8px]">FK</span>}
                                  <span className={`truncate ${col.isPrimaryKey ? 'font-bold text-slate-800 dark:text-slate-100' : 'text-slate-600 dark:text-slate-400'}`}>
                                     {col.name}
                                  </span>
                               </div>
                               <span className="text-slate-400 font-mono text-[9px]">{col.type.split('(')[0]}</span>
                            </div>
                         ))}
                      </div>
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