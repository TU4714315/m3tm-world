import { describe, expect, it } from 'vitest';
import { buildAntimeridianSafeLine } from './publicRouteGeometry';

describe('buildAntimeridianSafeLine', () => {
  it('keeps ordinary links as a single line', () => {
    expect(buildAntimeridianSafeLine(39, 24, 46, 25)).toEqual({
      type: 'LineString',
      coordinates: [[39, 24], [46, 25]],
    });
  });

  it('splits eastbound links at the antimeridian', () => {
    const geometry = buildAntimeridianSafeLine(179, 10, -179, 12);
    expect(geometry.type).toBe('MultiLineString');
    expect(geometry.coordinates).toEqual([
      [[179, 10], [180, 11]],
      [[-180, 11], [-179, 12]],
    ]);
  });

  it('splits westbound links at the antimeridian', () => {
    const geometry = buildAntimeridianSafeLine(-179, -4, 179, -2);
    expect(geometry.type).toBe('MultiLineString');
    expect(geometry.coordinates).toEqual([
      [[-179, -4], [-180, -3]],
      [[180, -3], [179, -2]],
    ]);
  });
});
