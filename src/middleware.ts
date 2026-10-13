import { NextResponse } from 'next/server';
import type { NextRequest, NextFetchEvent } from 'next/server';

export function middleware(request: NextRequest, event: NextFetchEvent) {
  const url = request.nextUrl.pathname;

  /* Owner decision: public WORLD map is paused while graphics and upstream
     source reliability are being corrected. This is an HTTP gate, not a
     front-end overlay: direct Render/Vercel URLs must not bypass it.
     Keep /api/health and /api/news reachable for operational checks and APP.
     An explicit production environment switch is required to reopen it. */
  if (url === '/' && process.env.M3TM_WORLD_PUBLIC_MAP_ENABLED !== 'true') {
    const html = `<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow"><title>M3TM | تحسين الخدمة</title><style>*{box-sizing:border-box}body{min-height:100vh;margin:0;display:grid;place-items:center;background:radial-gradient(circle at 50% 15%,#302513,#080d19 52%,#03060c);font:16px system-ui,-apple-system,Segoe UI,sans-serif;color:#f3e7d1;text-align:center;padding:24px}main{max-width:600px}strong{display:block;font-size:clamp(40px,9vw,70px);letter-spacing:.22em;color:#f6d892}h1{font-size:clamp(21px,4vw,30px)}p{line-height:2;color:#ccd3dd}a{display:inline-block;margin-top:16px;border:1px solid #b39854;border-radius:8px;padding:12px 20px;color:#f6d892;text-decoration:none}</style></head><body><main><strong dir="ltr">M3TM</strong><h1>صيانة مؤقتة لتحسين خدمة الخريطة</h1><p>نعمل على تحسين السرعة والتحقق من تحديث البيانات قبل إعادة إتاحة الخريطة العامة.</p><a href="https://m3tm.app/news">الأخبار العامة</a></main></body></html>`;
    return new NextResponse(html, {
      status: 503,
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'no-store, max-age=0',
        'Retry-After': '300',
        'X-M3TM-Public-Map': 'maintenance',
        'X-Robots-Tag': 'noindex, nofollow',
        'Referrer-Policy': 'strict-origin-when-cross-origin',
      },
    });
  }
  
  const protectedOsint = url === '/api/scanner' || url.startsWith('/api/osint/') || url.startsWith('/api/tools/');
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
    '/api/osint/:path*',
    '/api/tools/:path*',
    '/api/scanner',
    '/((?!api|_next/static|_next/image|vendor|favicon.ico|sitemap.xml|robots.txt|.*\\.(?:svg|png|jpg|jpeg|gif|webp|mjs|js|css|json|pbf|mvt|woff|woff2|ico|txt)$).*)',
  ],
}
