const DEFAULT_PUBLIC_DATA_TTL_MS = 5 * 60_000;
const MAX_PUBLIC_DATA_ENTRIES = 200;

type PublicDataCacheEntry<T> = {
  expiresAt: number;
  value: Promise<T>;
};

type PublicDataCacheStore = Map<string, PublicDataCacheEntry<unknown>>;

const cacheSymbol = Symbol.for("ailore-sift.public-data-cache");

function cacheStore(): PublicDataCacheStore {
  const scope = globalThis as typeof globalThis & {
    [cacheSymbol]?: PublicDataCacheStore;
  };
  scope[cacheSymbol] ??= new Map();
  return scope[cacheSymbol];
}

function pruneExpiredEntries(store: PublicDataCacheStore, now: number) {
  for (const [key, entry] of store) {
    if (entry.expiresAt <= now) store.delete(key);
  }
  while (store.size >= MAX_PUBLIC_DATA_ENTRIES) {
    const oldestKey = store.keys().next().value;
    if (typeof oldestKey !== "string") break;
    store.delete(oldestKey);
  }
}

/**
 * Short-lived, process-local cache for public read models. On Cloudflare this is
 * shared by requests handled by the same warm isolate; on Vercel it is shared by
 * a warm function instance. Private workspace data must never use this cache.
 */
export function cachePublicData<T>(
  key: string,
  loader: () => Promise<T>,
  ttlMs = DEFAULT_PUBLIC_DATA_TTL_MS,
): Promise<T> {
  const store = cacheStore();
  const now = Date.now();
  const existing = store.get(key) as PublicDataCacheEntry<T> | undefined;
  if (existing && existing.expiresAt > now) return existing.value;
  if (existing) store.delete(key);

  pruneExpiredEntries(store, now);
  const value = loader().catch((error) => {
    const current = store.get(key);
    if (current?.value === value) store.delete(key);
    throw error;
  });
  store.set(key, { expiresAt: now + ttlMs, value });
  return value;
}

export function clearPublicDataCache() {
  cacheStore().clear();
}
