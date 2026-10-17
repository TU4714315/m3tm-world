import { atlasScheduledRecoveryDelay } from './atlas-stale-retry-policy.mjs';
// Ordinary checks use the same published-read boundary as visitors. A collector
// credential is still mandatory for an explicit major-event dispatch.
const allowedOrigins = new Set([
  'https://m3tm-world-recovery.onrender.com',
  'https://m3tm-world.vercel.app',
]);
const origin = process.env.REFERENCE_ATLAS_ORIGIN || 'https://m3tm-world-recovery.onrender.com';
if (!allowedOrigins.has(origin)) throw new Error('Unsupported reference atlas origin');
const token = process.env.WORLD_MAP_REFRESH_TOKEN;
if (token && token.length < 32) throw new Error('Collector authorization is invalid');
const eventId = process.env.REFERENCE_ATLAS_MAJOR_EVENT_ID || '';
if (process.env.REFERENCE_ATLAS_TRIGGER === 'repository_dispatch' && !eventId) {
  throw new Error('A major published event requires an idempotent event id');
}
if (eventId && !/^[A-Za-z0-9][A-Za-z0-9_.:-]{0,95}$/.test(eventId)) {
  throw new Error('Invalid major event id');
}
if (eventId && !token) throw new Error('Major event collector authorization is not configured');
const check = async () => {
  const response = await fetch(`${origin}/api/reference-atlas`, {
    headers: { Accept: 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(eventId ? { 'X-M3TM-Atlas-Event-Id': eventId } : {}) },
    redirect: 'error',
    signal: AbortSignal.timeout(55_000),
  });
  if (!response.ok) throw new Error(`Reference atlas check returned HTTP ${response.status}`);
  const snapshot = await response.json();
  if (snapshot?.provider !== 'iswn' || snapshot?.version !== 1 ||
      snapshot?.contentKind !== 'reference_annotations') {
    throw new Error('Reference atlas response contract is unavailable');
  }
  return snapshot;
};
let snapshot = await check();
// Scheduled checks may encounter a transient failed KML refresh. The server
// advertises its backoff timestamp; permit exactly one retry after that time.
// Dispatch requests must remain idempotent and never repeat implicitly.
const retryMs = process.env.REFERENCE_ATLAS_TRIGGER === 'schedule'
  ? atlasScheduledRecoveryDelay(snapshot)
  : null;
if (retryMs !== null) {
  console.log(JSON.stringify({ status: 'stale_source_retry_scheduled',
    retryInMs: retryMs, lastGoodFetchedAt: snapshot.fetchedAt,
    nextRefreshAt: snapshot.nextRefreshAt }));
  await new Promise(resolve => setTimeout(resolve, retryMs));
  snapshot = await check();
}
console.log(JSON.stringify({ status: snapshot.status, fetchedAt: snapshot.fetchedAt,
  checkedAt: snapshot.checkedAt, nextRefreshAt: snapshot.nextRefreshAt,
  refreshReason: snapshot.refreshReason, featureCount: snapshot.featureCount,
  cacheBackend: snapshot.cacheBackend, majorEventState: snapshot.majorEventState,
  evidenceState: snapshot.evidenceState, sourcePublishedAt: snapshot.sourcePublishedAt,
  currentControl: snapshot.currentControl === false ? false : undefined,
  retryAttempted: retryMs !== null }));
// Preserve the failure until actual successful refresh; never disguise stale
// historical features as independently verified present-day events.
if (snapshot.status !== 'ok') process.exitCode = 1;
