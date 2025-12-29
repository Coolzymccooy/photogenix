import React from 'react';
import { HistoryItem } from '../types';
import { Clock, Check } from 'lucide-react';

interface HistoryStripProps {
  history: HistoryItem[];
  currentId: string | null;
  onSelect: (item: HistoryItem) => void;
}

export const HistoryStrip: React.FC<HistoryStripProps> = ({
  history,
  currentId,
  onSelect
}) => {
  if (history.length === 0) return null;

  return (
    <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-40 max-w-[90vw]">
      <div className="bg-slate-900/80 backdrop-blur-md border border-slate-700/50 rounded-2xl p-2 shadow-2xl flex items-center gap-2 overflow-x-auto custom-scrollbar">
        <div className="px-3 text-xs font-semibold text-slate-500 uppercase flex items-center gap-2 border-r border-slate-700/50 mr-1">
          <Clock size={14} />
          <span>Versions</span>
        </div>
        
        {history.map((item) => (
          <button
            key={item.id}
            onClick={() => onSelect(item)}
            className={`relative group flex-shrink-0 w-16 h-16 rounded-xl overflow-hidden border-2 transition-all duration-200 ${
              currentId === item.id 
                ? 'border-indigo-500 shadow-[0_0_10px_rgba(99,102,241,0.3)] scale-105' 
                : 'border-transparent hover:border-slate-500 opacity-70 hover:opacity-100'
            }`}
          >
            <img 
              src={item.url} 
              alt={item.toolLabel} 
              className="w-full h-full object-cover"
            />
            {currentId === item.id && (
               <div className="absolute inset-0 bg-indigo-500/20 flex items-center justify-center">
                 <Check size={20} className="text-white drop-shadow-md" />
               </div>
            )}
            <div className="absolute bottom-0 left-0 right-0 bg-black/60 text-[8px] text-white text-center py-0.5 truncate px-1">
              {item.toolLabel}
            </div>
          </button>
        ))}
      </div>
    </div>
  );
};
