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
    delete process.env.REDIS_URL;
    vi.restoreAllMocks();
  });

  it('validates Render native Redis URL schemes', () => {
    process.env.REDIS_URL = 'http://invalid.example';
    expect(durableCacheConfigured()).toBe(false);
    process.env.REDIS_URL = 'redis://render-key-value.internal:6379';
    expect(durableCacheConfigured()).toBe(true);
    delete process.env.REDIS_URL;
  });

  it('falls back to memory when no durable backend is configured', async () => {
    expect(durableCacheConfigured()).toBe(false);
    expect(await durableSetJson('k', { ok: true }, 30)).toBe('memory');
    const result = await durableGetJson<{ ok: boolean }>('k');
    expect(result.backend).toBe('memory');
    expect(result.value).toEqual({ ok: true });
  });

  it('does not retain a huge JSON snapshot in an instance with no Redis', async () => {
    const large = 'x'.repeat(8 * 1024 * 1024);
    expect(await durableSetJson('too-large', { payload: large }, 60)).toBe('not-stored');
    expect(await durableGetJson('too-large')).toEqual({ value: null, backend: 'miss' });
  });

  it('preserves the last-good small snapshot when an oversized replacement is rejected', async () => {
    expect(await durableSetJson('conflicts', { payload: 'verified' }, 60)).toBe('memory');
    expect(await durableSetJson('conflicts', { payload: 'x'.repeat(8 * 1024 * 1024) }, 60)).toBe('not-stored');
    expect((await durableGetJson<{payload: string}>('conflicts')).value?.payload).toBe('verified');
  });

  it('evicts the oldest keys when encoded retained cache exceeds the byte budget', async () => {
    const payload = 'x'.repeat(5 * 1024 * 1024);
    await durableSetJson('first', { payload }, 60);
    await durableSetJson('second', { payload }, 60);
    await durableSetJson('third', { payload }, 60);
    await durableSetJson('fourth', { payload }, 60);
    expect(await durableGetJson('first')).toEqual({ value: null, backend: 'miss' });
    expect((await durableGetJson<{ payload: string }>('fourth')).value?.payload.length).toBe(payload.length);
  });

  it('preserves a refreshed key when memory eviction exceeds the byte budget', async () => {
    const payload = 'x'.repeat(5 * 1024 * 1024);
    await durableSetJson('first', { payload }, 60);
    await durableSetJson('second', { payload }, 60);
    await durableSetJson('third', { payload }, 60);
    // Refresh to a large value so the next write actually exceeds 16 MiB.
    const refreshed = 'y'.repeat(5 * 1024 * 1024);
    await durableSetJson('first', { payload: refreshed }, 60);
    await durableSetJson('fourth', { payload }, 60);
    expect((await durableGetJson<{payload: string}>('first')).value?.payload).toBe(refreshed);
    expect(await durableGetJson('second')).toEqual({ value: null, backend: 'miss' });
  });

  it('never mixes a partial Upstash pair with KV credentials', async () => {
    process.env.UPSTASH_REDIS_REST_URL = 'https://partial-upstash.example.test';
    process.env.KV_REST_API_URL = 'https://kv.example.test';
    process.env.KV_REST_API_TOKEN = 'kv-token';
    const fetchMock = vi.spyOn(globalThis, 'fetch')
      .mockResolvedValue(new Response(JSON.stringify({ result: 'OK' }), { status: 200 }));

    expect(durableCacheConfigured()).toBe(true);
    expect(await durableSetJson('pair', { ok: true }, 30)).toBe('redis');
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][0]).toBe('https://kv.example.test');
    expect((fetchMock.mock.calls[0][1]?.headers as Record<string, string>).Authorization).toBe('Bearer kv-token');
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
