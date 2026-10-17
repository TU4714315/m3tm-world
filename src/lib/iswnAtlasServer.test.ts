import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { clearDurableMemoryCache, durableGetJson } from './durableCache';
import { ISWN_FEED_URL, ISWN_MAP_URL } from './iswnAtlas';
import { getReferenceAtlasSnapshot } from './iswnAtlasServer';

const map = '<kml><Document><Folder><name>Syria</name><Placemark><name>Reference</name><Point><coordinates>36.12,33.56</coordinates></Point></Placemark></Folder></Document></kml>';
const feed = (date = '2026-10-01T12:00:00Z', title = 'New offensive reported', id = '1') => `<rss><channel><item><guid>${id}</guid><title>${title}</title><link>https://english.iswnews.com/${id}/</link><pubDate>${date}</pubDate></item></channel></rss>`;
let currentFeed: string, failMap: boolean, fetchMock: ReturnType<typeof vi.fn>;
const mapCalls = () => fetchMock.mock.calls.filter(([url]) => url === ISWN_MAP_URL).length;
const feedCalls = () => fetchMock.mock.calls.filter(([url]) => url === ISWN_FEED_URL).length;

beforeEach(() => {
  clearDurableMemoryCache();
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-10-15T12:00:00Z'));
  vi.stubEnv('UPSTASH_REDIS_REST_URL', '');
  vi.stubEnv('KV_REST_API_URL', '');
  currentFeed = feed(); failMap = false;
  fetchMock = vi.fn(async (url: string) => {
    if (url === ISWN_MAP_URL && failMap) return new Response('error', { status: 503 });
    return new Response(url === ISWN_MAP_URL ? map : currentFeed);
  });
  vi.stubGlobal('fetch', fetchMock);
});
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); vi.unstubAllEnvs(); clearDurableMemoryCache(); });

describe('reference atlas collection schedule', () => {
  it('refreshes for a collector event outside the RSS check and schedule, consuming its id only once', async () => {
    await getReferenceAtlasSnapshot();
    vi.advanceTimersByTime(15 * 60_000);
    await getReferenceAtlasSnapshot();
    vi.advanceTimersByTime(60_000);
    const refreshed = await getReferenceAtlasSnapshot('published-event:one');
    expect(refreshed.refreshReason).toBe('major_event');
    expect(refreshed.majorEventState).toBe('none');
    expect(mapCalls()).toBe(2);
    expect(feedCalls()).toBe(2);
    vi.advanceTimersByTime(15 * 60_000);
    await getReferenceAtlasSnapshot('published-event:one');
    expect(mapCalls()).toBe(2);
  });

  it('persists an event during cooldown and refreshes it on a later ordinary check', async () => {
    await getReferenceAtlasSnapshot();
    vi.advanceTimersByTime(60_000);
    const pending = await getReferenceAtlasSnapshot('published-event:queued');
    expect(pending.majorEventState).toBe('pending');
    expect(pending.nextRefreshAt).toBe('2026-10-15T12:15:00.000Z');
    await getReferenceAtlasSnapshot('published-event:queued');
    expect(mapCalls()).toBe(1);
    vi.advanceTimersByTime(14 * 60_000);
    expect((await getReferenceAtlasSnapshot()).refreshReason).toBe('major_event');
    expect(mapCalls()).toBe(2);
  });

  it('does not lose an event behind an ordinary in-flight check, and retries failed event refreshes', async () => {
    await getReferenceAtlasSnapshot();
    vi.advanceTimersByTime(15 * 60_000);
    failMap = true;
    const [, failed] = await Promise.all([getReferenceAtlasSnapshot(), getReferenceAtlasSnapshot('published-event:retry')]);
    expect(failed.majorEventState).toBe('pending');
    expect(failed.status).toBe('stale');
    expect(mapCalls()).toBe(2);
    failMap = false;
    vi.advanceTimersByTime(15 * 60_000);
    const retried = await getReferenceAtlasSnapshot();
    expect(retried.majorEventState).toBe('none');
    expect(retried.status).toBe('ok');
    expect(mapCalls()).toBe(3);
    await getReferenceAtlasSnapshot('published-event:retry');
    expect(mapCalls()).toBe(3);
  });

  it('never treats a successful new collection as current control or invents source evidence dates', async () => {
    const first = await getReferenceAtlasSnapshot();
    expect(first).toMatchObject({ status: 'ok', evidenceState: 'unknown', currentControl: false,
      sourcePublishedAt: null, sourceOldestPublishedAt: null, undatedFeatureCount: 1 });
    vi.advanceTimersByTime(12 * 60 * 60_000);
    const next = await getReferenceAtlasSnapshot();
    expect(next.fetchedAt).not.toBe(first.fetchedAt);
    expect(next.sourcePublishedAt).toBeNull();
    expect(next.evidenceState).toBe('unknown');
    expect(next.currentControl).toBe(false);
  });
  it('singleflights and reuses snapshots, checks RSS every 15 minutes and refreshes KML after 12 hours', async () => {
    const [first, concurrent] = await Promise.all([getReferenceAtlasSnapshot(), getReferenceAtlasSnapshot()]);
    expect(first).toEqual(concurrent);
    expect(first.status).toBe('ok');
    expect(first.sourcePublishedAt).toBeNull();
    expect(first.cacheBackend).toBe('memory');
    expect(mapCalls()).toBe(1); expect(feedCalls()).toBe(1);
    await getReferenceAtlasSnapshot();
    expect(mapCalls()).toBe(1); expect(feedCalls()).toBe(1);
    vi.advanceTimersByTime(15 * 60 * 1000);
    await getReferenceAtlasSnapshot();
    expect(mapCalls()).toBe(1); expect(feedCalls()).toBe(2);
    vi.advanceTimersByTime(12 * 60 * 60 * 1000);
    expect((await getReferenceAtlasSnapshot()).refreshReason).toBe('scheduled');
    expect(mapCalls()).toBe(2);
  });

  it('refreshes once for an unseen recent major report; stale RSS cannot replay', async () => {
    await getReferenceAtlasSnapshot();
    vi.advanceTimersByTime(15 * 60 * 1000);
    currentFeed = feed('2026-10-15T12:10:00Z', 'Ceasefire agreed', '2');
    expect((await getReferenceAtlasSnapshot()).refreshReason).toBe('major_report');
    expect(mapCalls()).toBe(2);
    vi.advanceTimersByTime(15 * 60 * 1000);
    await getReferenceAtlasSnapshot(); expect(mapCalls()).toBe(2);
    currentFeed = feed('2026-10-01T12:00:00Z', 'Major attack', '3');
    vi.advanceTimersByTime(15 * 60 * 1000);
    await getReferenceAtlasSnapshot(); expect(mapCalls()).toBe(2);
  });

  it('preserves last-good data and original fetchedAt after failure, respects cooldown, retries unconsumed report', async () => {
    const first = await getReferenceAtlasSnapshot();
    vi.advanceTimersByTime(15 * 60 * 1000);
    currentFeed = feed('2026-10-15T12:10:00Z', 'Ceasefire agreed', '2');
    failMap = true;
    const stale = await getReferenceAtlasSnapshot();
    expect(stale.status).toBe('stale');
    expect(stale.fetchedAt).toBe(first.fetchedAt);
    expect(stale.features).toEqual(first.features);
    expect(stale.error).toBe('reference_source_refresh_failed');
    failMap = false;
    await getReferenceAtlasSnapshot(); expect(mapCalls()).toBe(2);
    vi.advanceTimersByTime(15 * 60 * 1000);
    expect((await getReferenceAtlasSnapshot()).status).toBe('ok');
    expect(mapCalls()).toBe(3);
  });

  it('returns unavailable rather than an empty success on initial source failure', async () => {
    failMap = true;
    const snapshot = await getReferenceAtlasSnapshot();
    expect(snapshot.status).toBe('unavailable'); expect(snapshot.fetchedAt).toBeNull();
    expect(snapshot.featureCount).toBe(0);
    await getReferenceAtlasSnapshot(); expect(mapCalls()).toBe(1);
  });

  it('retries a failed major refresh even when the next RSS check fails', async () => {
    await getReferenceAtlasSnapshot();
    vi.advanceTimersByTime(15 * 60 * 1000);
    currentFeed = feed('2026-10-15T12:10:00Z', 'Ceasefire agreed', '2');
    failMap = true;
    expect((await getReferenceAtlasSnapshot()).status).toBe('stale');
    vi.advanceTimersByTime(15 * 60 * 1000);
    fetchMock.mockImplementation(async (url: string) => url === ISWN_FEED_URL
      ? new Response('outage', { status: 503 }) : new Response(map));
    expect((await getReferenceAtlasSnapshot()).status).toBe('ok');
    expect(mapCalls()).toBe(3);
  });

  it('bounds streamed bytes even without a content-length header', async () => {
    fetchMock.mockImplementation(async (url: string) => new Response(url === ISWN_MAP_URL ? ' '.repeat(6 * 1024 * 1024 + 1) : currentFeed));
    expect((await getReferenceAtlasSnapshot()).status).toBe('unavailable');
  });

  it('masks Saudi-named layers before durable persistence and response counts', async () => {
    const raw = map.replace('</Document>', '<Folder><name>Saudi map</name><Placemark><name>Masked</name><Point><coordinates>36.12,33.56</coordinates></Point></Placemark></Folder></Document>');
    fetchMock.mockImplementation(async (url: string) => new Response(url === ISWN_MAP_URL ? raw : currentFeed));
    const snapshot = await getReferenceAtlasSnapshot();
    expect(snapshot.featureCount).toBe(1);
    expect(snapshot.layers).toHaveLength(1);
    const persisted = await durableGetJson<{ snapshot: unknown }>('m3tm:reference-atlas:iswn:v3');
    expect(JSON.stringify(persisted.value?.snapshot)).not.toContain('Masked');
    expect(JSON.stringify(persisted.value?.snapshot)).not.toContain('Saudi map');
  });

  it('rejects HTML and never follows a fixed source redirect', async () => {
    fetchMock.mockImplementation(async () => new Response('<html>challenge</html>', { headers: { 'content-type': 'text/html' } }));
    expect((await getReferenceAtlasSnapshot()).status).toBe('unavailable');
    expect(fetchMock.mock.calls.every(([, options]) => options.redirect === 'error')).toBe(true);
  });
});
