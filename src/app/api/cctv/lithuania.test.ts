import { afterEach, describe, expect, it, vi } from 'vitest';
import { indexVkrCoords, parseLithuania } from './lithuania';

const NOW = Date.parse('2026-09-30T12:00:00Z');
const feature = (point: unknown = [54.72, 25.20]) => [{ layer: 'VKR', features: [{ id: 72, points: [{ point }] }] }];
const camera = (override: Record<string, unknown> = {}) => ({
  id: 72, name: 'Vilnius A1 10,04', roadName: 'Vilnius-Kaunas',
  roadNr: 'A1', date: NOW - 60_000, ...override,
});

describe('Via Lietuva public camera catalog', () => {
  it('joins published coordinates to recent frames and uses only the fixed-host local proxy', () => {
    expect(indexVkrCoords(feature()).get('72')).toEqual([54.72, 25.20]);
    expect(parseLithuania(feature(), [camera()], NOW)[0]).toMatchObject({
      id: 'lt-72', source: 'Via Lietuva', city: 'Vilnius',
      feed_url: '/api/cctv/lithuania/snapshot?id=72', stream_type: 'jpg',
    });
  });
  it('drops stale, undated, duplicated, invalid and unmatched entries', () => {
    expect(parseLithuania(feature(), [camera(), camera()], NOW)).toHaveLength(1);
    expect(parseLithuania(feature(), [camera({date: NOW - 7 * 3600_000})], NOW)).toEqual([]);
    expect(parseLithuania(feature(), [camera({date: undefined})], NOW)).toEqual([]);
    expect(parseLithuania(feature([0, 0]), [camera()], NOW)).toEqual([]);
    expect(parseLithuania([], [camera()], NOW)).toEqual([]);
  });
});

const frame = new Uint8Array([0xff,0xd8,0xff,0xe0,0xff,0xd9]);
describe('Via Lietuva fixed-host snapshot', () => {
  afterEach(() => vi.unstubAllGlobals());
  it('rejects invalid identifiers without any upstream call', async () => {
    const fetchMock = vi.fn(); vi.stubGlobal('fetch', fetchMock);
    const { GET } = await import('./lithuania/snapshot/route');
    for (const id of ['', 'abc/def', 'a'.repeat(60)]) {
      const response = await GET(new Request('https://example.test/api/cctv/lithuania/snapshot?id=' + encodeURIComponent(id)));
      expect(response.status).toBe(400);
    }
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it('returns only JPEG images from the fixed trusted host', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(frame, { status: 200, headers: { 'content-type': 'image/jpeg' } }));
    vi.stubGlobal('fetch', fetchMock);
    const { GET } = await import('./lithuania/snapshot/route');
    const response = await GET(new Request('https://example.test/api/cctv/lithuania/snapshot?id=72'));
    expect(response.status).toBe(200);
    expect(response.headers.get('X-Content-Type-Options')).toBe('nosniff');
    expect(new Uint8Array(await response.arrayBuffer())).toEqual(frame);
    const url = new URL(fetchMock.mock.calls[0][0]);
    expect(url.hostname).toBe('eismoinfo.lt');
    expect(url.searchParams.get('id')).toBe('72');
  });
  it('rejects non-JPEG upstream payloads', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('not image', { status: 200 })));
    const { GET } = await import('./lithuania/snapshot/route');
    expect((await GET(new Request('https://example.test/api/cctv/lithuania/snapshot?id=72'))).status).toBe(502);
  });
});
