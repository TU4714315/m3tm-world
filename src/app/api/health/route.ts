import { NextResponse } from 'next/server';
import { fetchAcledPublicEvents } from '@/lib/acled';
import { durableCacheConfigured } from '@/lib/durableCache';

export const dynamic = 'force-dynamic';

type SourceStatus =
  | 'active'
  | 'degraded'
  | 'restricted'
  | 'configured'
  | 'not_configured'
  | 'anonymous_fallback'
  | 'public_no_auth'
  | 'unavailable'
  | 'not_probed';

function hasAcledCredentials() {
  return Boolean(
    process.env.ACLED_ACCESS_TOKEN
    || (process.env.ACLED_USERNAME && process.env.ACLED_PASSWORD)
  );
}

function acledAuthMode() {
  if (process.env.ACLED_ACCESS_TOKEN) return 'access-token';
  if (process.env.ACLED_USERNAME && process.env.ACLED_PASSWORD) return 'oauth-password';
  return 'none';
}

function hasOpenSkyCredentials() {
  return Boolean(process.env.OPENSKY_CLIENT_ID && process.env.OPENSKY_CLIENT_SECRET);
}

function hasAisCredentials() {
  return Boolean(process.env.AIS_API_KEY);
}

function hasCloudflareRadarCredentials() {
  return Boolean(process.env.CLOUDFLARE_API_TOKEN);
}


async function probeGdelt(): Promise<{ status: SourceStatus; detail: string }> {
  try {
    const res = await fetch('https://data.gdeltproject.org/gdeltv2/lastupdate.txt', {
      cache: 'no-store',
      signal: AbortSignal.timeout(4000),
    });
    if (!res.ok) return { status: 'unavailable', detail: `manifest HTTP ${res.status}` };
    const text = await res.text();
    const hasExport = text.includes('.export.CSV.zip');
    return hasExport
      ? { status: 'active', detail: '15-minute manifest reachable' }
      : { status: 'unavailable', detail: 'manifest reachable but export pointer missing' };
  } catch (error) {
    return {
      status: 'unavailable',
      detail: error instanceof Error ? error.message : 'GDELT probe failed',
    };
  }
}

async function probeAcled(): Promise<{
  status: SourceStatus;
  detail: string;
  sampledEvents?: number;
}> {
  if (!hasAcledCredentials()) {
    return {
      status: 'not_configured',
      detail: 'No ACLED server credentials are configured.',
    };
  }

  const result = await Promise.race([
    fetchAcledPublicEvents(1, 100),
    new Promise<Awaited<ReturnType<typeof fetchAcledPublicEvents>>>(resolve => {
      setTimeout(() => resolve({
        status: 'unavailable',
        events: [],
        lastUpdateHours: null,
        message: 'ACLED health probe exceeded 5 seconds.',
      }), 5000);
    }),
  ]);

  if (result.status === 'restricted_recency') {
    return {
      status: 'restricted',
      detail: 'ACLED OAuth is valid; event data access is limited to historical periods by account entitlement.',
      sampledEvents: 0,
    };
  }
  if (result.status === 'ok') {
    return {
      status: 'active',
      detail: 'Authenticated ACLED API request succeeded.',
      sampledEvents: result.events.length,
    };
  }
  return {
    status: result.status === 'not_configured' ? 'not_configured' : 'unavailable',
    detail: result.message || 'ACLED probe failed.',
  };
}

async function probeFlights(request: Request): Promise<{
  status: SourceStatus;
  detail: string;
  publicTotal: number | null;
  fallbackCells: number;
  source: string | null;
  providers: Record<string, unknown>;
  alert: string | null;
}> {
  try {
    const url = new URL('/api/flights?summary=1', request.url);
    const res = await fetch(url, {
      cache: 'no-store',
      signal: AbortSignal.timeout(20_000),
    });
    if (!res.ok) {
      return {
        status: 'unavailable', detail: `/api/flights HTTP ${res.status}`,
        publicTotal: null, fallbackCells: 0, source: null, providers: {},
        alert: 'flight_route_unavailable',
      };
    }
    const data = await res.json();
    const publicTotal = Number.isFinite(Number(data?.counts?.public_total))
      ? Number(data.counts.public_total) : null;
    const fallbackCells = Number.isFinite(Number(data?.civilian_activity?.cells))
      ? Number(data.civilian_activity.cells) : 0;
    const fallbackActive = data?.civilian_activity?.fallback_active === true;
    const active = data?.status === 'operational' && (publicTotal ?? 0) > 0;
    const degraded = fallbackActive || data?.status === 'degraded' || publicTotal === 0;
    return {
      status: active ? 'active' : degraded ? 'degraded' : 'unavailable',
      detail: active
        ? `Public flight route active with ${publicTotal} civilian observations.`
        : fallbackActive
          ? `Live civilian feed degraded; ${fallbackCells} coarse last-good cells available.`
          : 'Public flight route returned no civilian observations.',
      publicTotal,
      fallbackCells,
      source: typeof data?.source === 'string' ? data.source : null,
      providers: data?.providers && typeof data.providers === 'object' ? data.providers : {},
      alert: publicTotal === 0 ? 'public_total_zero' : null,
    };
  } catch (error) {
    return {
      status: 'unavailable',
      detail: error instanceof Error ? error.message : 'Flight reachability probe failed',
      publicTotal: null, fallbackCells: 0, source: null, providers: {},
      alert: 'flight_probe_failed',
    };
  }
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const deep = url.searchParams.get('deep') === '1';

  const acledConfigured = hasAcledCredentials();
  const openskyConfigured = hasOpenSkyCredentials();
  const aisConfigured = hasAisCredentials();
  const cloudflareConfigured = hasCloudflareRadarCredentials();
  const durableConfigured = durableCacheConfigured();

  const [gdeltProbe, acledProbe, flightProbe] = deep
    ? await Promise.all([probeGdelt(), probeAcled(), probeFlights(request)])
    : [
        { status: 'not_probed' as SourceStatus, detail: 'Use ?deep=1 for an external reachability probe.' },
        {
          status: acledConfigured ? 'configured' as SourceStatus : 'not_configured' as SourceStatus,
          detail: acledConfigured ? 'Server credentials are present.' : 'No ACLED server credentials are configured.',
        },
        {
          status: 'not_probed' as SourceStatus,
          detail: 'Use ?deep=1 for the live /api/flights summary probe.',
          publicTotal: null,
          fallbackCells: 0,
          source: null,
          providers: {} as Record<string, unknown>,
          alert: null,
        },
      ];

  const sources = {
    gdelt: {
      role: 'primary-conflict',
      auth: 'none',
      status: gdeltProbe.status,
      detail: gdeltProbe.detail,
      cadence: '15-minute exports',
    },
    acled: {
      role: 'optional-curated-conflict',
      configured: acledConfigured,
      authMode: acledAuthMode(),
      status: acledProbe.status,
      detail: acledProbe.detail,
      sampledEvents: 'sampledEvents' in acledProbe ? acledProbe.sampledEvents : undefined,
    },
    opensky: {
      role: 'public-air-observation',
      configured: openskyConfigured,
      status: openskyConfigured ? 'configured' as SourceStatus : 'anonymous_fallback' as SourceStatus,
      authMode: openskyConfigured ? 'oauth-client' : 'anonymous',
      detail: 'Runtime aircraft counts and snapshot age are exposed by /api/flights.providers.',
    },
    adsbfi: {
      role: 'public-air-observation-fallback',
      status: 'public_no_auth' as SourceStatus,
      auth: 'none',
      detail: 'Runtime counts are exposed by /api/flights.providers.',
    },
    flights: {
      role: 'public-air-observation-runtime',
      status: flightProbe.status,
      detail: flightProbe.detail,
      publicTotal: flightProbe.publicTotal,
      civilianFallbackCells: flightProbe.fallbackCells,
      source: flightProbe.source,
      providers: flightProbe.providers,
      alert: flightProbe.alert,
    },
    ais: {
      role: 'public-maritime-observation',
      configured: aisConfigured,
      status: aisConfigured ? 'configured' as SourceStatus : 'not_configured' as SourceStatus,
      authMode: aisConfigured ? 'server-api-key' : 'none',
      detail: aisConfigured
        ? 'AISStream.io is configured; runtime vessel counts/freshness are exposed by /api/maritime.source_status.'
        : 'AIS_API_KEY is absent. Static public ports/chokepoints remain available, but live AIS vessels are not claimed.',
    },
    cloudflareRadar: {
      role: 'optional-internet-observation',
      configured: cloudflareConfigured,
      status: cloudflareConfigured ? 'configured' as SourceStatus : 'not_configured' as SourceStatus,
      authMode: cloudflareConfigured ? 'server-api-token' : 'none',
      detail: cloudflareConfigured
        ? 'Cloudflare Radar: Read credential is present.'
        : 'CLOUDFLARE_API_TOKEN is absent; public controls remain operable but report غير مهيأ and no Cloudflare data is claimed.',
    },
    durableCache: {
      role: 'public-last-good-snapshot-cache',
      configured: durableConfigured,
      status: durableConfigured ? 'configured' as SourceStatus : 'anonymous_fallback' as SourceStatus,
      authMode: durableConfigured ? 'server-rest-token' : 'process-memory',
      detail: durableConfigured
        ? 'Redis/KV REST storage is configured for bounded public last-good snapshots.'
        : 'Redis/KV is not configured; bounded process-memory fallback remains active.',
    },
    balloons: {
      role: 'optional-moving-object-layer',
      configured: false,
      status: 'unavailable' as SourceStatus,
      authMode: 'none',
      detail: '/api/balloons is not implemented in this deployment; no public control is exposed.',
    },
    radiation: {
      role: 'optional-radiation-monitor-layer',
      configured: false,
      status: 'unavailable' as SourceStatus,
      authMode: 'none',
      detail: '/api/radiation is not implemented in this deployment; no public control is exposed.',
    },
  };

  const degraded =
    sources.gdelt.status === 'unavailable'
    || (acledConfigured && sources.acled.status === 'unavailable')
    || (deep && sources.flights.status !== 'active');

  return NextResponse.json({
    status: degraded ? 'degraded' : 'operational',
    platform: 'M3TM.WORLD',
    version: '0.1.0',
    deployment: {
      sha: process.env.VERCEL_GIT_COMMIT_SHA || null,
      environment: process.env.VERCEL_ENV || process.env.NODE_ENV || null,
    },
    uptime: process.uptime ? Math.round(process.uptime()) : 0,
    timestamp: new Date().toISOString(),
    deepProbe: deep,
    sources,
    observationPolicy: {
      publicMilitaryAirMode: 'coarse-regional-aggregate',
      spatialCellDegrees: 6,
      temporalBucketMinutes: 30,
      exactMilitaryTracksExposed: false,
      exactMilitaryTracksPersisted: false,
      unobservedAircraftInferred: false,
      absenceMeaning: 'not-observed-does-not-mean-absent',
      knownPublicFeedLimitations: [
        'receiver coverage gaps',
        'Mode S aircraft without ADS-B position',
        'transponder disabled or unavailable',
      ],
    },
    endpoints: [
      '/api/flights',
      '/api/conflicts',
      '/api/gdelt-events',
      '/api/satellites',
      '/api/earthquakes',
      '/api/news',
      '/api/gdelt',
      '/api/markets',
      '/api/frontlines',
      '/api/maritime',
      '/api/cctv',
      '/api/cloudflare-radar',
      '/api/geosearch',
      '/api/region-dossier',
    ],
  }, {
    headers: {
      'Cache-Control': deep ? 'no-store' : 'public, s-maxage=60, stale-while-revalidate=120',
    },
  });
}
