
import React, { useState, useEffect } from 'react';
import { ToolType, ToolConfig, ToolCategory, MediaType } from '../types';
import { Button } from './ui/Button';
import { 
  Wand2, Box, Sparkles, Palette, Zap, 
  Eraser, Image as ImageIcon, Layers, 
  Grid, Users, Merge, Film, Terminal,
  Video, MonitorPlay, Cpu, Target, PenTool, Focus, Type,
  SprayCan, Crosshair, Stamp, SunMedium, Braces, ShieldAlert, Maximize, 
  Camera, Sliders, Scissors, ImageMinus, Layout, Heart
} from 'lucide-react';

interface ToolsPanelProps {
  onProcess: (instruction: string, toolLabel: string, isBatch: boolean, extra?: any) => void;
  isProcessing: boolean;
  activeTool: ToolType;
  setActiveTool: (tool: ToolType) => void;
  projectCount: number;
  onGoHome: () => void;
  activeMediaType: MediaType;
  onSwitchMediaType: (type: MediaType) => void;
  rangeValue: number;
  onRangeChange: (val: number) => void;
  selectedCount: number;
}

const CATEGORIES: { id: ToolCategory; label: string; icon: any }[] = [
  { id: 'pro_pipeline', label: 'MASTER', icon: Cpu },
  { id: 'essentials', label: 'CORE', icon: Layers },
  { id: 'modify', label: 'MOD', icon: Eraser },
  { id: 'presets', label: 'STYLE', icon: Camera },
  { id: 'creative', label: 'FX', icon: Palette },
  { id: 'combine', label: 'STUDIO', icon: Grid },
];

const ASPECT_RATIOS = ['1:1', '4:3', '3:4', '16:9', '9:16'];
const STYLE_PRESETS = ['PORTRA_400', 'FUJI_PRO', 'MONO_NOIR', 'COMMERCIAL_GLOSS', 'VINTAGE_FADE'];

const TOOLS: Record<ToolCategory, ToolConfig[]> = {
  pro_pipeline: [
    { id: 'super-engine', label: 'SUPER_ENGINE', icon: 'cpu', promptPrefix: 'PRO_MASTER_WORKFLOW', description: '16-bit linear master. High-end reconstruction.' },
    { id: 'neural-beauty', label: 'NEURAL_BEAUTY', icon: 'heart', promptPrefix: 'Apply ultra-high-end professional color grading. Balance highlights, enhance micro-contrast, preserve skin textures, and apply a 32-bit color finish.', description: 'Final beautification & color harmony.' },
    { id: 'aspect-ratio', label: 'NEURAL_FORMAT', icon: 'maximize', promptPrefix: 'NEURAL_CROP_AND_EXTEND', description: 'Intelligent format switching.', presets: ASPECT_RATIOS }
  ],
  essentials: [
    { id: 'enhance', label: 'SMART_MASTER', icon: 'wand', promptPrefix: 'Professional photo restoration.', description: 'Auto-correct lighting & noise.' },
    { id: 'clean', label: 'NEURAL_CLEAN', icon: 'spray', promptPrefix: 'Remove artifacts.', description: 'Texture-aware surface cleanup.' },
    { id: 'relight', label: 'PRO_RELIGHT', icon: 'sun', promptPrefix: 'Generate dramatic studio lighting.', description: 'Volumetric light source.' },
    { id: 'sharpness', label: 'RE_FOCUS', icon: 'focus', promptPrefix: 'Neural sharpness reconstruction.', description: 'Fix lens blur/shake.' },
    { id: 'spot-heal-pro', label: 'PRO_SPOT_HEAL', icon: 'crosshair', promptPrefix: 'Point & Heal', description: 'Targeted reconstruction.', isCoordinateBased: true, hasRange: true, rangeLabel: 'HEAL_RADIUS', rangeDefault: 15 },
    { id: 'watermark', label: 'NEURAL_STAMP', icon: 'type', promptPrefix: 'Apply neural watermark:', description: 'Blended scene branding.', requiresInput: true, inputPlaceholder: 'TEXT FOR WATERMARK...' }
  ],
  modify: [
    { id: 'remove', label: 'OBJ_ERASER', icon: 'eraser', promptPrefix: 'Remove specific object: ', description: 'Contextual object removal.', requiresInput: true, inputPlaceholder: 'OBJECT TO ERASE...' },
    { id: 'background', label: 'BG_SWAP', icon: 'image', promptPrefix: 'Replace background with: ', description: 'AI Environment replacement.', requiresInput: true, inputPlaceholder: 'NEW BACKGROUND SCENE...' },
    { id: 'smart-crop', label: 'AI_CROP', icon: 'scissors', promptPrefix: 'Optimal composition crop.', description: 'Rule-of-thirds auto crop.' }
  ],
  presets: [
    { id: 'style-transfer', label: 'PRO_FILM_STOCK', icon: 'camera', promptPrefix: 'Apply film style: ', description: 'Professional stock presets.', presets: STYLE_PRESETS }
  ],
  creative: [
    { id: '3d-pop', label: '3D_POP_VOL', icon: 'zap', promptPrefix: 'Volumetric depth pop.', description: 'Depth-mapped enhancement.' },
    { id: 'cyberpunk', label: 'CYBERPUNK', icon: 'zap', promptPrefix: 'Restyle to cyberpunk neon.', description: 'Neon aesthetic.' },
    { id: 'anime', label: 'ANIME_PRO', icon: 'palette', promptPrefix: 'Neural anime conversion.', description: 'Studio Ghibli style.' },
    { id: 'sketch', label: 'PENCIL_SKETCH', icon: 'palette', promptPrefix: 'Fine art pencil sketch.', description: 'Hand-drawn aesthetic.' }
  ],
  combine: [
    { id: 'collage', label: 'PRO_COLLAGE', icon: 'layout', promptPrefix: 'High-end collage.', description: 'Multi-image composition.', isMultiImage: true },
    { id: 'merge-scene', label: 'SCENE_MERGE', icon: 'merge', promptPrefix: 'Intelligent scene blending.', description: 'Combine subjects.', isMultiImage: true }
  ],
  video_core: [
    { id: 'video-enhance', label: 'AI_MASTER', icon: Wand2, promptPrefix: 'Video enhancement.', description: 'Auto-level video.', isVideoTool: true }
  ],
  video_fx: [
    { id: 'video-cinematic', label: 'CINEMATIC', icon: Film, promptPrefix: 'Cinematic film look.', description: 'Hollywood aesthetic.', isVideoTool: true }
  ]
};

export const ToolsPanel: React.FC<ToolsPanelProps> = ({
  onProcess, isProcessing, activeTool, setActiveTool, onGoHome, activeMediaType, onSwitchMediaType, rangeValue, onRangeChange, selectedCount
}) => {
  const [activeCategory, setActiveCategory] = useState<ToolCategory>(activeMediaType === 'video' ? 'video_core' : 'pro_pipeline');
  const [toolInput, setToolInput] = useState('');
  const [selectedPreset, setSelectedPreset] = useState('');

  const currentToolConfig = Object.values(TOOLS).flat().find(t => t.id === activeTool);

  const getIcon = (iconName: string | any) => {
    if (typeof iconName !== 'string') return React.createElement(iconName, { size: 16 });
    switch (iconName) {
      case 'cpu': return <Cpu size={16} />;
      case 'heart': return <Heart size={16} />;
      case 'wand': return <Wand2 size={16} />;
      case 'type': return <Type size={16} />;
      case 'spray': return <SprayCan size={16} />;
      case 'eraser': return <Eraser size={16} />;
      case 'image': return <ImageIcon size={16} />;
      case 'maximize': return <Maximize size={16} />;
      case 'crosshair': return <Crosshair size={16} />;
      case 'sun': return <SunMedium size={16} />;
      case 'focus': return <Focus size={16} />;
      case 'camera': return <Camera size={16} />;
      case 'scissors': return <Scissors size={16} />;
      case 'layout': return <Layout size={16} />;
      case 'merge': return <Grid size={16} />;
      default: return <Zap size={16} />;
    }
  };

  return (
    <div className="flex flex-col h-full bg-base border-r border-line w-full md:w-80 shrink-0 z-30 font-mono shadow-2xl">
      <button onClick={onGoHome} className="p-6 text-left group hover:bg-surface border-b border-line">
        <h1 className="text-xl font-bold text-white flex items-center gap-3 tracking-tighter">
          <Terminal size={20} className="text-signal" />
          <span>PHOTOGENIX</span>
        </h1>
        <div className="flex justify-between items-center mt-2">
            <p className="text-zinc-500 text-[10px] uppercase">Engine: Stable</p>
             <span className="text-[10px] text-signal font-bold tracking-widest">PRO_SUITE</span>
        </div>
      </button>

      <div className="grid grid-cols-2 border-b border-line shrink-0">
         {['image', 'video'].map((type) => (
           <button 
             key={type}
             onClick={() => onSwitchMediaType(type as MediaType)}
             className={`py-3 text-[10px] font-bold tracking-widest uppercase flex items-center justify-center gap-2 transition-colors ${activeMediaType === type ? 'bg-surface text-white border-b-2 border-signal' : 'bg-base text-zinc-600 hover:text-zinc-400'}`}
           >
             {type === 'image' ? <ImageIcon size={12} /> : <Video size={12} />} {type}
           </button>
         ))}
      </div>

      <div className="flex border-b border-line bg-base shrink-0 overflow-x-auto no-scrollbar px-1">
        {CATEGORIES.map((cat) => {
          const Icon = cat.icon;
          return (
            <button
              key={cat.id}
              onClick={() => setActiveCategory(cat.id)}
              className={`min-w-[50px] flex-1 py-4 text-[7px] font-bold tracking-tighter flex flex-col items-center gap-1.5 transition-colors relative ${activeCategory === cat.id ? 'text-white bg-surface' : 'text-zinc-600 hover:text-zinc-400 hover:bg-surface/50'}`}
            >
              <Icon size={13} /> 
              <span className="uppercase whitespace-nowrap">{cat.label}</span>
              {activeCategory === cat.id && <div className="absolute bottom-0 left-0 w-full h-[2px] bg-signal" />}
            </button>
          );
        })}
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-2 bg-base custom-scrollbar">
        <div className="grid grid-cols-1 gap-1">
          {TOOLS[activeCategory]?.map((tool) => (
            <button
              key={tool.id}
              onClick={() => { setActiveTool(tool.id); setToolInput(''); setSelectedPreset(''); }}
              className={`flex items-center gap-4 p-3 rounded-sm text-left transition-all border group ${activeTool === tool.id ? 'bg-surface border-line border-l-2 border-l-signal' : 'bg-transparent border-transparent hover:border-line hover:bg-surface/30'}`}
            >
              <div className={`p-1.5 rounded-sm ${activeTool === tool.id ? 'text-signal' : 'text-zinc-600 group-hover:text-zinc-400'}`}>
                {getIcon(tool.icon)}
              </div>
              <div className="flex-1 min-w-0">
                <h3 className={`text-xs font-bold truncate ${activeTool === tool.id ? 'text-white' : 'text-zinc-400'}`}>{tool.label}</h3>
                <p className="text-[10px] text-zinc-600 mt-1 leading-tight line-clamp-1">{tool.description}</p>
              </div>
            </button>
          ))}
        </div>
      </div>

      <div className="p-4 bg-surface border-t border-line space-y-4 shrink-0">
        {currentToolConfig?.presets && (
          <div className="space-y-1.5">
            <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest px-1">
                {activeCategory === 'presets' ? 'Film_Presets' : 'Ratio_Presets'}
            </label>
            <div className="grid grid-cols-3 gap-1">
              {currentToolConfig.presets.map(preset => (
                <button
                  key={preset}
                  onClick={() => setSelectedPreset(preset)}
                  className={`py-2 text-[8px] border rounded-sm font-mono transition-all px-1 truncate ${selectedPreset === preset ? 'bg-signal text-white border-signal' : 'bg-base text-zinc-500 border-line hover:border-zinc-500'}`}
                >
                  {preset}
                </button>
              ))}
            </div>
          </div>
        )}

        {currentToolConfig?.requiresInput && (
          <div className="space-y-1.5">
            <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest px-1">Tool_Input</label>
            <input 
              type="text" 
              value={toolInput}
              onChange={(e) => setToolInput(e.target.value)}
              placeholder={currentToolConfig.inputPlaceholder}
              className="w-full bg-base border border-line rounded-sm px-3 py-2 text-xs text-white focus:outline-none focus:border-signal transition-colors font-mono"
            />
          </div>
        )}

        <div className="flex flex-col gap-2">
            <Button 
                onClick={() => onProcess(
                    currentToolConfig?.promptPrefix + (selectedPreset ? ` : ${selectedPreset}` : '') + (toolInput ? ` : ${toolInput}` : ''), 
                    currentToolConfig?.label || '', 
                    selectedCount > 1,
                    { aspectRatio: selectedPreset, preset: selectedPreset }
                )} 
                isLoading={isProcessing} 
                className="w-full py-3" 
                icon={<Sparkles size={14} />} 
                disabled={(currentToolConfig?.requiresInput && !toolInput.trim()) || (currentToolConfig?.presets && !selectedPreset)}
            >
              {isProcessing ? 'ENGINE_BUSY...' : selectedCount > 1 ? `EXECUTE_BATCH (${selectedCount})` : 'EXECUTE_PIPELINE'}
            </Button>
            
            {selectedCount > 1 && (
                <p className="text-[8px] text-signal font-mono text-center uppercase tracking-widest animate-pulse">
                    Batch_Mode: Multiple targets detected.
                </p>
            )}
        </div>
      </div>
    </div>
  );
};
