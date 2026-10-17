import { authorizeMapRequest, mapAuthority, mapPrivateHeaders } from '@/lib/mapAccessServer';

export const dynamic = 'force-dynamic';
function sessionCookie(request: Request, token: string, expiry = 0) {
  const local = ['localhost', '127.0.0.1'].includes(new URL(request.url).hostname);
  const age = Math.max(0, Math.floor((expiry - Date.now()) / 1000));
  return `${local ? 'm3tm-map-access' : '__Host-m3tm-map-access'}=${token}; Path=/; HttpOnly; Max-Age=${age}; ${local ? 'SameSite=Lax' : 'SameSite=None; Secure; Partitioned'}`;
}
export async function GET(request: Request) {
  const access = await authorizeMapRequest(request);
  return Response.json(access || { error: 'access_denied' }, { status: access ? 200 : 403, headers: mapPrivateHeaders });
}
export async function DELETE(request: Request) {
  return Response.json({ cleared: true }, { headers: { ...mapPrivateHeaders, 'Set-Cookie': sessionCookie(request, '') } });
}
export async function POST(request: Request) {
  if (new URL(request.url).search || !request.headers.get('content-type')?.startsWith('application/json'))
    return Response.json({ error: 'invalid_request' }, { status: 400, headers: mapPrivateHeaders });
  // Read a bounded stream, including chunked requests without content-length.
  const reader = request.body?.getReader();
  if (!reader) return Response.json({ error: 'invalid_request' }, { status: 400, headers: mapPrivateHeaders });
  let text = ''; let length = 0;
  const decoder = new TextDecoder();
  while (true) {
    const chunk = await reader.read(); if (chunk.done) break;
    length += chunk.value.length;
    if (length > 8192) { await reader.cancel(); return Response.json({ error: 'invalid_request' }, { status: 413, headers: mapPrivateHeaders }); }
    text += decoder.decode(chunk.value, { stream: true });
  }
  let body: Record<string, unknown>;
  try { body = JSON.parse(text); } catch { return Response.json({ error: 'invalid_request' }, { status: 400, headers: mapPrivateHeaders }); }
  if (!body || typeof body !== 'object' || Array.isArray(body)) return Response.json({ error: 'invalid_request' }, { status: 400, headers: mapPrivateHeaders });
  const code = typeof body.code === 'string' && /^[A-Fa-f0-9]{24}$/.test(body.code) ? body.code : null;
  const token = typeof body.accessToken === 'string' && /^[A-Za-z0-9_.-]{40,2048}$/.test(body.accessToken) ? body.accessToken : null;
  if ((!code && !token) || (code && token)) return Response.json({ error: 'invalid_request' }, { status: 400, headers: mapPrivateHeaders });
  const result: Record<string, unknown> | null = token
    ? await mapAuthority({ action: 'map-check', token }).then(value => value ? { ...value, accessToken: token } : null)
    : await mapAuthority({ action: 'map-access', code });
  if (!result || result.scope !== 'published-map' || typeof result.accessToken !== 'string' || result.accessToken.length > 2048
    || !['guest', 'member'].includes(String(result.accessMode)) || typeof result.expiresAt !== 'string'
    || !Number.isFinite(Date.parse(result.expiresAt)) || Date.parse(result.expiresAt) <= Date.now())
    return Response.json({ error: 'access_denied' }, { status: 403, headers: mapPrivateHeaders });
  return Response.json({ accessToken: result.accessToken, expiresAt: result.expiresAt, accessMode: result.accessMode },
    { headers: { ...mapPrivateHeaders, 'Set-Cookie': sessionCookie(request, result.accessToken, Date.parse(result.expiresAt)) } });
}
