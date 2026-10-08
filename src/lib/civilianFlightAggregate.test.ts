import { describe, expect, it } from 'vitest';
import {
  boundCivilianFlightAggregate,
  buildCivilianFlightAggregate,
  civilianFlightMapFeatures,
  staleCivilianFlightAggregate,
} from './civilianFlightAggregate';

describe('public civilian flight degraded aggregate', () => {
  const now = Date.parse('2026-10-08T08:00:00Z');

  it('bins civilian observations into coarse 2-degree cells without identifiers', () => {
    const cells = buildCivilianFlightAggregate({
      commercial: [
        { lat: 24.1, lng: 46.2, callsign: 'SECRET-A', icao24: 'abc123' },
        { lat: 24.7, lng: 46.8, callsign: 'SECRET-B', icao24: 'def456' },
      ],
      private: [{ lat: 25.1, lng: 47.1, registration: 'PRIVATE' }],
      jets: [{ lat: 40.7, lng: -74.0, callsign: 'JET-1' }],
    }, now);

    expect(cells.length).toBeGreaterThan(0);
    expect(cells.reduce((sum, cell) => sum + cell.total, 0)).toBe(4);
    const serialized = JSON.stringify(cells);
    for (const forbidden of ['SECRET-A', 'SECRET-B', 'abc123', 'def456', 'PRIVATE', 'JET-1']) {
      expect(serialized).not.toContain(forbidden);
    }
    expect(cells.every(cell => cell.cell_degrees === 2 && cell.precision === 'coarse-2deg')).toBe(true);
  });

  it('ages a durable last-good snapshot instead of pretending it is live', () => {
    const live = buildCivilianFlightAggregate({
      commercial: [{ lat: 24.1, lng: 46.2 }],
      private: [],
      jets: [],
    }, now - 10 * 60_000);
    const stale = staleCivilianFlightAggregate({
      cells: live,
      observed_at: new Date(now - 10 * 60_000).toISOString(),
    }, now);
    expect(stale[0]).toMatchObject({ data_state: 'cached-stale', age_seconds: 600 });
    const features = civilianFlightMapFeatures(stale);
    expect(features[0].properties).toMatchObject({
      total: 1,
      data_state: 'cached-stale',
      age_seconds: 600,
    });
    expect(JSON.stringify(features)).not.toMatch(/callsign|registration|icao24|heading/);
  });

  it('rejects invalid coordinates and empty cells', () => {
    const cells = buildCivilianFlightAggregate({
      commercial: [{ lat: NaN, lng: 45 }, { lat: 95, lng: 45 }],
      private: [],
      jets: [],
    }, now);
    expect(cells).toEqual([]);
    expect(civilianFlightMapFeatures([{ lat: NaN, lng: 45, total: 1 } as never])).toEqual([]);
  });

  it('keeps sparse MENA coverage when bounding a dense global fallback', () => {
    const dense = Array.from({ length: 649 }, (_, index) => ({
      id: `dense-${index}`,
      lat: -80 + Math.floor(index / 100) * 10,
      lng: -170 + (index % 100) * 3.4,
      total: 20,
      commercial: 20,
      private: 0,
      jets: 0,
      cell_degrees: 2,
      precision: 'coarse-2deg' as const,
      data_state: 'live' as const,
      observed_at: new Date(now).toISOString(),
      age_seconds: 0,
    })).filter(cell => cell.lng <= 180 && !(cell.lat >= -5 && cell.lat <= 45 && cell.lng >= -20 && cell.lng <= 75));
    dense.push({
      id: 'mena-sparse', lat: 24, lng: 46, total: 1, commercial: 1, private: 0, jets: 0,
      cell_degrees: 2, precision: 'coarse-2deg', data_state: 'live',
      observed_at: new Date(now).toISOString(), age_seconds: 0,
    });
    const bounded = boundCivilianFlightAggregate(dense, 600);
    expect(bounded).toHaveLength(600);
    expect(bounded.some(cell => cell.id === 'mena-sparse')).toBe(true);
  });

  it('projects only the civilian categories the user actually enabled', () => {
    const cell = buildCivilianFlightAggregate({
      commercial: Array.from({length:4},()=>({lat:24.1,lng:46.2})),
      private: [{lat:24.1,lng:46.2}],
      jets: [{lat:24.1,lng:46.2}],
    }, now)[0];
    const privateOnly = civilianFlightMapFeatures([cell], { commercial:false, private:true, jets:false });
    expect(privateOnly[0].properties).toMatchObject({ total:1, commercial:0, private:1, jets:0 });
    expect(civilianFlightMapFeatures([cell], { commercial:false, private:false, jets:false })).toEqual([]);
  });
});
