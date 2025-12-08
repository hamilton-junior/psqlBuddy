
import React, { useState, useRef } from 'react';
import { X, Calculator, Plus, Table2, Check, Braces } from 'lucide-react';

interface AvailableColumn {
  table: string;
  column: string;
  fullId: string;
  type: string;
}

interface FormulaModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (alias: string, expression: string) => void;
  availableColumns: AvailableColumn[];
}

const FormulaModal: React.FC<FormulaModalProps> = ({ isOpen, onClose, onSave, availableColumns }) => {
  const [alias, setAlias] = useState('');
  const [expression, setExpression] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  if (!isOpen) return null;

  const handleInsertColumn = (colId: string) => {
    const textarea = textareaRef.current;
    if (!textarea) {
       setExpression(prev => prev + colId);
       return;
    }

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const text = textarea.value;
    
    const newText = text.substring(0, start) + colId + text.substring(end);
    setExpression(newText);
    
    // Restore focus and move cursor
    setTimeout(() => {
       textarea.focus();
       textarea.selectionStart = textarea.selectionEnd = start + colId.length;
    }, 0);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (alias.trim() && expression.trim()) {
      onSave(alias.trim().replace(/\s+/g, '_').toLowerCase(), expression.trim());
      setAlias('');
      setExpression('');
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-[100] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="bg-white dark:bg-slate-800 w-full max-w-2xl rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700 flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="p-5 border-b border-slate-100 dark:border-slate-700 flex justify-between items-center bg-slate-50 dark:bg-slate-900/50">
          <div className="flex items-center gap-3">
             <div className="p-2 bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 rounded-lg">
                <Calculator className="w-6 h-6" />
             </div>
             <div>
                <h3 className="text-lg font-bold text-slate-800 dark:text-white">Nova Coluna Calculada</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">Crie campos virtuais usando expressões SQL</p>
             </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors p-2 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-6">
           <form id="formula-form" onSubmit={handleSubmit} className="space-y-5">
              
              {/* Alias Input */}
              <div>
                 <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">
                    Nome da Coluna (Alias) <span className="text-red-500">*</span>
                 </label>
                 <input 
                    type="text" 
                    value={alias}
                    onChange={(e) => setAlias(e.target.value)}
                    placeholder="ex: total_venda, lucro_liquido"
                    className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-bold text-slate-800 dark:text-white focus:ring-2 focus:ring-indigo-500 outline-none font-mono"
                    autoFocus
                    required
                 />
                 <p className="text-[10px] text-slate-400 mt-1.5 ml-1">Será usado como o nome da coluna no resultado (AS alias).</p>
              </div>

              {/* Expression Input */}
              <div>
                 <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">
                    Expressão SQL <span className="text-red-500">*</span>
                 </label>
                 <div className="relative">
                    <textarea 
                       ref={textareaRef}
                       value={expression}
                       onChange={(e) => setExpression(e.target.value)}
                       placeholder="ex: (products.price * order_items.quantity) - discounts.amount"
                       className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-sm text-slate-700 dark:text-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none font-mono h-32 resize-none leading-relaxed"
                       required
                    />
                    <div className="absolute right-3 bottom-3">
                       <Braces className="w-4 h-4 text-slate-400" />
                    </div>
                 </div>
              </div>

              {/* Column Suggestions */}
              <div>
                 <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-2">
                    <Table2 className="w-3.5 h-3.5" /> Inserir Colunas Disponíveis
                 </label>
                 <div className="bg-slate-50 dark:bg-slate-900/50 p-3 rounded-xl border border-slate-100 dark:border-slate-800 max-h-40 overflow-y-auto custom-scrollbar">
                    {availableColumns.length === 0 ? (
                       <p className="text-xs text-slate-400 text-center py-2">Nenhuma tabela selecionada.</p>
                    ) : (
                       <div className="flex flex-wrap gap-2">
                          {availableColumns.map(col => (
                             <button
                                key={col.fullId}
                                type="button"
                                onClick={() => handleInsertColumn(col.fullId)}
                                className="px-2 py-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:border-indigo-400 dark:hover:border-indigo-500 hover:text-indigo-600 dark:hover:text-indigo-400 rounded-md text-xs font-mono text-slate-600 dark:text-slate-400 transition-all flex items-center gap-1 group"
                                title={`Inserir ${col.fullId}`}
                             >
                                <span className="opacity-50 group-hover:opacity-100">+</span> {col.fullId}
                             </button>
                          ))}
                       </div>
                    )}
                 </div>
              </div>

           </form>
        </div>

        {/* Footer */}
        <div className="p-4 bg-slate-50 dark:bg-slate-900 border-t border-slate-200 dark:border-slate-700 flex justify-end gap-3">
          <button 
            onClick={onClose}
            type="button"
            className="px-4 py-2 text-sm text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-lg transition-colors font-medium"
          >
            Cancelar
          </button>
          <button 
            type="submit"
            form="formula-form"
            disabled={!alias.trim() || !expression.trim()}
            className="px-6 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold rounded-lg shadow-lg shadow-indigo-200 dark:shadow-none flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
          >
            <Check className="w-4 h-4" />
            Adicionar Fórmula
          </button>
        </div>

      </div>
    </div>
  );
};

export default FormulaModal;
