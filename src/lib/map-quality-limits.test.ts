import { describe, expect, it } from 'vitest';
import { mapViewMaxZoom, SATELLITE_IMAGE_SOURCE_MAX_ZOOM, TERRAIN_LAST_USEFUL_ZOOM, TERRAIN_HIGH_ZOOM_RELEASE } from './map-quality-limits';

describe('map source quality versus view zoom', () => {
  it('does not blow up limited-resolution satellite tiles by five zoom levels', () => {
    expect(SATELLITE_IMAGE_SOURCE_MAX_ZOOM).toBe(15);
    expect(mapViewMaxZoom('satellite')).toBeLessThan(17);
    expect(mapViewMaxZoom('dark')).toBe(20);
  });
  it('stops oversized low-detail terrain meshes before street-level zoom', () => {
    expect(TERRAIN_HIGH_ZOOM_RELEASE).toBeGreaterThan(TERRAIN_LAST_USEFUL_ZOOM);
    expect(TERRAIN_HIGH_ZOOM_RELEASE).toBeLessThan(16);
  });
});
