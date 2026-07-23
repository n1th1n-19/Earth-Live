import { Redis } from "@upstash/redis";

// Cache-aside layer per docs/03-architecture.md §3.5 and §3.9: every adapter
// reads this before calling upstream, and writes the result back with a
// source-appropriate TTL (docs/05-api-integration-guide.md §5.12). Falls back
// to an in-process Map when Upstash credentials aren't configured (local dev)
// so the app runs without requiring a Redis instance to be provisioned first.

const redis =
  process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN
    ? new Redis({
        url: process.env.UPSTASH_REDIS_REST_URL,
        token: process.env.UPSTASH_REDIS_REST_TOKEN,
      })
    : null;

interface MemoryEntry {
  value: unknown;
  expiresAt: number;
}

const memoryStore = new Map<string, MemoryEntry>();

export async function cacheGet<T>(key: string): Promise<T | null> {
  if (redis) {
    const value = await redis.get<T>(key);
    return value ?? null;
  }

  const entry = memoryStore.get(key);
  if (!entry || entry.expiresAt < Date.now()) {
    memoryStore.delete(key);
    return null;
  }
  return entry.value as T;
}

export async function cacheSet(key: string, value: unknown, ttlSeconds: number): Promise<void> {
  if (redis) {
    await redis.set(key, value, { ex: ttlSeconds });
    return;
  }

  memoryStore.set(key, { value, expiresAt: Date.now() + ttlSeconds * 1000 });
}

/** Cache-aside: return the cached value, or compute, cache, and return it. */
export async function cacheAside<T>(
  key: string,
  ttlSeconds: number,
  compute: () => Promise<T>,
): Promise<{ value: T; cacheHit: boolean }> {
  const cached = await cacheGet<T>(key);
  if (cached !== null) {
    return { value: cached, cacheHit: true };
  }

  const value = await compute();
  await cacheSet(key, value, ttlSeconds);
  return { value, cacheHit: false };
}
