import { NextResponse } from 'next/server';
import { centroidFor } from '@/lib/countryCentroids';
import { fetchGdeltEvents, toPublicGdeltEvent } from '@/lib/gdeltEvents';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/**
 * Public network-event feed.
 *
 * Preferred provider: Cloudflare Radar, when CLOUDFLARE_API_TOKEN is injected
 * server-side with Radar: Read.
 *
 * Public fallback when that credential is not available:
 *   - GDELT 2.0 CAMEO 176 records: source-reported cyber attacks / hostile
 *     network shutdown events with generalized ActionGeo coordinates.
 *   - abuse.ch Feodo Tracker: country-level aggregate of observed C2
 *     infrastructure. No IPs are returned to this layer and the country is NOT
 *     asserted to be the attacker's origin.
 *
 * Provider state remains explicit in the payload so the UI never labels
 * fallback data as Cloudflare data.
 */

const RADAR_BASE = 'https://api.cloudflare.com/client/v4/radar';
const FEODO_URL = 'https://feodotracker.abuse.ch/downloads/ipblocklist.json';

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
  /** Percentage of currently observed Feodo rows in this country. */
  share: number;
  observations: number;
  indicator_type: 'observed-c2-infrastructure';
  source: 'abuse.ch Feodo Tracker';
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

interface FallbackResult {
  networkEvents: PublicNetworkEvent[];
  threatIndicators: PublicThreatIndicator[];
  providers: {
    gdelt: 'active' | 'empty' | 'unavailable';
    abuse_ch: 'active' | 'empty' | 'unavailable';
  };
  errors: string[];
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
  const annotations = result?.annotations ?? [];
  const out: PublicNetworkEvent[] = [];

  for (const a of annotations) {
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
  const rows = result?.top_0 ?? result?.top0 ?? [];
  const out: PublicThreatIndicator[] = [];

  for (const r of rows) {
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
      indicator_type: 'observed-c2-infrastructure',
      source: 'abuse.ch Feodo Tracker',
    });
  }
  return out;
}

async function fetchGdeltNetworkEvents(): Promise<PublicNetworkEvent[]> {
  const { events } = await fetchGdeltEvents({ quads: [4], minArticles: 1, limit: 2000 });
  return events
    .filter(event => String(event.event_code || '').startsWith('176'))
    .slice(0, 120)
    .map(event => {
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
        description: e.event_label_ar || 'هجوم سيبراني مُبلّغ عنه',
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

async function fetchPublicFallback(): Promise<FallbackResult> {
  const signal = AbortSignal.timeout(20000);
  const [gdeltRes, feodoRes] = await Promise.allSettled([
    fetchGdeltNetworkEvents(),
    fetchObservedThreatIndicators(signal),
  ]);

  const networkEvents = gdeltRes.status === 'fulfilled' ? gdeltRes.value : [];
  const threatIndicators = feodoRes.status === 'fulfilled' ? feodoRes.value : [];
  const errors: string[] = [];

  if (gdeltRes.status === 'rejected') errors.push('gdelt unavailable');
  if (feodoRes.status === 'rejected') errors.push('abuse.ch unavailable');

  return {
    networkEvents,
    threatIndicators,
    providers: {
      gdelt: gdeltRes.status === 'rejected' ? 'unavailable' : networkEvents.length ? 'active' : 'empty',
      abuse_ch: feodoRes.status === 'rejected' ? 'unavailable' : threatIndicators.length ? 'active' : 'empty',
    },
    errors,
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

  const fallbackPromise = fetchPublicFallback();

  if (!cloudflareConfigured) {
    const fallback = await fallbackPromise;
    return NextResponse.json(
      {
        configured: false,
        fallback_active: true,
        outages: fallback.networkEvents,
        attack_origins: fallback.threatIndicators,
        total_outages: fallback.networkEvents.length,
        total_attack_origins: fallback.threatIndicators.length,
        source: 'GDELT 2.0 + abuse.ch Feodo Tracker',
        source_mode: 'public-fallback',
        cloudflare_status: 'not_configured',
        providers: fallback.providers,
        ...(fallback.errors.length ? { partial: true, errors: fallback.errors } : {}),
        timestamp: new Date().toISOString(),
      },
      { headers: { 'Cache-Control': 'public, s-maxage=120, stale-while-revalidate=300' } }
    );
  }

  const signal = AbortSignal.timeout(20000);
  const [outagesRes, attacksRes, fallback] = await Promise.all([
    radarFetch('/annotations/outages?limit=50&format=json', signal).then(
      value => ({ ok: true as const, value }),
      () => ({ ok: false as const, value: null })
    ),
    radarFetch('/attacks/layer3/top/locations/origin?limit=25&format=json', signal).then(
      value => ({ ok: true as const, value }),
      () => ({ ok: false as const, value: null })
    ),
    fallbackPromise,
  ]);

  const cloudflareOutages = outagesRes.ok ? mapCloudflareOutages(outagesRes.value) : [];
  const cloudflareAttackOrigins = attacksRes.ok ? mapCloudflareAttackOrigins(attacksRes.value) : [];

  const useOutageFallback = !outagesRes.ok;
  const useAttackFallback = !attacksRes.ok;
  const outages = useOutageFallback ? fallback.networkEvents : cloudflareOutages;
  const attack_origins = useAttackFallback ? fallback.threatIndicators : cloudflareAttackOrigins;
  const fallbackActive = useOutageFallback || useAttackFallback;

  return NextResponse.json(
    {
      configured: true,
      fallback_active: fallbackActive,
      outages,
      attack_origins,
      total_outages: outages.length,
      total_attack_origins: attack_origins.length,
      source: fallbackActive ? 'Cloudflare Radar + public fallback' : 'Cloudflare Radar',
      source_mode: fallbackActive ? 'mixed' : 'cloudflare-radar',
      cloudflare_status: outagesRes.ok && attacksRes.ok ? 'active' : 'partial',
      providers: {
        cloudflare_outages: outagesRes.ok ? 'active' : 'unavailable',
        cloudflare_attacks: attacksRes.ok ? 'active' : 'unavailable',
        ...(fallbackActive ? fallback.providers : {}),
      },
      ...(fallbackActive ? { partial: true } : {}),
      timestamp: new Date().toISOString(),
    },
    { headers: { 'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600' } }
  );
}
