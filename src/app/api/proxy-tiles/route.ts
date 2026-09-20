import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const url = request.nextUrl.searchParams.get('url');

  if (!url) {
    return NextResponse.json({ error: 'Missing url parameter' }, { status: 400 });
  }

  try {
    // Only allow cartocdn.com domains to prevent open proxy abuse
    const targetUrl = new URL(url);
    const host = targetUrl.hostname.toLowerCase();
    if (host !== 'cartocdn.com' && !host.endsWith('.cartocdn.com')) {
      return NextResponse.json({ error: 'Forbidden domain' }, { status: 403 });
    }

    const response = await fetch(targetUrl.toString(), {
      signal: AbortSignal.timeout(15000),
      headers: {
        'Accept': '*/*',
        'User-Agent': 'Osiris-Tile-Proxy/1.0',
      },
      // No Next fetch-cache: a stalled upstream once stored EMPTY bodies in the
      // persistent cache, so every tile came back 200 with zero bytes and the
      // basemap stayed black. The browser cache below is enough; upstream is
      // re-read only on browser cache miss.
      cache: 'no-store',
    });

    if (!response.ok) {
      return NextResponse.json({ error: 'Failed to fetch tile' }, { status: response.status });
    }

    const data = await response.arrayBuffer();

    // A 200 with an empty body is a failed fetch, not a valid tile.
    if (data.byteLength === 0) {
      return NextResponse.json({ error: 'Empty tile response' }, { status: 502 });
    }

    // Forward the content-type from the upstream response
    const contentType = response.headers.get('content-type') || 'application/octet-stream';

    return new NextResponse(data, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=86400, immutable',
        'Access-Control-Allow-Origin': '*',
      },
    });

  } catch (error) {
    console.error('Tile proxy error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
