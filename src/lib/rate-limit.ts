/**
 * Sliding-window rate limiter.
 *
 * Production should point RATE_LIMIT_REDIS_URL at a shared store; this
 * implementation keeps counters in process memory so local development and
 * single-instance deployments work with no external dependency. The interface
 * is deliberately small so a Redis adapter can replace the store without
 * touching call sites.
 */

interface Bucket {
  hits: number[];
}

const buckets = new Map<string, Bucket>();
const MAX_KEYS = 10_000;
let lastSweep = Date.now();

function sweep(now: number) {
  if (now - lastSweep < 60_000) return;
  lastSweep = now;
  for (const [key, bucket] of buckets) {
    const newest = bucket.hits[bucket.hits.length - 1] ?? 0;
    if (now - newest > 15 * 60_000) buckets.delete(key);
  }
  if (buckets.size > MAX_KEYS) {
    // Drop the oldest half rather than growing without bound.
    const entries = [...buckets.entries()].sort(
      (a, b) => (a[1].hits.at(-1) ?? 0) - (b[1].hits.at(-1) ?? 0),
    );
    entries.slice(0, Math.floor(entries.length / 2)).forEach(([key]) => buckets.delete(key));
  }
}

export interface RateLimitOptions {
  key: string;
  limit: number;
  windowMs: number;
}

export interface RateLimitResult {
  allowed: boolean;
  limit: number;
  remaining: number;
  reset: number;
  retryAfterSeconds: number;
}

export function rateLimit({ key, limit, windowMs }: RateLimitOptions): RateLimitResult {
  const now = Date.now();
  sweep(now);

  const bucket = buckets.get(key) ?? { hits: [] };
  bucket.hits = bucket.hits.filter((timestamp) => timestamp > now - windowMs);

  const allowed = bucket.hits.length < limit;
  if (allowed) bucket.hits.push(now);
  buckets.set(key, bucket);

  const oldest = bucket.hits[0] ?? now;
  const reset = Math.ceil((oldest + windowMs) / 1000);
  return {
    allowed,
    limit,
    remaining: Math.max(0, limit - bucket.hits.length),
    reset,
    retryAfterSeconds: Math.max(1, Math.ceil((oldest + windowMs - now) / 1000)),
  };
};

export function rateLimitHeaders(result: RateLimitResult): Record<string, string> {
  return {
    "RateLimit-Limit": String(result.limit),
    "RateLimit-Remaining": String(result.remaining),
    "RateLimit-Reset": String(result.reset),
    ...(result.allowed ? {} : { "Retry-After": String(result.retryAfterSeconds) }),
  };
}

/** Best-effort client identity for public, unauthenticated endpoints. */
export function clientKey(request: Request, scope: string): string {
  const forwarded = request.headers.get("x-forwarded-for");
  const ip = forwarded?.split(",")[0]?.trim() || request.headers.get("x-real-ip") || "local";
  return `${scope}:${ip}`;
}

export function resetRateLimits() {
  buckets.clear();
}
