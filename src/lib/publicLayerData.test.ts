import { describe, expect, it } from 'vitest';
import { buildPublicLayerData } from './publicLayerData';

describe('public WORLD source-backed layer projection', () => {
  it('keeps all documented safe public layers available to the renderer', () => {
    const source = {
      cameras: [{ id: 'camera-1' }], fires: [{ id: 'fire-1' }],
      weather_events: [{ id: 'storm-1' }], infrastructure: [{ id: 'plant-1' }],
      maritime_ports: [{ id: 'port-1' }], maritime_chokepoints: [{ id: 'choke-1' }],
      submarine_cables: [{ id: 'cable-1' }], balloons: [{ id: 'balloon-1' }],
      radiation: [{ id: 'station-1' }], cf_outages: [{ id: 'outage-1' }],
      earthquakes: [{ id: 'quake-1' }], gdelt_events: [{ id: 'event-1' }], civil_unrest: [{ id: 'unrest-1' }],
      conflict_live_events: [{ id: 'conflict-1' }], live_feeds: [{ id: 'feed-1' }],
    };
    const publicData = buildPublicLayerData(source);
    for (const key of Object.keys(source).filter(key => !['balloons', 'radiation'].includes(key))) {
      expect(publicData[key as keyof typeof publicData]).toEqual(source[key as keyof typeof source]);
    }
    expect(publicData.balloons).toEqual([]);
    expect(publicData.radiation).toEqual([]);
    expect(publicData.sdk_entities).toEqual([]);
  });

  it('projects a bounded public-safe AIR SDK subset without flight identifiers', () => {
    const result = buildPublicLayerData({
      commercial_flights: [
        { id: 'civil-1', callsign: 'SECRETISH1', lat: 1.3, lng: 103.8 },
        { id: 'civil-2', callsign: 'SECRETISH2', lat: 2.1, lng: 104.1 },
      ],
      private_flights: [{ id: 'private-1', callsign: 'PRIVATE1', lat: 25.2, lng: 55.3 }],
      private_jets: [{ id: 'jet-1', callsign: 'JET1', lat: 40.7, lng: -74.0 }],
      sdk_entities: [{ token: 'never-forward-raw-sdk' }],
    });
    expect(result.sdk_entities).toHaveLength(4);
    for (const entity of result.sdk_entities) {
      expect(entity.properties).toEqual({
        domain: 'AIR',
        name: 'رصد جوي عام',
        source: 'ADS-B / OpenSky',
      });
    }
    const serialized = JSON.stringify(result.sdk_entities);
    for (const forbidden of ['civil-1', 'SECRETISH1', 'PRIVATE1', 'JET1', 'never-forward-raw-sdk']) {
      expect(serialized).not.toContain(forbidden);
    }
  });

  it('never forwards internal entities, exact military flights, or military AIS/satellite entities', () => {
    const result = buildPublicLayerData({
      military_flights: [{ icao24: 'sensitive-track' }],
      sat_military: [{ id: 'sensitive-satellite' }],
      sdk_entities: [{ secret: 'internal' }],
      internalToolsToken: 'never-expose',
      maritime_ships: [
        { id: 'cargo', type: 'cargo' },
        { id: 'ship-2', type: 'Military' },
        { id: 'ship-3', category: 'Naval' },
        { id: 'ship-4', isMilitary: true },
      ],
      satellites: [{ id: 'sat-1', category: 'navigation' }, { id: 'sat-2', category: 'military' }],
      commercial_flights: [{ id: 'civil-1' }],
      military_activity: [{ id: 'aggregate-cell', lat: 24, lng: 48, count: 5, trend: 'up', data_state: 'cached-stale', observed_at: '2026-10-03T04:00:00Z', age_seconds: 120, icao24: 'should-strip', token: 'strip-me' }],
      military_activity_meta: { mode: 'coarse-regional-aggregate', exact_tracks_exposed: false, stale_fallback: true, cache_backend: 'redis', durable_cache_configured: true, internalEndpoint: 'http://10.0.0.4' },
      flight_source_status: { status: 'active', exact_military_tracks_exposed: false, hostToken: 'strip-me' },
      military_satellite_activity: [{ lat: 20, lng: 30, approximate_count: '3-5', noradId: '99999', name: 'strip-me' }],
      naval_activity: [{ id: 'naval-cell', lat: 3, lng: 105, level: 1, approximate_count: '2-4', cell_degrees: 6, mmsi: 'should-strip', name: 'strip-me', speed: 22, heading: 180 }],
      naval_activity_meta: { mode: 'coarse-regional-aggregate', exact_tracks_exposed: false, speed_heading_exposed: false, internalEndpoint: 'http://10.0.0.6' },
      military_satellite_meta: { mode: 'coarse-orbital-aggregate', exact_tracks_exposed: false, secret: 'strip-me' },
      military_satellite_summary: { catalog_objects: 7, represented_objects: 3, internal: 'strip-me' },
      satellite_source_status: { status: 'active', military_public_cells: 1, internalIp: '10.0.0.5' },
    });
    expect(result.maritime_ships).toEqual([{ id: 'cargo', type: 'cargo' }]);
    expect(result.satellites).toEqual([{ id: 'sat-1', category: 'navigation' }]);
    expect(result.commercial_flights).toHaveLength(1);
    expect(result.military_activity).toHaveLength(1);
    expect(result.military_activity[0]).toMatchObject({ id: 'aggregate-cell', lat: 24, lng: 48, trend: 'up', data_state: 'cached-stale', age_seconds: 120 });
    expect(result.military_activity_meta).toMatchObject({ mode: 'coarse-regional-aggregate', exact_tracks_exposed: false, stale_fallback: true, cache_backend: 'redis', durable_cache_configured: true });
    expect(result.flight_source_status).toMatchObject({ status: 'active', exact_military_tracks_exposed: false });
    expect(result.military_satellite_activity[0]).toMatchObject({ lat: 20, lng: 30, approximate_count: '3-5' });
    expect(result.naval_activity[0]).toMatchObject({ id: 'naval-cell', lat: 3, lng: 105, approximate_count: '2-4', cell_degrees: 6 });
    expect(result.naval_activity_meta).toMatchObject({ mode: 'coarse-regional-aggregate', exact_tracks_exposed: false, speed_heading_exposed: false });
    expect(result.military_satellite_meta).toMatchObject({ mode: 'coarse-orbital-aggregate', exact_tracks_exposed: false });
    expect(result.military_satellite_summary).toMatchObject({ catalog_objects: 7, represented_objects: 3 });
    expect(result.satellite_source_status).toMatchObject({ status: 'active', military_public_cells: 1 });
    expect(Object.keys(result)).not.toEqual(expect.arrayContaining([
      'military_flights', 'sat_military', 'internalToolsToken',
    ]));
    expect(result.sdk_entities).toEqual([]);
    const serialized = JSON.stringify(result);
    for (const forbidden of ['sensitive-track', 'sensitive-satellite', 'should-strip', 'strip-me', '10.0.0.4', '10.0.0.5', '10.0.0.6', '99999']) {
      expect(serialized).not.toContain(forbidden);
    }
  });

  it('prefers verified APP-synced public news over fallback broadcast feed', () => {
    const result = buildPublicLayerData(
      { live_feeds: [{ id: 'fallback' }] },
      [{ id: 'app-feed' }],
    );
    expect(result.live_feeds).toEqual([{ id: 'app-feed' }]);
    expect(buildPublicLayerData({}).conflict_zones).toEqual([]);
  });
});

describe('public feed readiness projection', () => {
  it('keeps source state useful while stripping operational details', () => {
    const result = buildPublicLayerData({
      maritime_source: 'AISStream.io + M3TM static maritime reference',
      maritime_timestamp: '2026-09-30T22:00:00Z',
      maritime_source_status: {
        ais: {
          status: 'active',
          configured: true,
          provider: 'AISStream.io',
          public_ships: 42,
          military_public_cells: 3,
          latest_observed_at: '2026-09-30T21:59:55Z',
          latest_observation_age_s: 5,
          persistence: 'process-memory',
          exact_military_tracks_exposed: false,
          serverless_note: 'internal deployment detail',
          token: 'never-public',
        },
        reference: { status: 'active', provider: 'M3TM.WORLD curated static reference', ports: 50, chokepoints: 10 },
      },
      cloudflare_source_status: {
        status: 'not_configured',
        configured: false,
        provider: 'Cloudflare Radar',
        timestamp: '2026-09-30T22:00:00Z',
        internalEndpoint: 'http://10.0.0.8',
      },
    });
    expect(result.maritime_source_status.ais).toMatchObject({
      status: 'active',
      configured: true,
      provider: 'AISStream.io',
      public_ships: 42,
      military_public_cells: 3,
      latest_observation_age_s: 5,
      exact_military_tracks_exposed: false,
    });
    expect(result.cloudflare_source_status).toMatchObject({
      status: 'not_configured',
      configured: false,
      provider: 'Cloudflare Radar',
    });
    const serialized = JSON.stringify(result);
    for (const forbidden of ['never-public', 'internal deployment detail', '10.0.0.8']) {
      expect(serialized).not.toContain(forbidden);
    }
  });
});

describe('public evidence status projection', () => {
  it('returns source diagnostics and categorized counts without leaking internal data', () => {
    const result = buildPublicLayerData({
      conflict_source_status: { gdelt: { status: 'ok' }, acled: { status: 'not_configured' } },
      conflict_category_counts: { aerial_attack: 2, heavy_weapons: 3 },
      country_boundaries_meta: { source: 'Natural Earth', precision: 'overview' },
      internalHostToken: 'not-public',
      sdk_entities: [{ token: 'not-public' }],
    });
    expect(result.conflict_source_status).toEqual({
      gdelt: { status: 'ok' }, acled: { status: 'not_configured' },
    });
    expect(result.conflict_category_counts).toEqual({ aerial_attack: 2, heavy_weapons: 3 });
    expect(result.country_boundaries_meta).toEqual({ source: 'Natural Earth', precision: 'overview' });
    expect(JSON.stringify(result)).not.toContain('not-public');
  });
});
