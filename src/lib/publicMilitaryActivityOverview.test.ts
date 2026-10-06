import { describe, expect, it } from 'vitest';
import { publicMilitaryActivityOverview } from './publicMilitaryActivityOverview';

describe('coarse public military activity overview', () => {
  it('summarizes anonymous regional levels and a comparable sample only', () => {
    expect(publicMilitaryActivityOverview([
      { level: 1, trend: 'steady', lat: 50, lng: 30, callsign: 'PRIVATE' },
      { level: 2, trend: 'up' },
      { level: 3, trend: 'down' },
      { level: 2, trend: 'new' },
    ])).toEqual({
      total: 4, low: 1, medium: 2, high: 1, compared: 3,
      increased: 1, decreased: 1, unchanged: 1,
      unknown: 0, stale: false,
    });
  });

  it('does not claim a trend for stale or unsupported observations', () => {
    expect(publicMilitaryActivityOverview([
      { level: 3, trend: 'up', data_state: 'cached-stale' },
      { level: 1, trend: 'steady' },
    ])).toMatchObject({
      total: 2, high: 1, low: 1, compared: 0,
      increased: 0, decreased: 0, unchanged: 0, stale: true,
    });
    expect(publicMilitaryActivityOverview([{ level: 3, trend: 'up' }], true).compared).toBe(0);
  });

  it('does not mistake malformed, missing or individual tracks for verified aggregate cells', () => {
    expect(publicMilitaryActivityOverview(undefined).total).toBe(0);
    expect(publicMilitaryActivityOverview([null, 12, {}, { level: 9 }, { level: '3' }])).toMatchObject({
      total: 0, unknown: 3, compared: 0,
    });
  });

  it('never emits raw coordinates, identifiers or flight trajectories', () => {
    const result = publicMilitaryActivityOverview([
      { level: 2, trend: 'steady', lat: 32.01, lng: 50.011, callsign: 'PRIVATE', hex: 'abc', trajectory: [[1,2]] },
    ]);
    const serialized = JSON.stringify(result);
    expect(serialized).not.toMatch(/lat|lng|callsign|hex|trajectory|PRIVATE/);
  });
});
