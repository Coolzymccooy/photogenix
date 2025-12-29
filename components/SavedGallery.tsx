
import React from 'react';
import { ProjectItem } from '../types';
import { Download, Trash2, ArrowLeft, Video, Play } from 'lucide-react';
import { Button } from './ui/Button';

interface SavedGalleryProps {
  items: ProjectItem[];
  onBack: () => void;
  onDelete: (id: string) => void;
}

export const SavedGallery: React.FC<SavedGalleryProps> = ({ items, onBack, onDelete }) => {
  const savedItems = items.filter(i => i.saved);

  return (
    <div className="absolute inset-0 z-50 bg-slate-950 flex flex-col animate-in slide-in-from-bottom-10">
      <div className="h-16 border-b border-slate-800 flex items-center justify-between px-6 bg-slate-900/50 backdrop-blur-sm">
         <div className="flex items-center gap-4">
            <Button variant="ghost" onClick={onBack} icon={<ArrowLeft size={18}/>}>
              Back to Studio
            </Button>
            <h2 className="text-xl font-bold text-white">Saved Library ({savedItems.length})</h2>
         </div>
      </div>

      <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">
         {savedItems.length === 0 ? (
           <div className="h-full flex flex-col items-center justify-center text-slate-500">
              <div className="w-16 h-16 rounded-2xl bg-slate-900 border border-slate-800 mb-4 flex items-center justify-center">
                <Download size={24} className="opacity-50" />
              </div>
              <p>No saved images yet.</p>
              <p className="text-xs mt-2">Click "Save Checkpoint" while editing to add images here.</p>
           </div>
         ) : (
           <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-6 max-w-7xl mx-auto">
              {savedItems.map(item => {
                const isVideo = item.mediaType === 'video';
                return (
                  <div key={item.id} className="group relative bg-slate-900 border border-slate-800 rounded-xl overflow-hidden hover:border-indigo-500/50 transition-all">
                     <div className="aspect-[4/5] bg-black relative">
                        {isVideo ? (
                           <div className="w-full h-full relative group/video">
                             <video 
                               src={item.processedUrl || item.originalUrl} 
                               className="w-full h-full object-cover" 
                               muted
                               loop
                               onMouseOver={e => e.currentTarget.play()}
                               onMouseOut={e => e.currentTarget.pause()}
                             />
                             <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-50 group-hover/video:opacity-0 transition-opacity">
                                <Play size={32} className="text-white fill-white" />
                             </div>
                             <div className="absolute top-2 right-2 bg-black/60 px-2 py-0.5 rounded text-[10px] font-mono text-white flex items-center gap-1">
                                <Video size={10} /> VIDEO
                             </div>
                           </div>
                        ) : (
                           <img 
                             src={item.processedUrl || item.originalUrl} 
                             className="w-full h-full object-cover" 
                             alt="Saved" 
                           />
                        )}
                     </div>
                     <div className="p-4 flex items-center justify-between bg-slate-900 relative z-10">
                        <div className="text-xs text-slate-400 truncate max-w-[100px]">
                          {new Date(parseInt(item.id.split('_')[0] || Date.now().toString())).toLocaleDateString()}
                        </div>
                        <div className="flex gap-2">
                           <a 
                             href={item.processedUrl || item.originalUrl} 
                             download={`saved-${item.id}.${isVideo ? 'mp4' : 'png'}`}
                             className="p-2 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-white transition-colors"
                           >
                             <Download size={16} />
                           </a>
                           <button 
                             onClick={() => onDelete(item.id)}
                             className="p-2 hover:bg-red-900/20 rounded-lg text-slate-400 hover:text-red-400 transition-colors"
                           >
                             <Trash2 size={16} />
                           </button>
                        </div>
                     </div>
                  </div>
                );
              })}
           </div>
         )}
      </div>
    </div>
  );
};
