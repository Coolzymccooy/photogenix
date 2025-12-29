
import React from 'react';
import { HistoryItem } from '../types';
import { RotateCcw, Trash2, CheckCircle2, Save, Terminal, Layers } from 'lucide-react';

interface CheckpointPanelProps {
  checkpoints: HistoryItem[];
  currentUrl: string | null;
  onRestore: (item: HistoryItem) => void;
  onRemove: (id: string) => void;
  onReset: () => void;
}

export const CheckpointPanel: React.FC<CheckpointPanelProps> = ({
  checkpoints,
  currentUrl,
  onRestore,
  onRemove,
  onReset
}) => {
  return (
    <div className="w-64 bg-base border-l border-line flex flex-col shrink-0 overflow-hidden font-mono">
      <div className="p-4 border-b border-line bg-surface flex items-center justify-between">
        <h3 className="text-[10px] font-bold text-white flex items-center gap-2 tracking-widest">
          <Layers size={14} className="text-signal" />
          CHECKPOINTS
        </h3>
        <span className="text-[9px] text-zinc-500">{checkpoints.length} STACKED</span>
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-3 custom-scrollbar">
        {/* Original Base State */}
        <button
          onClick={onReset}
          className="w-full group relative p-2 rounded-sm border border-line bg-zinc-900/50 hover:border-zinc-500 transition-all text-left"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-black border border-zinc-800 flex items-center justify-center rounded-sm">
              <RotateCcw size={16} className="text-zinc-600 group-hover:text-white" />
            </div>
            <div>
              <p className="text-[10px] font-bold text-zinc-400 group-hover:text-white">ORIGINAL_RAW</p>
              <p className="text-[8px] text-zinc-600 uppercase">Input State</p>
            </div>
          </div>
        </button>

        {checkpoints.length > 0 && <div className="h-px bg-line mx-2" />}

        {/* Saved Checkpoints Loop */}
        {[...checkpoints].reverse().map((item) => {
          const isActive = currentUrl === item.url;
          return (
            <div 
              key={item.id} 
              className={`group relative p-2 rounded-sm border transition-all ${
                isActive ? 'border-signal bg-signal/5' : 'border-line hover:border-zinc-700 bg-zinc-900/30'
              }`}
            >
              <div className="flex items-start gap-3">
                <div className="w-12 h-12 bg-black border border-line rounded-sm overflow-hidden shrink-0">
                  <img src={item.url} alt="Checkpoint" className="w-full h-full object-cover opacity-80 group-hover:opacity-100" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className={`text-[10px] font-bold truncate ${isActive ? 'text-signal' : 'text-white'}`}>
                    {item.toolLabel}
                  </p>
                  <p className="text-[8px] text-zinc-500 uppercase mt-0.5">
                    {new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </p>
                </div>
              </div>

              <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <button 
                  onClick={() => onRestore(item)}
                  className="p-1.5 bg-zinc-800 hover:bg-signal text-zinc-400 hover:text-white rounded-sm border border-line"
                  title="Restore this state"
                >
                  <CheckCircle2 size={10} />
                </button>
                <button 
                  onClick={() => onRemove(item.id)}
                  className="p-1.5 bg-zinc-800 hover:bg-red-950 text-zinc-400 hover:text-red-400 rounded-sm border border-line"
                  title="Remove from loop"
                >
                  <Trash2 size={10} />
                </button>
              </div>

              {isActive && (
                <div className="mt-2 h-0.5 bg-signal w-full relative overflow-hidden">
                  <div className="absolute inset-0 bg-white/20 animate-pulse"></div>
                </div>
              )}
            </div>
          );
        })}

        {checkpoints.length === 0 && (
          <div className="py-10 text-center space-y-2 opacity-30">
            <Save size={24} className="mx-auto text-zinc-600" />
            <p className="text-[9px] uppercase tracking-tighter">No_States_Saved</p>
          </div>
        )}
      </div>

      <div className="p-4 bg-surface border-t border-line text-[9px] text-zinc-600">
        <div className="flex items-center gap-2 mb-2">
            <Terminal size={10} />
            <span>SESSION_CACHE: ACTIVE</span>
        </div>
        <p className="leading-tight">Checkpoints allow non-destructive branching in your workflow.</p>
      </div>
    </div>
  );
};
