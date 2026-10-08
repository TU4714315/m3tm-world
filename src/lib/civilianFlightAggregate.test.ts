import { describe, expect, it } from 'vitest';
import {
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
});
