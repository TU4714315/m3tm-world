import { describe, expect, it } from 'vitest';
import { geometryIntersectsSaudi } from './publicGeometryBoundary';
const box = (west: number, south: number, east: number, north: number) =>
  [[west, south], [east, south], [east, north], [west, north], [west, south]];

describe('Saudi suppression for published area geometry', () => {
  it('catches areas enclosing and thin areas crossing the country without an inside vertex', () => {
    expect(geometryIntersectsSaudi({ type: 'Polygon', coordinates: [box(30, 10, 65, 36)] })).toBe(true);
    expect(geometryIntersectsSaudi({ type: 'Polygon', coordinates: [box(30, 24, 65, 25)] })).toBe(true);
    expect(geometryIntersectsSaudi({ type: 'LineString', coordinates: [[30, 24], [65, 24]] })).toBe(true);
  });
  it('preserves Yemen and respects polygon holes enclosing the exclusion area', () => {
    expect(geometryIntersectsSaudi({ type: 'Polygon', coordinates: [box(43, 12, 47, 15)] })).toBe(false);
    expect(geometryIntersectsSaudi({ type: 'Polygon', coordinates: [box(20, 0, 70, 40), box(30, 10, 65, 36)] })).toBe(false);
  });
  it('does not interpret short Pacific edges as a route across Arabia', () => {
    expect(geometryIntersectsSaudi({ type: 'Polygon', coordinates: [box(170, 20, -170, 30)] })).toBe(false);
    expect(geometryIntersectsSaudi({ type: 'LineString', coordinates: [[170, 24], [-170, 24]] })).toBe(false);
  });
  it('checks multipart geometries and bounds nested geometry collections', () => {
    expect(geometryIntersectsSaudi({ type: 'MultiPolygon', coordinates: [[box(43, 12, 47, 15)], [box(30, 24, 65, 25)]] })).toBe(true);
    expect(geometryIntersectsSaudi({ type: 'GeometryCollection', geometries: [{ type: 'Point', coordinates: [46.7, 24.7] }] })).toBe(true);
    expect(geometryIntersectsSaudi({ type: 'Point', coordinates: [NaN, 24] })).toBe(false);
  });
});
