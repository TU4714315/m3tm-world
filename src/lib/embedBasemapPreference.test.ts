import { describe, expect, it } from 'vitest';
import { embeddedBasemapPreference } from './embedBasemapPreference';
describe('internal iframe basemap preference', () => {
  it('accepts dark for an internal frame', () => {
    expect(embeddedBasemapPreference(new URLSearchParams('embed=1&basemap=dark'), true, false)).toBe('dark');
  });
  it('keeps public embeds and standalone WORLD independent', () => {
    const query = new URLSearchParams('embed=1&surface=public&basemap=dark');
    expect(embeddedBasemapPreference(query, true, true)).toBeNull();
    expect(embeddedBasemapPreference(query, false, false)).toBeNull();
  });
  it('ignores unrecognized or satellite preferences without changing default', () => {
    expect(embeddedBasemapPreference(new URLSearchParams('basemap=arbitrary'), true, false)).toBeNull();
    expect(embeddedBasemapPreference(new URLSearchParams('basemap=satellite'), true, false)).toBeNull();
  });
});
