import { afterEach, describe, expect, it, vi } from 'vitest';
import { authorizeMapRequest, withMixedMapPolicy } from './mapAccessServer';
vi.mock('./delayedNewsArchive', () => ({ archiveMapNews: async (news: unknown) => news }));
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); vi.useRealTimers(); });
const request = (token?: string) => new Request('https://m3tm-world.vercel.app/api/news', { headers: token ? { Authorization:`Bearer ${token}` } : {} });
describe('server map authority', () => {
  it('fails closed for query flags, arbitrary headers, and missing authority configuration', async () => {
    vi.stubEnv('M3TM_APP_SUPABASE_ANON_KEY','');
    expect(await authorizeMapRequest(new Request('https://map.test/api/conflicts?surface=internal&code=accepted', { headers:{'x-role':'owner'} }))).toBeNull();
    expect(await authorizeMapRequest(request('a'.repeat(80)))).toBeNull();
  });
  it('revalidates signed-grant authority within 15 seconds and stops on revocation', async () => {
    vi.useFakeTimers(); vi.setSystemTime(new Date('2026-10-15T10:00:00Z'));
    vi.stubEnv('M3TM_APP_SUPABASE_ANON_KEY','public-test-key');
    const fetcher = vi.fn().mockResolvedValueOnce(Response.json({ scope:'published-map', accessMode:'guest', expiresAt:'2026-10-16T10:00:00Z' }))
      .mockResolvedValueOnce(Response.json({error:'revoked'}, {status:403}));
    vi.stubGlobal('fetch',fetcher);
    const req=request('b'.repeat(80));
    expect((await authorizeMapRequest(req))?.accessMode).toBe('guest');
    expect((await authorizeMapRequest(req))?.scope).toBe('published-map');
    expect(fetcher).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(15_001);
    expect(await authorizeMapRequest(req)).toBeNull();
    expect(fetcher).toHaveBeenCalledTimes(2);
  });
  it('does not cache beyond member expiry and rejects incomplete authority payloads', async () => {
    vi.useFakeTimers(); vi.setSystemTime(new Date('2026-10-15T10:00:00Z'));
    vi.stubEnv('M3TM_APP_SUPABASE_ANON_KEY','public-test-key');
    vi.stubGlobal('fetch',vi.fn().mockResolvedValueOnce(Response.json({scope:'published-map', accessMode:'member', expiresAt:'2026-10-15T10:00:01Z'}))
      .mockResolvedValue(Response.json({accessMode:'owner', expiresAt:'2099-01-01'})));
    const req=request('c'.repeat(80));
    expect((await authorizeMapRequest(req))?.accessMode).toBe('member');
    vi.advanceTimersByTime(1001);
    expect(await authorizeMapRequest(req)).toBeNull();
  });
  it('publishes current news without a grant and forbids CDN reuse', async () => {
    const handler = withMixedMapPolicy('news', async () => Response.json({ news:[{title:'restricted-title',published:new Date().toISOString()}] },
      { headers:{'Cache-Control':'public, s-maxage=86400'} }));
    const response=await handler(request());
    expect(response.headers.get('cache-control')).toContain('no-store');
    expect(response.headers.get('vary')).toBe('Authorization, Cookie');
    expect(await response.text()).toContain('restricted-title');
  });
});
