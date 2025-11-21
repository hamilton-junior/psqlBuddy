
import React, { useState } from 'react';
import { DatabaseSchema } from '../types';
import { Database, Table as TableIcon, Key, ArrowRight, Search, Loader2, X } from 'lucide-react';

interface SchemaViewerProps {
  schema: DatabaseSchema;
  onRegenerateClick: () => void;
  loading?: boolean;
}

const SchemaViewer: React.FC<SchemaViewerProps> = ({ schema, onRegenerateClick, loading = false }) => {
  const [searchTerm, setSearchTerm] = useState('');

  const filteredTables = schema.tables.filter(table => 
    table.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    (table.description && table.description.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  return (
    <div className="h-full flex flex-col bg-white border-r border-slate-200 overflow-hidden">
      {/* Header */}
      <div className="p-4 border-b border-slate-100 bg-slate-50 flex justify-between items-center shrink-0">
        <div className="flex items-center gap-2 text-slate-700">
          <Database className="w-5 h-5 text-indigo-600" />
          <h2 className="font-semibold text-sm uppercase tracking-wider truncate max-w-[120px]">
            {loading ? 'Loading...' : `Schema: ${schema.name}`}
          </h2>
        </div>
        <button 
          onClick={onRegenerateClick}
          disabled={loading}
          className="text-xs text-indigo-600 hover:text-indigo-800 hover:underline disabled:opacity-50"
        >
          Change DB
        </button>
      </div>

      {/* Search Bar */}
      <div className="p-2 border-b border-slate-100 shrink-0">
        <div className="relative">
          <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Filter tables..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            disabled={loading}
            className="w-full pl-9 pr-8 py-2 bg-slate-50 border border-slate-200 rounded text-xs focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
          />
          {searchTerm && (
            <button 
              onClick={() => setSearchTerm('')}
              className="absolute right-2 top-2.5 text-slate-400 hover:text-slate-600"
            >
              <X className="w-3 h-3" />
            </button>
          )}
        </div>
      </div>
      
      {/* Content Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        {loading ? (
          // Skeleton Loader
          <div className="space-y-6 animate-pulse">
            {[1, 2, 3].map((i) => (
              <div key={i} className="space-y-2">
                <div className="h-5 bg-slate-200 rounded w-3/4"></div>
                <div className="pl-4 space-y-2 border-l-2 border-slate-100 ml-2">
                  <div className="h-3 bg-slate-100 rounded w-full"></div>
                  <div className="h-3 bg-slate-100 rounded w-5/6"></div>
                  <div className="h-3 bg-slate-100 rounded w-4/6"></div>
                </div>
              </div>
            ))}
          </div>
        ) : filteredTables.length === 0 ? (
          <div className="text-center py-8 text-slate-400 text-xs italic">
            No tables match your search.
          </div>
        ) : (
          filteredTables.map((table) => (
            <div key={table.name} className="group">
              <div className="flex items-center gap-2 mb-2 text-slate-800 font-medium">
                <TableIcon className="w-4 h-4 text-slate-400" />
                <span>{table.name}</span>
              </div>
              {table.description && (
                <div className="text-[10px] text-slate-400 mb-1.5 pl-6 italic leading-tight">
                  {table.description}
                </div>
              )}
              <div className="pl-2 border-l-2 border-slate-100 ml-2 space-y-1">
                {table.columns.map((col) => (
                  <div key={col.name} className="flex items-center text-xs text-slate-600 py-0.5 hover:bg-slate-50 rounded px-1 group/col">
                    <div className="w-4 mr-1 flex justify-center">
                      {col.isPrimaryKey && (
                        <div title="Primary Key" className="cursor-help">
                          <Key className="w-3 h-3 text-amber-500 transform rotate-45" />
                        </div>
                      )}
                      {col.isForeignKey && (
                         <div title={`Foreign Key -> ${col.references || 'Unknown'}`} className="cursor-help">
                           <ArrowRight className="w-3 h-3 text-blue-400" />
                         </div>
                      )}
                    </div>
                    <span className="font-mono text-slate-700 mr-2" title={col.name}>{col.name}</span>
                    <span className="text-slate-400 text-[10px]">{col.type.toLowerCase()}</span>
                  </div>
                ))}
              </div>
            </div>
          ))
        )}
      </div>
      
      <div className="p-4 bg-slate-50 border-t border-slate-200 text-xs text-slate-500 shrink-0">
        <p>Tip: Hover over icons for details.</p>
      </div>
    </div>
  );
};

export default SchemaViewer;
