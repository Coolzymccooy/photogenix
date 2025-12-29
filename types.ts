

export interface ProcessedImage {
  id: string;
  originalUrl: string;
  processedUrl: string;
  prompt: string;
  timestamp: number;
}

export type MediaType = 'image' | 'video';
export type CreationType = 'album' | 'storybook' | 'catalogue';
export type PipelineStage = 
  | 'ingest' 
  | 'analysis' 
  | 'masking' 
  | 'hdr_merge' 
  | 'color_science' 
  | 'local_contrast' 
  | 'denoise' 
  | 'tone_mapping'
  | 'completed';

export interface ProjectMetadata {
  bitDepth: 8 | 10 | 16 | 32;
  colorSpace: 'sRGB' | 'AdobeRGB' | 'ProPhoto' | 'Linear';
  sceneTags: string[];
  dynamicRange: string;
  iso: number;
  lastUsedPrompt?: string;
  recoveredHighlights?: boolean;
  noiseReduced?: boolean;
  aspectRatio?: string;
}

export interface ProjectItem {
  id: string;
  mediaType: MediaType;
  originalUrl: string; 
  processedUrl: string | null;
  status: 'idle' | 'processing' | 'done' | 'error' | 'developing';
  pipelineStage?: PipelineStage;
  metadata?: ProjectMetadata;
  history: HistoryItem[];
  checkpoints: HistoryItem[];
  lastTool?: string; 
  isRaw?: boolean;
  fileExtension?: string;
  // Added saved property to fix type error in components/SavedGallery.tsx
  saved?: boolean;
}

export interface HistoryItem {
  id: string;
  url: string;
  prompt: string;
  timestamp: number;
  toolLabel: string;
}

export type ToolCategory = 'essentials' | 'modify' | 'creative' | 'combine' | 'video_core' | 'video_fx' | 'pro_pipeline' | 'presets';

export type ToolType = 
  | 'enhance' | 'clean' | 'relight' | 'spot-heal' | 'spot-heal-pro' | 'watermark' | 'sharpness'
  | 'remove' | 'background' | 'smart-crop' | 'logo-gen' | 'logo-tweak'
  | '3d-pop' | 'cyberpunk' | 'anime' | 'clay' | 'sketch' | 'glossy-print'
  | 'collage' | 'merge-scene' | 'group-photo'
  | 'video-enhance' | 'video-stabilize' | 'video-color-pop' | 'video-denoise'
  | 'video-cinematic' | 'video-slowmo' | 'video-upscale' | 'video-trim'
  | 'super-engine' | 'aspect-ratio' | 'style-transfer' | 'neural-beauty';

export interface ToolConfig {
  id: ToolType;
  label: string;
  // Updated icon to any to fix type errors in components/ToolsPanel.tsx where Lucide components are passed directly
  icon: any;
  promptPrefix: string;
  description: string;
  requiresInput?: boolean; 
  inputPlaceholder?: string;
  presets?: string[];
  isMultiImage?: boolean; 
  isVideoTool?: boolean;
  isCoordinateBased?: boolean;
  hasRange?: boolean;
  rangeLabel?: string;
  rangeDefault?: number;
}
