/**
 * PHOTOGENIX FRONTEND - DEPLOYMENT GUIDE
 * -----------------------------------------------------------------
 * LOCAL: Run `npm run dev`. Ensure VITE_API_BASE is set if your backend
 * is not on the same origin (e.g. Render).
 *
 * Production on Vercel:
 *   - Set VITE_API_BASE=https://photogenix-2.onrender.com/api
 *   - Backend must allow CORS for https://photogenix-one.vercel.app
 * -----------------------------------------------------------------
 */

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { ToolsPanel } from './components/ToolsPanel';
import { ComparisonSlider } from './components/ComparisonSlider';
import { VideoWorkspace } from './components/VideoWorkspace';
import { GalleryStrip } from './components/GalleryStrip';
import { ReviewModal } from './components/ReviewModal';
import { LandingPage } from './components/LandingPage';
import { AuthModal } from './components/AuthModal';
import { CheckpointPanel } from './components/CheckpointPanel';
import { HelpCorner } from './components/HelpCorner';
import { CreationModal } from './components/CreationModal';
import { AILens } from './components/AILens';
import { Button } from './components/ui/Button';

// ✅ RAW: use multipart to avoid base64 payload blowups
import {
  transformImage,
  transformVideoMock,
  superProcess,
  combineImages,
  healSpot,
  applyWatermark,
  developRawFile,
} from './services/geminiService';

import { AuthService, UserProfile } from './services/authService';
import { StorageService } from './services/storageService';
import { Analytics } from './services/analyticsService';
import { Scan, Cpu, PackageOpen, HelpCircle, Sparkles, Binary } from 'lucide-react';
import { ToolType, ProjectItem, HistoryItem, MediaType } from './types';

type ViewState = 'landing' | 'app';

const RAW_EXTENSIONS = ['dng', 'cr2', 'cr3', 'nef', 'nrw', 'arw', 'sr2', 'srf', 'raf', 'orf', 'rw2', 'pef', 'srw', '3fr', 'fff', 'iiq', 'mos', 'gpr'];

/**
 * Small concurrency limiter (so bulk RAW doesn't DOS your backend)
 */
async function runWithLimit<T, R>(
  items: T[],
  limit: number,
  worker: (item: T) => Promise<R>
): Promise<R[]> {
  const results: R[] = [];
  let idx = 0;

  const runners = Array.from({ length: Math.max(1, limit) }, async () => {
    while (idx < items.length) {
      const my = idx++;
      results[my] = await worker(items[my]);
    }
  });

  await Promise.all(runners);
  return results;
}

const App: React.FC = () => {
  const [viewState, setViewState] = useState<ViewState>('landing');
  const [user, setUser] = useState<UserProfile | null>(AuthService.getCurrentUser());
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [items, setItems] = useState<ProjectItem[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [activeTool, setActiveTool] = useState<ToolType>('super-engine');
  const [isProcessing, setIsProcessing] = useState(false);
  const [sessionReady, setSessionReady] = useState(false);
  const [activeMediaType, setActiveMediaType] = useState<MediaType>('image');
  const [loadingMessage, setLoadingMessage] = useState("DECODING_STREAM...");
  const [lastOpTime, setLastOpTime] = useState(0);
  const [avgLoadTime, setAvgLoadTime] = useState(0);
  const [spotRadius, setSpotRadius] = useState(15);

  const [isReviewOpen, setIsReviewOpen] = useState(false);
  const [isLensOpen, setIsLensOpen] = useState(false);
  const [isHelpOpen, setIsHelpOpen] = useState(false);
  const [isCreationOpen, setIsCreationOpen] = useState(false);

  // ✅ Keep RAW File objects in-memory (cannot persist reliably)
  const rawFileByIdRef = useRef<Map<string, File>>(new Map());

  const loadSession = useCallback(async () => {
    setSessionReady(false);
    try {
      const loadedItems = await StorageService.loadWorkspace();
      if (loadedItems && loadedItems.length > 0) {
        setItems(loadedItems);
        setSelectedIds(prev => (prev.length > 0 && loadedItems.some(li => prev.includes(li.id))) ? prev : [loadedItems[0].id]);
        setViewState('app');
      }
    } catch (err) {
      console.error("Hydration Error:", err);
    } finally {
      setSessionReady(true);
    }
  }, []);

  useEffect(() => {
    loadSession();
    setAvgLoadTime(Analytics.getAverageLoadTime());
  }, [loadSession]);

  const saveTimeout = useRef<any>(null);
  useEffect(() => {
    if (saveTimeout.current) clearTimeout(saveTimeout.current);
    if (items.length > 0 && sessionReady) {
      saveTimeout.current = setTimeout(() => {
        StorageService.saveWorkspace(items);
      }, 5000);
    }
  }, [items, sessionReady]);

  const currentItem = useMemo(() => items.find(i => i.id === selectedIds[0]), [items, selectedIds]);

  const handleSelect = useCallback((id: string, isMulti: boolean) => {
    if (isMulti) {
      setSelectedIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
    } else {
      setSelectedIds([id]);
    }
  }, []);

  const getRawFileForItem = useCallback(async (item: ProjectItem): Promise<File> => {
    const cached = rawFileByIdRef.current.get(item.id);
    if (cached) return cached;

    // Fallback: fetch from the object URL (works as long as the tab is still alive)
    const resp = await fetch(item.originalUrl);
    const blob = await resp.blob();
    const ext = item.fileExtension || "dng";
    return new File([blob], `upload.${ext}`, { type: blob.type || "application/octet-stream" });
  }, []);

  const autoDevelopRawItems = useCallback(async (rawItems: ProjectItem[]) => {
    if (rawItems.length === 0) return;

    // mark all as developing
    setItems(prev => prev.map(p => rawItems.some(r => r.id === p.id) ? { ...p, status: 'developing' } : p));

    await runWithLimit(rawItems, 2, async (rawItem) => {
      try {
        const file = await getRawFileForItem(rawItem);

        const developed = await developRawFile(file, {
          prompt: "ACT AS RAW DEVELOPER. Recover highlights & shadows, preserve skin tones, natural color science. IMAGE ONLY.",
        });

        // persist processed blob
        const resp = await fetch(developed.developedUrl);
        const blob = await resp.blob();
        await StorageService.persistBlob(rawItem.id, 'proc', blob);

        const historyItem: HistoryItem = {
          id: Date.now().toString(),
          url: developed.developedUrl,
          prompt: 'RAW_DEVELOPMENT',
          timestamp: Date.now(),
          toolLabel: 'NEURAL_DEVELOP'
        };

        setItems(prev => prev.map(p => p.id === rawItem.id ? {
          ...p,
          processedUrl: developed.developedUrl,
          status: 'done',
          history: [historyItem],
          checkpoints: [historyItem]
        } : p));
      } catch (err) {
        console.error("RAW Development Failed:", err);
        setItems(prev => prev.map(p => p.id === rawItem.id ? { ...p, status: 'error' } : p));
      }
    });
  }, [getRawFileForItem]);

  const handleAddFile = async (type: MediaType) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = type === 'image' ? 'image/*, .dng, .cr2, .cr3, .nef, .arw' : 'video/*';
    input.multiple = true;

    input.onchange = async (e) => {
      const files = Array.from((e.target as HTMLInputElement).files || []);
      if (files.length === 0) return;

      setViewState('app');
      setSessionReady(false);

      const newItems: ProjectItem[] = [];

      for (const file of files) {
        const id = Math.random().toString(36).substr(2, 9);
        const ext = file.name.split('.').pop()?.toLowerCase() || '';
        const isRaw = RAW_EXTENSIONS.includes(ext);

        // keep RAW file in memory for multipart upload
        if (isRaw) rawFileByIdRef.current.set(id, file);

        await StorageService.persistBlob(id, 'orig', file);

        newItems.push({
          id,
          mediaType: type,
          originalUrl: URL.createObjectURL(file),
          processedUrl: null,
          status: isRaw ? 'developing' : 'idle',
          history: [],
          checkpoints: [],
          isRaw,
          fileExtension: ext,
        });
      }

      setItems(prev => [...prev, ...newItems]);
      setSelectedIds([newItems[0].id]);
      setSessionReady(true);

      // Auto-develop RAW in the background (but controlled concurrency)
      void autoDevelopRawItems(newItems.filter(i => i.isRaw));
    };

    input.click();
  };

  const handleProcess = async (instruction: string, toolLabel: string, isBatch: boolean, extra?: any) => {
    const targets = isBatch ? items.filter(i => selectedIds.includes(i.id)) : [currentItem].filter(Boolean) as ProjectItem[];
    if (targets.length === 0 || isProcessing) return;

    setIsProcessing(true);
    setLoadingMessage(isBatch ? `BATCH_PROCESSING [${targets.length}_FILES]...` : `ENGINE_CALIBRATING [${toolLabel}]...`);

    const startTime = Date.now();
    try {
      const results = await Promise.all(targets.map(async (target) => {
        setItems(prev => prev.map(p => p.id === target.id ? { ...p, status: 'processing' } : p));
        const sourceUrl = target.processedUrl || target.originalUrl;

        try {
          let resultUrl = '';

          if (activeTool === 'watermark' || activeTool === 'logo-gen') {
            resultUrl = await applyWatermark(sourceUrl, instruction.split(':').pop()?.trim() || 'PHOTOGENIX');
          } else if (activeTool === 'aspect-ratio') {
            const ratio = extra?.aspectRatio || instruction.split(':').pop()?.trim();
            resultUrl = await transformImage(
              sourceUrl,
              `Re-crop and intelligently extend this image to a ${ratio} aspect ratio. Fill gaps with context-aware textures. IMAGE ONLY.`,
              ratio
            );
          } else if (target.mediaType === 'image') {
            resultUrl =
              (activeTool === 'super-engine' || activeTool === 'neural-beauty')
                ? await superProcess(sourceUrl)
                : await transformImage(sourceUrl, instruction);
          } else {
            resultUrl = await transformVideoMock(sourceUrl);
          }

          const resp = await fetch(resultUrl);
          const blob = await resp.blob();
          await StorageService.persistBlob(target.id, 'proc', blob);

          const historyItem: HistoryItem = { id: Date.now().toString(), url: resultUrl, prompt: instruction, timestamp: Date.now(), toolLabel };
          return { id: target.id, resultUrl, historyItem };
        } catch (e) {
          return { id: target.id, error: true as const };
        }
      }));

      setItems(prev => prev.map(item => {
        const res = results.find(r => r.id === item.id);
        if (!res || (res as any).error) return item;
        const r = res as any;
        return {
          ...item,
          processedUrl: r.resultUrl,
          status: 'done' as const,
          lastTool: toolLabel,
          history: [...item.history, r.historyItem],
          checkpoints: [...item.checkpoints, r.historyItem],
          metadata: { ...item.metadata, lastUsedPrompt: instruction } as any
        };
      }));

      setLastOpTime(Date.now() - startTime);
      Analytics.trackPerformance('tool_process', Date.now() - startTime);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleCoordinateSelect = useCallback(async (x: number, y: number) => {
    if (!currentItem || activeTool !== 'spot-heal-pro' || isProcessing) return;
    setIsProcessing(true);
    setLoadingMessage(`RECONSTRUCTING_AREA...`);
    try {
      const sourceUrl = currentItem.processedUrl || currentItem.originalUrl;
      const result = await healSpot(sourceUrl, x, y, spotRadius);

      const resp = await fetch(result);
      const blob = await resp.blob();
      await StorageService.persistBlob(currentItem.id, 'proc', blob);

      const historyItem = { id: Date.now().toString(), url: result, prompt: `Manual Heal @ ${x.toFixed(1)}%, ${y.toFixed(1)}%`, timestamp: Date.now(), toolLabel: 'SPOT_HEAL' };
      setItems(prev => prev.map(p => p.id === currentItem.id ? { ...p, processedUrl: result, history: [...p.history, historyItem], checkpoints: [...p.checkpoints, historyItem], status: 'done' } : p));
    } catch (e) {
      console.error("Heal failed", e);
    } finally {
      setIsProcessing(false);
    }
  }, [currentItem, activeTool, isProcessing, spotRadius]);

  const RenderWorkspace = () => {
    if (!sessionReady) return (
      <div className="flex flex-col items-center gap-4 font-mono">
        <Binary size={48} className="text-signal animate-pulse" />
        <span className="text-signal text-[10px] tracking-[0.4em] uppercase">NEURAL_BUFFER_READYING...</span>
      </div>
    );

    if (!currentItem) return (
      <div className="flex flex-col items-center justify-center p-12 text-center">
        <div
          className="p-20 border border-line bg-surface/10 rounded-sm flex flex-col items-center group cursor-pointer hover:bg-surface/30 transition-all border-dashed"
          onClick={() => handleAddFile('image')}
        >
          <PackageOpen size={64} className="text-zinc-800 mb-8" />
          <span className="uppercase tracking-[0.6em] text-[10px] text-zinc-600 font-bold">INJECT_DATA_STREAM</span>
        </div>
      </div>
    );

    return currentItem.mediaType === 'image' ? (
      <div className="w-full h-full p-6">
        <ComparisonSlider
          itemId={currentItem.id}
          beforeImage={currentItem.originalUrl}
          afterImage={currentItem.processedUrl || currentItem.originalUrl}
          isProcessing={isProcessing}
          processingMessage={loadingMessage}
          isCoordinateMode={activeTool === 'spot-heal-pro'}
          onCoordinateSelect={handleCoordinateSelect}
          spotRadius={spotRadius}
          onRefresh={loadSession}
        />
      </div>
    ) : (
      <VideoWorkspace item={currentItem} isProcessing={isProcessing} />
    );
  };

  return (
    <div className="flex flex-col h-screen bg-base overflow-hidden">
      {viewState === 'landing' ? (
        <LandingPage
          onGetStarted={() => setIsAuthModalOpen(true)}
          isAuthenticated={!!user}
          onReturnToApp={() => setViewState('app')}
        />
      ) : (
        <div className="flex flex-1 overflow-hidden">
          <ToolsPanel
            onProcess={handleProcess}
            isProcessing={isProcessing}
            activeTool={activeTool}
            setActiveTool={setActiveTool}
            projectCount={items.length}
            onGoHome={() => setViewState('landing')}
            activeMediaType={activeMediaType}
            onSwitchMediaType={setActiveMediaType}
            rangeValue={spotRadius}
            onRangeChange={setSpotRadius}
            selectedCount={selectedIds.length}
          />

          <main className="flex-1 flex flex-col min-w-0 bg-[#010101] relative">
            <header className="h-16 bg-surface border-b border-line flex items-center justify-between px-6 shrink-0 z-40">
              <div className="flex gap-2">
                <Button variant="secondary" size="sm" onClick={() => setIsReviewOpen(true)} disabled={items.length === 0}>
                  REVIEW_SESSION
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setIsCreationOpen(true)}
                  icon={<Sparkles size={14} className="text-signal" />}
                >
                  CREATOR_STUDIO
                </Button>
              </div>
              <div className="flex items-center gap-4">
                <div className="hidden lg:flex items-center gap-6 px-4 py-1.5 bg-base border border-line rounded-sm font-mono">
                  <div className="flex items-center gap-2 text-zinc-500">
                    <Cpu size={12} className="text-signal" />
                    <span className="text-[10px] uppercase">{lastOpTime > 0 ? `${lastOpTime}ms` : 'STABLE'}</span>
                  </div>
                </div>
                <div className="flex gap-1">
                  <button
                    onClick={() => setIsLensOpen(!isLensOpen)}
                    className={`p-2 rounded-sm border transition-all ${isLensOpen ? 'bg-signal text-white' : 'bg-base text-zinc-500 border-line hover:text-white'}`}
                  >
                    <Scan size={18} />
                  </button>
                  <button
                    onClick={() => setIsHelpOpen(!isHelpOpen)}
                    className="p-2 rounded-sm border bg-base text-zinc-500 border-line hover:text-white"
                  >
                    <HelpCircle size={18} />
                  </button>
                </div>
              </div>
            </header>

            <div className="flex-1 relative flex items-center justify-center overflow-hidden bg-black">
              {RenderWorkspace()}
              {isLensOpen && currentItem?.mediaType === 'image' && (
                <AILens imageUrl={currentItem.processedUrl || currentItem.originalUrl} isOpen={isLensOpen} onClose={() => setIsLensOpen(false)} />
              )}
            </div>

            <HelpCorner isOpen={isHelpOpen} onClose={() => setIsHelpOpen(false)} />
          </main>

          <CheckpointPanel
            checkpoints={currentItem?.checkpoints || []}
            currentUrl={currentItem?.processedUrl || null}
            onRestore={(item) => setItems(prev => prev.map(p => p.id === currentItem?.id ? { ...p, processedUrl: item.url } : p))}
            onRemove={(id) => setItems(prev => prev.map(p => p.id === currentItem?.id ? { ...p, checkpoints: p.checkpoints.filter(c => c.id !== id) } : p))}
            onReset={() => setItems(prev => prev.map(p => p.id === currentItem?.id ? { ...p, processedUrl: null } : p))}
          />
        </div>
      )}

      {viewState !== 'landing' && (
        <GalleryStrip
          items={items}
          selectedIds={selectedIds}
          onSelect={handleSelect}
          onAddImage={() => handleAddFile('image')}
          onAddVideo={() => handleAddFile('video')}
          onAddFolder={() => handleAddFile('image')}
          onRemove={(id) => setItems(prev => prev.filter(i => i.id !== id))}
        />
      )}

      {isAuthModalOpen && (
        <AuthModal
          isOpen={isAuthModalOpen}
          onClose={() => setIsAuthModalOpen(false)}
          onSuccess={(u) => { setUser(u); setIsAuthModalOpen(false); setViewState('app'); }}
        />
      )}

      {isReviewOpen && <ReviewModal isOpen={isReviewOpen} onClose={() => setIsReviewOpen(false)} items={items} onDownloadAll={() => { }} />}

      {isCreationOpen && <CreationModal isOpen={isCreationOpen} onClose={() => setIsCreationOpen(false)} onCreate={() => { }} isProcessing={isProcessing} imageCount={selectedIds.length} />}
    </div>
  );
};

export default App;
