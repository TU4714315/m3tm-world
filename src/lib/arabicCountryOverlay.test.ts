import { describe, expect, it } from 'vitest';
import { publicArabicCountryLabels } from './arabicCountryOverlay';

describe('country labels on imagery/3D', () => {
  it('provides Arabic country names without altering borders', () => {
    const data = publicArabicCountryLabels();
    expect(data.type).toBe('FeatureCollection');
    expect(data.features.length).toBeGreaterThan(60);
    expect(data.features.find(feature => feature.properties.code === 'YE')?.properties.name).toBe('اليمن');
    expect(data.features.find(feature => feature.properties.code === 'SA')?.properties.name).toBe('السعودية');
    expect(data.features.every(feature => feature.geometry.type === 'Point')).toBe(true);
  });
});
