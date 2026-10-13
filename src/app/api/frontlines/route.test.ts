import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const store = vi.hoisted(() => ({
  get: vi.fn(),
  set: vi.fn(),
}));
vi.mock('@/lib/durableCache', () => ({
  durableGetJson: store.get,
  durableSetJson: store.set,
}));

const sample = {
  type: 'FeatureCollection',
  features: [
    { type: 'Feature', geometry: { type: 'Point', coordinates: [1, 2] }, properties: { name: 'private point' } },
    { type: 'Feature', geometry: { type: 'Polygon', coordinates: [[[0, 0], [1, 0], [1, 1], [0, 0]]] }, properties: { name: 'Area', secret: 'must not leak' } },
  ],
};

describe('frontline last-good and status semantics', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    store.get.mockResolvedValue({ value: null, backend: 'miss' });
    store.set.mockResolvedValue('memory');
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('keeps only published area shapes and attributes on success', async () => {
    const fetcher = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ map: sample, id: 'published' }) });
    vi.stubGlobal('fetch', fetcher);
    const { GET } = await import('./route');
    const response = await GET();
    expect(response.status).toBe(200);
    const result = await response.json();
    expect(result.status).toBe('ok');
    expect(result.total).toBe(1);
    expect(result.frontlines.features).toHaveLength(1);
    expect(result.frontlines.features[0].geometry.type).toBe('Polygon');
    expect(result.frontlines.features[0].properties).not.toHaveProperty('secret');
    expect(store.set).toHaveBeenCalledTimes(1);
  });

  it('does not fake a live frontline on upstream failure and bounds retry', async () => {
    const fetcher = vi.fn().mockRejectedValue(new Error('upstream unreachable'));
    vi.stubGlobal('fetch', fetcher);
    const { GET } = await import('./route');
    const response = await GET();
    const result = await response.json();
    expect(result.status).toBe('unavailable');
    expect(result.frontlines.features).toEqual([]);
    expect(result).not.toHaveProperty('error');
    await GET();
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it('marks last-good fallback as dated rather than silently live', async () => {
    const stored = {
      frontlines: { type: 'FeatureCollection', features: [
        { type: 'Feature', geometry: { type: 'Polygon', coordinates: [] }, properties: { id: 'old' } },
      ] },
      total: 1,
      fetchedAt: new Date(Date.now() - 40 * 60_000).toISOString(),
    };
    store.get.mockResolvedValue({ value: stored, backend: 'memory' });
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('upstream down')));
    const { GET } = await import('./route');
    const result = await (await GET()).json();
    expect(result.status).toBe('cached-stale');
    expect(result.sourceFetchedAt).toBe(stored.fetchedAt);
    expect(result.frontlines.features).toHaveLength(1);
    expect(result).not.toHaveProperty('error');
  });
});
