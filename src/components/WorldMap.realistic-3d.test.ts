import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const page = readFileSync(new URL('../app/page.tsx', import.meta.url), 'utf8');
const map = readFileSync(new URL('./WorldMap.tsx', import.meta.url), 'utf8');

describe('realistic three-dimensional mode', () => {
  it('enables imagery and the two independent, zoom-lazy 3D sources together', () => {
    expect(page).toContain('const selectRealistic3DMap = () => {');
    expect(page).toContain("setMapStyle('satellite')");
    expect(page).toContain("setSatelliteVisual('original')");
    expect(page).toContain('terrain_elevation: true, terrain_3d: true, terrain_etopo_2022: false');
    expect(page.match(/onClick={selectRealistic3DMap}/g)).toHaveLength(2);
    expect(page).toContain("mapProjection === 'globe' ? selectFlatMap() : selectRealistic3DMap()");
    expect(page).toContain('عرض 3D واقعي');
  });

  it('presents building extrusion as approximate and guards regional pitch', () => {
    expect(map).toContain("filter: ['>', ['to-number', ['get', 'render_height'], 0], 0]");
    expect(map).toContain('can be derived from levels or a default');
    expect(map).toContain('map.getZoom() >= 15.5 && map.getPitch() < 40');
    expect(map).toContain("'fill-extrusion-color': '#b0aaa0'");
    expect(map).toContain("16.5, ['to-number', ['get', 'render_height'], 0]");
    expect(map).toContain("16.5, ['to-number', ['get', 'render_min_height'], 0]");
    expect(map).toContain('16.5, 0.35');
  });

  it('preserves off-by-default resource handling and 2D fallback', () => {
    expect(page).toContain('terrain_elevation: false, terrain_3d: false');
    expect(map).toContain('maxzoom: 15');
    expect(map).toContain("map.addSource('satellite-tiles'");
  });
});
