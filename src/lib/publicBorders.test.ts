import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('world reference boundaries', () => {
  it('includes Natural Earth attribution and generalized geometries', () => {
    const path = join(process.cwd(), 'public/data/ne110-land-boundaries.geojson');
    const collection = JSON.parse(readFileSync(path, 'utf8'));
    expect(collection.type).toBe('FeatureCollection');
    expect(collection.metadata.source).toContain('natural-earth-vector');
    expect(collection.features.length).toBeGreaterThan(300);
    expect(collection.features.some((f: {properties:{kind:string}}) => f.properties.kind === 'contested')).toBe(true);
    expect(collection.features.every((f: {geometry:{type:string}}) => ['LineString', 'MultiLineString'].includes(f.geometry.type))).toBe(true);
  });
});
