import path from "path";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

/**
 * IMPORTANT SECURITY NOTE
 * - Never inject API keys into the browser bundle via `define`.
 * - All Gemini calls are proxied through the backend at /api.
 */
export default defineConfig(() => {
  return {
    server: {
      port: 3080,
      host: "0.0.0.0",
      proxy: {
        // Frontend calls /api/* -> backend
        "/api": {
          target: "http://localhost:5051",
          changeOrigin: true,
        },
      },
    },
    // Electron needs relative paths for file:// protocol in production
    base: process.env.ELECTRON === "true" ? "./" : "/",
    build: {
      outDir: "dist",
      emptyOutDir: true,
    },
    plugins: [react()],
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "."),
      },
    },
  };
});
