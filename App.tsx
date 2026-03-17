/**
 * PHOTOGENIX FRONTEND
 * -----------------------------------------------------------------
 * Desktop + Web photo editing studio with local Sharp processing
 * and AI-powered tools via Gemini.
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

import {
  transformImage,
  transformVideoMock,
  superProcess,
  healSpot,
  applyWatermark,
  developRawFile,
  localProcess,
} from './services/geminiService';

import { AuthService, UserProfile } from './services/authService';
import { StorageService } from './services/storageService';
import { Analytics } from './services/analyticsService';
import { Scan, Cpu, PackageOpen, HelpCircle, Sparkles, Binary } from 'lucide-react';
import { ToolType, ProjectItem, HistoryItem, MediaType } from './types';

type ViewState = 'landing' | 'app';

const RAW_EXTENSIONS = ['dng', 'cr2', 'cr3', 'nef', 'nrw', 'arw', 'sr2', 'srf', 'raf', 'orf', 'rw2', 'pef', 'srw', '3fr', 'fff', 'iiq', 'mos', 'gpr'];

// Tools that can be processed locally via Sharp (instant, no AI round-trip)
const LOCAL_TOOLS = new Set<ToolType>([
  'enhance', 'clean', 'sharpness', 'watermark', 'smart-crop',
]);


/**
 * Concurrency limiter for bulk operations.
 * Increased from 2 -> 4 for better throughput on desktop.
 */
async function runWithLimit<T, R>(
  items: T[],
  limit: number,
  worker: (item: T) => Promise<R>
): Promise<R[]> {
  const results: R[] = [];
  let idx = 0;

  const runners = Array.from({ length: Math.min(items.length, Math.max(1, limit)) }, async () => {
    while (idx < items.length) {
      const my = idx++;
      try {
        results[my] = await worker(items[my]);
      } catch (e) {
        // Retry once on failure
        try {
          results[my] = await worker(items[my]);
        } catch (retryErr) {
          throw retryErr;
        }
      }
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
  const [spotRadius, setSpotRadius] = useState(15);

  const [isReviewOpen, setIsReviewOpen] = useState(false);
  const [isLensOpen, setIsLensOpen] = useState(false);
  const [isHelpOpen, setIsHelpOpen] = useState(false);
  const [isCreationOpen, setIsCreationOpen] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);

  // Keep RAW File objects in-memory (cannot persist reliably)
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

    // Fallback: fetch from the object URL or IndexedDB blob
    const blob = await StorageService.getBlob(item.id, 'orig');
    if (blob) {
      const ext = item.fileExtension || "dng";
      return new File([blob], `upload.${ext}`, { type: blob.type || "application/octet-stream" });
    }

    const resp = await fetch(item.originalUrl);
    const fetchedBlob = await resp.blob();
    const ext = item.fileExtension || "dng";
    return new File([fetchedBlob], `upload.${ext}`, { type: fetchedBlob.type || "application/octet-stream" });
  }, []);

  const autoDevelopRawItems = useCallback(async (rawItems: ProjectItem[]) => {
    if (rawItems.length === 0) return;

    // mark all as developing
    setItems(prev => prev.map(p => rawItems.some(r => r.id === p.id) ? { ...p, status: 'developing' } : p));

    // Use higher concurrency (4) for bulk RAW processing
    await runWithLimit(rawItems, 4, async (rawItem) => {
      try {
        const file = await getRawFileForItem(rawItem);

        const developed = await developRawFile(file, {
          prompt: "ACT AS RAW DEVELOPER. Recover highlights and shadows with natural tone mapping. Preserve skin tones and natural color science. Maintain all facial features, expressions, and subject identity exactly as captured. Apply professional white balance and exposure correction. IMAGE ONLY.",
        });

        // persist processed blob
        const resp = await fetch(developed.developedUrl);
        const blob = await resp.blob();
        await StorageService.persistBlob(rawItem.id, 'proc', blob);

        const historyItem: HistoryItem = {
          id: Date.now().toString() + rawItem.id,
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
        console.error("RAW Development Failed:", rawItem.id, err);
        setItems(prev => prev.map(p => p.id === rawItem.id ? { ...p, status: 'error' } : p));
      }
    });
  }, [getRawFileForItem]);

  /** Core file ingestion — used by both file dialog and drag-and-drop */
  const processFiles = useCallback(async (files: File[], type: MediaType) => {
    if (files.length === 0) return;
    setViewState('app');

    const newItems: ProjectItem[] = [];

    for (const file of files) {
      const id = crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2, 11);
      const ext = file.name.split('.').pop()?.toLowerCase() || '';
      const isRaw = RAW_EXTENSIONS.includes(ext);

      if (isRaw) rawFileByIdRef.current.set(id, file);

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

    // Persist blobs to IndexedDB in background (non-blocking)
    Promise.all(
      files.map((file, i) =>
        StorageService.persistBlob(newItems[i].id, 'orig', file).catch(err =>
          console.warn("Blob persist warning:", newItems[i].id, err)
        )
      )
    ).catch(() => {});

    // Auto-develop RAW files in the background
    const rawNewItems = newItems.filter(i => i.isRaw);
    if (rawNewItems.length > 0) {
      void autoDevelopRawItems(rawNewItems);
    }
  }, [autoDevelopRawItems]);

  const handleAddFile = async (type: MediaType) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = type === 'image' ? 'image/*, .dng, .cr2, .cr3, .nef, .arw, .raf, .orf, .rw2, .pef' : 'video/*';
    input.multiple = true;
    input.onchange = (e) => {
      const files = Array.from((e.target as HTMLInputElement).files || []);
      processFiles(files, type);
    };
    input.click();
  };

  // Drag-and-drop handlers
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) {
      const hasVideo = files.some(f => f.type.startsWith('video/'));
      processFiles(files, hasVideo ? 'video' : 'image');
    }
  }, [processFiles]);

  // Global keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const mod = e.ctrlKey || e.metaKey;
      if (!mod) return;

      if (e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        if (currentItem && currentItem.checkpoints.length > 1) {
          const prev = currentItem.checkpoints[currentItem.checkpoints.length - 2];
          setItems(its => its.map(p => p.id === currentItem.id ? {
            ...p,
            processedUrl: prev.url,
            checkpoints: p.checkpoints.slice(0, -1),
          } : p));
        } else if (currentItem && currentItem.checkpoints.length === 1) {
          setItems(its => its.map(p => p.id === currentItem.id ? {
            ...p,
            processedUrl: null,
            checkpoints: [],
          } : p));
        }
      } else if (e.key === 'o') {
        e.preventDefault();
        handleAddFile('image');
      } else if (e.key === 's') {
        e.preventDefault();
        const url = currentItem?.processedUrl || currentItem?.originalUrl;
        if (url) {
          const a = document.createElement('a');
          a.href = url;
          a.download = `photogenix_${currentItem?.id || 'export'}.jpg`;
          a.click();
        }
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [currentItem, handleAddFile]);

  const handleProcess = async (instruction: string, toolLabel: string, isBatch: boolean, extra?: any) => {
    const targets = isBatch ? items.filter(i => selectedIds.includes(i.id)) : [currentItem].filter(Boolean) as ProjectItem[];
    if (targets.length === 0 || isProcessing) return;

    setIsProcessing(true);

    // Determine if this is a local (Sharp) or AI (Gemini) operation
    const isLocal = LOCAL_TOOLS.has(activeTool);
    const toolMode = isLocal ? 'LOCAL' : 'AI';
    setLoadingMessage(
      isBatch
        ? `${toolMode}_BATCH [${targets.length}_FILES]...`
        : isLocal
          ? `LOCAL_PROCESSING [${toolLabel}]...`
          : `AI_PROCESSING [${toolLabel}]...`
    );

    const startTime = Date.now();
    try {
      const results = await Promise.all(targets.map(async (target) => {
        setItems(prev => prev.map(p => p.id === target.id ? { ...p, status: 'processing' } : p));
        const sourceUrl = target.processedUrl || target.originalUrl;

        try {
          let resultUrl = '';

          if (isLocal) {
            // Route to local Sharp processing (instant)
            resultUrl = await localProcess(sourceUrl, activeTool, {
              text: extra?.watermarkText || instruction.split(':').pop()?.trim(),
            });
          } else if (activeTool === 'watermark' || activeTool === 'logo-gen') {
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

          const historyItem: HistoryItem = { id: Date.now().toString() + target.id, url: resultUrl, prompt: instruction, timestamp: Date.now(), toolLabel };
          return { id: target.id, resultUrl, historyItem };
        } catch (e) {
          console.error(`Processing failed for ${target.id}:`, e);
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
    <div
      className="flex flex-col h-screen bg-base overflow-hidden relative"
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {isDragOver && (
        <div className="absolute inset-0 z-[200] bg-base/90 backdrop-blur-sm flex items-center justify-center pointer-events-none">
          <div className="border-2 border-dashed border-signal rounded-sm p-16 text-center animate-pulse">
            <PackageOpen size={64} className="text-signal mx-auto mb-4" />
            <span className="text-signal text-xs font-mono uppercase tracking-[0.4em] font-bold">DROP_FILES_TO_IMPORT</span>
          </div>
        </div>
      )}
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
          onRemove={(id) => { StorageService.removeItem(id); rawFileByIdRef.current.delete(id); setItems(prev => prev.filter(i => i.id !== id)); }}
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
