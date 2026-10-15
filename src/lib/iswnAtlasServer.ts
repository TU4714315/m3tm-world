import { durableGetJson, durableSetJson } from './durableCache';
import { maskSaudiPublicIndicators } from './publicCountryVisibility';
import { atlasLayers, calculateAtlasChanges, ISWN_CHECK_MS, ISWN_FEED_URL, ISWN_MAP_URL,
  ISWN_PUBLISHER_URL, ISWN_REFRESH_MS, type AtlasSnapshot } from './iswnAtlas';
import { isMajorIswnBulletin, MAX_FEED_BYTES, MAX_KML_BYTES, parseIswnBulletins, parseIswnKml } from './iswnAtlasParser';

const CACHE_KEY = 'm3tm:reference-atlas:iswn:v2';
const RETENTION_SECONDS = 7 * 24 * 60 * 60;
interface CacheState { snapshot: AtlasSnapshot; rssCheckedAt: number; lastAttemptAt: number; seenReportIds: string[] }
let inFlight: Promise<AtlasSnapshot> | null = null;
const mask = (snapshot: AtlasSnapshot): AtlasSnapshot => maskSaudiPublicIndicators({ reference_atlas: snapshot }).reference_atlas;

async function boundedXml(url: string, maxBytes: number, timeout: number): Promise<string> {
  const response = await fetch(url, { cache: 'no-store', redirect: 'error', signal: AbortSignal.timeout(timeout),
    headers: { Accept: 'application/xml, text/xml, application/vnd.google-earth.kml+xml' } });
  if (!response.ok || !response.body) throw new Error('upstream_unavailable');
  if (/text\/html/i.test(response.headers.get('content-type') ?? '')) {
    await response.body.cancel();
    throw new Error('unexpected_source_type');
  }
  if (Number(response.headers.get('content-length')) > maxBytes) {
    await response.body.cancel();
    throw new Error('source_size_limit');
  }
  const reader = response.body.getReader(), decoder = new TextDecoder();
  let bytes = 0, text = '';
  try {
    for (;;) {
      const part = await reader.read();
      if (part.done) break;
      bytes += part.value.byteLength;
      if (bytes > maxBytes) { await reader.cancel(); throw new Error('source_size_limit'); }
      text += decoder.decode(part.value, { stream: true });
    }
    return text + decoder.decode();
  } finally { reader.releaseLock(); }
}

function emptySnapshot(): AtlasSnapshot {
  return { version: 1, provider: 'iswn', status: 'unavailable', sourceUrl: ISWN_MAP_URL,
    publisherUrl: ISWN_PUBLISHER_URL, fetchedAt: null, checkedAt: null, nextRefreshAt: null,
    sourcePublishedAt: null, contentKind: 'reference_annotations', features: { type: 'FeatureCollection', features: [] },
    featureCount: 0, layers: [], refreshReason: null, changes: null, cacheBackend: 'miss', bulletins: [], error: null };
}

async function collect(): Promise<AtlasSnapshot> {
  const now = Date.now(), iso = new Date(now).toISOString();
  const cached = await durableGetJson<CacheState>(CACHE_KEY);
  const previous = cached.value;
  let snapshot = mask(previous?.snapshot ?? emptySnapshot());
  snapshot = { ...snapshot, cacheBackend: cached.backend };
  const state: CacheState = { snapshot, rssCheckedAt: previous?.rssCheckedAt ?? 0,
    lastAttemptAt: previous?.lastAttemptAt ?? 0, seenReportIds: previous?.seenReportIds ?? [] };
  const scheduled = !snapshot.fetchedAt || now - Date.parse(snapshot.fetchedAt) >= ISWN_REFRESH_MS;
  const retryAllowed = !state.lastAttemptAt || now - state.lastAttemptAt >= ISWN_CHECK_MS;
  const checkRss = !state.rssCheckedAt || now - state.rssCheckedAt >= ISWN_CHECK_MS;
  let majorReport = false, rssOk = false;
  const seen = new Set(state.seenReportIds);
  if (checkRss) {
    state.rssCheckedAt = now;
    snapshot = { ...snapshot, checkedAt: iso };
    try {
      const bulletins = parseIswnBulletins(await boundedXml(ISWN_FEED_URL, MAX_FEED_BYTES, 8_000));
      majorReport = bulletins.some(bulletin => !seen.has(bulletin.id) && isMajorIswnBulletin(bulletin, now));
      snapshot = { ...snapshot, bulletins };
      rssOk = true;
    } catch { /* A bulletin outage does not invalidate a successfully fetched reference map. */ }
  }
  // Retain failed refresh intent even when RSS later fails or drops the headline.
  const refresh = retryAllowed && (scheduled || majorReport || snapshot.status === 'stale');
  if (refresh) {
    state.lastAttemptAt = now;
    const reason = !snapshot.fetchedAt ? 'initial' : scheduled ? 'scheduled' : 'major_report';
    try {
      const features = parseIswnKml(await boundedXml(ISWN_MAP_URL, MAX_KML_BYTES, 20_000));
      const next = mask({ ...snapshot, status: 'ok', fetchedAt: iso, checkedAt: iso,
        nextRefreshAt: new Date(now + ISWN_REFRESH_MS).toISOString(), features, featureCount: features.features.length,
        layers: atlasLayers(features.features), refreshReason: reason, changes: null, error: null });
      next.changes = snapshot.fetchedAt ? calculateAtlasChanges(snapshot.features, next.features) : null;
      snapshot = next;
      // Only a successful full fetch consumes major-event triggers.
      for (const bulletin of snapshot.bulletins) seen.add(bulletin.id);
    } catch {
      snapshot = { ...snapshot, status: snapshot.fetchedAt ? 'stale' : 'unavailable', checkedAt: iso,
        nextRefreshAt: new Date(now + ISWN_CHECK_MS).toISOString(), error: 'reference_source_refresh_failed' };
    }
  }
  if (rssOk) {
    for (const bulletin of snapshot.bulletins) {
      if (!isMajorIswnBulletin(bulletin, now)) seen.add(bulletin.id);
    }
  }
  state.seenReportIds = [...seen].slice(-300);
  // Apply the public boundary before persistence as well as at the response boundary.
  state.snapshot = mask(snapshot);
  if (refresh || checkRss) {
    const backend = await durableSetJson(CACHE_KEY, state, RETENTION_SECONDS);
    state.snapshot = { ...state.snapshot, cacheBackend: backend };
  }
  return mask(state.snapshot);
}

export function getReferenceAtlasSnapshot(): Promise<AtlasSnapshot> {
  if (!inFlight) inFlight = collect().finally(() => { inFlight = null; });
  return inFlight;
}
