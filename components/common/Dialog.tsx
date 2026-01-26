
import React, { useState, useEffect } from 'react';
import { X, AlertTriangle, Info, Check, HelpCircle } from 'lucide-react';

interface DialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (inputValue?: string) => void;
  title: string;
  message: string;
  type?: 'info' | 'confirm' | 'danger' | 'prompt';
  confirmLabel?: string;
  cancelLabel?: string;
  placeholder?: string;
  defaultValue?: string;
}

const Dialog: React.FC<DialogProps> = ({ 
  isOpen, onClose, onConfirm, title, message, 
  type = 'confirm', confirmLabel = 'Confirmar', cancelLabel = 'Cancelar',
  placeholder = '', defaultValue = ''
}) => {
  const [inputValue, setInputValue] = useState(defaultValue);

  useEffect(() => {
    if (isOpen) setInputValue(defaultValue);
  }, [isOpen, defaultValue]);

  if (!isOpen) return null;

  const getIcon = () => {
    switch (type) {
      case 'danger': return <AlertTriangle className="w-6 h-6 text-red-500" />;
      case 'info': return <Info className="w-6 h-6 text-blue-500" />;
      case 'prompt': return <HelpCircle className="w-6 h-6 text-indigo-500" />;
      default: return <Check className="w-6 h-6 text-emerald-500" />;
    }
  };

  const handleConfirm = () => {
    onConfirm(type === 'prompt' ? inputValue : undefined);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[200] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="bg-white dark:bg-slate-800 w-full max-w-md rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700 overflow-hidden animate-in zoom-in-95 duration-200">
        <div className="p-6">
          <div className="flex items-center gap-4 mb-4">
             <div className={`p-2 rounded-xl bg-slate-50 dark:bg-slate-900/50`}>
                {getIcon()}
             </div>
             <h3 className="text-lg font-bold text-slate-800 dark:text-white leading-tight">{title}</h3>
          </div>
          
          <p className="text-sm text-slate-600 dark:text-slate-400 mb-6 leading-relaxed whitespace-pre-wrap">
            {message}
          </p>

          {type === 'prompt' && (
            <div className="mb-6">
              <input 
                type="text" 
                autoFocus
                value={inputValue}
                onChange={e => setInputValue(e.target.value)}
                placeholder={placeholder}
                onKeyDown={e => e.key === 'Enter' && handleConfirm()}
                className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-sm outline-none focus:ring-2 focus:ring-indigo-500 text-slate-800 dark:text-white"
              />
            </div>
          )}

          <div className="flex gap-3">
            <button 
              onClick={onClose}
              className="flex-1 px-4 py-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-600 dark:text-slate-300 rounded-xl text-sm font-bold transition-all"
            >
              {cancelLabel}
            </button>
            <button 
              onClick={handleConfirm}
              className={`flex-1 px-4 py-2.5 text-white rounded-xl text-sm font-bold shadow-lg transition-all active:scale-95
                ${type === 'danger' ? 'bg-red-600 hover:bg-red-700 shadow-red-200 dark:shadow-none' : 'bg-indigo-600 hover:bg-indigo-700 shadow-indigo-200 dark:shadow-none'}
              `}
            >
              {confirmLabel}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dialog;
