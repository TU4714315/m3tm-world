import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('fs', () => ({ existsSync: () => false, mkdirSync: vi.fn(), writeFileSync: vi.fn(), readFileSync: vi.fn() }));
vi.mock('@/lib/stealthFetch', () => ({ stealthFetch: vi.fn() }));
vi.mock('@/lib/orbit', () => ({ propagateTLE: (line: string) => line.includes('10001')
  ? { lat: 24.7136, lng: 46.6753, altKm: 550 }
  : { lat: 15.3694, lng: 44.191, altKm: 550 } }));

import { stealthFetch } from '@/lib/stealthFetch';
import { GET } from './route';

afterEach(() => vi.unstubAllGlobals());

describe('satellite API Saudi public mask', () => {
  it('keeps Yemen objects and counts only the published category and source rows', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('', { status: 503 })));
    vi.mocked(stealthFetch).mockResolvedValueOnce(new Response(JSON.stringify([
      { tle0: 'STARLINK SA', tle1: '1 10001U', tle2: '2 10001' },
      { tle0: 'STARLINK YE', tle1: '1 10002U', tle2: '2 10002' },
    ])));
    const response = await GET();
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(body.satellites.map((row: { name: string }) => row.name)).toEqual(['STARLINK YE']);
    expect(body.total).toBe(1);
    expect(body.category_counts).toEqual({ comms: 1 });
    expect(body.satellite_source_status.public_individual_objects).toBe(1);
    expect(body.satellite_source_status.military_public_cells).toBe(body.military_satellite_activity.length);
  });
});
