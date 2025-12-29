
import React from 'react';
import { Button } from './ui/Button';
import { 
  Sparkles, Zap, ShieldCheck, Aperture, ArrowRight, 
  Terminal, Cpu, Video, MonitorPlay, Camera, 
  Layers, Target, Scan, Maximize, Play
} from 'lucide-react';

interface LandingPageProps {
  onGetStarted: () => void;
  isAuthenticated?: boolean;
  onReturnToApp?: () => void;
}

export const LandingPage: React.FC<LandingPageProps> = ({ 
  onGetStarted, 
  isAuthenticated = false,
  onReturnToApp 
}) => {
  
  const scrollToSection = (id: string) => {
    const element = document.getElementById(id);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  return (
    <div className="min-h-screen bg-base text-zinc-300 overflow-x-hidden font-sans relative selection:bg-signal selection:text-white">
      
      {/* BACKGROUND ATMOSPHERE */}
      <div className="fixed inset-0 z-0 pointer-events-none">
        {/* Cinematic Lens Flare Glow */}
        <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-signal/10 rounded-full blur-[120px] animate-pulse"></div>
        <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-indigo-900/5 rounded-full blur-[120px]"></div>
        
        {/* Technical Grid Overlay */}
        <div className="absolute inset-0 opacity-[0.03]" 
             style={{
               backgroundImage: `linear-gradient(to right, #ffffff 1px, transparent 1px), linear-gradient(to bottom, #ffffff 1px, transparent 1px)`,
               backgroundSize: '40px 40px',
             }}>
        </div>
      </div>

      {/* TOP NAVIGATION */}
      <nav className="fixed top-0 w-full z-50 px-8 py-6 flex items-center justify-between backdrop-blur-md border-b border-white/5">
        <div className="flex items-center gap-4 group cursor-pointer" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>
          <div className="relative">
             <Aperture size={28} className="text-signal group-hover:rotate-90 transition-transform duration-500" />
             <div className="absolute inset-0 bg-signal/20 blur-md animate-pulse"></div>
          </div>
          <div className="flex flex-col">
            <span className="text-xl font-bold tracking-tighter text-white font-mono uppercase">PHOTOGENIX</span>
            <span className="text-[8px] text-signal font-mono tracking-[0.4em] uppercase">NEURAL_DEVELOPMENT_LAB</span>
          </div>
        </div>
        
        <div className="flex items-center gap-8">
          <div className="hidden lg:flex gap-6 text-[10px] font-mono text-zinc-500 uppercase tracking-widest">
            <button onClick={() => scrollToSection('pipeline')} className="hover:text-signal transition-colors cursor-pointer">// Pipeline</button>
            <button onClick={() => scrollToSection('features')} className="hover:text-signal transition-colors cursor-pointer">// Capabilities</button>
            <button onClick={() => scrollToSection('engine')} className="hover:text-signal transition-colors cursor-pointer">// The_Engine</button>
          </div>
          {isAuthenticated ? (
            <Button variant="primary" size="sm" onClick={onReturnToApp} className="shadow-lg shadow-signal/20">
              RESUME_SESSION
            </Button>
          ) : (
            <Button variant="secondary" size="sm" onClick={onGetStarted}>
              INIT_AUTH_V2
            </Button>
          )}
        </div>
      </nav>

      {/* HERO SECTION - DRAMATIC ENTRY */}
      <section className="relative z-10 pt-44 pb-20 px-8 max-w-7xl mx-auto min-h-screen flex flex-col justify-center border-l border-white/5">
        <div className="max-w-4xl relative">
          
          {/* Floating UI Decorative HUD */}
          <div className="absolute -top-12 -left-4 hidden xl:block animate-bounce-slow">
             <div className="p-3 bg-surface/80 border border-white/10 backdrop-blur-md rounded-sm">
                <div className="flex items-center gap-2 mb-2">
                   <Target size={12} className="text-signal" />
                   <span className="text-[8px] font-mono text-zinc-400">TARGET_RECOVERY: ACTIVE</span>
                </div>
                <div className="flex gap-1">
                   {[1,2,3,4,5].map(i => <div key={i} className={`w-3 h-1 ${i < 4 ? 'bg-signal' : 'bg-zinc-800'}`}></div>)}
                </div>
             </div>
          </div>

          <div className="space-y-2 mb-6">
            <span className="text-signal font-mono text-xs tracking-[0.5em] uppercase font-bold bg-signal/5 px-2 py-1 rounded-sm">
              Architect: Tiwaton // NEXT_GEN_SYSTEM
            </span>
          </div>

          <h1 className="text-7xl md:text-[140px] font-black tracking-tighter mb-10 leading-[0.85] text-white">
            MASTER<br/>
            EVERY<br/>
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-zinc-700 via-zinc-400 to-zinc-700 animate-gradient-x">PIXEL.</span>
          </h1>

          <div className="flex flex-col md:flex-row gap-12 items-start md:items-center">
            <div className="max-w-md border-l-2 border-signal pl-8 py-2">
              <p className="text-xl text-zinc-400 font-mono leading-tight">
                90% workflow reduction.<br/>
                <span className="text-white">AI-driven 3D-volumetric lighting.</span><br/>
                Professional RAW development at scale.
              </p>
            </div>
            
            <div className="flex flex-col gap-4">
              {isAuthenticated ? (
                <Button onClick={onReturnToApp} variant="primary" size="lg" className="h-16 px-10 group rounded-none">
                  ENTER STUDIO <ArrowRight className="ml-4 group-hover:translate-x-2 transition-transform" size={20}/>
                </Button>
              ) : (
                <Button onClick={onGetStarted} variant="primary" size="lg" className="h-16 px-10 group rounded-none shadow-[0_0_30px_rgba(99,102,241,0.3)]">
                  START ENGINE <Zap className="ml-4 animate-pulse" size={20}/>
                </Button>
              )}
              <span className="text-[10px] text-zinc-600 font-mono uppercase tracking-widest text-center md:text-left">System v2.5.0 // Stable Build</span>
            </div>
          </div>
        </div>

        {/* HUD DECORATIVE ELEMENT */}
        <div className="absolute right-0 bottom-20 hidden 2xl:block opacity-20">
           <div className="relative">
              <div className="w-64 h-64 border-[1px] border-signal rounded-full animate-spin-slow flex items-center justify-center">
                 <div className="w-48 h-48 border-[1px] border-zinc-700 rounded-full border-dashed"></div>
              </div>
              <div className="absolute inset-0 flex items-center justify-center">
                 <Scan size={48} className="text-signal" />
              </div>
           </div>
        </div>
      </section>

      {/* THE PIPELINE SECTION */}
      <section id="pipeline" className="relative z-10 py-32 bg-surface/30 border-y border-white/5">
        <div className="max-w-7xl mx-auto px-8">
          <div className="flex flex-col md:flex-row justify-between items-end mb-20 gap-8">
            <div>
              <h2 className="text-5xl font-bold tracking-tighter text-white font-mono mb-4 uppercase">The_Pipeline</h2>
              <p className="text-zinc-500 font-mono text-sm max-w-sm">From RAW negative to gallery master in four automated neural stages.</p>
            </div>
            <div className="text-signal font-mono text-[10px] tracking-widest border border-signal/20 px-4 py-2 bg-signal/5">
              FLOW_ID: PX-8800 // AUTOMATED
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-px bg-white/5 border border-white/5">
            {[
              { id: '01', title: 'INGEST', desc: 'Auto-detect camera profile & lens metadata.', icon: Cpu },
              { id: '02', title: 'DECOMPOSE', desc: 'Segmentation of depth, texture, and light.', icon: Layers },
              { id: '03', title: 'SYNTHESIZE', desc: 'Neural blemish removal and color science.', icon: Sparkles },
              { id: '04', title: 'RENDER', desc: '16-bit high-fidelity export generation.', icon: Maximize },
            ].map((step, i) => (
              <div key={i} className="bg-base p-10 hover:bg-surface transition-all group">
                <div className="text-signal font-mono text-xs font-bold mb-6 flex items-center gap-2">
                  <span className="opacity-40">[{step.id}]</span>
                  <div className="w-8 h-[1px] bg-signal/20 group-hover:w-16 transition-all"></div>
                </div>
                <step.icon size={24} className="text-zinc-400 group-hover:text-signal mb-6 transition-colors" />
                <h3 className="text-lg font-bold text-white mb-2 font-mono uppercase tracking-tight">{step.title}</h3>
                <p className="text-zinc-600 text-xs font-mono leading-relaxed">{step.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* DRAMATIC FEATURE SHOWCASE */}
      <section id="features" className="relative z-10 py-40 max-w-7xl mx-auto px-8">
        <div className="flex flex-col lg:flex-row gap-20 items-center">
          <div className="flex-1 space-y-12">
            <div className="inline-block p-2 bg-signal/10 border border-signal/20 text-signal text-[10px] font-bold font-mono uppercase tracking-[0.3em]">
              Capabilities // Advanced_Intelligence
            </div>
            <h2 className="text-6xl font-black tracking-tighter text-white leading-[0.9] uppercase">
              REPLACE MANUAL<br/>
              LABOR WITH<br/>
              <span className="text-signal">PURE VISION.</span>
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-8 pt-6">
              <div className="space-y-3">
                <div className="w-10 h-[2px] bg-signal"></div>
                <h4 className="font-mono font-bold text-white text-sm uppercase">Auto_Relight</h4>
                <p className="text-zinc-500 text-xs font-mono">Dynamic light source generation based on scene geometry.</p>
              </div>
              <div className="space-y-3">
                <div className="w-10 h-[2px] bg-signal"></div>
                <h4 className="font-mono font-bold text-white text-sm uppercase">Neural_Stabilize</h4>
                <p className="text-zinc-500 text-xs font-mono">Remove camera micro-jitters without cropping quality.</p>
              </div>
            </div>
            <Button onClick={onGetStarted} variant="secondary" className="px-10 h-14 rounded-none border-signal/50 hover:bg-signal/5 text-signal font-bold uppercase tracking-widest">
              Explore_Toolkit_Manifesto
            </Button>
          </div>

          {/* MOCK UI PREVIEW - DRAMATIC */}
          <div className="flex-1 w-full max-w-xl aspect-square border border-white/5 bg-surface relative overflow-hidden group">
             <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/10 to-transparent"></div>
             {/* Decorative HUD Scanline */}
             <div className="absolute inset-x-0 h-[2px] bg-signal/30 top-1/4 animate-scanline z-20"></div>
             
             <div className="absolute inset-0 flex flex-col items-center justify-center p-8">
                <div className="relative w-full h-full border border-white/10 flex items-center justify-center">
                   <MonitorPlay size={64} className="text-zinc-800" />
                   <div className="absolute bottom-6 left-6 right-6 p-4 bg-black/80 backdrop-blur-md border border-white/5 font-mono text-[9px] space-y-2">
                      <div className="flex justify-between">
                         <span className="text-signal">BUFFER_STATUS:</span>
                         <span className="text-white">SYNCHRONIZED</span>
                      </div>
                      <div className="flex justify-between">
                         <span className="text-signal">MODEL_CORE:</span>
                         <span className="text-white">GEMINI_2.5_IMAGE</span>
                      </div>
                      <div className="w-full h-1 bg-zinc-800 mt-2">
                         <div className="h-full bg-signal w-3/4 animate-pulse"></div>
                      </div>
                   </div>
                </div>
             </div>
          </div>
        </div>
      </section>

      {/* THE ARCHITECT FOOTER */}
      <footer id="engine" className="relative z-10 border-t border-white/5 py-20 bg-base">
        <div className="max-w-7xl mx-auto px-8 flex flex-col md:flex-row justify-between items-center gap-10">
          <div className="flex items-center gap-6">
            <Terminal size={32} className="text-signal" />
            <div className="flex flex-col">
              <span className="text-sm font-bold text-white font-mono uppercase tracking-widest">PHOTOGENIX_OS</span>
              <span className="text-[10px] text-zinc-600 font-mono tracking-tighter">AUTHENTICATED_BY_SYSTEM_ADMIN</span>
            </div>
          </div>
          
          <div className="text-center md:text-right">
             <p className="text-zinc-700 font-mono text-[10px] uppercase tracking-[0.5em] mb-2">Designed & Directed By</p>
             <h3 className="text-2xl font-bold text-white font-mono tracking-tighter uppercase italic">
                TIWATON <span className="text-signal">STUDIOS</span>
             </h3>
             <p className="text-[9px] text-zinc-800 font-mono mt-2 uppercase tracking-widest">2024_ALL_RIGHTS_RESERVED // BUILD_0911</p>
          </div>
        </div>
      </footer>

      {/* GLOBAL SCANLINE EFFECT */}
      <div className="fixed inset-0 pointer-events-none z-[100] opacity-[0.03] scanline"></div>

      <style>{`
        @keyframes scanline {
          from { top: 0%; }
          to { top: 100%; }
        }
        .animate-scanline {
          animation: scanline 4s linear infinite;
        }
        @keyframes gradient-x {
          0% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
          100% { background-position: 0% 50%; }
        }
        .animate-gradient-x {
          background-size: 200% 200%;
          animation: gradient-x 6s ease infinite;
        }
        .animate-pulse-slow {
          animation: pulse 4s cubic-bezier(0.4, 0, 0.6, 1) infinite;
        }
        .animate-spin-slow {
          animation: spin 20s linear infinite;
        }
        .animate-bounce-slow {
          animation: bounce 3s infinite;
        }
      `}</style>
    </div>
  );
};
