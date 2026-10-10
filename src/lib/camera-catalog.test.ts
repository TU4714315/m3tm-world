import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CAMERA_INITIAL_REGIONS, loadCameraCatalog, mergeCameraCatalog } from './camera-catalog';

beforeEach(() => vi.useFakeTimers());
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });

const json = (cameras: { id: string }[], pendingRegions: string[] = [], sources: Record<string, number> = {}) =>
  Response.json({ cameras, pendingRegions, sources, timestamp: '2026-10-10T08:00:00Z' });
const names = (regions: string[]) => Response.json({ regions });

const requestedRegions = (url: string) =>
  new URL(url, 'https://example.com').searchParams.get('region')?.split(',') ?? [];

describe('progressive camera catalogue', () => {
  it('loads MENA first, then all other public regions in groups of at most four', async () => {
    const all = [...CAMERA_INITIAL_REGIONS, 'canada', 'florida', 'georgia', 'utah', 'japan'];
    const fetcher = vi.fn(async (url: string) => {
      if (url.includes('catalog=regions')) return names(all);
      const batch = requestedRegions(url);
      return json(batch.map(id => ({ id })), [], { [batch[0]]: batch.length });
    });
    vi.stubGlobal('fetch', fetcher);
    let cameras: { id: string | number }[] = [];
    const statuses: { pendingRegions: string[]; sourceNames: string[] }[] = [];
    const stop = loadCameraCatalog(
      batch => { cameras = mergeCameraCatalog(cameras, batch); },
      vi.fn(),
      status => statuses.push(status),
    );

    await vi.advanceTimersByTimeAsync(0);
    expect(fetcher.mock.calls.slice(0, 2).map(([url]) => url)).toEqual([
      '/api/cctv?region=middle-east%2Cwestasia%2Casia-live',
      '/api/cctv?catalog=regions',
    ]);
    expect(cameras).toHaveLength(CAMERA_INITIAL_REGIONS.length);
    expect(statuses.at(-1)?.pendingRegions).toEqual(['canada', 'florida', 'georgia', 'utah', 'japan']);
    await vi.advanceTimersByTimeAsync(5_000);
    expect(cameras.map(camera => camera.id)).toEqual(all);
    const batches = fetcher.mock.calls
      .map(([url]) => requestedRegions(url))
      .filter(regions => regions.length);
    expect(batches.every(regions => regions.length <= 4)).toBe(true);
    expect(fetcher.mock.calls.some(([url]) => url.includes('region=all'))).toBe(false);
    expect(statuses.at(-1)?.pendingRegions).toEqual([]);
    stop();
  });

  it('retries only failed regions while retaining already delivered cameras', async () => {
    let westAsiaAttempts = 0;
    const fetcher = vi.fn(async (url: string) => {
      if (url.includes('catalog=regions')) return names([...CAMERA_INITIAL_REGIONS]);
      const batch = requestedRegions(url);
      if (batch.length === 1 && batch[0] === 'westasia') {
        westAsiaAttempts++;
        return json([{ id: 'west-asia-camera' }]);
      }
      return json([{ id: 'middle-east-camera' }], ['westasia'], { MENA: 1 });
    });
    vi.stubGlobal('fetch', fetcher);
    let cameras: { id: string | number }[] = [];
    const stop = loadCameraCatalog(batch => { cameras = mergeCameraCatalog(cameras, batch); }, vi.fn());

    await vi.advanceTimersByTimeAsync(0);
    expect(cameras).toEqual([{ id: 'middle-east-camera' }]);
    await vi.advanceTimersByTimeAsync(16_500);
    expect(westAsiaAttempts).toBe(1);
    expect(cameras).toEqual([{ id: 'middle-east-camera' }, { id: 'west-asia-camera' }]);
    stop();
  });

  it('retries a transient region-index outage and still loads worldwide regions', async () => {
    let discoveryCalls = 0;
    const fetcher = vi.fn(async (url: string, _options?: RequestInit) => {
      if (url.includes('catalog=regions')) {
        discoveryCalls++;
        if (discoveryCalls === 1) return new Response('temporary', { status: 503 });
        return names([...CAMERA_INITIAL_REGIONS, 'florida']);
      }
      return json(requestedRegions(url).map(id => ({ id })));
    });
    vi.stubGlobal('fetch', fetcher);
    let cameras: { id: string | number }[] = [];
    const onError = vi.fn();
    const stop = loadCameraCatalog(batch => { cameras = mergeCameraCatalog(cameras, batch); }, onError);
    await vi.advanceTimersByTimeAsync(0);
    expect(discoveryCalls).toBe(1);
    await vi.advanceTimersByTimeAsync(17_000);
    expect(discoveryCalls).toBe(2);
    expect(onError).toHaveBeenCalledTimes(1);
    expect(cameras.some(camera => camera.id === 'florida')).toBe(true);
    expect(fetcher.mock.calls.filter(([url]) => url.includes('catalog=regions'))
      .every(([,options]) => options?.cache === 'no-store')).toBe(true);
    stop();
  });

  it('aborts background loading when the layer is disabled', async () => {
    const fetcher = vi.fn(async (url: string) =>
      url.includes('catalog=regions') ? names([...CAMERA_INITIAL_REGIONS, 'georgia']) : json([{ id: 'first' }]));
    vi.stubGlobal('fetch', fetcher);
    const stop = loadCameraCatalog(vi.fn(), vi.fn());
    await vi.advanceTimersByTimeAsync(0);
    stop();
    await vi.advanceTimersByTimeAsync(30_000);
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it('keeps provider outage retries bounded', async () => {
    const fetcher = vi.fn(async (url: string) => {
      if (url.includes('catalog=regions')) return names([...CAMERA_INITIAL_REGIONS]);
      throw new Error('provider offline');
    });
    vi.stubGlobal('fetch', fetcher);
    const onError = vi.fn();
    const stop = loadCameraCatalog(vi.fn(), onError);
    await vi.advanceTimersByTimeAsync(55_000);
    expect(onError).toHaveBeenCalledTimes(3);
    // initial request + catalogue index + only two retry requests.
    expect(fetcher).toHaveBeenCalledTimes(4);
    stop();
  });

  it('updates duplicate camera IDs without duplicating dots', () => {
    expect(mergeCameraCatalog([{ id: 'a', name: 'old' }], [{ id: 'a', name: 'new' }, { id: 'b', name: 'second' }]))
      .toEqual([{ id: 'a', name: 'new' }, { id: 'b', name: 'second' }]);
  });
});
