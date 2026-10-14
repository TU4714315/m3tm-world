import { afterEach, describe, expect, it, vi } from 'vitest';
import { GET } from './route';

afterEach(() => vi.unstubAllGlobals());

describe('legacy IODA country suppression', () => {
  it('excludes Saudi country data without removing Yemen or inventing event positions', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({
      data: [
        { location: 'country/SA', score: 9, severity: 'high', start: 123 },
        { location: 'country/YE', score: 2, severity: 'low', start: 124 },
      ],
    }), { status: 200, headers: { 'Content-Type': 'application/json' } })));
    const response = await GET();
    expect(response.status).toBe(200);
    const payload = await response.json();
    expect(payload.outages).toHaveLength(1);
    expect(payload.total).toBe(1);
    expect(payload.outages[0]).toMatchObject({
      country: 'YE', lat: 15.5, lng: 48,
      precision: 'country-centroid-not-incident-location',
    });
  });
});
