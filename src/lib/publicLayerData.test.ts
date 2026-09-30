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
      earthquakes: [{ id: 'quake-1' }], gdelt_events: [{ id: 'event-1' }],
      conflict_live_events: [{ id: 'conflict-1' }], live_feeds: [{ id: 'feed-1' }],
    };
    const publicData = buildPublicLayerData(source);
    for (const key of Object.keys(source)) {
      expect(publicData[key as keyof typeof publicData]).toEqual(source[key as keyof typeof source]);
    }
    expect(publicData.sdk_entities).toEqual([]);
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
      military_activity: [{ id: 'aggregate-cell', lat: 24, lng: 48, count: 5 }],
    });
    expect(result.maritime_ships).toEqual([{ id: 'cargo', type: 'cargo' }]);
    expect(result.satellites).toEqual([{ id: 'sat-1', category: 'navigation' }]);
    expect(result.commercial_flights).toHaveLength(1);
    expect(result.military_activity).toHaveLength(1);
    expect(Object.keys(result)).not.toEqual(expect.arrayContaining([
      'military_flights', 'sat_military', 'internalToolsToken',
    ]));
    expect(result.sdk_entities).toEqual([]);
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
