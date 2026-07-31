import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

// docs/03-architecture.md §3.8 / docs/10-security-guide.md §10.4 — Redis-backed
// sliding window, applied to search/geocoding specifically since that's the
// endpoint most directly exposing an upstream free-tier limit (Nominatim's
// 1 req/s). Falls back to an in-process limiter when Upstash isn't configured
// (local dev), same pattern as src/lib/cache.ts.
const redis =
  process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN
    ? new Redis({
        url: process.env.UPSTASH_REDIS_REST_URL,
        token: process.env.UPSTASH_REDIS_REST_TOKEN,
      })
    : null;

// Two buckets, because one number cannot serve both callers:
//
//  - "search" stays tight. It fronts Nominatim, whose usage policy is 1
//    req/s, and it is only driven by a human typing.
//  - "api" covers the whole BFF via middleware and must clear normal use: a
//    single page load fans out to ~10 routes, and the flight/ISS/earthquake
//    layers then poll on 10-60s intervals. A 20/min cap would throttle a
//    legitimate visitor within a minute, so it is set well above real usage
//    while still bounding a caller walking random coordinates to miss the
//    cache.
const LIMITS = {
  search: { max: 20, window: "60 s" },
  api: { max: 240, window: "60 s" },
} as const;

export type RateLimitBucket = keyof typeof LIMITS;

const redisLimiters = redis
  ? {
      search: new Ratelimit({
        redis,
        limiter: Ratelimit.slidingWindow(LIMITS.search.max, LIMITS.search.window),
        prefix: "earth-live:ratelimit:search",
      }),
      api: new Ratelimit({
        redis,
        limiter: Ratelimit.slidingWindow(LIMITS.api.max, LIMITS.api.window),
        prefix: "earth-live:ratelimit:api",
      }),
    }
  : null;

const memoryHits = new Map<string, number[]>();
const MEMORY_WINDOW_MS = 60_000;

function memoryLimit(key: string, max: number): { success: boolean } {
  const now = Date.now();
  const hits = (memoryHits.get(key) ?? []).filter((t) => now - t < MEMORY_WINDOW_MS);
  hits.push(now);
  memoryHits.set(key, hits);
  return { success: hits.length <= max };
}

export async function checkRateLimit(
  key: string,
  bucket: RateLimitBucket = "search",
): Promise<{ success: boolean }> {
  if (redisLimiters) {
    const { success } = await redisLimiters[bucket].limit(key);
    return { success };
  }
  return memoryLimit(`${bucket}:${key}`, LIMITS[bucket].max);
}

export function clientKeyFromRequest(request: Request): string {
  const forwardedFor = request.headers.get("x-forwarded-for");
  return forwardedFor?.split(",")[0]?.trim() ?? "unknown";
}
