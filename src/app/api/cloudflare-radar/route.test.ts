import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fetchGdeltEvents } from '@/lib/gdeltEvents';
import { GET } from './route';

vi.mock('@/lib/gdeltEvents', () => ({
  fetchGdeltEvents: vi.fn(),
  toPublicGdeltEvent: vi.fn((event: any) => ({ ...event, precision: 'generalized-0.25deg' })),
}));

const cyberEvent = {
  id: 'cyber-1',
  lat: 1.35,
  lng: 103.8,
  country: 'SG',
  name: 'Singapore',
  event_code: '176',
  root_code: '17',
  quad: 4,
  event_label_ar: 'حدث نزاع مادي مُبلّغ عنه',
  date: '2026-10-03T18:30:00Z',
  url: 'https://example.com/cyber-report',
};

beforeEach(() => {
  vi.resetAllMocks();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe('public network-event endpoint', () => {
  it('returns source-backed public fallbacks without IP exposure or attacker attribution', async () => {
    vi.stubEnv('CLOUDFLARE_API_TOKEN', '');
    vi.mocked(fetchGdeltEvents).mockResolvedValue({
      events: [cyberEvent as any],
      window: '20261003183000.export.CSV.zip',
      scanned: 1,
    });

    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes('feodotracker.abuse.ch')) {
        return Response.json([
          { country: 'US', ip_address: '203.0.113.10' },
          { country: 'US', ip_address: '203.0.113.11' },
          { country: 'DE', ip_address: '203.0.113.12' },
        ]);
      }
      throw new Error(`unexpected fetch: ${url}`);
    });
    vi.stubGlobal('fetch', fetchMock);

    const response = await GET(new Request('http://localhost/api/cloudflare-radar'));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toMatchObject({
      configured: false,
      fallback_active: true,
      fallback_sections: { outages: true, attacks: true },
      source_mode: 'public-fallback',
      cloudflare_status: 'not_configured',
      providers: {
        cloudflare_outages: 'not_configured',
        cloudflare_attacks: 'not_configured',
        gdelt: 'active',
        abuse_ch: 'active',
      },
      total_outages: 1,
      total_attack_origins: 2,
    });
    expect(body.outages[0]).toMatchObject({
      event_type: 'REPORTED_CYBER_EVENT',
      description: 'حدث سيبراني مُبلّغ عنه',
      source: 'GDELT 2.0 · CAMEO 176',
      precision: 'generalized-0.25deg',
    });
    expect(body.attack_origins[0]).toMatchObject({
      indicator_type: 'observed-c2-infrastructure',
      source: 'abuse.ch Feodo Tracker',
    });
    expect(body.attack_origins[0].observations).toBeGreaterThan(0);
    expect(JSON.stringify(body)).not.toContain('203.0.113.');
    expect(JSON.stringify(body)).not.toContain('target_ip');
    expect(vi.mocked(fetchGdeltEvents)).toHaveBeenCalledWith({
      quads: [4],
      eventCodePrefixes: ['176'],
      minArticles: 1,
      limit: 120,
    });
  });

  it('uses only the attack fallback when Cloudflare outages succeed and attack-origin fails', async () => {
    vi.stubEnv('CLOUDFLARE_API_TOKEN', 'server-only-test-token');
    vi.mocked(fetchGdeltEvents).mockResolvedValue({
      events: [cyberEvent as any],
      window: 'unused',
      scanned: 1,
    });

    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes('/annotations/outages')) {
        return Response.json({
          success: true,
          result: {
            annotations: [{
              id: 'cf-1',
              locations: ['US'],
              locationsDetails: [{ code: 'US', name: 'United States' }],
              eventType: 'OUTAGE',
              startDate: '2026-10-03T18:00:00Z',
            }],
          },
        });
      }
      if (url.includes('/attacks/layer3/top/locations/origin')) {
        return new Response('', { status: 503 });
      }
      if (url.includes('feodotracker.abuse.ch')) {
        return Response.json([{ country: 'DE', ip_address: '203.0.113.50' }]);
      }
      throw new Error(`unexpected fetch: ${url}`);
    });
    vi.stubGlobal('fetch', fetchMock);

    const body = await (await GET(new Request('http://localhost/api/cloudflare-radar'))).json();

    expect(body).toMatchObject({
      configured: true,
      fallback_active: true,
      fallback_sections: { outages: false, attacks: true },
      source_mode: 'mixed',
      cloudflare_status: 'partial',
      providers: {
        cloudflare_outages: 'active',
        cloudflare_attacks: 'unavailable',
        gdelt: 'not_used',
        abuse_ch: 'active',
      },
    });
    expect(body.outages[0].source).toBe('Cloudflare Radar');
    expect(body.attack_origins[0]).toMatchObject({
      source: 'abuse.ch Feodo Tracker',
      indicator_type: 'observed-c2-infrastructure',
    });
    expect(vi.mocked(fetchGdeltEvents)).not.toHaveBeenCalled();
    expect(JSON.stringify(body)).not.toContain('203.0.113.50');
  });

  it('uses only the GDELT fallback when Cloudflare outage lookup fails', async () => {
    vi.stubEnv('CLOUDFLARE_API_TOKEN', 'server-only-test-token');
    vi.mocked(fetchGdeltEvents).mockResolvedValue({
      events: [cyberEvent as any],
      window: '20261003183000.export.CSV.zip',
      scanned: 1,
    });

    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes('/annotations/outages')) return new Response('', { status: 503 });
      if (url.includes('/attacks/layer3/top/locations/origin')) {
        return Response.json({
          success: true,
          result: {
            top_0: [{ originCountryAlpha2: 'US', originCountryName: 'United States', value: 12.5 }],
          },
        });
      }
      if (url.includes('feodotracker.abuse.ch')) throw new Error('Feodo must not be fetched');
      throw new Error(`unexpected fetch: ${url}`);
    });
    vi.stubGlobal('fetch', fetchMock);

    const body = await (await GET(new Request('http://localhost/api/cloudflare-radar'))).json();

    expect(body.fallback_sections).toEqual({ outages: true, attacks: false });
    expect(body.providers).toMatchObject({
      cloudflare_outages: 'unavailable',
      cloudflare_attacks: 'active',
      gdelt: 'active',
      abuse_ch: 'not_used',
    });
    expect(body.outages[0].source).toContain('GDELT');
    expect(body.attack_origins[0]).toMatchObject({
      source: 'Cloudflare Radar',
      indicator_type: 'cloudflare-layer3-origin-share',
    });
    expect(fetchMock.mock.calls.some(([url]) => String(url).includes('feodotracker.abuse.ch'))).toBe(false);
  });
});
