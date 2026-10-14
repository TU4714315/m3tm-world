import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const source = readFileSync(new URL('./WorldMap.tsx', import.meta.url), 'utf8');

describe('WORLD map first-paint recovery on phones', () => {
  it('tries an attributed alternate raster basemap after a bounded style timeout', () => {
    expect(source).toContain('window.setTimeout(attemptBasemapRecovery, 14000)');
    expect(source).toContain("server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map");
    expect(source).toContain("attribution: 'Tiles © Esri");
    expect(source).toContain('if (basemapLoaded || recoveryAttempted) return');
  });
  it('shows an accessible error instead of a silent black map', () => {
    expect(source).toContain("role=\"status\" aria-live=\"polite\"");
    expect(source).toContain("setMapLoadState('unavailable')");
    expect(source).toContain('window.clearTimeout(initialTimeout)');
  });
});
