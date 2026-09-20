export interface CacheEntry<T = unknown> {
  payload: T;
  expiresAt: Date | null;
  createdAt: Date;
}

const globalCache = globalThis as unknown as {
  __resolveCache?: Map<string, CacheEntry>;
};

if (!globalCache.__resolveCache) {
  globalCache.__resolveCache = new Map();
}

const cacheStore = globalCache.__resolveCache;

export class CacheService {
  static get<T = unknown>(cacheKey: string): T | null {
    const entry = cacheStore.get(cacheKey);
    if (!entry) return null;

    if (entry.expiresAt && entry.expiresAt.getTime() < Date.now()) {
      cacheStore.delete(cacheKey);
      return null;
    }

    return entry.payload as T;
  }

  static set<T = unknown>(cacheKey: string, payload: T, ttlSeconds?: number): void {
    const expiresAt = ttlSeconds ? new Date(Date.now() + ttlSeconds * 1000) : null;
    cacheStore.set(cacheKey, {
      payload,
      expiresAt,
      createdAt: new Date(),
    });
  }

  static delete(cacheKey: string): void {
    cacheStore.delete(cacheKey);
  }

  static clear(): void {
    cacheStore.clear();
  }
}
