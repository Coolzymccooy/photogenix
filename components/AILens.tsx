
import React, { useEffect, useState } from 'react';
import { analyzeImage, ImageAnalysis } from '../services/geminiService';
import { Scan, X, Activity, Aperture, Palette, Lightbulb } from 'lucide-react';
import { Button } from './ui/Button';

interface AILensProps {
  imageUrl: string;
  isOpen: boolean;
  onClose: () => void;
}

export const AILens: React.FC<AILensProps> = ({ imageUrl, isOpen, onClose }) => {
  const [analysis, setAnalysis] = useState<ImageAnalysis | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (isOpen && imageUrl) {
      setLoading(true);
      analyzeImage(imageUrl).then(data => {
        setAnalysis(data);
        setLoading(false);
      });
    } else {
      setAnalysis(null);
    }
  }, [isOpen, imageUrl]);

  if (!isOpen) return null;

  return (
    <div className="absolute top-16 right-4 z-40 w-80 animate-in slide-in-from-right-4 duration-300">
      <div className="bg-black/80 backdrop-blur-xl border border-indigo-500/30 rounded-lg shadow-2xl overflow-hidden">
        
        {/* Header */}
        <div className="flex items-center justify-between p-3 border-b border-indigo-500/20 bg-indigo-900/10">
          <div className="flex items-center gap-2 text-indigo-400">
            <Scan size={16} className="animate-pulse" />
            <span className="font-mono text-xs font-bold uppercase tracking-widest">AI_LENS_VISION</span>
          </div>
          <button onClick={onClose} className="text-zinc-500 hover:text-white transition-colors">
            <X size={14} />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 min-h-[300px]">
          {loading ? (
            <div className="flex flex-col items-center justify-center h-64 space-y-4">
              <div className="relative w-16 h-16">
                 <div className="absolute inset-0 border-t-2 border-indigo-500 rounded-full animate-spin"></div>
                 <div className="absolute inset-2 border-r-2 border-purple-500 rounded-full animate-spin-slow"></div>
              </div>
              <p className="font-mono text-xs text-indigo-400 animate-pulse">ANALYZING_VECTOR_DATA...</p>
            </div>
          ) : analysis ? (
            <div className="space-y-6">
              
              {/* Scores */}
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-zinc-900/50 p-3 rounded-sm border border-zinc-800">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[10px] text-zinc-500 uppercase">Lighting</span>
                    <span className="text-xs font-bold text-white">{analysis.lightingScore}%</span>
                  </div>
                  <div className="h-1 bg-zinc-800 rounded-full overflow-hidden">
                    <div className="h-full bg-indigo-500 transition-all duration-1000" style={{ width: `${analysis.lightingScore}%` }}></div>
                  </div>
                </div>
                <div className="bg-zinc-900/50 p-3 rounded-sm border border-zinc-800">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[10px] text-zinc-500 uppercase">Focus</span>
                    <span className="text-xs font-bold text-white">{analysis.sharpnessScore}%</span>
                  </div>
                  <div className="h-1 bg-zinc-800 rounded-full overflow-hidden">
                    <div className="h-full bg-emerald-500 transition-all duration-1000" style={{ width: `${analysis.sharpnessScore}%` }}></div>
                  </div>
                </div>
              </div>

              {/* Composition */}
              <div className="space-y-1">
                 <div className="flex items-center gap-2 text-xs text-zinc-400">
                    <Aperture size={12} />
                    <span className="uppercase">Composition Type</span>
                 </div>
                 <div className="font-mono text-sm text-white border-l-2 border-purple-500 pl-2">
                    {analysis.composition}
                 </div>
              </div>

              {/* Palette */}
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-xs text-zinc-400">
                   <Palette size={12} />
                   <span className="uppercase">Dominant Palette</span>
                </div>
                <div className="flex gap-2">
                  {analysis.colors.map((c, i) => (
                    <div key={i} className="w-8 h-8 rounded-sm shadow-lg border border-white/10" style={{ backgroundColor: c }} title={c}></div>
                  ))}
                </div>
              </div>

              {/* Critique */}
              <div className="bg-indigo-900/20 p-3 rounded-sm border border-indigo-500/20">
                 <div className="flex items-center gap-2 mb-1 text-indigo-300">
                   <Lightbulb size={12} />
                   <span className="text-[10px] uppercase font-bold">AI Critique</span>
                 </div>
                 <p className="text-xs text-indigo-100 leading-relaxed">
                   "{analysis.critique}"
                 </p>
              </div>

              {/* Tags */}
              <div className="flex flex-wrap gap-2">
                {analysis.tags.map(tag => (
                  <span key={tag} className="px-2 py-0.5 bg-zinc-800 text-[10px] text-zinc-400 rounded-sm border border-zinc-700">
                    {tag}
                  </span>
                ))}
              </div>

            </div>
          ) : (
            <div className="text-center text-red-400 text-xs">Analysis Failed</div>
          )}
        </div>
      </div>
    </div>
  );
};
