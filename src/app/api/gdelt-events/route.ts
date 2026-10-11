import { NextResponse } from 'next/server';
import { buildGdeltReportedRoutes, publisherCoverage, fetchGdeltEvents, toPublicGdeltEvent } from '@/lib/gdeltEvents';
import { gdeltWindowTime, isMiddleEastBelt } from '@/lib/menaSignals';
import { durableCacheConfigured, durableGetJson, durableSetJson } from '@/lib/durableCache';
import { observeGdeltWindow } from '@/lib/gdeltCoverageLedger';

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
const ALLOWED_LIMITS = [300, 600, 1000, 2000] as const;
const ALLOWED_MIN_ARTICLES = [1, 2, 5] as const;

function parseQuads(raw: string | null): number[] {
  if (!raw) return [];
  return [...new Set(
    raw.split(',')
      .map(v => Number(v.trim()))
      .filter(v => Number.isInteger(v) && v >= 1 && v <= 4)
  )].sort((a, b) => a - b);
}

function nearestAllowed(raw: string | null, allowed: readonly number[], fallback: number): number {
  if (raw === null || raw.trim() === '') return fallback;
  const requested = Number(raw);
  if (!Number.isFinite(requested)) return fallback;
  return allowed.reduce((best, value) =>
    Math.abs(value - requested) < Math.abs(best - requested) ? value : best
  , allowed[0] ?? fallback);
}

function durableProfile(quads: number[], minArticles: number, limit: number): string | null {
  const quadKey = quads.join(',');
  if (quadKey === '' && minArticles === 1 && limit === 600) return 'default';
  if (quadKey === '4' && minArticles === 2 && limit === 600) return 'conflict';
  if (quadKey === '3,4' && minArticles === 2 && limit === 1000) return 'conflict-unrest';
  return null;
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);

  const quads = parseQuads(searchParams.get('quad'));
  const minArticles = nearestAllowed(searchParams.get('min_articles'), ALLOWED_MIN_ARTICLES, 1);
  const limit = Math.min(MAX_LIMIT, nearestAllowed(searchParams.get('limit'), ALLOWED_LIMITS, 600));
  const profile = durableProfile(quads, minArticles, limit);
  const cacheKey = profile ? `m3tm:public:gdelt-events:v3:${profile}` : null;
  const previous = cacheKey
    ? await durableGetJson<any>(cacheKey)
    : { value: null, backend: 'miss' as const };

  try {
    const { events, window, scanned } = await fetchGdeltEvents({ quads, minArticles, limit, regionalPriority: 'middle-east' });
    // Preserve exactly which 15-minute source export was *actually* decoded.
    // This is metadata sampling, not a fake seven-day event history.
    await observeGdeltWindow(window);
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
      source_published_at: gdeltWindowTime(window),
      priority_region: 'middle-east-red-sea',
      priority_region_count: publicEvents.filter(e => isMiddleEastBelt(e.lat,e.lng)).length,
      source: 'GDELT 2.0 Events',
      timestamp: new Date().toISOString(),
      data_state: 'live',
      durable_cache_configured: durableCacheConfigured(),
      cache_backend: previous.backend as Awaited<ReturnType<typeof durableSetJson>> | 'miss',
    };
    if (cacheKey && publicEvents.length > 0) payload.cache_backend = await durableSetJson(cacheKey, payload, 60 * 60);

    return NextResponse.json(
      payload,
      {
        // GDELT publishes a new export every 15 minutes, so anything under that
        // is wasted work. Serve stale while revalidating to absorb bursts.
        headers: { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=120' },
      }
    );
  } catch (error) {
    console.error('[OSIRIS] GDELT events fetch failed:', error);
    if (previous.value) {
      return NextResponse.json({
        ...previous.value,
        // Old durable payloads were saved with articles>=3 treated as
        // multi-source. Correct the labels even when upstream is unavailable.
        events: Array.isArray(previous.value.events)
          ? previous.value.events.map((event:any) => ({
              ...event, corroboration: publisherCoverage(event.sources),
            })) : [],
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
