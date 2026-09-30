import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { GET, clearMaritimeSnapshot } from './route';

/* The route aggregates over the websocket-fed ship map on globalThis, so the
   tests drive it directly rather than standing up an AIS stream. */
interface Ship {
  id: number; mmsi: number; lat: number; lng: number;
  speed: number; type: string; name: string; timestamp: number;
}

const ships = () => (globalThis as unknown as { shipsCache: Map<number, Ship> }).shipsCache;

function addShip(mmsi: number, lat: number, lng: number) {
  ships().set(mmsi, {
    id: mmsi, mmsi, lat, lng, speed: 0, type: 'cargo',
    name: `SHIP-${mmsi}`, timestamp: Date.now(),
  });
}

describe('GET /api/maritime', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-01T00:00:00Z'));
    delete process.env.AIS_API_KEY;
    ships().clear();
    clearMaritimeSnapshot();
  });

  afterEach(() => {
    vi.useRealTimers();
  });


  it('reports AIS as not configured without inventing live ships', async () => {
    const body = await (await GET()).json();
    expect(body.total_ships).toBe(0);
    expect(body.source_status.ais).toMatchObject({
      status: 'not_configured',
      configured: false,
      provider: 'AISStream.io',
      public_ships: 0,
      exact_military_tracks_exposed: false,
    });
    expect(body.source_status.ais.latest_observed_at).toBeNull();
    expect(body.source_status.reference.status).toBe('active');
    expect(JSON.stringify(body)).not.toContain('AIS_API_KEY');
  });

  it('publishes freshness for observed public vessels without exposing military AIS tracks', async () => {
    process.env.AIS_API_KEY = 'test-only-not-returned';
    addShip(1, 1.26, 103.84);
    ships().set(2, {
      id: 2, mmsi: 2, lat: 1.27, lng: 103.85, speed: 12,
      type: 'military', name: 'MIL', timestamp: Date.now(),
    });
    const body = await (await GET()).json();
    expect(body.total_ships).toBe(1);
    expect(body.ships.map((ship: Ship) => ship.mmsi)).toEqual([1]);
    expect(body.source_status.ais).toMatchObject({
      status: 'active',
      configured: true,
      public_ships: 1,
      latest_observation_age_s: 0,
      exact_military_tracks_exposed: false,
    });
    expect(JSON.stringify(body)).not.toContain('test-only-not-returned');
  });

  it('still counts the ships sitting off a port', async () => {
    addShip(1, 1.26, 103.84); // on top of Singapore
    const body = await (await GET()).json();

    const singapore = body.ports.find((p: { name: string }) => p.name === 'Singapore');
    expect(singapore.volume).toContain('LIVE: 1');
    expect(singapore.volume).toContain('WAITING: 1');
    expect(body.total_ships).toBe(1);
  });

  it('serves one snapshot to every caller inside the TTL', async () => {
    addShip(1, 1.26, 103.84);
    const first = await (await GET()).json();

    vi.advanceTimersByTime(4_000);
    addShip(2, 1.27, 103.85);
    const second = await (await GET()).json();

    // The aggregation did not run again — the second caller got the first
    // caller's bytes, which is the whole point under load.
    expect(second).toEqual(first);
    expect(second.total_ships).toBe(1);
  });

  it('rebuilds once the TTL has passed', async () => {
    addShip(1, 1.26, 103.84);
    expect((await (await GET()).json()).total_ships).toBe(1);

    vi.advanceTimersByTime(5_000);
    addShip(2, 1.27, 103.85);
    expect((await (await GET()).json()).total_ships).toBe(2);
  });

  it('lets the browser and any CDN reuse the response', async () => {
    const res = await GET();
    const cc = res.headers.get('cache-control') ?? '';

    expect(cc).toContain('s-maxage=5');
    expect(cc).toContain('max-age=5');
    expect(cc).not.toContain('no-store');
    expect(res.headers.get('content-type')).toContain('application/json');
  });
});
