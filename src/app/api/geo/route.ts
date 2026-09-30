import { NextResponse } from 'next/server';
import { visitorIp } from '@/lib/ssrf-guard';

const NO_STORE = { 'Cache-Control': 'private, no-store' };

type GeoReply = {
  status: 'success' | 'unavailable';
  lat?: number;
  lon?: number;
  city?: string;
  regionName?: string;
  country?: string;
  reason?: string;
};

function success(lat: unknown, lon: unknown, city: unknown, region: unknown, country: unknown): GeoReply | null {
  const latitude = Number(lat);
  const longitude = Number(lon);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude) || Math.abs(latitude) > 90 || Math.abs(longitude) > 180) return null;
  return {
    status: 'success',
    lat: latitude,
    lon: longitude,
    city: typeof city === 'string' ? city : '',
    regionName: typeof region === 'string' ? region : '',
    country: typeof country === 'string' ? country : '',
  };
}

// Server-side proxy for coarse visitor geolocation. The public response omits
// the visitor IP, ASN, ISP and organization because the map only needs a city
// coordinate for its optional fly-in.
export async function GET(request: Request) {
  try {
    const ip = visitorIp(request) ?? '';

    // Never ask a provider to auto-detect the server in production when the
    // visitor address is unavailable; that would mislocate every such visitor.
    if (!ip && process.env.NODE_ENV === 'production') {
      return NextResponse.json({ status: 'unavailable', reason: 'Visitor address unknown' } satisfies GeoReply, { headers: NO_STORE });
    }

    try {
      const url = ip ? `https://ipapi.co/${ip}/json/` : 'https://ipapi.co/json/';
      const res = await fetch(url, {
        signal: AbortSignal.timeout(5000),
        cache: 'no-store',
        headers: { 'User-Agent': 'M3TM-WORLD/1.0 (+https://m3tm.world)' },
      });
      if (res.ok) {
        const d = await res.json();
        const body = !d.error && success(d.latitude, d.longitude, d.city, d.region, d.country_name);
        if (body) return NextResponse.json(body, { headers: NO_STORE });
      }
    } catch { /* fall through */ }

    try {
      const url = ip ? `https://freeipapi.com/api/json/${ip}` : 'https://freeipapi.com/api/json';
      const res = await fetch(url, { signal: AbortSignal.timeout(5000), cache: 'no-store' });
      if (res.ok) {
        const d = await res.json();
        const body = success(d.latitude, d.longitude, d.cityName, d.regionName, d.countryName);
        if (body) return NextResponse.json(body, { headers: NO_STORE });
      }
    } catch { /* fall through */ }

    try {
      const url = ip
        ? `http://ip-api.com/json/${ip}?fields=status,lat,lon,city,regionName,country`
        : 'http://ip-api.com/json/?fields=status,lat,lon,city,regionName,country';
      const res = await fetch(url, { signal: AbortSignal.timeout(5000), cache: 'no-store' });
      if (res.ok) {
        const d = await res.json();
        const body = d.status === 'success' && success(d.lat, d.lon, d.city, d.regionName, d.country);
        if (body) return NextResponse.json(body, { headers: NO_STORE });
      }
    } catch { /* fall through */ }

    return NextResponse.json({ status: 'unavailable', reason: 'Geolocation providers unavailable' } satisfies GeoReply, { headers: NO_STORE });
  } catch (error) {
    console.warn('[M3TM.WORLD] Geolocation unavailable:', error instanceof Error ? error.message : error);
    return NextResponse.json({ status: 'unavailable', reason: 'Geolocation unavailable' } satisfies GeoReply, { headers: NO_STORE });
  }
}
