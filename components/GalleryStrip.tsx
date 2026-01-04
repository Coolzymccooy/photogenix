import React from "react";
import { ProjectItem } from "../types";
import {
  FolderInput,
  Image as ImageIcon,
  Plus,
  Video,
  X,
  Binary,
  Upload,
  Check,
} from "lucide-react";

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
  onRemove,
}) => {
  return (
    <div className="w-full shrink-0 border-t border-line bg-base p-4 relative z-40">
      <div className="flex items-center gap-3 overflow-x-auto no-scrollbar pb-2">
        {/* Upload options */}
        <div className="flex items-center gap-2 mr-2">
          <button
            onClick={onAddFolder}
            className="w-16 h-16 rounded-xl border border-line bg-card hover:bg-card/80 transition flex flex-col items-center justify-center gap-1 text-white/80"
            title="Add a folder"
          >
            <FolderInput size={18} />
            <span className="text-[8px] font-bold tracking-widest">ADD_FOLDER</span>
          </button>

          <button
            onClick={onAddImage}
            className="w-16 h-16 rounded-xl border border-line bg-card hover:bg-card/80 transition flex flex-col items-center justify-center gap-1 text-white/80"
            title="Add images (JPG/PNG/RAW)"
          >
            <ImageIcon size={18} />
            <span className="text-[8px] font-bold tracking-widest">ADD_IMG</span>
          </button>

          <button
            onClick={onAddVideo}
            className="w-16 h-16 rounded-xl border border-line bg-card hover:bg-card/80 transition flex flex-col items-center justify-center gap-1 text-white/80"
            title="Add videos"
          >
            <Video size={18} />
            <span className="text-[8px] font-bold tracking-widest">ADD_VID</span>
          </button>
        </div>

        <div className="w-px h-12 bg-line mx-1" />

        {/* Gallery items */}
        {items.map((item) => {
          const displayUrl = (item as any).processedUrl || (item as any).originalUrl || "";
          const isSelected = selectedIds.includes(item.id);
          const isVideo = (item as any).mediaType === "video";
          const isRaw = Boolean((item as any).isRaw);
          const status = String((item as any).status || "idle");
          const isDeveloping = status === "developing";
          const isProcessing = status === "processing";

          return (
            <div key={item.id} className="relative group shrink-0">
              <button
                onClick={(e) => onSelect(item.id, (e as any).shiftKey || (e as any).metaKey || (e as any).ctrlKey)}
                className={[
                  "w-16 h-16 rounded-xl overflow-hidden border transition relative",
                  isSelected ? "border-signal ring-1 ring-signal/40" : "border-line hover:border-white/20",
                ].join(" ")}
                title={(item as any).name || (item as any).fileName || "asset"}
              >
                {displayUrl ? (
                  isVideo ? (
                    <div className="w-full h-full bg-black relative">
                      <video
                        src={displayUrl}
                        className="w-full h-full object-cover opacity-80"
                        muted
                        loop
                        playsInline
                      />
                      <div className="absolute top-1 right-1">
                        <Video size={10} className="text-white/70" />
                      </div>
                    </div>
                  ) : (
                    <img src={displayUrl} className="w-full h-full object-cover" alt="" />
                  )
                ) : (
                  <div className="w-full h-full flex items-center justify-center bg-black/30">
                    {isRaw ? <Binary size={18} className="text-white/70" /> : <Upload size={18} className="text-white/70" />}
                  </div>
                )}

                {/* RAW badge */}
                {isRaw && (
                  <div className="absolute bottom-1 left-1 px-1.5 py-0.5 rounded bg-black/70 border border-white/10">
                    <span className="text-[8px] font-mono font-bold tracking-widest text-white/90">RAW</span>
                  </div>
                )}

                {/* status overlay */}
                {(isProcessing || isDeveloping) && (
                  <div className="absolute inset-0 bg-black/55 flex items-center justify-center z-10">
                    <div className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-black/60 border border-white/10">
                      <div className="w-2 h-2 rounded-full bg-signal animate-pulse" />
                      <span className="text-[8px] font-mono font-bold tracking-widest text-white/90">
                        {isDeveloping ? "NEURAL_DEV" : "SYNCING"}
                      </span>
                    </div>
                  </div>
                )}

                {status === "done" && (
                  <div className="absolute top-1 left-1">
                    <Check size={12} className="text-emerald-400 drop-shadow" />
                  </div>
                )}

                {status === "error" && (
                  <div className="absolute inset-0 bg-red-950/40 flex items-center justify-center border-2 border-red-500/40 z-10">
                    <X size={12} className="text-red-400" />
                  </div>
                )}
              </button>

              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onRemove(item.id);
                }}
                className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-base border border-line text-white/70 flex items-center justify-center opacity-0 group-hover:opacity-100 transition shadow-xl"
                title="Remove"
              >
                <X size={10} />
              </button>
            </div>
          );
        })}
      </div>

      {selectedIds.length > 1 && (
        <div className="absolute -top-10 left-4 bg-signal px-3 py-1 rounded-xl flex items-center gap-2 shadow-2xl animate-in slide-in-from-bottom-2">
          <span className="text-[9px] font-mono font-bold text-white tracking-widest">
            {selectedIds.length}_ASSETS_SELECTED
          </span>
        </div>
      )}
    </div>
  );
};
