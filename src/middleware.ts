import { NextResponse } from 'next/server';
import type { NextRequest, NextFetchEvent } from 'next/server';
import { restrictedMapEndpoint, temporaryPublicMapEndpoint } from './lib/mapAccessPolicy';
import { authorizeMapRequest, mapPrivateHeaders } from './lib/mapAccessServer';

export async function middleware(request: NextRequest, event: NextFetchEvent) {
  const url = request.nextUrl.pathname;

  const sdkPublisher = url === '/api/sdk/ingest' && request.method === 'POST';
  // The ingestion route retains its dedicated body API-key check. Viewing
  // grants never authorize raw SDK stores, enrichment, analysis, or writes.
  if (sdkPublisher) return NextResponse.next();
  const protectedOsint = url === '/api/scanner' || url.startsWith('/api/osint/') || url.startsWith('/api/tools/')
    || url.startsWith('/api/sdk/') || url.startsWith('/api/entity/') || url.startsWith('/api/ai/') || url === '/api/astra';
  if (protectedOsint) {
    const expectedToken = process.env.M3TM_WORLD_INTERNAL_TOOLS_TOKEN;
    const explicitlyEnabled = process.env.M3TM_WORLD_INTERNAL_TOOLS_ENABLED === 'true';
    const authorization = request.headers.get('authorization') || '';
    const bearer = authorization.startsWith('Bearer ') ? authorization.slice(7) : '';
    const providedToken = request.headers.get('x-m3tm-internal-token') || bearer;
    const authorized = explicitlyEnabled && Boolean(expectedToken) && providedToken === expectedToken;

    if (!authorized) {
      return NextResponse.json(
        {
          error: 'internal_only',
          message: 'OSINT tools are available only through the authorized M3TM.APP internal portal.',
        },
        {
          status: 403,
          headers: { 'Cache-Control': 'no-store, max-age=0' },
        },
      );
    }
    return NextResponse.next();
  }

  if (url.startsWith('/api/')) {
    if (restrictedMapEndpoint(url)) {
      const scheduler = process.env.WORLD_MAP_REFRESH_TOKEN;
      const refreshOnly = url === '/api/reference-atlas' && scheduler && scheduler.length >= 32
        && request.headers.get('authorization') === `Bearer ${scheduler}`;
      if (!temporaryPublicMapEndpoint(url, request.method) && !refreshOnly && !await authorizeMapRequest(request)) {
        return NextResponse.json({ error: 'map_access_required' }, { status: 403, headers: mapPrivateHeaders });
      }
      const response = NextResponse.next();
      Object.entries(mapPrivateHeaders).forEach(([key, value]) => response.headers.set(key, value));
      return response;
    }
    return NextResponse.next();
  }

  const ip = request.headers.get('cf-connecting-ip') || request.headers.get('x-forwarded-for') || '127.0.0.1';
  const userAgent = request.headers.get('user-agent') || 'Unknown OSIRIS Client';
  
  const basePayload = {
    hostname: request.nextUrl.hostname,
    language: "en-US",
    referrer: request.headers.get('referer') || "",
    screen: "1920x1080",
    title: "OSIRIS",
    url: url,
    website: process.env.UMAMI_WEBSITE_ID || "cd8f216c-fc3f-45f5-ba1a-e10309a61d18"
  };

  /* Bounded, because these are fire-and-forget analytics on the critical path.
     `umami-umami-1` only resolves inside the production compose network; on a
     developer's machine it is ENOTFOUND, and two unbounded requests per page
     view accumulated against the shared connection pool until the app's own
     API routes could not get a socket. The CCTV route would then time out
     region after region and the map came up half empty — the analytics were
     starving the thing they were measuring. */
  const pageView = fetch('http://umami-umami-1:3000/api/send', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'User-Agent': userAgent, 'x-forwarded-for': ip },
    body: JSON.stringify({ payload: basePayload, type: "event" }),
    signal: AbortSignal.timeout(2000),
  }).catch(() => {});

  const ipEvent = fetch('http://umami-umami-1:3000/api/send', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'User-Agent': userAgent, 'x-forwarded-for': ip },
    body: JSON.stringify({
      payload: { ...basePayload, name: "Network Log", data: { IP: ip } },
      type: "event"
    }),
    signal: AbortSignal.timeout(2000),
  }).catch(() => {});

  event.waitUntil(Promise.all([pageView, ipEvent]));

  return NextResponse.next();
}

/* Assets are excluded, not just pages. MapLibre 6 loads its worker from
   /vendor/maplibre/<version>/ at runtime, and the basemap style from
   /dark-matter-style.json — neither is under _next/static, so both used to
   match here and pay two umami round trips before the map could start. That is
   the same starvation that 2f375dd fixed for the CCTV routes, moved onto the
   map's critical path. Analytics wants page views; asset fetches are not one. */
export const config = {
  matcher: [
    '/api/:path*',
    '/api/osint/:path*',
    '/api/tools/:path*',
    '/api/scanner',
    '/((?!api|_next/static|_next/image|vendor|favicon.ico|sitemap.xml|robots.txt|.*\\.(?:svg|png|jpg|jpeg|gif|webp|mjs|js|css|json|pbf|mvt|woff|woff2|ico|txt)$).*)',
  ],
}
