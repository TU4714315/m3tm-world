import { NextRequest, NextResponse } from 'next/server';
import http from 'node:http';
import https from 'node:https';
import net from 'node:net';
import { isPublicIp, validateHost } from '@/lib/ssrf-guard';

export const dynamic = 'force-dynamic';
export const maxDuration = 15;

/**
 * Camera still-frame proxy. The source allowlist is retained, while every
 * DNS answer is validated and each connection is pinned to a vetted address.
 * Redirect destinations are independently revalidated and TLS is verified.
 */
const ALLOWED_HOSTS = [
  'cdn.skylinewebcams.com',
  'cdn2.skylinewebcams.com',
  's3-eu-west-1.amazonaws.com',
  'voyage.aprr.fr',
  'stream.inmoves.nl',
  'thb.gov.tw',
  'etraffic.dgt.es',
  'eismoinfo.lt',
  'infobanjirjps.selangor.gov.my',
] as const;

const NO_REFERER_HOSTS = ['thb.gov.tw'];
const MAX_BYTES = 3 * 1024 * 1024;
const MAX_REDIRECTS = 3;
const MAX_ADDRESSES = 3;
const TOTAL_TIMEOUT_MS = 12500;

function matchesHost(host: string, domain: string): boolean {
  return host === domain || host.endsWith('.' + domain);
}

export function isAllowedCameraUrl(url: URL): boolean {
  const hostname = url.hostname.toLowerCase();
  return (url.protocol === 'https:' || url.protocol === 'http:')
    && !url.username && !url.password && !url.hash
    && !url.port && !hostname.endsWith('.')
    && url.toString().length <= 2048
    && ALLOWED_HOSTS.some(domain => matchesHost(hostname, domain));
}

/** Accept raster stills only; this also repairs octet-stream JPEG/PNG labels. */
export function imageType(data: Buffer): string | null {
  if (data.length >= 3 && data[0] === 0xff && data[1] === 0xd8 && data[2] === 0xff) return 'image/jpeg';
  if (data.length >= 8 && data.toString('latin1', 0, 8) === '\x89PNG\r\n\x1a\n') return 'image/png';
  if (data.length >= 12 && data.toString('ascii', 0, 4) === 'RIFF' && data.toString('ascii', 8, 12) === 'WEBP') return 'image/webp';
  if (data.length >= 6 && /^(GIF87a|GIF89a)$/.test(data.toString('ascii', 0, 6))) return 'image/gif';
  return null;
}

type Frame = { status: number; data: Buffer; location?: string };

function fetchPinned(target: URL, address: string, deadline: number): Promise<Frame> {
  const family = net.isIP(address);
  if ((family !== 4 && family !== 6) || !isPublicIp(address)) {
    return Promise.reject(new Error('Invalid camera address'));
  }
  const timeout = Math.min(5000, deadline - Date.now());
  if (timeout < 100) return Promise.reject(new Error('Camera request time budget exceeded'));

  const hostname = target.hostname.toLowerCase();
  const headers: Record<string, string> = {
    'Accept': 'image/*,*/*',
    'User-Agent': 'M3TM-WORLD-Camera/1.0',
  };
  if (!NO_REFERER_HOSTS.some(h => matchesHost(hostname, h))) {
    headers.Referer = target.origin + '/';
  }

  return new Promise<Frame>((resolve, reject) => {
    const mod = target.protocol === 'https:' ? https : http;
    const req = mod.get(target, {
      headers,
      timeout,
      maxHeaderSize: 16384,
      // Never resolve DNS again inside the socket: use only an already
      // validated address. Node still uses the original host for TLS/SNI.
      lookup: (_hostname, opts, callback) => {
        const all = typeof opts === 'object' && Boolean(opts.all);
        const value = all ? [{ address, family }] : address;
        (callback as (error: null, result: unknown, addressFamily?: number) => void)(null, value, family);
      },
    }, res => {
      const status = res.statusCode ?? 502;
      const location = res.headers.location;
      if (status >= 300 && status < 400) {
        res.resume();
        resolve({ status, data: Buffer.alloc(0), location });
        return;
      }
      const parts: Buffer[] = [];
      let bytes = 0;
      res.on('data', (chunk: Buffer) => {
        bytes += chunk.length;
        if (bytes > MAX_BYTES) {
          res.destroy(new Error('Camera image exceeds size limit'));
          return;
        }
        parts.push(chunk);
      });
      res.on('end', () => resolve({ status, data: Buffer.concat(parts) }));
      res.on('error', reject);
      res.on('aborted', () => reject(new Error('Camera response interrupted')));
    });
    req.on('error', reject);
    req.on('timeout', () => req.destroy(new Error('Camera request timed out')));
  });
}

async function retrieveImage(firstUrl: URL): Promise<Frame> {
  const deadline = Date.now() + TOTAL_TIMEOUT_MS;
  let current = firstUrl;
  for (let redirect = 0; redirect <= MAX_REDIRECTS; redirect++) {
    if (!isAllowedCameraUrl(current)) throw new Error('Camera destination is not approved');
    const validation = await validateHost(current.hostname);
    if (!validation.ok || !validation.resolved?.length || !validation.resolved.every(isPublicIp)) {
      throw new Error('Camera destination has an unsafe DNS answer');
    }
    // Attempt multiple verified public IPs, but never DNS-re-resolve during a
    // connection. This avoids rebinding while retaining alternate-CDN fallback.
    const addresses = [...new Set(validation.resolved)].slice(0, MAX_ADDRESSES);
    let frame: Frame | undefined;
    let lastError: unknown;
    for (const addr of addresses) {
      try {
        frame = await fetchPinned(current, addr, deadline);
        break;
      } catch (e) {
        lastError = e;
      }
    }
    if (!frame) throw lastError ?? new Error('Camera endpoint unavailable');
    if (frame.status < 300 || frame.status >= 400) return frame;
    if (!frame.location || redirect === MAX_REDIRECTS) throw new Error('Camera redirect limit exceeded');
    current = new URL(frame.location, current);
  }
  throw new Error('Camera redirect limit exceeded');
}

export async function GET(request: NextRequest) {
  const raw = request.nextUrl.searchParams.get('url');
  if (!raw) return NextResponse.json({ error: 'Missing URL' }, { status: 400 });
  let target: URL;
  try { target = new URL(raw); }
  catch { return NextResponse.json({ error: 'Invalid URL' }, { status: 400 }); }
  if (!isAllowedCameraUrl(target)) {
    return NextResponse.json({ error: 'Camera destination forbidden' }, { status: 403 });
  }
  try {
    const frame = await retrieveImage(target);
    if (frame.status < 200 || frame.status >= 300) {
      return NextResponse.json({ error: 'Camera provider unavailable' }, { status: 502 });
    }
    const mime = imageType(frame.data);
    if (!mime) return NextResponse.json({ error: 'Camera did not return a supported image' }, { status: 502 });
    return new NextResponse(new Uint8Array(frame.data), {
      status: 200,
      headers: {
        'Content-Type': mime,
        'X-Content-Type-Options': 'nosniff',
        'Cache-Control': 'public, max-age=5, stale-while-revalidate=10',
        'Access-Control-Allow-Origin': '*',
      },
    });
  } catch (error) {
    console.warn('[M3TM.WORLD] camera frame unavailable:', error instanceof Error ? error.message : 'unknown');
    return NextResponse.json({ error: 'Camera provider unavailable' }, { status: 502 });
  }
}
