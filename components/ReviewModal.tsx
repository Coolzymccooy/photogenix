
import React, { useState } from 'react';
import { ProjectItem } from '../types';
import { Button } from './ui/Button';
import { X, Download, Check, ArrowLeft, Grid3X3, Tag, Wand2, Share2, Loader2, Play, Zap, ShieldCheck, Package } from 'lucide-react';
import JSZip from 'jszip';

interface ReviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  items: ProjectItem[];
  onDownloadAll: () => void;
}

export const ReviewModal: React.FC<ReviewModalProps> = ({
  isOpen,
  onClose,
  items,
  onDownloadAll
}) => {
  const [sharingId, setSharingId] = useState<string | null>(null);
  const [copySuccessId, setCopySuccessId] = useState<string | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState(0);

  if (!isOpen) return null;

  const handleShare = async (item: ProjectItem) => {
    if (!item.processedUrl && !item.originalUrl) return;
    const urlToShare = item.processedUrl || item.originalUrl;
    setSharingId(item.id);
    try {
        const res = await fetch(urlToShare);
        const blob = await res.blob();
        const ext = item.mediaType === 'video' ? 'mp4' : 'png';
        const file = new File([blob], `photogenix-${item.id.slice(-4)}.${ext}`, { type: blob.type });
        if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
            await navigator.share({ title: 'PhotoGenix Creation', files: [file] });
        } else {
            await navigator.clipboard.writeText(urlToShare);
            setCopySuccessId(item.id);
            setTimeout(() => setCopySuccessId(null), 2000);
        }
    } catch (err) { console.error("Share failed:", err); } finally { setSharingId(null); }
  };

  const handleBatchExport = async () => {
    if (isExporting || items.length === 0) return;
    setIsExporting(true);
    setExportProgress(0);

    try {
      const zip = new JSZip();
      const folder = zip.folder('photogenix-export');

      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        const url = item.processedUrl || item.originalUrl;
        if (!url) continue;

        try {
          const resp = await fetch(url);
          const blob = await resp.blob();
          const ext = item.mediaType === 'video' ? 'mp4' : (blob.type.includes('png') ? 'png' : 'jpg');
          const name = `${String(i + 1).padStart(3, '0')}_${item.lastTool || 'original'}.${ext}`;
          folder!.file(name, blob);
        } catch (e) {
          console.warn(`Skip export for ${item.id}:`, e);
        }

        setExportProgress(Math.round(((i + 1) / items.length) * 100));
      }

      const content = await zip.generateAsync({ type: 'blob' }, (meta) => {
        setExportProgress(Math.round(meta.percent));
      });

      const a = document.createElement('a');
      a.href = URL.createObjectURL(content);
      a.download = `photogenix-export-${new Date().toISOString().slice(0, 10)}.zip`;
      a.click();
      URL.revokeObjectURL(a.href);
    } catch (e) {
      console.error("Export failed:", e);
    } finally {
      setIsExporting(false);
      setExportProgress(0);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] bg-slate-950 flex flex-col animate-in fade-in duration-200">
      <div className="h-16 border-b border-slate-800 flex items-center justify-between px-6 bg-slate-900/50 backdrop-blur-sm">
        <div className="flex items-center gap-4">
           <button onClick={onClose} className="p-2 hover:bg-slate-800 rounded-full text-slate-400 hover:text-white transition-colors">
              <ArrowLeft size={20} />
           </button>
           <h2 className="text-lg font-bold text-white flex items-center gap-2">
             <Grid3X3 className="text-indigo-500" size={20} />
             Review Session ({items.length})
           </h2>
        </div>
        <div className="flex gap-2">
          <Button
            variant="primary"
            onClick={handleBatchExport}
            isLoading={isExporting}
            icon={<Package size={16}/>}
          >
            {isExporting ? `EXPORTING ${exportProgress}%` : `EXPORT_ALL (${items.length})`}
          </Button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-8 custom-scrollbar bg-[#0a0f1e]">
         <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 max-w-7xl mx-auto">
            {items.map((item) => (
               <div key={item.id} className="bg-slate-900 border border-slate-800 rounded-sm overflow-hidden shadow-xl group flex flex-col">
                  <div className="relative aspect-[4/5] bg-black/40">
                    <img src={item.processedUrl || item.originalUrl} className="w-full h-full object-cover" alt="Result" />
                    <div className="absolute top-2 left-2 flex flex-col gap-1 z-30">
                        {item.metadata?.recoveredHighlights && (
                            <div className="bg-emerald-500/90 text-white text-[8px] font-bold px-2 py-0.5 rounded-sm flex items-center gap-1 shadow-lg">
                                <Zap size={8} /> HIGHLIGHTS_RECOVERED
                            </div>
                        )}
                        {item.metadata?.noiseReduced && (
                            <div className="bg-signal/90 text-white text-[8px] font-bold px-2 py-0.5 rounded-sm flex items-center gap-1 shadow-lg">
                                <ShieldCheck size={8} /> NR_APPLIED
                            </div>
                        )}
                    </div>
                  </div>
                  <div className="p-4 border-t border-slate-800 bg-slate-900 flex items-center justify-between">
                     <span className="text-[10px] font-mono text-slate-500">{item.lastTool || 'ORIGINAL'}</span>
                     <div className="flex gap-2">
                        <button onClick={() => handleShare(item)} className="p-1.5 text-slate-400 hover:text-white bg-slate-800 rounded-sm border border-slate-700">
                           {sharingId === item.id ? <Loader2 size={12} className="animate-spin" /> : copySuccessId === item.id ? <Check size={12} /> : <Share2 size={12} />}
                        </button>
                        <a href={item.processedUrl || item.originalUrl} download={`photogenix_${item.id}.jpg`} className="p-1.5 text-slate-400 hover:text-white bg-slate-800 rounded-sm border border-slate-700">
                           <Download size={12} />
                        </a>
                     </div>
                  </div>
               </div>
            ))}
         </div>
      </div>
    </div>
  );
};
