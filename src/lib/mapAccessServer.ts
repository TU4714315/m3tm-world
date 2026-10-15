import { publicMixedMapPayload } from './mapAccessPolicy';
import { archiveMapNews } from './delayedNewsArchive';

const AUTH_URL = 'https://heibzaolhwlzqaweludm.supabase.co/functions/v1/viewer-access';
export type MapGrant = { accessMode: 'guest' | 'member'; expiresAt: string; scope: 'published-map' };
// Validation is shared briefly, never beyond grant expiry. Rotation/revocation
// can take at most 15s for guest grants; member approval is renewed each minute.
const validated = new Map<string, { grant: MapGrant; until: number }>();
const inFlight = new Map<string, Promise<MapGrant | null>>();
function grant(value: unknown): MapGrant | null {
  if (!value || typeof value !== 'object') return null;
  const row = value as Record<string, unknown>;
  if (row.scope !== 'published-map' || !['guest', 'member'].includes(String(row.accessMode))
    || typeof row.expiresAt !== 'string' || Date.parse(row.expiresAt) <= Date.now()
    || !Number.isFinite(Date.parse(row.expiresAt))) return null;
  return { scope: 'published-map', accessMode: row.accessMode as MapGrant['accessMode'], expiresAt: row.expiresAt };
}
export async function mapAuthority(body: Record<string, unknown>) {
  const key = process.env.M3TM_APP_SUPABASE_ANON_KEY;
  if (!key) return null;
  try {
    const response = await fetch(AUTH_URL, { method: 'POST', redirect: 'error', cache: 'no-store',
      signal: AbortSignal.timeout(8000), headers: { 'Content-Type': 'application/json', apikey: key,
        Authorization: `Bearer ${key}` }, body: JSON.stringify(body) });
    if (!response.ok) return null;
    return await response.json() as Record<string, unknown>;
  } catch { return null; }
}
export async function authorizeMapRequest(request: Request): Promise<MapGrant | null> {
  const local = ['localhost', '127.0.0.1'].includes(new URL(request.url).hostname);
  const cookieName = local ? 'm3tm-map-access' : '__Host-m3tm-map-access';
  const cookie = request.headers.get('cookie')?.split(';').map(item => item.trim()).find(item => item.startsWith(`${cookieName}=`))?.slice(cookieName.length + 1);
  const credential = request.headers.get('authorization') || (cookie ? `Bearer ${cookie}` : '');
  const token = /^Bearer ([A-Za-z0-9_.-]{40,2048})$/.exec(credential)?.[1];
  if (!token) return null;
  // Cache key is a hash, never invitation code, member JWT, or plaintext grant.
  const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token));
  const key = Array.from(new Uint8Array(hash), b => b.toString(16).padStart(2, '0')).join('');
  const cached = validated.get(key);
  if (cached && cached.until > Date.now()) return cached.grant;
  if (inFlight.has(key)) return inFlight.get(key)!;
  if (inFlight.size >= 128) return null;
  const check = (async () => {
    const result = grant(await mapAuthority({ action: 'map-check', token }));
    if (result) {
      if (validated.size >= 500) validated.delete(validated.keys().next().value!);
      validated.set(key, { grant: result, until: Math.min(Date.now() + 15_000, Date.parse(result.expiresAt)) });
    } else validated.delete(key);
    return result;
  })();
  inFlight.set(key, check);
  try { return await check; } finally { inFlight.delete(key); }
}
export const mapPrivateHeaders = { 'Cache-Control': 'private, no-store, max-age=0', 'Vary': 'Authorization, Cookie', 'Pragma': 'no-cache' };

/** Set final response headers even when a provider selects cache TTL dynamically. */
export function withRestrictedMapResponse<Args extends unknown[]>(handler: (...args: Args) => Promise<Response>) {
  return async (...args: Args): Promise<Response> => {
    const response = await handler(...args);
    const headers = new Headers(response.headers);
    Object.entries(mapPrivateHeaders).forEach(([key, value]) => headers.set(key, value));
    return new Response(response.body, { status: response.status, headers });
  };
}

/** Applied after provider caches; authorized responses can never enter a CDN. */
export function withMixedMapPolicy(kind: 'news' | 'flights' | 'satellites' | 'maritime', handler: (request: Request) => Promise<Response>) {
  return async (request: Request = new Request('https://m3tm-world.vercel.app/api/')) => {
    const access = await authorizeMapRequest(request);
    const response = await handler(request);
    const headers = new Headers(response.headers);
    headers.delete('content-length'); headers.delete('etag');
    Object.entries(mapPrivateHeaders).forEach(([key, value]) => headers.set(key, value));
    if (!response.ok) return new Response(response.body, { status: response.status, headers });
    try {
      const body = await response.json();
      const news = kind === 'news' ? await archiveMapNews(body.news) : null;
      const stillAllowed = access && await authorizeMapRequest(request);
      const visible = stillAllowed ? body : publicMixedMapPayload(kind, kind === 'news' ? { ...body, news } : body);
      return Response.json(visible, { status: response.status, headers });
    } catch { return Response.json({ error: 'map_unavailable' }, { status: 503, headers: mapPrivateHeaders }); }
  };
}
