'use strict';

/**
 * High-performance in-memory client cache with promise deduplication.
 * Prevents redundant HTTP waterfall calls across components and provides instant (0ms) warm page switches.
 */
interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

const memoryCache = new Map<string, CacheEntry<any>>();
const inFlightRequests = new Map<string, Promise<any>>();

/**
 * Fetches data with in-memory caching and in-flight promise deduplication.
 * @param key Unique cache key (e.g., 'app_detail_xyz' or 'all_projects')
 * @param fetcher Async function that performs the network request
 * @param ttlMs Cache time-to-live in milliseconds (default: 60,000ms = 1 minute)
 */
export async function cachedFetch<T>(
  key: string,
  fetcher: () => Promise<T>,
  ttlMs: number = 60000
): Promise<T> {
  // 1. Check cache hit
  const cached = memoryCache.get(key);
  if (cached && Date.now() - cached.timestamp < ttlMs) {
    return cached.data as T;
  }

  // 2. In-flight request deduplication
  if (inFlightRequests.has(key)) {
    return inFlightRequests.get(key)! as Promise<T>;
  }

  // 3. Initiate fetch and register in-flight promise
  const requestPromise = (async () => {
    try {
      const data = await fetcher();
      if (data !== null && data !== undefined) {
        memoryCache.set(key, { data, timestamp: Date.now() });
      }
      return data;
    } finally {
      inFlightRequests.delete(key);
    }
  })();

  inFlightRequests.set(key, requestPromise);
  return requestPromise;
}

/**
 * Invalidates a specific cache key or all keys matching a prefix.
 */
export function invalidateCache(keyOrPrefix?: string): void {
  if (!keyOrPrefix) {
    memoryCache.clear();
    return;
  }
  for (const k of memoryCache.keys()) {
    if (k === keyOrPrefix || k.startsWith(keyOrPrefix)) {
      memoryCache.delete(k);
    }
  }
}
