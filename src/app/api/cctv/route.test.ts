import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { GET, clearCctvRegionBackoff } from './route';
import { stealthFetch } from '@/lib/stealthFetch';
import { clearSourceCache } from '@/lib/sourceCache';

vi.mock('@/lib/stealthFetch', () => ({ stealthFetch: vi.fn(), stealthHeaders: vi.fn(() => ({})) }));
beforeEach(() => { vi.useFakeTimers(); vi.resetAllMocks(); clearSourceCache(); clearCctvRegionBackoff(); });
afterEach(() => vi.useRealTimers());

describe('CCTV lightweight region discovery', () => {
  it('returns the public region names without touching upstream providers', async () => {
    const response = await GET(new Request('http://localhost/api/cctv?catalog=regions'));
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(body.regions).toContain('middle-east');
    expect(body.regions).toContain('westasia');
    expect(body.regions).toContain('florida');
    expect(vi.mocked(stealthFetch)).not.toHaveBeenCalled();
  });
});

describe('CCTV partial responses', () => {
  it('returns a completed region without scheduling unnecessary retries', async () => {
    vi.mocked(stealthFetch).mockResolvedValue(Response.json([
      { id: 'JamCams_1', lat: 51.5, lon: -0.1, commonName: 'London' },
    ]));
    const response = await GET(new Request('http://localhost/api/cctv?region=uk'));
    const body = await response.json();
    expect(body.total).toBe(1);
    expect(body.pendingRegions).toEqual([]);
  });

  it('marks slow regions as pending instead of silently treating them as complete', async () => {
    vi.mocked(stealthFetch).mockReturnValue(new Promise(() => {}));
    const pending = GET(new Request('http://localhost/api/cctv?region=uk'));
    await vi.advanceTimersByTimeAsync(12_000);
    const response = await pending;
    expect((await response.json()).pendingRegions).toEqual(['uk']);
    expect(response.headers.get('Cache-Control')).toContain('no-store');
  });

  it('allows a bounded retry for an empty/failed provider response', async () => {
    vi.mocked(stealthFetch).mockResolvedValue(new Response('', { status: 503 }));
    const response = await GET(new Request('http://localhost/api/cctv?region=uk'));
    expect((await response.json()).pendingRegions).toEqual(['uk']);
  });

  it('does not immediately spend another 12s budget on a region that just timed out', async () => {
    vi.mocked(stealthFetch).mockReturnValue(new Promise(() => {}));

    const first = GET(new Request('http://localhost/api/cctv?region=uk'));
    await vi.advanceTimersByTimeAsync(12_000);
    expect((await (await first).json()).pendingRegions).toEqual(['uk']);
    expect(vi.mocked(stealthFetch)).toHaveBeenCalledTimes(1);

    const second = await GET(new Request('http://localhost/api/cctv?region=uk'));
    expect((await second.json()).pendingRegions).toEqual(['uk']);
    expect(vi.mocked(stealthFetch)).toHaveBeenCalledTimes(1);
  });
});
