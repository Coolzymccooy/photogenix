
import { ProjectItem } from '../types';

const DB_NAME = 'PhotoGenixDB_v5'; 
const STORE_NAME = 'projects';
const BLOB_STORE_NAME = 'media_blobs';

// Memory cache to prevent constant re-generation of Blob URLs
const urlRegistry = new Map<string, string>();

/**
 * Revoke all blob URLs for a given item (cleanup on removal)
 */
function revokeItemUrls(id: string) {
  for (const type of ['orig', 'proc'] as const) {
    const key = `${id}_${type}`;
    if (urlRegistry.has(key)) {
      URL.revokeObjectURL(urlRegistry.get(key)!);
      urlRegistry.delete(key);
    }
  }
}

export const StorageService = {
  openDB: (): Promise<IDBDatabase> => {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, 5);

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME, { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains(BLOB_STORE_NAME)) {
          db.createObjectStore(BLOB_STORE_NAME);
        }
      };

      request.onsuccess = (event) => resolve((event.target as IDBOpenDBRequest).result);
      request.onerror = (event) => reject(`IndexedDB error: ${(event.target as IDBOpenDBRequest).error}`);
    });
  },

  persistBlob: async (id: string, type: 'orig' | 'proc', blob: Blob): Promise<void> => {
    try {
      const db = await StorageService.openDB();
      const tx = db.transaction([BLOB_STORE_NAME], 'readwrite');
      const store = tx.objectStore(BLOB_STORE_NAME);
      const key = `${id}_${type}`;
      store.put(blob, key);
      
      // Update registry with a fresh URL
      if (urlRegistry.has(key)) {
        URL.revokeObjectURL(urlRegistry.get(key)!);
      }
      urlRegistry.set(key, URL.createObjectURL(blob));

      return new Promise((res, rej) => {
        tx.oncomplete = () => res();
        tx.onerror = () => rej(tx.error);
      });
    } catch (e) {
      console.error("Persistence error", e);
    }
  },

  getBlob: async (id: string, type: 'orig' | 'proc'): Promise<Blob | null> => {
    try {
      const db = await StorageService.openDB();
      const tx = db.transaction([BLOB_STORE_NAME], 'readonly');
      const store = tx.objectStore(BLOB_STORE_NAME);
      return new Promise((res) => {
        const req = store.get(`${id}_${type}`);
        req.onsuccess = () => res(req.result || null);
        req.onerror = () => res(null);
      });
    } catch (e) {
      return null;
    }
  },

  /**
   * SILENT RESCUE: Returns a registered URL or creates a new one without flashing.
   */
  rescueUrl: async (id: string, type: 'orig' | 'proc'): Promise<string | null> => {
    const key = `${id}_${type}`;
    if (urlRegistry.has(key)) return urlRegistry.get(key)!;
    
    const blob = await StorageService.getBlob(id, type);
    if (!blob) return null;
    
    const url = URL.createObjectURL(blob);
    urlRegistry.set(key, url);
    return url;
  },

  /**
   * Remove an item's blobs from IndexedDB and revoke its URLs
   */
  removeItem: async (id: string): Promise<void> => {
    revokeItemUrls(id);
    try {
      const db = await StorageService.openDB();
      const tx = db.transaction([BLOB_STORE_NAME], 'readwrite');
      const store = tx.objectStore(BLOB_STORE_NAME);
      store.delete(`${id}_orig`);
      store.delete(`${id}_proc`);
    } catch (e) {
      console.warn("Remove item warning:", e);
    }
  },

  /**
   * Revoke all URLs in the registry (call on app unmount)
   */
  cleanup: () => {
    for (const [key, url] of urlRegistry.entries()) {
      URL.revokeObjectURL(url);
    }
    urlRegistry.clear();
  },

  saveWorkspace: async (items: ProjectItem[]): Promise<void> => {
    try {
      const db = await StorageService.openDB();
      const tx = db.transaction([STORE_NAME], 'readwrite');
      const itemStore = tx.objectStore(STORE_NAME);
      itemStore.clear();
      for (const item of items) {
        // Strip non-serializable fields if any
        itemStore.put(JSON.parse(JSON.stringify(item)));
      }
    } catch (err) {
      console.warn("Auto-save metadata failed silently");
    }
  },

  loadWorkspace: async (): Promise<ProjectItem[]> => {
    try {
      const db = await StorageService.openDB();
      const tx = db.transaction([STORE_NAME, BLOB_STORE_NAME], 'readonly');
      const items: ProjectItem[] = await new Promise((res) => {
        const req = tx.objectStore(STORE_NAME).getAll();
        req.onsuccess = () => res(req.result || []);
      });

      const hydratedItems = await Promise.all(items.map(async (item) => {
        const origUrl = await StorageService.rescueUrl(item.id, 'orig');
        const procUrl = await StorageService.rescueUrl(item.id, 'proc');

        return {
          ...item,
          originalUrl: origUrl || item.originalUrl,
          processedUrl: procUrl || item.processedUrl
        };
      }));

      return hydratedItems;
    } catch (err) {
      return [];
    }
  }
};
