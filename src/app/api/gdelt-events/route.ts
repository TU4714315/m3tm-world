import { NextResponse } from 'next/server';
import { buildGdeltReportedRoutes, fetchGdeltEvents, toPublicGdeltEvent } from '@/lib/gdeltEvents';
import { durableCacheConfigured, durableGetJson, durableSetJson } from '@/lib/durableCache';

export const maxDuration = 60;

/**
 * OSIRIS — GDELT 2.0 Geocoded Events
 * Source: GDELT Project 15-minute Events export — free, no auth required.
 * https://www.gdeltproject.org/
 *
 * Distinct from /api/gdelt, which despite its name reads GDACS disaster alerts.
 * This route serves actual GDELT event records with ActionGeo coordinates.
 */

const MAX_LIMIT = 2000;

function parseQuads(raw: string | null): number[] {
  if (!raw) return [];
  return raw
    .split(',')
    .map(v => Number(v.trim()))
    .filter(v => v >= 1 && v <= 4);
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);

  const quads = parseQuads(searchParams.get('quad'));
  const minArticles = Math.max(1, Number(searchParams.get('min_articles')) || 1);
  const limit = Math.min(MAX_LIMIT, Math.max(1, Number(searchParams.get('limit')) || 600));
  const cacheKey = 'm3tm:public:gdelt-events:v2:' + (quads.join('-') || 'all') + ':' + minArticles + ':' + limit;
  const previous = await durableGetJson<any>(cacheKey);

  try {
    const { events, window, scanned } = await fetchGdeltEvents({ quads, minArticles, limit });
    const reportedRoutes = buildGdeltReportedRoutes(events);
    const publicEvents = events.map(toPublicGdeltEvent);
    const payload = {
      events: publicEvents,
      reported_routes: reportedRoutes,
      reported_routes_meta: {
        mode: 'public-event-link',
        precision: 'generalized-0.25deg',
        not_trajectory: true,
        source: 'GDELT Actor1Geo → ActionGeo',
      },
      total: publicEvents.length,
      reported_routes_total: reportedRoutes.length,
      scanned,
      window,
      source: 'GDELT 2.0 Events',
      timestamp: new Date().toISOString(),
      data_state: 'live',
      durable_cache_configured: durableCacheConfigured(),
      cache_backend: previous.backend,
    };
    if (publicEvents.length > 0) payload.cache_backend = await durableSetJson(cacheKey, payload, 60 * 60);

    return NextResponse.json(
      payload,
      {
        // GDELT publishes a new export every 15 minutes, so anything under that
        // is wasted work. Serve stale while revalidating to absorb bursts.
        headers: { 'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600' },
      }
    );
  } catch (error) {
    console.error('[OSIRIS] GDELT events fetch failed:', error);
    if (previous.value) {
      return NextResponse.json({
        ...previous.value,
        data_state: 'cached-stale',
        cache_backend: previous.backend,
        durable_cache_configured: durableCacheConfigured(),
        served_at: new Date().toISOString(),
      }, { headers: { 'Cache-Control': 'no-store, max-age=0' } });
    }
    return NextResponse.json(
      { events: [], reported_routes: [], total: 0, reported_routes_total: 0, error: 'Failed to fetch GDELT events' },
      { status: 502 }
    );
  }
}
