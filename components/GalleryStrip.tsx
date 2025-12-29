
import React from 'react';
import { ProjectItem } from '../types';
import { Plus, X, FolderInput, Video, Image as ImageIcon, Binary, Upload, Check } from 'lucide-react';

interface GalleryStripProps {
  items: ProjectItem[];
  selectedIds: string[];
  onSelect: (id: string, isMulti: boolean) => void;
  onAddImage: () => void;
  onAddVideo: () => void;
  onAddFolder: () => void;
  onRemove: (id: string) => void;
}

export const GalleryStrip: React.FC<GalleryStripProps> = ({
  items,
  selectedIds,
  onSelect,
  onAddImage,
  onAddVideo,
  onAddFolder,
  onRemove
}) => {
  return (
    <div className="w-full bg-base border-t border-line p-4 shrink-0 z-40 relative">
      <div className="flex items-center gap-3 overflow-x-auto no-scrollbar pb-2">
        
        {/* Unified Upload Options */}
        <div className="flex gap-2 mr-2">
            <button
                onClick={onAddImage}
                className="flex-shrink-0 w-20 h-20 rounded-sm border border-line hover:border-signal hover:bg-surface text-zinc-500 hover:text-white flex flex-col items-center justify-center transition-all group font-mono"
            >
                <ImageIcon size={18} className="mb-1" />
                <span className="text-[8px] font-bold tracking-widest">ADD_IMG</span>
            </button>
            <button
                onClick={onAddVideo}
                className="flex-shrink-0 w-20 h-20 rounded-sm border border-line hover:border-signal hover:bg-surface text-zinc-500 hover:text-white flex flex-col items-center justify-center transition-all group font-mono"
            >
                <Video size={18} className="mb-1" />
                <span className="text-[8px] font-bold tracking-widest">ADD_VID</span>
            </button>
        </div>

        <div className="w-px h-12 bg-line mx-1"></div>

        {/* Gallery Items */}
        {items.map((item) => {
          const displayUrl = item.processedUrl || item.originalUrl;
          const isSelected = selectedIds.includes(item.id);
          const isVideo = item.mediaType === 'video';
          const isDeveloping = item.status === 'developing';
          const isProcessing = item.status === 'processing';
          
          return (
            <div key={item.id} className="relative group flex-shrink-0">
               <button
                onClick={(e) => onSelect(item.id, e.metaKey || e.ctrlKey)}
                className={`relative w-20 h-20 rounded-sm overflow-hidden border transition-all duration-150 bg-black ${
                  isSelected 
                    ? 'border-signal ring-1 ring-signal/50' 
                    : 'border-line opacity-60 hover:opacity-100'
                }`}
              >
                {isVideo ? (
                  <div className="w-full h-full bg-black relative">
                     <video 
                       src={displayUrl}
                       className="w-full h-full object-cover opacity-80"
                       muted
                       loop
                     />
                     <div className="absolute top-1 right-1">
                        <Video size={10} className="text-white opacity-50" />
                     </div>
                  </div>
                ) : (
                  <div className="relative w-full h-full">
                    <img 
                      src={displayUrl} 
                      alt="" 
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        (e.target as HTMLImageElement).src = `data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI4MCIgaGVpZ2h0PSI4MCI+PHJlY3Qgd2lkdGg9IjgwIiBoZWlnaHQ9IjgwIiBmaWxsPSIjMTgxODEiLz48dGV4dCB4PSI0MCIgeT0iNDAiIGZpbGw9IiM2MzY2RjEiIGZvbnQtZmFtaWx5PSJNb25vIiBmb250LXNpemU9IjgiIHRleHQtYW5jaG9yPSJtaWRkbGUiPkVSUk9SPC90ZXh0Pjwvc3ZnPg==`;
                      }}
                    />
                    {isSelected && (
                      <div className="absolute top-1 left-1 bg-signal rounded-full p-0.5">
                        <Check size={8} className="text-white" />
                      </div>
                    )}
                    {item.isRaw && item.status === 'done' && (
                       <div className="absolute bottom-0 right-0 left-0 bg-signal/80 text-[6px] font-bold text-white py-0.5 text-center uppercase tracking-tighter">
                         DEVELOPED
                       </div>
                    )}
                  </div>
                )}
                
                {(isProcessing || isDeveloping) && (
                  <div className="absolute inset-0 bg-black/60 flex flex-col items-center justify-center backdrop-blur-[1px] z-10">
                    <div className="w-4 h-4 border border-signal border-t-transparent rounded-full animate-spin mb-1"></div>
                    <span className="text-[6px] text-signal font-bold font-mono">
                      {isDeveloping ? 'NEURAL_DEV' : 'SYNCING'}
                    </span>
                  </div>
                )}
                
                {item.status === 'error' && (
                   <div className="absolute inset-0 bg-red-950/40 flex items-center justify-center border-2 border-red-500/50 z-10">
                      <X size={12} className="text-red-500" />
                   </div>
                )}
              </button>

              <button 
                onClick={(e) => { e.stopPropagation(); onRemove(item.id); }}
                className="absolute -top-1 -right-1 bg-base text-zinc-500 hover:text-red-500 rounded-full p-1 border border-line opacity-0 group-hover:opacity-100 transition-opacity z-20 shadow-xl"
              >
                <X size={8} />
              </button>
            </div>
          );
        })}
      </div>
      {selectedIds.length > 1 && (
        <div className="absolute -top-10 left-4 bg-signal px-3 py-1.5 rounded-sm flex items-center gap-2 shadow-2xl animate-in slide-in-from-bottom-2">
           <span className="text-[9px] font-mono font-bold text-white tracking-widest">{selectedIds.length}_ASSETS_SELECTED</span>
        </div>
      )}
    </div>
  );
};
