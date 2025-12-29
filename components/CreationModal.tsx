import React, { useState } from 'react';
import { Button } from './ui/Button';
import { CreationType } from '../types';
import { BookOpen, Layout, Grid, Sparkles, X } from 'lucide-react';

interface CreationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreate: (type: CreationType, theme: string) => void;
  isProcessing: boolean;
  imageCount: number;
}

export const CreationModal: React.FC<CreationModalProps> = ({
  isOpen,
  onClose,
  onCreate,
  isProcessing,
  imageCount
}) => {
  const [selectedType, setSelectedType] = useState<CreationType>('album');
  const [theme, setTheme] = useState('');

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200">
        <div className="p-6 border-b border-slate-800 flex justify-between items-center">
           <h2 className="text-xl font-bold text-white flex items-center gap-2">
             <Sparkles className="text-indigo-500" size={20} />
             AI Creator Studio
           </h2>
           <button onClick={onClose} className="text-slate-500 hover:text-white transition-colors">
             <X size={20} />
           </button>
        </div>

        <div className="p-6 space-y-6">
           <div className="grid grid-cols-3 gap-3">
              {[
                { id: 'album', label: 'Photo Album', icon: Layout },
                { id: 'storybook', label: 'Story Book', icon: BookOpen },
                { id: 'catalogue', label: 'Catalogue', icon: Grid },
              ].map((item) => (
                <button
                  key={item.id}
                  onClick={() => setSelectedType(item.id as CreationType)}
                  className={`flex flex-col items-center justify-center gap-3 p-4 rounded-xl border transition-all ${
                    selectedType === item.id 
                    ? 'bg-indigo-600/20 border-indigo-500 text-white' 
                    : 'bg-slate-800 border-slate-700 text-slate-400 hover:bg-slate-700'
                  }`}
                >
                  <item.icon size={24} className={selectedType === item.id ? 'text-indigo-400' : ''} />
                  <span className="text-sm font-medium">{item.label}</span>
                </button>
              ))}
           </div>

           <div>
             <label className="block text-sm font-medium text-slate-400 mb-2">
               Theme or Concept
             </label>
             <textarea 
               value={theme}
               onChange={(e) => setTheme(e.target.value)}
               placeholder={
                 selectedType === 'album' ? "e.g. Summer vacation memories, vintage wedding..." :
                 selectedType === 'storybook' ? "e.g. A magical adventure in the forest..." :
                 "e.g. Modern minimalist furniture collection..."
               }
               className="w-full bg-slate-950 border border-slate-700 rounded-lg p-3 text-sm text-white focus:ring-2 focus:ring-indigo-500 min-h-[80px] resize-none"
             />
             <p className="text-xs text-slate-500 mt-2">
               Generating using {imageCount} images. The AI will compose a layout based on your theme.
             </p>
           </div>
        </div>

        <div className="p-6 bg-slate-950 border-t border-slate-800 flex justify-end gap-3">
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button 
            onClick={() => onCreate(selectedType, theme)}
            isLoading={isProcessing}
            disabled={!theme.trim()}
          >
            Generate Creation
          </Button>
        </div>
      </div>
    </div>
  );
};
