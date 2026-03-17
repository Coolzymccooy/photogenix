/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_APP_NAME?: string;
  readonly VITE_API_BASE?: string;
  readonly VITE_API_BASE_URL?: string;
  readonly VITE_APP_API_KEY?: string;
  readonly VITE_ENABLE_AI?: string;
  readonly VITE_ENABLE_FIREBASE?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

// Electron API exposed via preload script
interface ElectronAPI {
  openFiles: (options?: any) => Promise<{ canceled: boolean; filePaths: string[] }>;
  saveFile: (options?: any) => Promise<{ canceled: boolean; filePath?: string }>;
  getVersion: () => Promise<string>;
  getPlatform: () => Promise<string>;
  onMenuImportImages: (callback: () => void) => () => void;
  onMenuExport: (callback: () => void) => () => void;
  isElectron: boolean;
}

interface Window {
  electronAPI?: ElectronAPI;
}
