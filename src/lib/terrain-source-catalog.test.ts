import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { ACTIVE_TERRAIN, NEWER_DEM_CANDIDATES } from './terrain-source-catalog';

describe('terrain source provenance and map attribution', () => {
  it('retains the already-tested Mapzen Terrarium endpoint, credit URL, and zoom budget', () => {
    expect(ACTIVE_TERRAIN.tileBaseUrl).toBe('https://s3.amazonaws.com/elevation-tiles-prod/terrarium/');
    expect(ACTIVE_TERRAIN.tileFormat).toBe('terrarium');
    expect(ACTIVE_TERRAIN.tileSize).toBe(256);
    expect(ACTIVE_TERRAIN.maxTileZoom).toBe(10);
    expect(ACTIVE_TERRAIN.status).toBe('active');
    expect(ACTIVE_TERRAIN.creditsUrl).toBe('https://github.com/tilezen/joerd/blob/master/docs/attribution.md');
  });

  it('does not misrepresent COG and GeoTIFF candidates as deployed browser-ready tiles', () => {
    expect(NEWER_DEM_CANDIDATES.map(candidate => candidate.id)).toEqual([
      'copernicus-glo90', 'copernicus-glo30-public', 'etopo-2022', 'usgs-3dep-s1m',
    ]);
    expect(NEWER_DEM_CANDIDATES.every(candidate => candidate.status.includes('validation'))).toBe(true);
    expect(NEWER_DEM_CANDIDATES.every(candidate => !('tileBaseUrl' in candidate))).toBe(true);
  });

  it('keeps provider credits visible and binds them to actual map sources', () => {
    const css = readFileSync(new URL('../app/globals.css', import.meta.url), 'utf8');
    const map = readFileSync(new URL('../components/WorldMap.tsx', import.meta.url), 'utf8');
    const terrain = readFileSync(new URL('./map-terrain.ts', import.meta.url), 'utf8');
    expect(css).not.toMatch(/\.maplibregl-ctrl-attrib\s*\{\s*display:\s*none/i);
    expect(css).toContain('.maplibregl-ctrl-attrib a');
    expect(map).toContain('attributionControl: { compact: false }');
    expect(map).toContain('attribution: \'<a href="https://doc.arcgis.com/');
    expect(terrain).toContain('attribution: `<a href="${ACTIVE_TERRAIN.creditsUrl}"');
  });
});
