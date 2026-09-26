import { NextResponse } from 'next/server';
import { fetchAcledPublicEvents } from '@/lib/acled';

export const dynamic = 'force-dynamic';

type SourceStatus =
  | 'active'
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

export async function GET(request: Request) {
  const url = new URL(request.url);
  const deep = url.searchParams.get('deep') === '1';

  const acledConfigured = hasAcledCredentials();
  const openskyConfigured = hasOpenSkyCredentials();

  const [gdeltProbe, acledProbe] = deep
    ? await Promise.all([probeGdelt(), probeAcled()])
    : [
        { status: 'not_probed' as SourceStatus, detail: 'Use ?deep=1 for an external reachability probe.' },
        {
          status: acledConfigured ? 'configured' as SourceStatus : 'not_configured' as SourceStatus,
          detail: acledConfigured ? 'Server credentials are present.' : 'No ACLED server credentials are configured.',
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
  };

  const degraded =
    sources.gdelt.status === 'unavailable'
    || (acledConfigured && sources.acled.status === 'unavailable');

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
      '/api/region-dossier',
    ],
  }, {
    headers: {
      'Cache-Control': deep ? 'no-store' : 'public, s-maxage=60, stale-while-revalidate=120',
    },
  });
}
