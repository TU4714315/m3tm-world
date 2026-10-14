import { NextResponse } from 'next/server';
import { maskSaudiPublicIndicators } from '@/lib/publicCountryVisibility';
import { durableGetJson, durableSetJson } from '@/lib/durableCache';

export const dynamic = 'force-dynamic';

const DEEPSTATE_LATEST = 'https://deepstatemap.live/api/history/last';
const EMPTY_FC = { type: 'FeatureCollection' as const, features: [] as unknown[] };
const CACHE_KEY = 'm3tm:frontlines:published-last-good:v2';
const CACHE_TTL_SECONDS = 48 * 60 * 60;
const REVALIDATE_MS = 10 * 60 * 1000;
const FAILURE_RETRY_MS = 2 * 60 * 1000;
const UPSTREAM_TIMEOUT_MS = 8_000;

type PublicFeature = {
  type: 'Feature';
  geometry: unknown;
  properties: {
    id: string;
    source: string;
    source_label: string;
    snapshot_id: unknown;
    precision: string;
  };
};
type Snapshot = {
  frontlines: { type: 'FeatureCollection'; features: PublicFeature[] };
  total: number;
  fetchedAt: string;
};

/* Deduplicate concurrent cold loads. Cache only successfully decoded published
   geometry; never replace last-good with an empty/error body. A source failure
   is diagnostic, not a claim that the frontline vanished. */
let pendingRefresh: Promise<Snapshot | null> | null = null;
let retryAfter = 0;

function validSnapshot(value: Snapshot | null): value is Snapshot {
  return Boolean(value
    && value.frontlines?.type === 'FeatureCollection'
    && Array.isArray(value.frontlines.features)
    && value.frontlines.features.length > 0
    && Number.isFinite(Date.parse(value.fetchedAt)));
}

function respond(snapshot: Snapshot | null, status: 'ok' | 'cached-stale' | 'unavailable') {
  const valid = validSnapshot(snapshot);
  const visibleFrontlines = maskSaudiPublicIndicators({ frontlines: valid ? snapshot.frontlines : EMPTY_FC }).frontlines;
  return NextResponse.json({
    // Consumers must respect status: "cached-stale" is historical context,
    // never an assertion about present control of territory.
    frontlines: visibleFrontlines,
    total: visibleFrontlines.features.length,
    status,
    source: 'DeepStateMap.Live',
    sourceMode: 'published-snapshot',
    sourceFetchedAt: valid ? snapshot.fetchedAt : null,
    timestamp: new Date().toISOString(),
  }, {
    headers: {
      'Cache-Control': status === 'ok'
        ? 'public, s-maxage=60, stale-while-revalidate=120'
        : 'no-store',
    },
  });
}

async function refresh(): Promise<Snapshot | null> {
  try {
    const res = await fetch(DEEPSTATE_LATEST, {
      headers: { 'User-Agent': 'M3TM.WORLD/1.0 public-map' },
      signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
      cache: 'no-store',
    });
    if (!res.ok) throw new Error('Frontline source not reachable');
    const raw = await res.json();
    const collection = raw?.map?.type === 'FeatureCollection' ? raw.map
      : raw?.type === 'FeatureCollection' ? raw : null;
    const features: PublicFeature[] = Array.isArray(collection?.features)
      ? collection.features
        .filter((feature: { geometry?: { type?: string } }) =>
          feature?.geometry?.type === 'Polygon' || feature?.geometry?.type === 'MultiPolygon')
        .slice(0, 300)
        .map((feature: { geometry: unknown; properties?: { name?: unknown } }, index: number) => ({
          type: 'Feature' as const,
          geometry: feature.geometry,
          properties: {
            id: 'published-frontline-' + index,
            source: 'DeepStateMap.Live',
            source_label: String(feature.properties?.name || 'منطقة منشورة').slice(0, 140),
            snapshot_id: raw?.id ?? null,
            precision: 'published-area',
          },
        }))
      : [];
    if (!features.length) throw new Error('Frontline source contains no usable areas');
    const snapshot: Snapshot = {
      frontlines: { type: 'FeatureCollection', features },
      total: features.length,
      fetchedAt: new Date().toISOString(),
    };
    await durableSetJson(CACHE_KEY, snapshot, CACHE_TTL_SECONDS);
    return snapshot;
  } catch {
    // Only server diagnostics see source failure. Public users see a neutral,
    // explicit unavailable/stale state rather than upstream errors or raw URLs.
    console.warn('[M3TM.WORLD] Published frontline refresh unavailable; bounded retry');
    return null;
  }
}

/** Public frontline areas, source-backed and clearly dated. */
export async function GET() {
  const now = Date.now();
  const { value: stored } = await durableGetJson<Snapshot>(CACHE_KEY);
  const cached = validSnapshot(stored) ? stored : null;
  const ageMs = cached ? now - Date.parse(cached.fetchedAt) : Infinity;

  if (cached && ageMs >= 0 && ageMs < REVALIDATE_MS) {
    return respond(cached, 'ok');
  }
  if (now < retryAfter) {
    return respond(cached, cached ? 'cached-stale' : 'unavailable');
  }

  pendingRefresh ??= refresh().finally(() => { pendingRefresh = null; });
  const fresh = await pendingRefresh;
  if (fresh) {
    retryAfter = 0;
    return respond(fresh, 'ok');
  }
  retryAfter = Date.now() + FAILURE_RETRY_MS;
  return respond(cached, cached ? 'cached-stale' : 'unavailable');
}
