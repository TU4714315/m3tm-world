import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const DEEPSTATE_LATEST = 'https://deepstatemap.live/api/history/last';
const EMPTY_FC = { type: 'FeatureCollection' as const, features: [] as any[] };

/**
 * Public frontline/territorial-control overlay.
 *
 * The upstream snapshot also contains point features. The public WORLD surface
 * only needs published area geometry, so this route removes points and strips
 * upstream properties down to source attribution/labels. This keeps the layer
 * contextual rather than turning it into a tactical-position feed.
 */
export async function GET() {
  try {
    const res = await fetch(DEEPSTATE_LATEST, {
      headers: { 'User-Agent': 'M3TM.WORLD/1.0 public-map' },
      signal: AbortSignal.timeout(15000),
      cache: 'no-store',
    });

    if (!res.ok) {
      return NextResponse.json({
        frontlines: EMPTY_FC,
        status: 'unavailable',
        source: 'DeepStateMap.Live',
        sourceMode: 'published-snapshot',
        error: 'Upstream returned ' + res.status,
        timestamp: new Date().toISOString(),
      }, { headers: { 'Cache-Control': 'no-store' } });
    }

    const raw = await res.json();
    const collection =
      raw?.map?.type === 'FeatureCollection' ? raw.map
        : raw?.type === 'FeatureCollection' ? raw
          : null;
    const features = Array.isArray(collection?.features)
      ? collection.features
        .filter((feature: any) => feature?.geometry?.type === 'Polygon' || feature?.geometry?.type === 'MultiPolygon')
        .slice(0, 300)
        .map((feature: any, index: number) => ({
          type: 'Feature',
          geometry: feature.geometry,
          properties: {
            id: 'published-frontline-' + index,
            source: 'DeepStateMap.Live',
            source_label: String(feature?.properties?.name || 'منطقة منشورة').slice(0, 140),
            snapshot_id: raw?.id ?? null,
            precision: 'published-area',
          },
        }))
      : [];

    return NextResponse.json({
      frontlines: { type: 'FeatureCollection', features },
      total: features.length,
      status: features.length ? 'ok' : 'empty',
      source: 'DeepStateMap.Live',
      sourceMode: 'published-snapshot',
      timestamp: new Date().toISOString(),
    }, {
      headers: { 'Cache-Control': 'public, s-maxage=1800, stale-while-revalidate=3600' },
    });
  } catch (error) {
    console.warn('[M3TM.WORLD] Frontline snapshot unavailable:', error instanceof Error ? error.message : error);
    return NextResponse.json({
      frontlines: EMPTY_FC,
      status: 'unavailable',
      source: 'DeepStateMap.Live',
      sourceMode: 'published-snapshot',
      timestamp: new Date().toISOString(),
    }, { headers: { 'Cache-Control': 'no-store' } });
  }
}
