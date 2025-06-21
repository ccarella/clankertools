export interface CacheEntry<T = unknown> {
  key: string;
  value: T;
  createdAt: number;
  expiresAt: number;
  staleWhileRevalidate?: number;
}

export interface CacheOptions<T = unknown> {
  ttl?: number; // Time to live in milliseconds
  staleWhileRevalidate?: boolean;
  revalidate?: () => Promise<T>;
}

const DEFAULT_TTL = 3600000; // 1 hour
const DB_NAME = 'ClankerToolsCache';
const DB_VERSION = 1;
const STORE_NAME = 'cache';

export class IndexedDBCache {
  private db: IDBDatabase | null = null;
  private initPromise: Promise<void> | null = null;

  async init(): Promise<void> {
    if (this.db) return;
    if (this.initPromise) return this.initPromise;

    this.initPromise = this._initDB();
    return this.initPromise;
  }

  private async _initDB(): Promise<void> {
    if (!('indexedDB' in globalThis)) {
      throw new Error('IndexedDB is not supported');
    }

    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onerror = () => {
        reject(request.error);
      };

      request.onsuccess = () => {
        this.db = request.result;
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          const store = db.createObjectStore(STORE_NAME, { keyPath: 'key' });
          store.createIndex('expiry', 'expiresAt', { unique: false });
        }
      };
    });
  }

  async set<T>(key: string, value: T, options: CacheOptions<T> = {}): Promise<void> {
    await this.init();
    if (!this.db) throw new Error('Database not initialized');

    const ttl = options.ttl || DEFAULT_TTL;
    const now = Date.now();
    
    const entry: CacheEntry<T> = {
      key,
      value,
      createdAt: now,
      expiresAt: now + ttl,
      staleWhileRevalidate: options.staleWhileRevalidate ? ttl * 2 : undefined,
    };

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.put(entry);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        transaction.oncomplete = () => resolve();
      };
    });
  }

  async get<T>(key: string, options: CacheOptions<T> = {}): Promise<T | null> {
    await this.init();
    if (!this.db) throw new Error('Database not initialized');

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([STORE_NAME], 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.get(key);

      request.onerror = () => reject(request.error);
      request.onsuccess = async () => {
        const entry = request.result as CacheEntry<T> | undefined;
        
        if (!entry) {
          resolve(null);
          return;
        }

        const now = Date.now();
        const isExpired = now > entry.expiresAt;
        const isStale = entry.staleWhileRevalidate 
          ? now > entry.createdAt + (entry.expiresAt - entry.createdAt) / 2
          : false;

        if (isExpired && !entry.staleWhileRevalidate) {
          // Delete expired entry
          await this.delete(key);
          resolve(null);
          return;
        }

        if (options.staleWhileRevalidate && isStale && options.revalidate) {
          // Return stale data and revalidate in background
          options.revalidate().then(freshData => {
            this.set(key, freshData, options).catch(console.error);
          }).catch(console.error);
        }

        resolve(entry.value);
      };
    });
  }

  async delete(key: string): Promise<void> {
    await this.init();
    if (!this.db) throw new Error('Database not initialized');

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.delete(key);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        transaction.oncomplete = () => resolve();
      };
    });
  }

  async clear(): Promise<void> {
    await this.init();
    if (!this.db) throw new Error('Database not initialized');

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.clear();

      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        transaction.oncomplete = () => resolve();
      };
    });
  }

  async cleanupExpired(): Promise<void> {
    await this.init();
    if (!this.db) throw new Error('Database not initialized');

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const index = store.index('expiry');
      const now = Date.now();
      const range = IDBKeyRange.upperBound(now);
      const request = index.openCursor(range);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        const cursor = request.result;
        if (cursor) {
          cursor.delete();
          cursor.continue();
        } else {
          transaction.oncomplete = () => resolve();
        }
      };
    });
  }
}

// Singleton instance
let cacheInstance: IndexedDBCache | null = null;

export function getCache(): IndexedDBCache {
  if (!cacheInstance) {
    cacheInstance = new IndexedDBCache();
  }
  return cacheInstance;
}

// Reset cache instance for testing
export function resetCacheInstance(): void {
  cacheInstance = null;
}

// TTL presets for different data types
export const CacheTTL = {
  TOKEN_DETAILS: 300000,     // 5 minutes
  USER_PROFILE: 3600000,     // 1 hour
  TOKEN_LIST: 60000,         // 1 minute
  LEADERBOARD: 300000,       // 5 minutes
  STATIC_CONFIG: 86400000,   // 24 hours
} as const;