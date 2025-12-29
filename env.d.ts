/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_APP_NAME?: string;
  readonly VITE_API_BASE?: string; // e.g. "/api"
  readonly VITE_ENABLE_AI?: string; // "true" | "false"
  readonly VITE_ENABLE_FIREBASE?: string; // "true" | "false"
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
