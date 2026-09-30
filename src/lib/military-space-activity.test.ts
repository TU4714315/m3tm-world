import { describe, expect, it } from 'vitest';
import { buildGeneralizedMilitarySpaceActivity, observedCountBand } from './military-space-activity';

describe('generalized military space activity', () => {
  it('groups military satellites into coarse 30 degree cells without identifiers', () => {
    const rows = [
      { category: 'military', lat: 10, lng: 20, alt: 500, noradId: '111', name: 'A' },
      { category: 'military', lat: 11, lng: 21, alt: 600, noradId: '222', name: 'B' },
      { category: 'military', lat: 12, lng: 22, alt: 700, noradId: '333', name: 'C' },
      { category: 'navigation', lat: 10, lng: 20, alt: 20_000, noradId: '444', name: 'GPS' },
    ];
    const cells = buildGeneralizedMilitarySpaceActivity(rows as any[], Date.UTC(2026, 8, 30, 20, 45));
    expect(cells).toHaveLength(1);
    expect(cells[0]).toMatchObject({
      lat: 15,
      lng: 15,
      level: 1,
      approximate_count: '3-5',
      cell_degrees: 30,
      precision: 'coarse-regional',
      time_precision: '60-minute-bucket',
      observed_at_bucket: '2026-09-30T20:00:00.000Z',
      reporting_mode: 'public-tle-aggregate',
      orbit_band: 'LEO',
    });
    expect(JSON.stringify(cells[0])).not.toContain('111');
    expect(JSON.stringify(cells[0])).not.toContain('"name"');
  });

  it('suppresses cells with fewer than three military observations', () => {
    expect(buildGeneralizedMilitarySpaceActivity([
      { category: 'military', lat: 0, lng: 0, alt: 500 },
      { category: 'military', lat: 1, lng: 1, alt: 35_786 },
    ])).toEqual([]);
  });

  it('marks a mixed orbit cell when no band dominates', () => {
    const cell = buildGeneralizedMilitarySpaceActivity([
      { category: 'military', lat: -10, lng: -10, alt: 500 },
      { category: 'military', lat: -11, lng: -11, alt: 12_000 },
      { category: 'military', lat: -12, lng: -12, alt: 35_786 },
    ])[0];
    expect(cell.orbit_band).toBe('mixed');
  });

  it('reduces global observed counts to bands', () => {
    expect(observedCountBand(0)).toBe('0');
    expect(observedCountBand(7)).toBe('5-9');
    expect(observedCountBand(22)).toBe('20-49');
    expect(observedCountBand(80)).toBe('50+');
  });
});
