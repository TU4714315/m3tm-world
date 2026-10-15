import { afterEach, describe, expect, it, vi } from 'vitest';
import { POST, GET, DELETE } from './route';
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });
const post = (body: unknown) => new Request('https://map.test/api/map-access', { method:'POST', headers:{'content-type':'application/json'}, body:JSON.stringify(body) });
describe('map invitation exchange', () => {
  it('accepts only authority-confirmed grants and stores a scoped HttpOnly partitioned session', async () => {
    vi.stubEnv('M3TM_APP_SUPABASE_ANON_KEY','public-test-key');
    const accessToken='s'.repeat(80);
    const fetcher=vi.fn<typeof fetch>().mockImplementation(async () => Response.json({scope:'published-map',accessToken,accessMode:'guest',expiresAt:new Date(Date.now()+60000).toISOString()}));
    vi.stubGlobal('fetch',fetcher);
    const response=await POST(post({code:'A'.repeat(24)}));
    expect(response.status).toBe(200);
    expect(response.headers.get('set-cookie')).toMatch(/__Host-m3tm-map-access=.*HttpOnly.*Secure.*Partitioned/);
    expect(response.headers.get('set-cookie')).not.toContain('A'.repeat(24));
    expect(fetcher.mock.calls[0][0]).not.toContain('?');
    expect(response.headers.get('cache-control')).toContain('no-store');
  });
  it('refuses client-supplied roles, arbitrary member JWTs, ambiguous credentials and expired authority results', async () => {
    expect((await POST(post({role:'owner',memberToken:'a'.repeat(80)}))).status).toBe(400);
    expect((await POST(post({code:'A'.repeat(24),accessToken:'t'.repeat(80)}))).status).toBe(400);
    vi.stubEnv('M3TM_APP_SUPABASE_ANON_KEY','public-test-key');
    vi.stubGlobal('fetch',vi.fn(async () => Response.json({scope:'published-map',accessToken:'q'.repeat(80),accessMode:'member',expiresAt:'2020-01-01'})));
    expect((await POST(post({accessToken:'q'.repeat(80)}))).status).toBe(403);
  });
  it('does not resume an anonymous session and deletes the scoped cookie', async () => {
    expect((await GET(new Request('https://map.test/api/map-access'))).status).toBe(403);
    const response=await DELETE(new Request('https://map.test/api/map-access', {method:'DELETE'}));
    expect(response.headers.get('set-cookie')).toContain('Max-Age=0');
  });
});
