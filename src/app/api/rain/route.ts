import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

/**
 * OSIRIS — the rain radar frames for the Rain layer: the last two hours,
 * oldest first, a frame every ten minutes.
 * Source: RainViewer's public radar mosaic — no key. The browser pulls the
 * tiles straight from RainViewer's cache; RainBar builds their addresses.
 */

const TTL_MS = 2 * 60 * 1000;
const MAX_BODY_BYTES = 128 * 1024;
const TILE_ORIGIN = 'https://tilecache.rainviewer.com';
const PATH = /^\/v2\/radar\/[0-9a-z]+$/i;

type Body = { host: string; frames: { time: number; path: string }[] };
let cached: { body: Body; expiresAt: number } | null = null;
let loading: Promise<void> | null = null;

async function readMaps(response: Response): Promise<unknown> {
  if (Number(response.headers.get('content-length')) > MAX_BODY_BYTES || !response.body) throw new Error('Radar index too large');
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > MAX_BODY_BYTES) throw new Error('Radar index too large');
      chunks.push(value);
    }
  } catch (error) { await reader.cancel().catch(() => {}); throw error; }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  return JSON.parse(new TextDecoder().decode(bytes));
}

export async function GET() {
  if (!cached || Date.now() > cached.expiresAt) {
    loading ??= (async () => {
      const res = await fetch('https://api.rainviewer.com/public/weather-maps.json', {
        signal: AbortSignal.timeout(10_000),
        cache: 'no-store',
        redirect: 'error',
      });
      if (!res.ok) throw new Error(`RainViewer ${res.status}`);
      const maps = await readMaps(res) as { host?: unknown; radar?: { past?: unknown } };
      const url = typeof maps?.host === 'string' ? new URL(maps.host) : null;
      if (!url || url.origin !== TILE_ORIGIN || url.username || url.password || url.pathname !== '/' || url.search || url.hash) throw new Error('Radar tile host rejected');
      const frames = (Array.isArray(maps?.radar?.past) ? maps.radar.past.slice(-24) : [])
        .filter((f: { time?: unknown; path?: unknown }) => typeof f?.time === 'number' && Number.isSafeInteger(f.time) && f.time > 0 && f.time * 1000 <= Date.now() + 10 * 60_000 && typeof f?.path === 'string' && f.path.length <= 80 && PATH.test(f.path))
        .map((f: { time: number; path: string }) => ({ time: f.time * 1000, path: f.path }))
        .sort((a: { time: number }, b: { time: number }) => a.time - b.time);
      if (!frames.length) throw new Error('RainViewer: no radar frames');
      cached = { body: { host: TILE_ORIGIN, frames }, expiresAt: Date.now() + TTL_MS };
    })().finally(() => { loading = null; });
    try {
      await loading;
    } catch (e) {
      console.warn('[OSIRIS] rain:', e);
      if (!cached) return NextResponse.json({ error: 'Rain radar unavailable' }, { status: 502 });
    }
  }
  const result = cached;
  if (!result) return NextResponse.json({ error: 'Rain radar unavailable' }, { status: 502 });
  return NextResponse.json({ ...result.body, stale: Date.now() > result.expiresAt }, { headers: { 'Cache-Control': 'public, max-age=60' } });
}
