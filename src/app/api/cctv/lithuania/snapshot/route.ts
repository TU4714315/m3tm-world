import { NextResponse } from 'next/server';

/**
 * Fixed-host public camera snapshot fetch for Via Lietuva.
 * Never accepts an upstream URL; validates IDs and verifies JPEG bytes.
 * Unlike the legacy generic camera proxy, TLS verification stays enabled
 * and upstream redirects are not followed.
 */
const BASE = 'https://eismoinfo.lt/eismoinfo-backend/image-provider/camera/last';
const ID_PATTERN = /^[A-Za-z0-9_-]{1,48}$/;
const MAX_BYTES = 5_000_000;
export const runtime = 'nodejs';

export async function GET(request: Request) {
  const id = new URL(request.url).searchParams.get('id') || '';
  if (!ID_PATTERN.test(id)) return new Response('Invalid camera ID', { status: 400 });
  const url = new URL(BASE);
  url.searchParams.set('id', id);
  try {
    const response = await fetch(url.toString(), {
      headers: { Referer: 'https://eismoinfo.lt/', Accept: 'image/jpeg' },
      redirect: 'manual', signal: AbortSignal.timeout(8000),
      next: { revalidate: 20 },
    });
    if (!response.ok) return new Response('Frame unavailable', { status: 502, headers: { 'Cache-Control': 'no-store' } });
    const announced = Number(response.headers.get('content-length'));
    if (Number.isFinite(announced) && announced > MAX_BYTES) return new Response('Frame too large', { status: 502 });
    const data = new Uint8Array(await response.arrayBuffer());
    if (data.byteLength > MAX_BYTES || data.byteLength < 4
      || data[0] !== 0xff || data[1] !== 0xd8 || data[2] !== 0xff) {
      return new Response('Invalid frame', { status: 502, headers: { 'Cache-Control': 'no-store' } });
    }
    return new NextResponse(data, { headers: {
      'Content-Type': 'image/jpeg', 'X-Content-Type-Options': 'nosniff',
      'Cache-Control': 'public, s-maxage=20, stale-while-revalidate=20',
    } });
  } catch {
    return new Response('Frame unavailable', { status: 502, headers: { 'Cache-Control': 'no-store' } });
  }
}
