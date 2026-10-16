import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const index = (host = 'https://tilecache.rainviewer.com') => ({
  host, radar: { past: [{ time: Math.floor(Date.now() / 1000) - 600, path: '/v2/radar/1792142400' }] },
});

beforeEach(() => { vi.resetModules(); vi.spyOn(console, 'warn').mockImplementation(() => {}); });
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });

describe('bounded public rain index', () => {
  it('serves only the approved tile host using a fixed upstream request', async () => {
    const request = vi.fn().mockResolvedValue(new Response(JSON.stringify(index())));
    vi.stubGlobal('fetch', request);
    const { GET } = await import('./route');
    const response = await GET();
    const result = await response.json();
    expect(response.status).toBe(200);
    expect(result.host).toBe('https://tilecache.rainviewer.com');
    expect(result.frames).toHaveLength(1);
    expect(result.stale).toBe(false);
    expect(request).toHaveBeenCalledWith('https://api.rainviewer.com/public/weather-maps.json', expect.objectContaining({ redirect: 'error', cache: 'no-store', signal: expect.any(AbortSignal) }));
  });
  it('rejects lookalike, credential-bearing and path-bearing tile hosts', async () => {
    for (const host of ['https://tilecache.rainviewer.com.attacker.net', 'https://example.net', 'https://user:pass@tilecache.rainviewer.com', 'https://tilecache.rainviewer.com/override']) {
      vi.resetModules();
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify(index(host)))));
      const { GET } = await import('./route');
      const response = await GET();
      expect(response.status).toBe(502);
      expect(await response.text()).not.toContain(host);
    }
  });
  it('rejects an oversized declared body before exposing any index', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('{}', { headers: { 'content-length': String(128 * 1024 + 1) } })));
    const { GET } = await import('./route');
    expect((await GET()).status).toBe(502);
  });
  it('caps streamed bodies and returns an explicitly stale cached index on refresh failure', async () => {
    const request = vi.fn().mockResolvedValueOnce(new Response(JSON.stringify(index())));
    vi.stubGlobal('fetch', request);
    const { GET } = await import('./route');
    const original = await (await GET()).json();
    const later = Date.now() + 2 * 60_000 + 1;
    vi.spyOn(Date, 'now').mockReturnValue(later);
    request.mockResolvedValueOnce(new Response(new ReadableStream({ start(controller) {
      controller.enqueue(new Uint8Array(80 * 1024));
      controller.enqueue(new Uint8Array(60 * 1024));
      controller.close();
    } })));
    const response = await GET();
    const result = await response.json();
    expect(response.status).toBe(200);
    expect(result.frames).toEqual(original.frames);
    expect(result.host).toBe(original.host);
    expect(result.stale).toBe(true);
    expect(request).toHaveBeenCalledTimes(2);
  });
});
