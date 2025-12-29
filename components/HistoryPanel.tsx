
import React from 'react';
import { HistoryItem } from '../types';
import { Undo2, History, RotateCcw } from 'lucide-react';

interface HistoryPanelProps {
  history: HistoryItem[];
  onRevert: (historyItem: HistoryItem) => void;
  onRevertToOriginal: () => void;
}

export const HistoryPanel: React.FC<HistoryPanelProps> = ({
  history,
  onRevert,
  onRevertToOriginal
}) => {
  return (
    <div className="absolute top-4 right-4 z-40 w-72 bg-slate-900/90 backdrop-blur-md border border-slate-700 rounded-2xl shadow-2xl overflow-hidden animate-fadeIn flex flex-col max-h-[500px]">
      <div className="p-4 border-b border-slate-800 bg-slate-900 flex items-center justify-between">
        <h3 className="text-sm font-bold text-white flex items-center gap-2">
          <History size={16} className="text-indigo-400" />
          Edit History
        </h3>
        <span className="text-xs text-slate-500">{history.length} Edits</span>
      </div>
      
      <div className="flex-1 overflow-y-auto custom-scrollbar p-2 space-y-2">
        {/* Original State */}
        <div className="p-2 flex items-center gap-3 opacity-50 hover:opacity-100 transition-opacity">
           <div className="w-8 h-8 rounded-lg bg-slate-800 border border-slate-700 flex items-center justify-center">
             <RotateCcw size={14} />
           </div>
           <div className="flex-1">
             <div className="text-xs font-medium text-slate-300">Original</div>
           </div>
           <button 
             onClick={onRevertToOriginal}
             className="px-2 py-1 text-[10px] bg-slate-800 hover:bg-slate-700 rounded border border-slate-700"
           >
             Reset
           </button>
        </div>

        {/* History Line */}
        {history.length > 0 && (
          <div className="w-px h-4 bg-slate-800 ml-6 my-1"></div>
        )}

        {/* Edit Steps (Reversed to show newest first) */}
        {[...history].reverse().map((item, index) => (
          <div key={item.id} className="relative group p-3 rounded-xl bg-slate-800/50 border border-slate-700 hover:border-indigo-500/50 transition-all">
             <div className="flex items-start gap-3">
               <img 
                 src={item.url} 
                 className="w-10 h-10 rounded-lg object-cover bg-slate-950 border border-slate-600" 
                 alt="snapshot"
               />
               <div className="flex-1 min-w-0">
                 <div className="text-xs font-bold text-white truncate">{item.toolLabel}</div>
                 <div className="text-[10px] text-slate-400 truncate mt-0.5">{new Date(item.timestamp).toLocaleTimeString()}</div>
               </div>
             </div>
             
             {/* Revert Button - Only show if not the latest (or logic allows branching) */}
             <button 
               onClick={() => onRevert(item)}
               className="absolute right-2 top-2 p-1.5 rounded-lg bg-indigo-600 text-white opacity-0 group-hover:opacity-100 transition-opacity shadow-lg hover:bg-indigo-500"
               title="Revert to this state"
             >
               <Undo2 size={14} />
             </button>
          </div>
        ))}

        {history.length === 0 && (
          <div className="text-center py-8 text-xs text-slate-500">
            No edits applied yet.
          </div>
        )}
      </div>
    </div>
  );
};
