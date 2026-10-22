import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { clearDurableMemoryCache, durableGetJson, durableSetJson } from './durableCache';
import { ISWN_CHECK_MS, ISWN_REFRESH_MS, ISWN_FEED_URL, ISWN_MAP_URL } from './iswnAtlas';
import { getReferenceAtlasSnapshot, readReferenceAtlasSnapshot } from './iswnAtlasServer';

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
  vi.stubEnv('REDIS_URL', '');
  currentFeed = feed(); failMap = false;
  fetchMock = vi.fn(async (url: string) => {
    if (url === ISWN_MAP_URL && failMap) return new Response('error', { status: 503 });
    return new Response(url === ISWN_MAP_URL ? map : currentFeed);
  });
  vi.stubGlobal('fetch', fetchMock);
});
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); vi.unstubAllEnvs(); clearDurableMemoryCache(); });

describe('reference atlas collection schedule', () => {
  it('returns an empty honest snapshot on a cold public read without any KML or RSS fetch', async () => {
    const initial = await readReferenceAtlasSnapshot();
    expect(initial.status).toBe('unavailable');
    expect(initial.features.features).toEqual([]);
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it('public reads use the last collected snapshot without initiating outbound requests', async () => {
    const first = await getReferenceAtlasSnapshot();
    expect(first.status).toBe('ok');
    fetchMock.mockClear();
    const cached = await readReferenceAtlasSnapshot();
    expect(cached.features).toEqual(first.features);
    expect(cached.sourcePublishedAt).toBe(first.sourcePublishedAt);
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it('allows the authenticated collector to refresh on explicit demand before twelve hours pass', async () => {
    await getReferenceAtlasSnapshot();
    const manuallyUpdated = await getReferenceAtlasSnapshot(undefined, true);
    expect(manuallyUpdated.refreshReason).toBe('manual');
    expect(mapCalls()).toBe(2);
    expect(feedCalls()).toBe(2);
    fetchMock.mockClear();
    await readReferenceAtlasSnapshot();
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it('continues collecting the map when the report fetch ignores abort forever', async () => {
    fetchMock.mockImplementation((url: string) => url === ISWN_FEED_URL
      ? new Promise<Response>(() => {}) : Promise.resolve(new Response(map)));
    const pending = getReferenceAtlasSnapshot();
    await vi.advanceTimersByTimeAsync(8001);
    expect((await pending).status).toBe('ok');
    expect(mapCalls()).toBe(1);
  });

  it('releases singleflight after a stalled response body and allows a later retry', async () => {
    fetchMock.mockImplementation(async (url: string) => url === ISWN_MAP_URL
      ? new Response(new ReadableStream({ start() {}, cancel: () => new Promise(() => {}) }))
      : new Response(currentFeed));
    const pending = getReferenceAtlasSnapshot();
    await vi.advanceTimersByTimeAsync(20001);
    expect((await pending).status).toBe('unavailable');
    fetchMock.mockImplementation(async (url: string) => new Response(url === ISWN_MAP_URL ? map : currentFeed));
    await vi.advanceTimersByTimeAsync(ISWN_CHECK_MS);
    expect((await getReferenceAtlasSnapshot()).status).toBe('ok');
    expect(mapCalls()).toBe(2);
  });

  it('does not wait for an upstream HTML challenge to finish cancelling', async () => {
    fetchMock.mockImplementation(async (url: string) => url === ISWN_MAP_URL
      ? new Response(new ReadableStream({ start() {}, cancel: () => new Promise(() => {}) }),
        { headers: { 'content-type': 'text/html' } }) : new Response(currentFeed));
    expect((await getReferenceAtlasSnapshot()).status).toBe('unavailable');
  });

  it('retains the last-good regions and fetched time when a due map fetch never settles', async () => {
    const first = await getReferenceAtlasSnapshot();
    fetchMock.mockImplementation((url: string) => url === ISWN_MAP_URL
      ? new Promise<Response>(() => {}) : Promise.resolve(new Response(currentFeed)));
    await vi.advanceTimersByTimeAsync(ISWN_REFRESH_MS);
    const pending = getReferenceAtlasSnapshot();
    await vi.advanceTimersByTimeAsync(20001);
    const failed = await pending;
    expect(failed.status).toBe('stale');
    expect(failed.fetchedAt).toBe(first.fetchedAt);
    expect(failed.features).toEqual(first.features);
    expect(failed.error).toBe('reference_source_refresh_failed');
  });

  it('refreshes for a collector event outside the RSS check and schedule, consuming its id only once', async () => {
    await getReferenceAtlasSnapshot();
    vi.advanceTimersByTime(ISWN_CHECK_MS);
    await getReferenceAtlasSnapshot();
    vi.advanceTimersByTime(60_000);
    const refreshed = await getReferenceAtlasSnapshot('published-event:one');
    expect(refreshed.refreshReason).toBe('major_event');
    expect(refreshed.majorEventState).toBe('none');
    expect(mapCalls()).toBe(2);
    expect(feedCalls()).toBe(2);
    vi.advanceTimersByTime(ISWN_CHECK_MS);
    await getReferenceAtlasSnapshot('published-event:one');
    expect(mapCalls()).toBe(2);
  });

  it('persists an event during cooldown and refreshes it on a later ordinary check', async () => {
    await getReferenceAtlasSnapshot();
    vi.advanceTimersByTime(60_000);
    const pending = await getReferenceAtlasSnapshot('published-event:queued');
    expect(pending.majorEventState).toBe('pending');
    expect(pending.nextRefreshAt).toBe('2026-10-15T12:02:00.000Z');
    await getReferenceAtlasSnapshot('published-event:queued');
    expect(mapCalls()).toBe(1);
    vi.advanceTimersByTime(ISWN_CHECK_MS - 60_000);
    expect((await getReferenceAtlasSnapshot()).refreshReason).toBe('major_event');
    expect(mapCalls()).toBe(2);
  });

  it('does not lose an event behind an ordinary in-flight check, and retries failed event refreshes', async () => {
    await getReferenceAtlasSnapshot();
    vi.advanceTimersByTime(ISWN_CHECK_MS);
    failMap = true;
    const [, failed] = await Promise.all([getReferenceAtlasSnapshot(), getReferenceAtlasSnapshot('published-event:retry')]);
    expect(failed.majorEventState).toBe('pending');
    expect(failed.status).toBe('stale');
    expect(mapCalls()).toBe(2);
    failMap = false;
    vi.advanceTimersByTime(ISWN_CHECK_MS);
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
    vi.advanceTimersByTime(ISWN_REFRESH_MS);
    const next = await getReferenceAtlasSnapshot();
    expect(next.fetchedAt).not.toBe(first.fetchedAt);
    expect(next.sourcePublishedAt).toBeNull();
    expect(next.evidenceState).toBe('unknown');
    expect(next.currentControl).toBe(false);
  });
  it('singleflights and reuses snapshots, checks reports every two minutes and collects map edits every five minutes', async () => {
    const [first, concurrent] = await Promise.all([getReferenceAtlasSnapshot(), getReferenceAtlasSnapshot()]);
    expect(first).toEqual(concurrent);
    expect(first.status).toBe('ok');
    expect(first.sourcePublishedAt).toBeNull();
    expect(first.cacheBackend).toBe('memory');
    expect(mapCalls()).toBe(1); expect(feedCalls()).toBe(1);
    await getReferenceAtlasSnapshot();
    expect(mapCalls()).toBe(1); expect(feedCalls()).toBe(1);
    vi.advanceTimersByTime(ISWN_CHECK_MS);
    await getReferenceAtlasSnapshot();
    expect(mapCalls()).toBe(1); expect(feedCalls()).toBe(2);
    vi.advanceTimersByTime(ISWN_REFRESH_MS);
    expect((await getReferenceAtlasSnapshot()).refreshReason).toBe('scheduled');
    expect(mapCalls()).toBe(2);
  });

  it('collects a changed Yemen area on schedule without a breaking headline or caller bypass', async () => {
    await getReferenceAtlasSnapshot();
    const updated = map.replace('Reference', 'AnsarAllah in Lahij');
    fetchMock.mockImplementation(async (url: string) => new Response(url === ISWN_MAP_URL ? updated : currentFeed));
    vi.advanceTimersByTime(ISWN_REFRESH_MS - 1);
    expect((await getReferenceAtlasSnapshot()).features.features[0].properties.name).toBe('Reference');
    expect(mapCalls()).toBe(1);
    vi.advanceTimersByTime(1);
    const next = await getReferenceAtlasSnapshot();
    expect(next.features.features[0].properties.name).toBe('AnsarAllah in Lahij');
    expect(next.nextRefreshAt).toBe('2026-10-16T12:00:00.000Z');
    expect(next.currentControl).toBe(false);
    expect(mapCalls()).toBe(2);
    await getReferenceAtlasSnapshot();
    expect(mapCalls()).toBe(2);
  });

  it('refreshes once for an unseen recent major report; stale RSS cannot replay', async () => {
    await getReferenceAtlasSnapshot();
    vi.advanceTimersByTime(ISWN_CHECK_MS);
    currentFeed = feed('2026-10-15T12:01:00Z', 'Ceasefire agreed', '2');
    expect((await getReferenceAtlasSnapshot()).refreshReason).toBe('major_report');
    expect(mapCalls()).toBe(2);
    vi.advanceTimersByTime(ISWN_CHECK_MS);
    await getReferenceAtlasSnapshot(); expect(mapCalls()).toBe(2);
    currentFeed = feed('2026-10-01T12:00:00Z', 'Major attack', '3');
    vi.advanceTimersByTime(ISWN_CHECK_MS);
    await getReferenceAtlasSnapshot(); expect(mapCalls()).toBe(2);
  });

  it('preserves last-good data and original fetchedAt after failure, respects cooldown, retries unconsumed report', async () => {
    const first = await getReferenceAtlasSnapshot();
    vi.advanceTimersByTime(ISWN_CHECK_MS);
    currentFeed = feed('2026-10-15T12:01:00Z', 'Ceasefire agreed', '2');
    failMap = true;
    const stale = await getReferenceAtlasSnapshot();
    expect(stale.status).toBe('stale');
    expect(stale.fetchedAt).toBe(first.fetchedAt);
    expect(stale.features).toEqual(first.features);
    expect(stale.error).toBe('reference_source_refresh_failed');
    failMap = false;
    await getReferenceAtlasSnapshot(); expect(mapCalls()).toBe(2);
    vi.advanceTimersByTime(ISWN_CHECK_MS);
    expect((await getReferenceAtlasSnapshot()).status).toBe('ok');
    expect(mapCalls()).toBe(3);
  });

  it('migrates last-good geometry through an upstream outage without inheriting old folder dates', async () => {
    const snapshot = await getReferenceAtlasSnapshot();
    clearDurableMemoryCache();
    // Older than the new 12-hour acquisition budget, so the collector retries.
    snapshot.fetchedAt = '2026-10-14T23:54:00.000Z';
    snapshot.features.features[0].properties.sourcePublishedAt = '2024-06-02T00:00:00.000Z';
    snapshot.sourcePublishedAt = '2024-06-02T00:00:00.000Z';
    await durableSetJson('m3tm:reference-atlas:iswn:v3', {
      snapshot, rssCheckedAt: Date.now(), lastAttemptAt: 0, seenReportIds: [],
    }, 3600);
    failMap = true;
    const migrated = await getReferenceAtlasSnapshot();
    expect(migrated.status).toBe('stale');
    expect(migrated.features.features).toHaveLength(1);
    expect(migrated.features.features[0].geometry).toEqual(snapshot.features.features[0].geometry);
    expect(migrated.features.features[0].properties.sourcePublishedAt).toBeNull();
    expect(migrated.sourcePublishedAt).toBeNull();
    expect(migrated.layers[0].sourcePublishedAt).toBeNull();
    expect(migrated.fetchedAt).toBe(snapshot.fetchedAt);
    const persisted = await durableGetJson<{ snapshot: unknown }>('m3tm:reference-atlas:iswn:v4');
    expect(persisted.value?.snapshot).toEqual(expect.objectContaining({ featureCount: 1, sourcePublishedAt: null }));
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
    vi.advanceTimersByTime(ISWN_CHECK_MS);
    currentFeed = feed('2026-10-15T12:01:00Z', 'Ceasefire agreed', '2');
    failMap = true;
    expect((await getReferenceAtlasSnapshot()).status).toBe('stale');
    vi.advanceTimersByTime(ISWN_CHECK_MS);
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
    const persisted = await durableGetJson<{ snapshot: unknown }>('m3tm:reference-atlas:iswn:v4');
    expect(JSON.stringify(persisted.value?.snapshot)).not.toContain('Masked');
    expect(JSON.stringify(persisted.value?.snapshot)).not.toContain('Saudi map');
  });

  it('rejects HTML and never follows a fixed source redirect', async () => {
    fetchMock.mockImplementation(async () => new Response('<html>challenge</html>', { headers: { 'content-type': 'text/html' } }));
    expect((await getReferenceAtlasSnapshot()).status).toBe('unavailable');
    expect(fetchMock.mock.calls.every(([, options]) => options.redirect === 'error')).toBe(true);
  });
});
