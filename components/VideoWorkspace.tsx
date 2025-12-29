
import React, { useRef, useState, useEffect } from 'react';
import { ProjectItem } from '../types';
import { Play, Pause, FastForward, Rewind, SplitSquareHorizontal, Maximize, Volume2, VolumeX, Activity, Download, Scissors, Flag, ScanEye, Minimize } from 'lucide-react';

interface VideoWorkspaceProps {
  item: ProjectItem;
  isProcessing: boolean;
}

export const VideoWorkspace: React.FC<VideoWorkspaceProps> = ({ item, isProcessing }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const originalVideoRef = useRef<HTMLVideoElement>(null); // Ref for split view sync
  
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [splitView, setSplitView] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [playbackRate, setPlaybackRate] = useState(1);

  // Auto-reset when item changes
  useEffect(() => {
    setIsPlaying(false);
    setProgress(0);
    setSplitView(false);
    setPlaybackRate(1);
    if(videoRef.current) videoRef.current.playbackRate = 1;
  }, [item.id]);

  // Apply "SlowMo" playback rate if tool is active
  useEffect(() => {
      if (item.lastTool === 'video-slowmo') {
          setPlaybackRate(0.5);
      } else {
          setPlaybackRate(1);
      }
  }, [item.lastTool]);

  useEffect(() => {
      if (videoRef.current) {
          videoRef.current.playbackRate = playbackRate;
      }
      if (originalVideoRef.current) {
          originalVideoRef.current.playbackRate = playbackRate;
      }
  }, [playbackRate]);

  // Sync Split View Video
  useEffect(() => {
    if (splitView && originalVideoRef.current && videoRef.current) {
        originalVideoRef.current.currentTime = videoRef.current.currentTime;
        if (isPlaying) originalVideoRef.current.play();
        else originalVideoRef.current.pause();
    }
  }, [splitView, isPlaying]);

  const togglePlay = () => {
    if (videoRef.current) {
      if (isPlaying) {
          videoRef.current.pause();
          if (originalVideoRef.current) originalVideoRef.current.pause();
      } else {
          videoRef.current.play();
          if (originalVideoRef.current) originalVideoRef.current.play();
      }
      setIsPlaying(!isPlaying);
    }
  };

  const toggleFullscreen = () => {
    if (!containerRef.current) return;

    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen().then(() => {
        setIsFullscreen(true);
      }).catch(err => {
        console.error(`Error attempting to enable fullscreen: ${err.message}`);
      });
    } else {
      document.exitFullscreen();
      setIsFullscreen(false);
    }
  };

  const handleTimeUpdate = () => {
    if (videoRef.current) {
      const prog = (videoRef.current.currentTime / videoRef.current.duration) * 100;
      setProgress(prog);
      // Sync original video if split view is active
      if (originalVideoRef.current && Math.abs(originalVideoRef.current.currentTime - videoRef.current.currentTime) > 0.1) {
          originalVideoRef.current.currentTime = videoRef.current.currentTime;
      }
    }
  };

  const handleLoadedMetadata = () => {
    if (videoRef.current) {
      setDuration(videoRef.current.duration);
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (videoRef.current) {
      const time = (parseFloat(e.target.value) / 100) * videoRef.current.duration;
      videoRef.current.currentTime = time;
      if (originalVideoRef.current) originalVideoRef.current.currentTime = time;
      setProgress(parseFloat(e.target.value));
    }
  };

  const handleJumpTo = (percent: number) => {
    if (videoRef.current && duration > 0) {
        const time = (percent / 100) * duration;
        videoRef.current.currentTime = time;
        if (originalVideoRef.current) originalVideoRef.current.currentTime = time;
        setProgress(percent);
    }
  };

  // ADVANCED VIDEO FX ENGINE
  const getVideoStyles = () => {
    if (!item.lastTool) return {};
    
    // Core transforms
    let transform = '';
    let filter = '';
    
    switch(item.lastTool) {
      case 'video-color-pop': 
        // Vibrant, commercial look
        filter = 'saturate(1.8) contrast(1.15) brightness(1.05)';
        break;
      
      case 'video-cinematic': 
        // Teal/Orange approximation + Fade
        filter = 'sepia(0.3) contrast(1.2) brightness(0.95) hue-rotate(-15deg) saturate(1.2)';
        break;

      case 'video-hdr': 
        // High Dynamic Range simulation
        filter = 'contrast(1.4) saturate(1.3) brightness(1.1) drop-shadow(0 0 1px rgba(255,255,255,0.4))';
        break;
        
      case 'video-enhance': 
        // Clean studio look
        filter = 'contrast(1.1) brightness(1.05) saturate(1.1) hue-rotate(5deg)';
        break;
        
      case 'video-upscale':
        // Sharpening illusion
        filter = 'contrast(1.2) brightness(1.05)';
        break;
        
      case 'video-stabilize':
        // Scale to crop edges
        transform = 'scale(1.15)';
        break;

      case 'video-glitch':
         // Heavy stylization
         filter = 'contrast(1.5) brightness(1.2) saturate(2) hue-rotate(90deg)';
         break;
    }

    return { filter, transform };
  };

  // Mock "Smart Points" for Trim tool
  const getSmartPoints = () => {
     if (item.lastTool !== 'video-trim' || duration === 0) return [];
     return [
         { percent: 15, label: 'ENTRY_POINT', icon: <Flag size={10} /> },
         { percent: 42, label: 'SILENCE_CUT', icon: <Scissors size={10} /> },
         { percent: 68, label: 'KEY_MOMENT', icon: <ScanEye size={10} /> },
         { percent: 88, label: 'EXIT_POINT', icon: <Flag size={10} /> },
     ];
  };

  const smartPoints = getSmartPoints();
  const styles = getVideoStyles();
  const isCinematic = item.lastTool === 'video-cinematic';
  const isGlitch = item.lastTool === 'video-glitch';
  const isVintage = item.lastTool === 'video-cinematic'; // Reusing for grain

  return (
    <div className="relative w-full h-full flex flex-col items-center justify-center p-4 bg-zinc-950">
      
      {/* GLITCH ANIMATION KEYFRAMES */}
      <style>{`
        @keyframes glitch {
          0% { transform: translate(0) }
          20% { transform: translate(-2px, 2px) }
          40% { transform: translate(-2px, -2px) }
          60% { transform: translate(2px, 2px) }
          80% { transform: translate(2px, -2px) }
          100% { transform: translate(0) }
        }
        .animate-glitch-layer {
           animation: glitch 0.2s cubic-bezier(0.25, 0.46, 0.45, 0.94) both infinite;
        }
      `}</style>

      {/* Video Container with Fullscreen Ref */}
      <div 
        ref={containerRef}
        className={`relative w-full max-w-5xl aspect-video bg-black border border-zinc-800 rounded-sm overflow-hidden group shadow-2xl ${isFullscreen ? 'h-screen w-screen max-w-none border-0' : ''}`}
      >
        
        {/* Processing Overlay */}
        {isProcessing && (
           <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-black/80 backdrop-blur-sm">
              <div className="w-16 h-16 border-2 border-t-signal border-zinc-800 rounded-full animate-spin mb-4"></div>
              <div className="text-signal font-mono text-sm tracking-[0.2em] animate-pulse">AI_RENDERING_FRAMES</div>
              <div className="mt-2 text-zinc-500 font-mono text-xs">Processing vector motion...</div>
           </div>
        )}

        {/* --- FX LAYERS --- */}
        
        {/* Layer 1: The Video */}
        <div className={`w-full h-full overflow-hidden relative ${isCinematic ? 'scale-[0.85] bg-black' : ''}`}>
             <video
                ref={videoRef}
                src={item.processedUrl || item.originalUrl}
                className={`w-full h-full object-contain ${isGlitch ? 'animate-glitch-layer opacity-80' : ''}`}
                onTimeUpdate={handleTimeUpdate}
                onLoadedMetadata={handleLoadedMetadata}
                onEnded={() => setIsPlaying(false)}
                muted={isMuted}
                style={{
                    filter: styles.filter,
                    transform: styles.transform,
                    transition: 'filter 0.5s ease, transform 0.5s ease'
                }} 
            />
            {/* Glitch RGB Split (Clone) */}
            {isGlitch && (
                 <video
                    src={item.processedUrl || item.originalUrl}
                    className="absolute inset-0 w-full h-full object-contain mix-blend-screen opacity-50 animate-glitch-layer"
                    muted
                    style={{
                        filter: 'hue-rotate(90deg)',
                        transform: 'translate(4px, 0)'
                    }} 
                />
            )}
        </div>

        {/* Layer 2: Cinematic Letterbox Bars */}
        {isCinematic && (
            <div className="absolute inset-0 pointer-events-none flex flex-col justify-between z-20">
                <div className="w-full h-[12%] bg-black"></div>
                <div className="w-full h-[12%] bg-black"></div>
            </div>
        )}

        {/* Layer 3: Film Grain Overlay */}
        {(isVintage || isGlitch) && (
            <div className="absolute inset-0 pointer-events-none z-10 opacity-20 mix-blend-overlay"
                 style={{
                     backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 400 400' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")`
                 }}
            ></div>
        )}
        
        {/* Layer 4: Scanlines Overlay (Glitch) */}
        {isGlitch && (
            <div className="absolute inset-0 pointer-events-none z-10 opacity-30 bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.25)_50%),linear-gradient(90deg,rgba(255,0,0,0.06),rgba(0,255,0,0.02),rgba(0,0,255,0.06))] bg-[length:100%_4px,3px_100%]"></div>
        )}

        {/* Split View Overlay (Original Source) */}
        {splitView && (
           <div className="absolute inset-0 w-1/2 overflow-hidden border-r border-signal/50 z-20 pointer-events-none bg-black">
              <div className="absolute top-4 left-4 bg-black/80 text-white text-[10px] font-mono px-2 py-1 border border-white/20 z-30">
                SOURCE RAW
              </div>
              <video 
                 ref={originalVideoRef}
                 src={item.originalUrl} 
                 className="w-[200%] h-full max-w-none object-contain ml-0" 
                 muted
                 style={{ display: 'block' }} 
              /> 
           </div>
        )}

        {/* Fullscreen Label (Only in fullscreen) */}
        {isFullscreen && (
            <div className="absolute top-4 right-4 bg-zinc-900/80 text-zinc-400 px-3 py-1 rounded-sm text-xs font-mono border border-zinc-800 pointer-events-none z-40">
                FULLSCREEN_MODE
            </div>
        )}
        
        {/* Controls Overlay - Technical UI */}
        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black via-black/90 to-transparent p-6 opacity-0 group-hover:opacity-100 transition-opacity duration-200 z-50">
           
           {/* Smart Trim Visualization Layer - "Tipping Points" */}
           {smartPoints.length > 0 && (
              <div className="relative w-full h-6 mb-1 pointer-events-none">
                  {smartPoints.map((pt, idx) => (
                      <div 
                        key={idx}
                        className="absolute bottom-0 flex flex-col items-center -translate-x-1/2 group/point pointer-events-auto cursor-pointer"
                        style={{ left: `${pt.percent}%` }}
                        onClick={() => handleJumpTo(pt.percent)}
                      >
                          <div className="mb-1 opacity-0 group-hover/point:opacity-100 transition-opacity bg-signal text-white text-[8px] font-mono px-1.5 py-0.5 rounded-sm whitespace-nowrap tracking-wider shadow-lg">
                              {pt.label}
                          </div>
                          <div className="text-signal hover:text-white hover:scale-125 transition-all drop-shadow-[0_0_5px_rgba(99,102,241,0.5)]">
                              {pt.icon}
                          </div>
                          <div className="w-px h-2 bg-signal mt-1"></div>
                      </div>
                  ))}
              </div>
           )}

           {/* Progress Bar */}
           <div className="relative w-full h-1 bg-zinc-800 cursor-pointer mb-6 group/progress">
              <div className="absolute top-0 left-0 h-full bg-signal" style={{ width: `${progress}%` }}></div>
              
              {/* Ticks on the bar for smart points */}
              {smartPoints.map((pt, idx) => (
                  <div 
                    key={`mark-${idx}`}
                    className="absolute top-0 h-full w-0.5 bg-white/50 z-10 pointer-events-none"
                    style={{ left: `${pt.percent}%` }}
                  ></div>
              ))}

              <input 
                type="range" 
                min="0" 
                max="100" 
                value={progress} 
                onChange={handleSeek}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-20"
              />
              <div 
                className="absolute top-1/2 -translate-y-1/2 w-3 h-3 bg-white rounded-full opacity-0 group-hover/progress:opacity-100 pointer-events-none transition-opacity z-30 shadow-[0_0_10px_rgba(255,255,255,0.5)]"
                style={{ left: `${progress}%` }}
              ></div>
           </div>

           {/* Buttons Row */}
           <div className="flex items-center justify-between font-mono text-zinc-400">
              <div className="flex items-center gap-4">
                 <button onClick={togglePlay} className="hover:text-white transition-colors">
                    {isPlaying ? <Pause size={18} fill="currentColor" /> : <Play size={18} fill="currentColor" />}
                 </button>
                 
                 <div className="flex items-center gap-1 text-xs">
                    <span>{formatTime(videoRef.current?.currentTime || 0)}</span>
                    <span className="opacity-50">/</span>
                    <span>{formatTime(duration)}</span>
                 </div>

                 <button onClick={() => setIsMuted(!isMuted)} className="hover:text-white ml-2">
                    {isMuted ? <VolumeX size={16} /> : <Volume2 size={16} />}
                 </button>
              </div>

              <div className="flex items-center gap-3">
                 {/* Technical Indicators */}
                 {item.lastTool && (
                   <div className="flex items-center gap-1.5 px-2 py-1 bg-signal/10 border border-signal/20 text-signal text-[10px] uppercase tracking-wider rounded-sm animate-pulse-slow">
                      <Activity size={10} />
                      {item.lastTool.replace('video-', '').replace('-', ' ')}
                   </div>
                 )}

                 <div className="w-px h-4 bg-zinc-700"></div>

                 <button 
                   onClick={() => setSplitView(!splitView)} 
                   className={`hover:text-white transition-colors ${splitView ? 'text-signal' : ''}`}
                   title={splitView ? "Disable Comparison" : "Enable Split Compare"}
                 >
                    <SplitSquareHorizontal size={16} />
                 </button>
                 
                 <button onClick={toggleFullscreen} className="hover:text-white transition-colors" title="Toggle Fullscreen">
                    {isFullscreen ? <Minimize size={16} /> : <Maximize size={16} />}
                 </button>
              </div>
           </div>
        </div>
      </div>
    </div>
  );
};
