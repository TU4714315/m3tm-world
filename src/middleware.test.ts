import { afterEach, describe, expect, it, vi } from 'vitest';
import { readdirSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { config, middleware } from './middleware';
import { NextRequest } from 'next/server';
import { version as maplibreVersion } from 'maplibre-gl/package.json';

const vendorDir = fileURLToPath(new URL('../public/vendor/maplibre/', import.meta.url));
const workerPath = `/vendor/maplibre/${maplibreVersion}/maplibre-gl-worker.mjs`;

/* PR #330 moved the MapLibre worker out of the bundle and onto a self-hosted
   public/ path. When that file is not retrievable the canvas and the
   main-thread entity layers still draw, but no vector tile can be parsed, so
   the basemap never arrives and startup times out into "The map couldn't
   finish loading" — the production failure that forced the revert to fac8d1b.
   Both halves of that path are asserted here: the file has to ship, and the
   analytics matcher has to leave it alone. */
describe('map runtime assets', () => {
  const matches = (path: string) => config.matcher.some(m => new RegExp(`^${m}$`).test(path));

  it('ships the worker the bundle actually asks for', () => {
    expect(existsSync(`${vendorDir}${maplibreVersion}/maplibre-gl-worker.mjs`)).toBe(true);
    // The worker is a module that imports this sibling by relative path.
    expect(existsSync(`${vendorDir}${maplibreVersion}/maplibre-gl-shared.mjs`)).toBe(true);
  });

  it('keeps exactly one vendored version, so local cannot pass while a clean deploy fails', () => {
    expect(readdirSync(vendorDir, { withFileTypes: true })
      .filter(e => e.isDirectory()).map(e => e.name)).toEqual([maplibreVersion]);
  });

  it('does not put analytics in front of the map worker, its sibling, or the basemap style', () => {
    expect(matches(workerPath)).toBe(false);
    expect(matches(`/vendor/maplibre/${maplibreVersion}/maplibre-gl-shared.mjs`)).toBe(false);
    expect(matches('/dark-matter-style.json')).toBe(false);
  });

  it('still counts page views', () => {
    expect(matches('/')).toBe(true);
    expect(matches('/merch')).toBe(true);
    expect(matches('/api/cctv')).toBe(false);
  });
});


describe('public OSINT boundary', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('registers the private tool API paths with middleware', () => {
    expect(config.matcher).toContain('/api/osint/:path*');
    expect(config.matcher).toContain('/api/tools/:path*');
    expect(config.matcher).toContain('/api/scanner');
  });

  it('fails closed when the internal tool bridge is not explicitly enabled', async () => {
    vi.stubEnv('M3TM_WORLD_INTERNAL_TOOLS_ENABLED', 'false');
    vi.stubEnv('M3TM_WORLD_INTERNAL_TOOLS_TOKEN', 'owner-only-token');

    const response = await middleware(
      new NextRequest('https://m3tm-world.vercel.app/api/osint/shodan'),
      { waitUntil: vi.fn() } as never,
    );

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toMatchObject({ error: 'internal_only' });
    expect(response.headers.get('cache-control')).toContain('no-store');
  });


  it('fails closed for the active scanner route too', async () => {
    vi.stubEnv('M3TM_WORLD_INTERNAL_TOOLS_ENABLED', 'true');
    vi.stubEnv('M3TM_WORLD_INTERNAL_TOOLS_TOKEN', 'owner-only-token');

    const response = await middleware(
      new NextRequest('https://m3tm-world.vercel.app/api/scanner?target=example.com&type=headers'),
      { waitUntil: vi.fn() } as never,
    );

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toMatchObject({ error: 'internal_only' });
  });

  it('allows an explicitly enabled internal route only with the matching server token', async () => {
    vi.stubEnv('M3TM_WORLD_INTERNAL_TOOLS_ENABLED', 'true');
    vi.stubEnv('M3TM_WORLD_INTERNAL_TOOLS_TOKEN', 'owner-only-token');

    const response = await middleware(
      new NextRequest('https://m3tm-world.vercel.app/api/scanner?target=example.com&type=headers', {
        headers: { 'x-m3tm-internal-token': 'owner-only-token' },
      }),
      { waitUntil: vi.fn() } as never,
    );

    expect(response.status).toBe(200);
    expect(response.headers.get('x-middleware-next')).toBe('1');
  });

  it('requires the server token even when the bridge flag is enabled', async () => {
    vi.stubEnv('M3TM_WORLD_INTERNAL_TOOLS_ENABLED', 'true');
    vi.stubEnv('M3TM_WORLD_INTERNAL_TOOLS_TOKEN', 'owner-only-token');

    const response = await middleware(
      new NextRequest('https://m3tm-world.vercel.app/api/tools/shodan', {
        headers: { authorization: 'Bearer wrong-token' },
      }),
      { waitUntil: vi.fn() } as never,
    );

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toMatchObject({ error: 'internal_only' });
  });
});

describe('published map route authorization', () => {
  afterEach(() => vi.unstubAllEnvs());
  it('gates every API path including alternate media routes', () => {
    expect(config.matcher).toContain('/api/:path*');
  });
  it('denies raw conflict data and camera streams regardless of query flags', async () => {
    vi.stubEnv('M3TM_APP_SUPABASE_ANON_KEY','');
    for (const path of ['/api/frontlines', '/api/reference-atlas', '/api/cctv/proxy', '/api/sdk/stream']) {
      const response=await middleware(new NextRequest(`https://map.test${path}?surface=internal&access=owner`), {waitUntil:vi.fn()} as never);
      expect(response.status).toBe(403);
      expect(response.headers.get('cache-control')).toContain('no-store');
    }
  });
  it('limits the scheduler credential to the atlas collector', async () => {
    vi.stubEnv('WORLD_MAP_REFRESH_TOKEN','r'.repeat(40));
    vi.stubEnv('M3TM_APP_SUPABASE_ANON_KEY','');
    const headers={Authorization:`Bearer ${'r'.repeat(40)}`};
    const event={waitUntil:vi.fn()} as never;
    expect((await middleware(new NextRequest('https://map.test/api/reference-atlas',{headers}),event)).status).toBe(200);
    expect((await middleware(new NextRequest('https://map.test/api/cctv',{headers}),event)).status).toBe(403);
    expect((await middleware(new NextRequest('https://map.test/api/osint/shodan',{headers}),event)).status).toBe(403);
  });
  it('does not allow viewing credentials into raw SDK, enrichment or analysis tools', async () => {
    vi.stubEnv('M3TM_WORLD_INTERNAL_TOOLS_ENABLED','false');
    for (const path of ['/api/sdk/stream','/api/sdk/ingest','/api/entity/expand','/api/astra','/api/ai/analyze']) {
      const response=await middleware(new NextRequest(`https://map.test${path}`,{headers:{Authorization:`Bearer ${'v'.repeat(80)}`}}),{waitUntil:vi.fn()} as never);
      expect(response.status).toBe(403);
      expect(await response.json()).toMatchObject({error:'internal_only'});
    }
  });
});
