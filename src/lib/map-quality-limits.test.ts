import { describe, expect, it } from 'vitest';
import { mapViewMaxZoom, SATELLITE_IMAGE_SOURCE_MAX_ZOOM, TERRAIN_LAST_USEFUL_ZOOM, TERRAIN_HIGH_ZOOM_RELEASE } from './map-quality-limits';

describe('map source quality versus view zoom', () => {
  it('does not blow up limited-resolution satellite tiles by five zoom levels', () => {
    expect(SATELLITE_IMAGE_SOURCE_MAX_ZOOM).toBe(15);
    expect(mapViewMaxZoom('satellite')).toBeLessThan(17);
    // Regression: M3TM.APP embeds WORLD with its literal imagery URL, not the
    // shorter 'satellite' enum used by the control panel.
    expect(mapViewMaxZoom('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}')).toBe(16.5);
    expect(mapViewMaxZoom('dark')).toBe(20);
  });
  it('stops oversized low-detail terrain meshes before street-level zoom', () => {
    expect(TERRAIN_HIGH_ZOOM_RELEASE).toBeGreaterThan(TERRAIN_LAST_USEFUL_ZOOM);
    expect(TERRAIN_HIGH_ZOOM_RELEASE).toBeLessThan(16);
  });
});
