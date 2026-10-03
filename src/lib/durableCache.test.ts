import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  clearDurableMemoryCache,
  durableCacheConfigured,
  durableGetJson,
  durableSetJson,
} from './durableCache';

describe('durableCache', () => {
  afterEach(() => {
    clearDurableMemoryCache();
    delete process.env.UPSTASH_REDIS_REST_URL;
    delete process.env.UPSTASH_REDIS_REST_TOKEN;
    delete process.env.KV_REST_API_URL;
    delete process.env.KV_REST_API_TOKEN;
    vi.restoreAllMocks();
  });

  it('falls back to memory when no durable backend is configured', async () => {
    expect(durableCacheConfigured()).toBe(false);
    expect(await durableSetJson('k', { ok: true }, 30)).toBe('memory');
    const result = await durableGetJson<{ ok: boolean }>('k');
    expect(result.backend).toBe('memory');
    expect(result.value).toEqual({ ok: true });
  });

  it('uses the Upstash-compatible REST command form when configured', async () => {
    process.env.UPSTASH_REDIS_REST_URL = 'https://cache.example.test';
    process.env.UPSTASH_REDIS_REST_TOKEN = 'server-only-token';
    const fetchMock = vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(new Response(JSON.stringify({ result: 'OK' }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ result: '{"v":2}' }), { status: 200 }));

    expect(await durableSetJson('abc', { v: 2 }, 60)).toBe('redis');
    const result = await durableGetJson<{ v: number }>('abc');
    expect(result.backend).toBe('redis');
    expect(result.value).toEqual({ v: 2 });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
