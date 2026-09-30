import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import {
  MAP_ATTRIBUTION_OPTIONS, TILEZEN_TERRAIN_ATTRIBUTION, ARCGIS_IMAGERY_ATTRIBUTION,
  NOAA_ETOPO_2022_TILE_URL, NOAA_ETOPO_2022_ATTRIBUTION,
} from './terrain-source-attribution';

describe('attribution is attached to real map sources', () => {
  it('makes source credits accessible from both the standalone map and APP iframe', () => {
    expect(MAP_ATTRIBUTION_OPTIONS.compact).toBe(false);
    expect(MAP_ATTRIBUTION_OPTIONS.customAttribution).toContain('href="/terrain-sources"');
    expect(MAP_ATTRIBUTION_OPTIONS.customAttribution).toContain('مصادر الخريطة');
    expect(TILEZEN_TERRAIN_ATTRIBUTION).toContain('tilezen/joerd/blob/master/docs/attribution.md');
    expect(TILEZEN_TERRAIN_ATTRIBUTION).toContain('Mapzen / Tilezen');
    expect(ARCGIS_IMAGERY_ATTRIBUTION).toContain('Esri');
    expect(NOAA_ETOPO_2022_TILE_URL).toContain('/ETOPO_hillshade/MapServer/tile/{z}/{y}/{x}');
    expect(NOAA_ETOPO_2022_ATTRIBUTION).toContain('NOAA NCEI');
  });
  it('does not globally hide attribution or break narrow viewports', () => {
    const css = readFileSync(new URL('../app/globals.css', import.meta.url), 'utf8');
    expect(css).not.toMatch(/\\.maplibregl-ctrl-attrib\\s*\\{\\s*display:\\s*none/i);
    expect(css).toContain('.maplibregl-ctrl-attrib a:focus-visible');
    expect(css).toContain('max-width: calc(100vw - 20px)');
  });

  it('does not advertise an unconnected modern DEM as the live tile source', () => {
    expect(TILEZEN_TERRAIN_ATTRIBUTION).not.toMatch(/ETOPO 2022|GLO-30|3DEP S1M/);
  });
});
