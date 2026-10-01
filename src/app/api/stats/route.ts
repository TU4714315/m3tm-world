import { NextResponse } from 'next/server';

export const maxDuration = 60;

type SettledResponse = PromiseSettledResult<Response>;

async function parseJson(result: SettledResponse): Promise<any | null> {
  if (result.status !== 'fulfilled' || !result.value.ok) return null;
  try {
    return await result.value.json();
  } catch {
    return null;
  }
}

function sourceState(result: SettledResponse, parsed: any | null) {
  if (result.status === 'rejected') return { ok: false, status: 0 };
  const applicationStatus = typeof parsed?.status === 'string' ? parsed.status : null;
  const applicationHealthy = applicationStatus !== 'degraded' && applicationStatus !== 'unavailable';
  return {
    ok: result.value.ok && parsed !== null && applicationHealthy,
    status: result.value.status,
    ...(applicationStatus ? { application_status: applicationStatus } : {}),
  };
}

/**
 * OSIRIS — Global Stats API
 * Lightweight aggregation endpoint.
 *
 * Flight aggregation uses /api/flights?summary=1 so this endpoint never
 * serializes/parses the multi-megabyte aircraft payload merely to count it.
 * The 55s flight budget exceeds the route's hard 45s refresh budget.
 *
 * A failed or malformed upstream must never make the whole dashboard counter
 * endpoint fail. Counts are best-effort and the response explicitly reports
 * degraded state when one or more source APIs could not be read.
 */
export async function GET(req: Request) {
  const emptyStats = {
    flights: 0,
    sats: 0,
    cctv: 0,
    weather: 0,
    nuclear: 0,
    incidents: 0,
  };

  try {
    const origin = new URL(req.url).origin;

    const settled = await Promise.allSettled([
      fetch(`${origin}/api/flights?summary=1`, { signal: AbortSignal.timeout(55000), next: { revalidate: 45 } }),
      fetch(`${origin}/api/satellites`, { signal: AbortSignal.timeout(20000), next: { revalidate: 3600 } }),
      fetch(`${origin}/api/cctv`, { signal: AbortSignal.timeout(20000), next: { revalidate: 3600 } }),
      fetch(`${origin}/api/weather`, { signal: AbortSignal.timeout(20000), next: { revalidate: 300 } }),
      fetch(`${origin}/api/infrastructure`, { signal: AbortSignal.timeout(20000), next: { revalidate: 86400 } }),
      fetch(`${origin}/api/gdelt`, { signal: AbortSignal.timeout(20000), next: { revalidate: 300 } }),
    ]);

    const parsed = await Promise.all(settled.map(parseJson));
    const [flightsData, satsData, cctvData, weatherData, infraData, gdeltData] = parsed;

    const stats = {
      flights:
        Number.isFinite(Number(flightsData?.counts?.public_total))
          ? Number(flightsData.counts.public_total)
          : (flightsData?.commercial_flights?.length || 0) +
            (flightsData?.private_flights?.length || 0) +
            (flightsData?.private_jets?.length || 0) +
            (flightsData?.military_flights?.length || 0),
      sats: satsData?.satellites?.length || 0,
      cctv: cctvData?.cameras?.length || 0,
      weather: weatherData?.events?.length || weatherData?.weather_events?.length || 0,
      nuclear: infraData?.infrastructure?.length || 0,
      incidents: gdeltData?.events?.length || gdeltData?.gdelt?.length || 0,
    };

    const names = ['flights', 'satellites', 'cctv', 'weather', 'infrastructure', 'gdelt'] as const;
    const sources = Object.fromEntries(
      names.map((name, index) => [name, sourceState(settled[index], parsed[index])]),
    );
    const degraded = Object.values(sources).some((state: any) => !state.ok);

    return NextResponse.json(
      {
        status: degraded ? 'degraded' : 'operational',
        degraded,
        stats,
        sources,
        timestamp: new Date().toISOString(),
      },
      {
        headers: {
          'Cache-Control': 'public, s-maxage=30, stale-while-revalidate=60',
        },
      },
    );
  } catch (error) {
    console.error('Stats aggregation failed:', error instanceof Error ? error.message : error);
    return NextResponse.json(
      {
        status: 'degraded',
        degraded: true,
        stats: emptyStats,
        sources: {},
        timestamp: new Date().toISOString(),
      },
      {
        headers: {
          'Cache-Control': 'public, s-maxage=10, stale-while-revalidate=30',
        },
      },
    );
  }
}
