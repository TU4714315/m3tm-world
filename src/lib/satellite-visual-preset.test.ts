import { describe, it, expect } from 'vitest';
import { SATELLITE_VISUAL_PRESETS, satelliteInsertionAnchor, satelliteRasterPaint } from './satellite-visual-preset';
describe('satellite visualization presets', () => {
  it('keeps an opt-in original and enhances only image raster properties', () => {
    expect(satelliteRasterPaint('original')['raster-contrast']).toBe(0.08);
    expect(satelliteRasterPaint('clarity')['raster-contrast']).toBeGreaterThan(0.08);
    expect(satelliteRasterPaint('bright')['raster-brightness-min']).toBeGreaterThan(0.03);
    expect(satelliteRasterPaint('clarity')['raster-brightness-min']).toBeGreaterThanOrEqual(0.03);
    expect(satelliteRasterPaint('clarity')['raster-brightness-max']).toBeLessThan(1);
    expect(satelliteRasterPaint('bright')['raster-brightness-min'])
      .toBeGreaterThan(satelliteRasterPaint('clarity')['raster-brightness-min']);
    for (const p of Object.values(SATELLITE_VISUAL_PRESETS)) {
      expect(p.opacity).toBeGreaterThanOrEqual(0);
      expect(p.opacity).toBeLessThanOrEqual(1);
      expect(p.brightnessMin).toBeLessThan(p.brightnessMax);
      expect(p.brightnessMax).toBeLessThanOrEqual(1);
      expect(Math.abs(p.contrast)).toBeLessThanOrEqual(1);
      expect(Math.abs(p.saturation)).toBeLessThanOrEqual(1);
    }
    expect(Object.keys(satelliteRasterPaint('clarity'))).not.toContain('icon-opacity');
  });
  it('places imagery below the first vector symbol label', () => {
    expect(satelliteInsertionAnchor([
      { id: 'water', type: 'fill' },
      { id: 'roads', type: 'line', 'source-layer': 'transportation' },
      { id: 'road-label', type: 'symbol', 'source-layer': 'transportation_name' },
      { id: 'place_country_1', type: 'symbol', 'source-layer': 'place' },
    ])).toBe('road-label');
  });
});
