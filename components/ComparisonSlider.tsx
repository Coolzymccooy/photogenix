
import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { GripVertical, Maximize2, Minimize2, Binary, Crosshair, AlertCircle, RefreshCw, Cpu, Loader2, ZoomIn, ZoomOut, RotateCcw, Search } from 'lucide-react';
import { StorageService } from '../services/storageService';

interface ComparisonSliderProps {
  itemId: string;
  beforeImage: string;
  afterImage: string;
  isProcessing?: boolean;
  processingMessage?: string;
  isCoordinateMode?: boolean;
  onCoordinateSelect?: (x: number, y: number) => void;
  spotRadius?: number;
  onRefresh?: () => void;
}

export const ComparisonSlider: React.FC<ComparisonSliderProps> = React.memo(({
  itemId,
  beforeImage,
  afterImage,
  isProcessing = false,
  processingMessage = "COMPUTING...",
  isCoordinateMode = false,
  onCoordinateSelect,
  spotRadius = 15,
  onRefresh
}) => {
  const [sliderPosition, setSliderPosition] = useState(50);
  const [isExpanded, setIsExpanded] = useState(false);
  const [zoom, setZoom] = useState(1);
  
  const [internalBefore, setInternalBefore] = useState(beforeImage);
  const [internalAfter, setInternalAfter] = useState(afterImage);
  
  const [beforeLoaded, setBeforeLoaded] = useState(false);
  const [afterLoaded, setAfterLoaded] = useState(false);
  const [isHealing, setIsHealing] = useState(false);
  const [computedAspectRatio, setComputedAspectRatio] = useState<string | null>(null);
  
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const [isHovering, setIsHovering] = useState(false);
  
  const containerRef = useRef<HTMLDivElement>(null);
  const isDragging = useRef(false);

  useEffect(() => {
    if (internalBefore !== beforeImage) {
        setInternalBefore(beforeImage);
        setBeforeLoaded(false);
    }
  }, [beforeImage, internalBefore]);

  useEffect(() => {
    if (internalAfter !== afterImage) {
        setInternalAfter(afterImage);
        setAfterLoaded(false);
        setComputedAspectRatio(null); 
    }
  }, [afterImage, internalAfter]);

  const handleAfterLoad = (e: React.SyntheticEvent<HTMLImageElement>) => {
    const img = e.currentTarget;
    setComputedAspectRatio(`${img.naturalWidth} / ${img.naturalHeight}`);
    setAfterLoaded(true);
  };

  const handleImageError = async (type: 'orig' | 'proc') => {
    if (isProcessing || isHealing) return;
    setIsHealing(true);
    try {
      const rescued = await StorageService.rescueUrl(itemId, type);
      if (rescued) {
        if (type === 'orig') setInternalBefore(rescued);
        else setInternalAfter(rescued);
      }
    } finally {
      setIsHealing(false);
    }
  };

  const handleMove = useCallback((clientX: number) => {
    if (containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      const x = Math.max(0, Math.min(clientX - rect.left, rect.width));
      setSliderPosition((x / rect.width) * 100);
    }
  }, []);

  const handleGlobalMouseMove = useCallback((e: MouseEvent) => {
    if (isDragging.current) {
      handleMove(e.clientX);
    }
    if (containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      setMousePos({ x: e.clientX - rect.left, y: e.clientY - rect.top });
    }
  }, [isDragging, handleMove]);

  useEffect(() => {
    const handleMouseUp = () => (isDragging.current = false);
    window.addEventListener('mouseup', handleMouseUp);
    window.addEventListener('mousemove', handleGlobalMouseMove);
    return () => {
      window.removeEventListener('mouseup', handleMouseUp);
      window.removeEventListener('mousemove', handleGlobalMouseMove);
    };
  }, [handleGlobalMouseMove]);

  const changeZoom = (delta: number) => {
    setZoom(prev => Math.min(3, Math.max(0.5, prev + delta)));
  };

  const handleManualClick = (e: React.MouseEvent) => {
    if (!isCoordinateMode || isProcessing || !onCoordinateSelect || !containerRef.current) return;
    
    const rect = containerRef.current.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    
    if (x >= 0 && x <= 100 && y >= 0 && y <= 100) {
        onCoordinateSelect(x, y);
    }
  };

  return (
    <div className={isExpanded ? "fixed inset-0 z-[100] bg-base flex flex-col items-center justify-center p-8" : "relative w-full h-full flex items-center justify-center overflow-hidden p-6"}>
      <div 
        ref={containerRef}
        key={internalAfter} 
        className={`relative max-w-full max-h-full select-none overflow-hidden rounded-sm group transform-gpu shadow-2xl bg-[#020202] ${isCoordinateMode ? 'cursor-none border border-signal/40' : 'cursor-default'}`}
        style={{ 
          aspectRatio: computedAspectRatio || 'auto',
          width: computedAspectRatio ? 'auto' : '100%',
          height: computedAspectRatio ? 'auto' : '100%',
          contain: 'paint layout',
          backfaceVisibility: 'hidden',
          WebkitBackfaceVisibility: 'hidden',
          transform: `translateZ(0) scale(${zoom})`,
          transition: isDragging.current ? 'none' : 'aspect-ratio 0.5s ease-in-out, transform 0.2s ease-out'
        }}
        onMouseEnter={() => setIsHovering(true)}
        onMouseLeave={() => setIsHovering(false)}
        onMouseDown={(e) => {
          if (isCoordinateMode) {
             handleManualClick(e);
             return;
          }
          if (!(e.target as HTMLElement).closest('button')) {
             isDragging.current = true;
             handleMove(e.clientX);
          }
        }}
      >
        <img 
          src={internalAfter} 
          onLoad={handleAfterLoad}
          onError={() => handleImageError('proc')}
          alt="" 
          className="w-full h-full object-contain pointer-events-none block"
          style={{ 
            opacity: afterLoaded ? 1 : 0, 
            transition: 'opacity 0.2s ease',
            transform: 'translateZ(0)',
            imageRendering: '-webkit-optimize-contrast'
          }} 
        />
        
        <div 
          className="absolute top-0 left-0 h-full overflow-hidden border-r border-white/20 z-10 pointer-events-none" 
          style={{ 
            width: `${sliderPosition}%`, 
            opacity: beforeLoaded ? 1 : 0, 
            transition: 'opacity 0.2s ease',
            transform: 'translateZ(0)'
          }}
        >
          <img 
            src={internalBefore} 
            onLoad={() => setBeforeLoaded(true)}
            onError={() => handleImageError('orig')}
            alt="" 
            className="absolute top-0 left-0 max-w-none h-full object-contain" 
            style={{ 
              width: containerRef.current?.clientWidth || '100vw',
              height: '100%',
              transform: 'translateZ(0)',
              imageRendering: '-webkit-optimize-contrast'
            }} 
          />
        </div>

        <div 
          className="absolute top-0 bottom-0 w-px bg-white/40 z-20" 
          style={{ left: `${sliderPosition}%`, transform: 'translateZ(0)' }}
        >
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-10 h-10 bg-black/60 backdrop-blur-md text-white rounded-full border border-white/10 shadow-2xl flex items-center justify-center cursor-col-resize z-30">
              <GripVertical size={18} className="opacity-50" />
          </div>
        </div>

        {isCoordinateMode && isHovering && !isProcessing && (
          <div 
            className="absolute z-[70] pointer-events-none flex items-center justify-center"
            style={{ left: mousePos.x, top: mousePos.y, transform: 'translate(-50%, -50%) translateZ(0)' }}
          >
             <div className="relative">
                <div 
                  className="absolute border border-signal bg-signal/5 rounded-full animate-pulse-slow"
                  style={{ width: spotRadius * 2, height: spotRadius * 2, left: -spotRadius, top: -spotRadius }}
                ></div>
                <div className="absolute w-2 h-2 border border-white/40 rounded-full"></div>
                <Crosshair size={24} className="text-signal relative z-10 drop-shadow-[0_0_8px_rgba(99,102,241,0.8)]" />
                <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 bg-signal px-2 py-0.5 rounded-sm shadow-xl">
                   <span className="text-[7px] font-mono text-white tracking-[0.2em] uppercase font-bold">READY_TO_HEAL</span>
                </div>
             </div>
          </div>
        )}

        <div className="absolute bottom-6 left-6 bg-black/80 text-zinc-500 text-[8px] font-mono px-3 py-1.5 rounded-sm border border-line uppercase tracking-[0.3em] z-30 opacity-80">
          SOURCE_RAW
        </div>
        <div className="absolute bottom-6 right-6 bg-signal text-white text-[8px] font-mono px-3 py-1.5 rounded-sm border border-white/10 uppercase tracking-[0.3em] z-30">
          NEURAL_MASTER
        </div>
      </div>

      {/* RESTORED: VIEW CONTROLS HUD */}
      <div className="absolute top-4 right-4 z-50 flex flex-col gap-2">
        <div className="flex bg-black/80 backdrop-blur-md border border-white/10 rounded-sm overflow-hidden p-1 shadow-2xl">
          <button 
            onClick={() => setIsExpanded(!isExpanded)} 
            className="p-2 text-zinc-400 hover:text-white transition-colors"
            title={isExpanded ? "Reduce View" : "Expand View"}
          >
            {isExpanded ? <Minimize2 size={18} /> : <Maximize2 size={18} />}
          </button>
        </div>

        <div className="flex flex-col bg-black/80 backdrop-blur-md border border-white/10 rounded-sm overflow-hidden p-1 shadow-2xl gap-1">
          <button 
            onClick={() => changeZoom(0.25)} 
            className="p-2 text-zinc-400 hover:text-white transition-colors border-b border-white/5"
            title="Increase View Scale"
          >
            <ZoomIn size={18} />
          </button>
          <div className="py-1 text-[8px] font-mono text-signal text-center font-bold">
            {Math.round(zoom * 100)}%
          </div>
          <button 
            onClick={() => changeZoom(-0.25)} 
            className="p-2 text-zinc-400 hover:text-white transition-colors border-t border-white/5"
            title="Decrease View Scale"
          >
            <ZoomOut size={18} />
          </button>
          <button 
            onClick={() => setZoom(1)} 
            className="p-2 text-zinc-500 hover:text-signal transition-colors border-t border-white/5"
            title="Reset View Scale"
          >
            <RotateCcw size={14} className="mx-auto" />
          </button>
        </div>
      </div>

      {isProcessing && (
        <div className="absolute inset-0 z-[80] flex flex-col items-center justify-center bg-zinc-950/80 backdrop-blur-xl transition-all duration-300">
            <div className="relative w-64 h-1 bg-zinc-900 rounded-full overflow-hidden mb-6">
                <div className="absolute top-0 left-0 h-full bg-signal animate-progressBar w-1/2"></div>
            </div>
            <div className="flex items-center gap-3">
                <Binary size={16} className="text-signal animate-pulse" />
                <span className="text-signal font-mono text-[10px] tracking-[0.4em] uppercase font-bold">{processingMessage}</span>
            </div>
        </div>
      )}

      {isHealing && (
          <div className="absolute inset-0 z-[85] flex flex-col items-center justify-center bg-black/60 backdrop-blur-sm transition-all duration-300">
              <Loader2 size={24} className="text-signal animate-spin mb-2" />
              <span className="text-signal font-mono text-[8px] uppercase tracking-widest">Re-pinning_Binary...</span>
          </div>
      )}

      <style>{`
        @keyframes progressBar {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(200%); }
        }
        .animate-progressBar {
          animation: progressBar 1.5s linear infinite;
        }
      `}</style>
    </div>
  );
});
