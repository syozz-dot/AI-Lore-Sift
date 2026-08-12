const WINDOW_MS = 15 * 60 * 1_000;
const MAX_FAILURES = 5;
const MAX_BUCKETS = 2_000;

interface FailureBucket {
  failures: number;
  expiresAt: number;
}

const failureBuckets = new Map<string, FailureBucket>();

function prune(now: number) {
  if (failureBuckets.size < MAX_BUCKETS) return;
  for (const [key, bucket] of failureBuckets) {
    if (bucket.expiresAt <= now) failureBuckets.delete(key);
  }
  while (failureBuckets.size >= MAX_BUCKETS) {
    const oldestKey = failureBuckets.keys().next().value as string | undefined;
    if (!oldestKey) break;
    failureBuckets.delete(oldestKey);
  }
}

export function loginRateLimitKey(request: Request) {
  const forwarded =
    request.headers.get("x-vercel-forwarded-for") ||
    request.headers.get("x-forwarded-for") ||
    request.headers.get("x-real-ip");
  return forwarded?.split(",")[0]?.trim() || "unknown-client";
}

export function canAttemptLogin(key: string, now = Date.now()) {
  const bucket = failureBuckets.get(key);
  if (!bucket || bucket.expiresAt <= now) {
    if (bucket) failureBuckets.delete(key);
    return true;
  }
  return bucket.failures < MAX_FAILURES;
}

export function recordLoginFailure(key: string, now = Date.now()) {
  prune(now);
  const current = failureBuckets.get(key);
  if (!current || current.expiresAt <= now) {
    failureBuckets.set(key, { failures: 1, expiresAt: now + WINDOW_MS });
    return;
  }
  failureBuckets.set(key, {
    failures: current.failures + 1,
    expiresAt: current.expiresAt,
  });
}

export function clearLoginFailures(key: string) {
  failureBuckets.delete(key);
}

export function resetLoginRateLimitForTests() {
  failureBuckets.clear();
}
