import { NextResponse } from 'next/server';

/**
 * Server-side Shodan adapter.
 *
 * - `GET /api/osint/shodan?ip=1.2.3.4`              → host record
 * - `GET /api/osint/shodan?query=apache&type=search` → host search (requires key)
 * - `GET /api/osint/shodan?check=1`                 → key presence BOOLEAN only
 *
 * The API key is read from `process.env.SHODAN_API_KEY` on the server only.
 * It is never returned, logged, or embedded in client bundles. Error responses
 * only ever carry safe, hardcoded messages — never raw fetch errors, which can
 * contain the full upstream URL including the key.
 *
 * Without a key the route falls back to Shodan InternetDB (free, public, no
 * key) and marks the response `configured:false` so the UI can show REQUIRES_KEY
 * honestly.
 *
 * Search notes (per Shodan schema): `/shodan/host/search` returns individual
 * service banners as matches (port/product/data/location at top level), not
 * full host objects. The API has no result-limit parameter, so we fetch the
 * default page and bound the matches LOCALLY to SEARCH_LIMIT. This never
 * changes Shodan credit accounting and only ever runs when the operator
 * explicitly requests a query — no background credit spending.
 */
const INTERNETDB = 'https://internetdb.shodan.io';
const SHODAN_API = 'https://api.shodan.io/shodan';
const SEARCH_LIMIT = 10;

class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

function keyPresent(): boolean {
  return Boolean(process.env.SHODAN_API_KEY?.trim());
}

function shodanKey(): string {
  return (process.env.SHODAN_API_KEY || '').trim();
}

function noStore(): HeadersInit {
  return { 'Cache-Control': 'no-store' };
}

async function internetdbHost(ip: string) {
  const res = await fetch(`${INTERNETDB}/${encodeURIComponent(ip)}`, {
    signal: AbortSignal.timeout(8000),
    cache: 'no-store',
  });

  if (res.status === 404) {
    return {
      ip,
      status: 'No Shodan InternetDB records found',
      ports: [],
      cpes: [],
      hostnames: [],
      tags: [],
      vulns: [],
    };
  }

  if (!res.ok) throw new ApiError(502, 'Shodan InternetDB request failed');
  return res.json();
}

function normalizeVulns(vulns: unknown): string[] {
  if (!vulns) return [];
  if (Array.isArray(vulns)) {
    return vulns
      .map((v) => (typeof v === 'string' ? v : typeof v === 'object' && v ? String((v as any).cve || (v as any).id || '') : ''))
      .filter(Boolean);
  }
  if (typeof vulns === 'object') return Object.keys(vulns);
  return [];
}

/**
 * Host coordinates live in `location.latitude/longitude` per the official
 * schema; some responses also carry top-level latitude/longitude. Accept both.
 */
function hostCoordinates(data: any): { lat: number | null; lng: number | null } {
  const fromLocation =
    data?.location?.latitude != null && data?.location?.longitude != null
      ? { lat: data.location.latitude, lng: data.location.longitude }
      : null;
  const fromTop =
    data?.latitude != null && data?.longitude != null ? { lat: data.latitude, lng: data.longitude } : null;
  return fromLocation || fromTop || { lat: null, lng: null };
}

function normalizeLocation(loc: any) {
  if (!loc) return null;
  return {
    country: loc.country_name || '',
    city: loc.city || '',
    lat: loc.latitude != null ? loc.latitude : null,
    lng: loc.longitude != null ? loc.longitude : null,
    isp: loc.isp || '',
  };
}

/** Full host record normalization (/shodan/host/{ip}). */
function normalizeHost(data: any) {
  const records = Array.isArray(data.data) ? data.data : [];
  const coords = hostCoordinates(data);

  const services = records.map((d: any, index: number) => ({
    port: d.port,
    protocol: d.transport || d._shodan?.module || '',
    service: d.product || '',
    banner: typeof d.data === 'string' ? d.data.slice(0, 400) : '',
    http_title: d.http?.title || null,
    ssl_versions: d.ssl?.versions || [],
    ssl_cert_subject: d.ssl?.cert?.subject || null,
    index,
  }));

  const ports = Array.from(
    new Set(records.map((d: any) => d.port).filter((p: any) => typeof p === 'number'))
  ) as number[];
  ports.sort((a, b) => a - b);

  return {
    ip: data.ip_str || data.ip || '',
    status: 'Shodan host record',
    source: 'shodan-api',
    ports,
    cpes: data.cpes || [],
    hostnames: data.hostnames || [],
    tags: data.tags || [],
    vulns: normalizeVulns(data.vulns),
    os: data.os || '',
    org: data.org || '',
    asn: data.asn || '',
    location: {
      ...(normalizeLocation(data.location) || {}),
      // Host coordinates are surfaced top-level as well, mirroring upstream.
      lat: coords.lat,
      lng: coords.lng,
    },
    timestamp: data.timestamp || data.last_update || null,
    services,
  };
}

/**
 * Search match normalization (/shodan/host/search). Matches are individual
 * service banners: port/product/data/location at top level, not host objects.
 */
function normalizeSearchMatch(m: any, index: number) {
  return {
    ip: m.ip_str || m.ip || '',
    port: m.port ?? null,
    product: m.product || '',
    transport: m.transport || '',
    banner: typeof m.data === 'string' ? m.data.slice(0, 400) : '',
    location: normalizeLocation(m.location),
    timestamp: m.timestamp || null,
    source: 'shodan-api',
    index,
  };
}

async function shodanHost(ip: string) {
  const res = await fetch(`${SHODAN_API}/host/${encodeURIComponent(ip)}?key=${shodanKey()}`, {
    signal: AbortSignal.timeout(10000),
    cache: 'no-store',
  });

  if (res.status === 401) throw new ApiError(401, 'Invalid Shodan API key');
  if (res.status === 403) throw new ApiError(403, 'Shodan access denied');
  if (!res.ok) throw new ApiError(502, 'Shodan API request failed');

  return normalizeHost(await res.json());
}

async function shodanSearch(query: string) {
  // No limit parameter exists on this endpoint; bound matches locally instead.
  const res = await fetch(
    `${SHODAN_API}/host/search?key=${shodanKey()}&query=${encodeURIComponent(query)}`,
    { signal: AbortSignal.timeout(10000), cache: 'no-store' }
  );

  if (res.status === 401) throw new ApiError(401, 'Invalid Shodan API key');
  if (res.status === 403) throw new ApiError(403, 'Shodan access denied');
  if (!res.ok) throw new ApiError(502, 'Shodan API request failed');

  const data = await res.json();
  const all = Array.isArray(data.matches) ? data.matches : [];
  return {
    source: 'shodan-api',
    query,
    total: data.total ?? all.length,
    // Local bound only — does not change Shodan credit accounting.
    matches: all.slice(0, SEARCH_LIMIT).map(normalizeSearchMatch),
  };
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const ip = searchParams.get('ip');
  const query = searchParams.get('query');
  const check = searchParams.get('check');

  try {
    if (check === '1') {
      return NextResponse.json(
        { configured: keyPresent(), source: keyPresent() ? 'shodan-api' : 'internetdb' },
        { headers: noStore() }
      );
    }

    if (query) {
      if (!keyPresent()) {
        return NextResponse.json(
          { error: 'Shodan search requires SHODAN_API_KEY', configured: false, source: 'internetdb' },
          { status: 501, headers: noStore() }
        );
      }
      return NextResponse.json(await shodanSearch(query), { headers: noStore() });
    }

    if (!ip) {
      return NextResponse.json({ error: 'Missing IP parameter' }, { status: 400, headers: noStore() });
    }

    if (keyPresent()) {
      return NextResponse.json(await shodanHost(ip), { headers: noStore() });
    }

    // No key: bounded free InternetDB fallback, explicitly marked.
    const data = await internetdbHost(ip);
    return NextResponse.json({ ...data, source: 'internetdb', configured: false }, { headers: noStore() });
  } catch (error: any) {
    const status = error instanceof ApiError ? error.status : 502;
    // SAFE KNOWN MESSAGES ONLY — raw fetch errors can embed the keyed URL.
    const detail = error instanceof ApiError ? error.message : 'Shodan upstream request failed';
    return NextResponse.json(
      { error: 'Shodan lookup failed', configured: keyPresent(), detail },
      { status, headers: noStore() }
    );
  }
}
