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

const redisLimiter = redis
  ? new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(20, "60 s"), prefix: "earth-live:ratelimit" })
  : null;

const memoryHits = new Map<string, number[]>();
const MEMORY_WINDOW_MS = 60_000;
const MEMORY_MAX = 20;

function memoryLimit(key: string): { success: boolean } {
  const now = Date.now();
  const hits = (memoryHits.get(key) ?? []).filter((t) => now - t < MEMORY_WINDOW_MS);
  hits.push(now);
  memoryHits.set(key, hits);
  return { success: hits.length <= MEMORY_MAX };
}

export async function checkRateLimit(key: string): Promise<{ success: boolean }> {
  if (redisLimiter) {
    const { success } = await redisLimiter.limit(key);
    return { success };
  }
  return memoryLimit(key);
}

export function clientKeyFromRequest(request: Request): string {
  const forwardedFor = request.headers.get("x-forwarded-for");
  return forwardedFor?.split(",")[0]?.trim() ?? "unknown";
}
