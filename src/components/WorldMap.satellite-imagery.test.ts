import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const source = readFileSync(new URL('./WorldMap.tsx', import.meta.url), 'utf8');

describe('satellite imagery safe zoom', () => {
  it('avoids requesting placeholder imagery at unsupported street-level zooms', () => {
    const sourceDefinition = source.match(/map\.addSource\('satellite-tiles',[\s\S]*?attribution: ARCGIS_IMAGERY_ATTRIBUTION,/);
    expect(sourceDefinition?.[0]).toContain('World_Imagery/MapServer/tile/{z}/{y}/{x}');
    expect(sourceDefinition?.[0]).toMatch(/maxzoom:\s*15/);
    expect(sourceDefinition?.[0]).toContain('tileSize: 256');
  });
  it('keeps vector labels above imagery and renders overlays independently', () => {
    expect(source).toContain('satelliteInsertionAnchor(map.getStyle()?.layers)');
    expect(source).toContain("id: 'satellite-layer'");
  });
});
