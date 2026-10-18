import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const page = readFileSync(new URL('../app/page.tsx', import.meta.url), 'utf8');
const map = readFileSync(new URL('./WorldMap.tsx', import.meta.url), 'utf8');

describe('realistic three-dimensional mode', () => {
  it('enables imagery and the two independent, zoom-lazy 3D sources together', () => {
    expect(page).toContain('const selectRealistic3DMap = () => {');
    expect(page).toContain("setMapStyle('satellite')");
    expect(page).toContain("setSatelliteVisual('original')");
    expect(page).toContain('terrain_elevation: true, terrain_3d: true');
    expect(page.match(/onClick={selectRealistic3DMap}/g)).toHaveLength(2);
  });

  it('does not invent buildings where height is not available', () => {
    expect(map).toContain("filter: ['all', ['has', 'render_height']");
    expect(map).toContain("'fill-extrusion-color': '#b0aaa0'");
    expect(map).toContain("15.5, ['to-number', ['get', 'render_height'], 0]");
    expect(map).toContain("15.5, ['to-number', ['get', 'render_min_height'], 0]");
  });

  it('preserves off-by-default resource handling and 2D fallback', () => {
    expect(page).toContain('terrain_elevation: false, terrain_3d: false');
    expect(map).toContain('maxzoom: 15');
    expect(map).toContain("map.addSource('satellite-tiles'");
  });
});
