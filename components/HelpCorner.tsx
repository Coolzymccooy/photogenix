
import React, { useState } from 'react';
import { X, Book, Terminal, Cpu, Zap, Search, HelpCircle, Layers, Target, Info, Palette, Grid, Search as SearchIcon, Maximize2, ZoomIn, CheckCircle2, ChevronRight } from 'lucide-react';

interface ToolDoc {
  id: string;
  name: string;
  category: string;
  logic: string;
  bestUse: string;
  techSpec: string;
}

const TOOL_DOCS: ToolDoc[] = [
  { id: 'neural-beauty', name: 'NEURAL_BEAUTY', category: 'MASTER', logic: '32-bit color harmonizer. Balances skin tones, highlight roll-off, and micro-contrast.', bestUse: 'The FINAL step for every portrait or landscape. Absolute color perfection.', techSpec: 'BeautyEngine v2.0' },
  { id: 'spot-heal-pro', name: 'PRO_SPOT_HEAL', category: 'CORE', logic: 'Precision targeting. ACTIVATE tool, then MANUAL TOUCH (Click) the area to reconstruct. Zoom in for higher accuracy.', bestUse: 'Removing blemishes, stray hairs, or sensor dust with surgical precision.', techSpec: 'Point Diffusion v3.1' },
  { id: 'board-nav', name: 'BOARD_NAVIGATION', category: 'HUD_UX', logic: 'Neural Zoom & Pan. Adjust view scale from 50% to 300% to inspect high-frequency detail.', bestUse: 'Essential for Spot Healing and checking Neural Sharpness levels.', techSpec: 'ViewCore v1.0' },
  { id: 'super-engine', name: 'SUPER_ENGINE', category: 'MASTER', logic: 'Utilizes 16-bit linear depth mapping to reconstruct lost highlight and shadow data.', bestUse: 'Initial step for every high-end professional workflow.', techSpec: 'Linear Pipeline v4.2' },
  { id: 'aspect-ratio', name: 'NEURAL_FORMAT', category: 'MASTER', logic: 'Intelligent canvas resizing. Uses context-aware extension to fill gaps when switching ratios.', bestUse: 'Changing between Portrait (9:16) and Landscape (16:9) formats.', techSpec: 'Spatial Transformer' },
  { id: 'logo-gen', name: 'NEURAL_LOGO', category: 'IDENTITY', logic: 'Synthesizes brand assets from text prompts and composites them using edge-detection blending.', bestUse: 'Creating professional watermarks or brand logos directly on the final shot.', techSpec: 'Vector Synth Engine' },
  { id: '3d-pop', name: '3D_POP_VOL', category: 'FX', logic: 'Generates a volumetric lighting map to add "roundness" and depth to flat subjects.', bestUse: 'Portraits and product photography looking for "expensive" depth.', techSpec: 'Depth Estimator v2.0' },
  { id: 'collage', name: 'PRO_COLLAGE', category: 'COLLECT', logic: 'Analyzes visual hierarchy across multiple frames to generate an optimal aesthetic layout.', bestUse: 'Summarizing a shoot or creating social media grid assets.', techSpec: 'Spatial Transformer' }
];

const WORKFLOW_STEPS = [
  { id: 1, title: 'RAW_INGEST', desc: 'Upload images via the bottom Gallery. RAW files will auto-develop into high-bit depth workspaces.' },
  { id: 2, title: 'MASTER_ENGINE', desc: 'Apply SUPER_ENGINE first to recover dynamic range and set a neutral technical base.' },
  { id: 3, title: 'PRECISION_HEAL', desc: 'Zoom in (200%+), select SPOT_HEAL, and click blemishes manually to reconstruct texture.' },
  { id: 4, title: 'FORMAT_STYLE', desc: 'Apply NEURAL_FORMAT for crops or choose a PRO_FILM preset for stylistic character.' },
  { id: 5, title: 'NEURAL_FINISH', desc: 'Finalize with NEURAL_BEAUTY for absolute color harmony and publication-ready balance.' }
];

export const HelpCorner: React.FC<{ isOpen: boolean; onClose: () => void }> = ({ isOpen, onClose }) => {
  const [search, setSearch] = useState('');
  const [activeTab, setActiveTab] = useState<'tools' | 'workflow'>('workflow');

  if (!isOpen) return null;

  const filtered = TOOL_DOCS.filter(d => 
    d.name.toLowerCase().includes(search.toLowerCase()) || 
    d.logic.toLowerCase().includes(search.toLowerCase()) ||
    d.category.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="fixed inset-y-0 right-0 w-96 bg-base border-l border-line z-[100] shadow-2xl flex flex-col animate-in slide-in-from-right duration-300 font-mono">
      <div className="p-6 bg-surface border-b border-line flex justify-between items-center">
        <div className="flex items-center gap-3">
          <Terminal size={18} className="text-signal" />
          <h2 className="text-sm font-bold text-white tracking-widest uppercase">NEURAL_MANIFEST</h2>
        </div>
        <button onClick={onClose} className="text-zinc-500 hover:text-white transition-colors">
          <X size={20} />
        </button>
      </div>

      <div className="flex border-b border-line">
        <button 
          onClick={() => setActiveTab('workflow')}
          className={`flex-1 py-3 text-[10px] font-bold tracking-widest uppercase transition-colors ${activeTab === 'workflow' ? 'bg-surface text-signal border-b-2 border-signal' : 'text-zinc-500 hover:text-zinc-300'}`}
        >
          Workflow_Guide
        </button>
        <button 
          onClick={() => setActiveTab('tools')}
          className={`flex-1 py-3 text-[10px] font-bold tracking-widest uppercase transition-colors ${activeTab === 'tools' ? 'bg-surface text-signal border-b-2 border-signal' : 'text-zinc-500 hover:text-zinc-300'}`}
        >
          Tool_Manifest
        </button>
      </div>

      {activeTab === 'workflow' ? (
        <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar bg-zinc-950/20">
           <div className="p-4 bg-signal/5 border border-signal/20 rounded-sm">
              <p className="text-[9px] text-zinc-400 uppercase leading-relaxed">
                Follow this sequence to reduce manual work by 90% and achieve professional neural results.
              </p>
           </div>
           <div className="space-y-4">
              {WORKFLOW_STEPS.map((step) => (
                <div key={step.id} className="relative pl-10 group">
                   <div className="absolute left-0 top-0 w-8 h-8 rounded-full border border-line bg-surface flex items-center justify-center text-[10px] font-bold text-zinc-500 group-hover:border-signal group-hover:text-signal transition-colors">
                      {step.id}
                   </div>
                   {step.id < 5 && <div className="absolute left-4 top-8 w-px h-8 bg-line" />}
                   <h4 className="text-[10px] font-bold text-white uppercase tracking-widest mb-1">{step.title}</h4>
                   <p className="text-[9px] text-zinc-500 leading-relaxed uppercase">{step.desc}</p>
                </div>
              ))}
           </div>
           <div className="pt-4">
              <div className="p-4 border border-line bg-surface/30 rounded-sm flex items-center gap-3">
                 <CheckCircle2 size={16} className="text-emerald-500" />
                 <span className="text-[9px] text-emerald-500 font-bold uppercase tracking-widest">Pipeline Operational</span>
              </div>
           </div>
        </div>
      ) : (
        <>
          <div className="p-4 border-b border-line bg-zinc-900/50">
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-600" />
              <input 
                type="text"
                placeholder="FILTER_TOOLS..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full bg-base border border-line rounded-sm py-2 pl-10 pr-4 text-[10px] text-white focus:outline-none focus:border-signal uppercase tracking-widest placeholder:opacity-30"
              />
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar">
            {filtered.map((doc) => (
              <div key={doc.id} className="p-4 bg-surface border border-line hover:border-signal/50 transition-all group relative overflow-hidden">
                <div className="absolute top-0 right-0 p-1 opacity-10 group-hover:opacity-100 transition-opacity">
                   <span className="text-[6px] text-zinc-400 font-mono tracking-tighter">{doc.techSpec}</span>
                </div>
                <div className="flex justify-between items-start mb-2">
                  <span className="text-[10px] font-bold text-signal">{doc.category}</span>
                  <Cpu size={12} className="text-zinc-700 group-hover:text-signal transition-colors" />
                </div>
                <h3 className="text-xs font-bold text-white mb-3 uppercase tracking-wider">{doc.name}</h3>
                <div className="space-y-3">
                  <div className="flex gap-3">
                    <Zap size={10} className="text-zinc-500 mt-1 shrink-0" />
                    <p className="text-[9px] text-zinc-400 leading-relaxed uppercase">{doc.logic}</p>
                  </div>
                  <div className="flex gap-3">
                    <Info size={10} className="text-emerald-500 mt-1 shrink-0" />
                    <p className="text-[9px] text-emerald-300/60 leading-relaxed italic uppercase">Best: {doc.bestUse}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      <div className="p-6 bg-zinc-950/80 border-t border-line">
         <div className="flex items-center gap-3 text-[9px] text-zinc-600 uppercase tracking-widest leading-relaxed">
            <HelpCircle size={14} className="text-signal" />
            <span>Beta v2.5. Operational Support Active.</span>
         </div>
      </div>
    </div>
  );
};
