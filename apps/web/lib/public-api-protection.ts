import { createHash, createHmac } from "node:crypto";

const DEFAULT_LIMIT = 180;
const DEFAULT_WINDOW_MS = 60_000;
const MAX_CLIENTS = 5_000;
const PUBLIC_CACHE_VERSION = "v1";

type RateEntry = { count: number; resetAt: number };

const rateLimitSymbol = Symbol.for("ailore-sift.public-api-rate-limit");

function rateLimitStore(): Map<string, RateEntry> {
  const scope = globalThis as typeof globalThis & {
    [rateLimitSymbol]?: Map<string, RateEntry>;
  };
  scope[rateLimitSymbol] ??= new Map();
  return scope[rateLimitSymbol];
}

function requestIdentity(request: Request): string {
  const forwarded = request.headers
    .get("x-forwarded-for")
    ?.split(",")[0]
    ?.trim();
  const source =
    request.headers.get("cf-connecting-ip")?.trim() ||
    forwarded ||
    request.headers.get("x-real-ip")?.trim() ||
    `unknown:${request.headers.get("user-agent") ?? "anonymous"}`;
  const secret = process.env.DISTILL_SESSION_SECRET?.trim();
  return secret
    ? createHmac("sha256", secret).update(source).digest("hex")
    : createHash("sha256").update(source).digest("hex");
}

function configuredLimit() {
  const value = Number(process.env.PUBLIC_API_REQUESTS_PER_MINUTE);
  return Number.isInteger(value) && value >= 30 && value <= 10_000
    ? value
    : DEFAULT_LIMIT;
}

export function checkPublicApiRateLimit(
  request: Request,
  now = Date.now(),
): { allowed: boolean; limit: number; remaining: number; retryAfter: number } {
  const limit = configuredLimit();
  const store = rateLimitStore();
  const key = requestIdentity(request);
  let entry = store.get(key);
  if (!entry || entry.resetAt <= now) {
    entry = { count: 0, resetAt: now + DEFAULT_WINDOW_MS };
  }
  entry.count += 1;
  store.set(key, entry);

  if (store.size > MAX_CLIENTS) {
    for (const [candidate, value] of store) {
      if (value.resetAt <= now) store.delete(candidate);
      if (store.size <= MAX_CLIENTS) break;
    }
  }

  return {
    allowed: entry.count <= limit,
    limit,
    remaining: Math.max(0, limit - entry.count),
    retryAfter: Math.max(1, Math.ceil((entry.resetAt - now) / 1_000)),
  };
}

export const PUBLIC_RESPONSE_CACHE_CONTROL =
  "public, max-age=300, stale-while-revalidate=600";

type EdgeCacheStorage = CacheStorage & { default?: Cache };

function edgeCache(): Cache | null {
  const storage = (
    globalThis as typeof globalThis & { caches?: EdgeCacheStorage }
  ).caches;
  return storage?.default ?? null;
}

function cacheRequest(request: Request) {
  const url = new URL(request.url);
  url.searchParams.set("__ailore_cache", PUBLIC_CACHE_VERSION);
  return new Request(url, { method: "GET" });
}

export async function matchPublicApiCache(
  request: Request,
): Promise<Response | null> {
  if (request.method !== "GET") return null;
  try {
    return (await edgeCache()?.match(cacheRequest(request))) ?? null;
  } catch {
    return null;
  }
}

export async function storePublicApiCache(
  request: Request,
  response: Response,
): Promise<void> {
  if (request.method !== "GET" || !response.ok) return;
  try {
    await edgeCache()?.put(cacheRequest(request), response.clone());
  } catch {
    // Cache availability must never turn a public read into an error.
  }
}

export function resetPublicApiRateLimit() {
  rateLimitStore().clear();
}
