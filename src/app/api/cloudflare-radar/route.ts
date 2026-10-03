import { NextResponse } from 'next/server';
import { centroidFor } from '@/lib/countryCentroids';
import { fetchGdeltEvents, toPublicGdeltEvent } from '@/lib/gdeltEvents';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const RADAR_BASE = 'https://api.cloudflare.com/client/v4/radar';
const FEODO_URL = 'https://feodotracker.abuse.ch/downloads/ipblocklist.json';

type ProviderState = 'active' | 'empty' | 'unavailable' | 'not_used' | 'not_configured';

interface PublicNetworkEvent {
  id: string;
  lat: number;
  lng: number;
  country: string;
  country_name: string;
  scope: string;
  event_type: string;
  cause: string;
  description: string;
  start: string;
  end: string | null;
  ongoing: boolean;
  url: string;
  source: string;
  precision?: string;
}

interface PublicThreatIndicator {
  country: string;
  country_name: string;
  lat: number;
  lng: number;
  share: number;
  observations: number;
  indicator_type: 'observed-c2-infrastructure' | 'cloudflare-layer3-origin-share';
  source: 'abuse.ch Feodo Tracker' | 'Cloudflare Radar';
}

interface RawAnnotation {
  id?: string;
  locations?: string[];
  locationsDetails?: Array<{ code?: string; name?: string }>;
  scope?: string;
  eventType?: string;
  outage?: { outageCause?: string; outageType?: string };
  description?: string;
  startDate?: string;
  endDate?: string | null;
  linkedUrl?: string;
}

interface RawTopLocation {
  originCountryAlpha2?: string;
  clientCountryAlpha2?: string;
  originCountry?: string;
  originCountryName?: string;
  clientCountryName?: string;
  value?: string | number;
}

interface RadarResult {
  annotations?: RawAnnotation[];
  top_0?: RawTopLocation[];
  top0?: RawTopLocation[];
}

function isConfigured() {
  return Boolean(process.env.CLOUDFLARE_API_TOKEN);
}

async function radarFetch(path: string, signal: AbortSignal): Promise<RadarResult> {
  const res = await fetch(`${RADAR_BASE}${path}`, {
    signal,
    cache: 'no-store',
    headers: {
      Authorization: `Bearer ${process.env.CLOUDFLARE_API_TOKEN}`,
      Accept: 'application/json',
    },
  });
  if (!res.ok) throw new Error(`Radar ${path} responded ${res.status}`);
  const json = await res.json();
  if (json?.success === false) {
    const detail = json?.errors?.[0]?.message || 'unknown error';
    throw new Error(`Radar ${path} rejected the request: ${detail}`);
  }
  return json?.result ?? {};
}

function mapCloudflareOutages(result: RadarResult): PublicNetworkEvent[] {
  const out: PublicNetworkEvent[] = [];
  for (const a of result.annotations ?? []) {
    const codes: string[] = Array.isArray(a?.locations) ? a.locations : [];
    const names: Record<string, string> = {};
    for (const d of a?.locationsDetails ?? []) {
      if (d?.code) names[d.code] = d.name ?? d.code;
    }
    for (const code of codes) {
      const c = centroidFor(code);
      if (!c) continue;
      out.push({
        id: `${a?.id ?? 'outage'}-${code}`,
        lng: c[0],
        lat: c[1],
        country: code,
        country_name: names[code] || code,
        scope: a?.scope || '',
        event_type: a?.eventType || 'OUTAGE',
        cause: a?.outage?.outageCause || a?.outage?.outageType || '',
        description: a?.description || '',
        start: a?.startDate || '',
        end: a?.endDate || null,
        ongoing: !a?.endDate,
        url: a?.linkedUrl || '',
        source: 'Cloudflare Radar',
      });
    }
  }
  return out;
}

function mapCloudflareAttackOrigins(result: RadarResult): PublicThreatIndicator[] {
  const out: PublicThreatIndicator[] = [];
  for (const r of result.top_0 ?? result.top0 ?? []) {
    const code = r?.originCountryAlpha2 ?? r?.clientCountryAlpha2 ?? r?.originCountry;
    const c = centroidFor(code);
    if (!c) continue;
    out.push({
      country: String(code).toUpperCase(),
      country_name: r?.originCountryName ?? r?.clientCountryName ?? String(code),
      lng: c[0],
      lat: c[1],
      share: Number(Number(r?.value).toFixed(2)) || 0,
      observations: 0,
      indicator_type: 'cloudflare-layer3-origin-share',
      source: 'Cloudflare Radar',
    });
  }
  return out;
}

async function fetchGdeltNetworkEvents(): Promise<PublicNetworkEvent[]> {
  const { events } = await fetchGdeltEvents({
    quads: [4],
    eventCodePrefixes: ['176'],
    minArticles: 1,
    limit: 120,
  });
  return events.map(event => {
    const e = toPublicGdeltEvent(event);
    return {
      id: `gdelt-cyber-${e.id}`,
      lat: e.lat,
      lng: e.lng,
      country: e.country || '',
      country_name: e.country || e.name || 'موقع منشور',
      scope: 'بلاغ حدث سيبراني منشور',
      event_type: 'REPORTED_CYBER_EVENT',
      cause: 'CAMEO_176',
      description: 'حدث سيبراني مُبلّغ عنه',
      start: e.date,
      end: e.date,
      ongoing: false,
      url: e.url || '',
      source: 'GDELT 2.0 · CAMEO 176',
      precision: e.precision,
    };
  });
}

async function fetchObservedThreatIndicators(signal: AbortSignal): Promise<PublicThreatIndicator[]> {
  const res = await fetch(FEODO_URL, {
    signal,
    cache: 'no-store',
    headers: {
      Accept: 'application/json',
      'User-Agent': 'M3TM.WORLD/1.0 public-network-events',
    },
  });
  if (!res.ok) throw new Error(`Feodo responded ${res.status}`);
  const raw = await res.json();
  const rows = Array.isArray(raw) ? raw : [];
  const counts = new Map<string, number>();

  for (const row of rows) {
    const code = String(row?.country || '').trim().toUpperCase();
    if (!/^[A-Z]{2}$/.test(code) || !centroidFor(code)) continue;
    counts.set(code, (counts.get(code) || 0) + 1);
  }

  const total = Array.from(counts.values()).reduce((sum, count) => sum + count, 0);
  if (!total) return [];

  return Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 35)
    .flatMap(([code, observations]) => {
      const c = centroidFor(code);
      if (!c) return [];
      return [{
        country: code,
        country_name: code,
        lng: c[0],
        lat: c[1],
        share: Number(((observations / total) * 100).toFixed(2)),
        observations,
        indicator_type: 'observed-c2-infrastructure' as const,
        source: 'abuse.ch Feodo Tracker' as const,
      }];
    });
}

const stateFor = (rows: unknown[], failed: boolean): ProviderState =>
  failed ? 'unavailable' : rows.length ? 'active' : 'empty';

async function fetchFallbackSections(wantOutages: boolean, wantAttacks: boolean) {
  const signal = AbortSignal.timeout(20000);
  const [gdeltResult, feodoResult] = await Promise.all([
    wantOutages
      ? fetchGdeltNetworkEvents().then(
          value => ({ ok: true as const, value }),
          () => ({ ok: false as const, value: [] as PublicNetworkEvent[] }),
        )
      : Promise.resolve({ ok: true as const, value: [] as PublicNetworkEvent[] }),
    wantAttacks
      ? fetchObservedThreatIndicators(signal).then(
          value => ({ ok: true as const, value }),
          () => ({ ok: false as const, value: [] as PublicThreatIndicator[] }),
        )
      : Promise.resolve({ ok: true as const, value: [] as PublicThreatIndicator[] }),
  ]);

  return {
    networkEvents: gdeltResult.value,
    threatIndicators: feodoResult.value,
    providers: {
      gdelt: wantOutages ? stateFor(gdeltResult.value, !gdeltResult.ok) : 'not_used' as ProviderState,
      abuse_ch: wantAttacks ? stateFor(feodoResult.value, !feodoResult.ok) : 'not_used' as ProviderState,
    },
    failed: {
      gdelt: wantOutages && !gdeltResult.ok,
      abuse_ch: wantAttacks && !feodoResult.ok,
    },
  };
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const cloudflareConfigured = isConfigured();

  if (searchParams.get('probe') === '1') {
    return NextResponse.json({
      configured: cloudflareConfigured,
      fallback_available: true,
      source: 'Cloudflare Radar',
      fallback_source: 'GDELT 2.0 + abuse.ch Feodo Tracker',
    });
  }

  if (!cloudflareConfigured) {
    const fallback = await fetchFallbackSections(true, true);
    const partial = fallback.failed.gdelt || fallback.failed.abuse_ch;
    return NextResponse.json(
      {
        configured: false,
        fallback_active: true,
        fallback_sections: { outages: true, attacks: true },
        outages: fallback.networkEvents,
        attack_origins: fallback.threatIndicators,
        total_outages: fallback.networkEvents.length,
        total_attack_origins: fallback.threatIndicators.length,
        source: 'GDELT 2.0 + abuse.ch Feodo Tracker',
        source_mode: 'public-fallback',
        cloudflare_status: 'not_configured',
        providers: {
          cloudflare_outages: 'not_configured',
          cloudflare_attacks: 'not_configured',
          ...fallback.providers,
        },
        ...(partial ? { partial: true } : {}),
        timestamp: new Date().toISOString(),
      },
      { headers: { 'Cache-Control': 'public, s-maxage=120, stale-while-revalidate=300' } },
    );
  }

  const signal = AbortSignal.timeout(20000);
  const [outagesRes, attacksRes] = await Promise.all([
    radarFetch('/annotations/outages?limit=50&format=json', signal).then(
      value => ({ ok: true as const, value }),
      () => ({ ok: false as const, value: null }),
    ),
    radarFetch('/attacks/layer3/top/locations/origin?limit=25&format=json', signal).then(
      value => ({ ok: true as const, value }),
      () => ({ ok: false as const, value: null }),
    ),
  ]);

  const useOutageFallback = !outagesRes.ok;
  const useAttackFallback = !attacksRes.ok;
  const fallback = await fetchFallbackSections(useOutageFallback, useAttackFallback);

  const cloudflareOutages = outagesRes.ok ? mapCloudflareOutages(outagesRes.value) : [];
  const cloudflareAttackOrigins = attacksRes.ok ? mapCloudflareAttackOrigins(attacksRes.value) : [];
  const outages = useOutageFallback ? fallback.networkEvents : cloudflareOutages;
  const attack_origins = useAttackFallback ? fallback.threatIndicators : cloudflareAttackOrigins;
  const fallbackActive = useOutageFallback || useAttackFallback;
  const partial =
    useOutageFallback || useAttackFallback || fallback.failed.gdelt || fallback.failed.abuse_ch;

  return NextResponse.json(
    {
      configured: true,
      fallback_active: fallbackActive,
      fallback_sections: { outages: useOutageFallback, attacks: useAttackFallback },
      outages,
      attack_origins,
      total_outages: outages.length,
      total_attack_origins: attack_origins.length,
      source: fallbackActive ? 'Cloudflare Radar + public fallback' : 'Cloudflare Radar',
      source_mode: fallbackActive ? 'mixed' : 'cloudflare-radar',
      cloudflare_status: outagesRes.ok && attacksRes.ok ? 'active' : 'partial',
      providers: {
        cloudflare_outages: outagesRes.ok ? stateFor(cloudflareOutages, false) : 'unavailable',
        cloudflare_attacks: attacksRes.ok ? stateFor(cloudflareAttackOrigins, false) : 'unavailable',
        ...fallback.providers,
      },
      ...(partial ? { partial: true } : {}),
      timestamp: new Date().toISOString(),
    },
    { headers: { 'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600' } },
  );
}
