import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.photogenix.studio',
  appName: 'PhotoGenix AI Studio',
  webDir: 'dist',
  server: {
    // In development, point to your backend server
    // In production, the app bundles the web assets and calls the remote API
    url: undefined, // undefined = use bundled web assets
    cleartext: true, // allow http for local dev
  },
  android: {
    buildOptions: {
      keystorePath: undefined,
      keystoreAlias: undefined,
    },
    // Allow large file uploads
    webContentsDebuggingEnabled: true,
  },
  plugins: {
    CapacitorHttp: {
      enabled: true, // Use native HTTP for better performance on mobile
    },
  },
};

export default config;
