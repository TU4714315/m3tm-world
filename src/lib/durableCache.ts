/**
 * Server-side cache that prefers an Upstash/Vercel-KV compatible REST
 * endpoint and degrades to process memory when no durable backend is configured.
 *
 * Supported env pairs:
 * - UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN
 * - KV_REST_API_URL + KV_REST_API_TOKEN
 *
 * Secrets never leave the server and cache failures never fail the caller.
 */

type CacheBackend = 'redis' | 'memory';

interface MemoryEntry {
  value: string;
  expiresAt: number;
}

interface RedisReply {
  result?: unknown;
  error?: string;
}

const globalCache = globalThis as unknown as {
  __m3tmDurableCache?: Map<string, MemoryEntry>;
};

const memory = globalCache.__m3tmDurableCache ?? new Map<string, MemoryEntry>();
globalCache.__m3tmDurableCache = memory;

const MAX_MEMORY_ENTRIES = 256;

function redisConfig(): { url: string; token: string } | null {
  const pairs = [
    { url: process.env.UPSTASH_REDIS_REST_URL, token: process.env.UPSTASH_REDIS_REST_TOKEN },
    { url: process.env.KV_REST_API_URL, token: process.env.KV_REST_API_TOKEN },
  ];
  const selected = pairs.find(pair => pair.url && pair.token);
  if (!selected?.url || !selected.token) return null;
  return { url: selected.url.replace(/\/$/, ''), token: selected.token };
}

function pruneMemory(now = Date.now()) {
  for (const [key, entry] of memory) {
    if (entry.expiresAt <= now) memory.delete(key);
  }
  while (memory.size > MAX_MEMORY_ENTRIES) {
    const oldest = memory.keys().next().value as string | undefined;
    if (!oldest) break;
    memory.delete(oldest);
  }
}

async function redisCommand(command: Array<string | number>): Promise<RedisReply> {
  const config = redisConfig();
  if (!config) return {};
  const response = await fetch(config.url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${config.token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(command),
    cache: 'no-store',
    signal: AbortSignal.timeout(2500),
  });
  if (!response.ok) throw new Error(`cache backend returned ${response.status}`);
  return response.json() as Promise<RedisReply>;
}

export function durableCacheConfigured(): boolean {
  return redisConfig() !== null;
}

export async function durableGetJson<T>(
  key: string,
): Promise<{ value: T | null; backend: CacheBackend | 'miss' }> {
  const now = Date.now();
  if (redisConfig()) {
    try {
      const reply = await redisCommand(['GET', key]);
      if (typeof reply.result === 'string') {
        return { value: JSON.parse(reply.result) as T, backend: 'redis' };
      }
    } catch (error) {
      console.warn('[M3TM.WORLD] durable cache GET degraded to memory:', error instanceof Error ? error.message : error);
    }
  }

  const entry = memory.get(key);
  if (!entry || entry.expiresAt <= now) {
    if (entry) memory.delete(key);
    return { value: null, backend: 'miss' };
  }
  try {
    return { value: JSON.parse(entry.value) as T, backend: 'memory' };
  } catch {
    memory.delete(key);
    return { value: null, backend: 'miss' };
  }
}

export async function durableSetJson<T>(
  key: string,
  value: T,
  ttlSeconds: number,
): Promise<CacheBackend> {
  const ttl = Math.max(1, Math.floor(ttlSeconds));
  const encoded = JSON.stringify(value);
  memory.set(key, { value: encoded, expiresAt: Date.now() + ttl * 1000 });
  pruneMemory();

  if (!redisConfig()) return 'memory';
  try {
    await redisCommand(['SET', key, encoded, 'EX', ttl]);
    return 'redis';
  } catch (error) {
    console.warn('[M3TM.WORLD] durable cache SET degraded to memory:', error instanceof Error ? error.message : error);
    return 'memory';
  }
}

export function clearDurableMemoryCache() {
  memory.clear();
}
