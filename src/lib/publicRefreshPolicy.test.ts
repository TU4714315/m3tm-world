import { describe, expect, it } from 'vitest';
import { PUBLIC_REFRESH_MS, significantCyberIndicators } from './publicRefreshPolicy';

describe('public WORLD regional refresh schedule', () => {
  const DAY = 24 * 60 * 60 * 1000;
  it('keeps published MENA incidents on fast cadence while reference layers are daily', () => {
    expect(PUBLIC_REFRESH_MS.menaPublishedEvents).toBe(60_000);
    expect(PUBLIC_REFRESH_MS.commercialMaritime).toBe(DAY);
    expect(PUBLIC_REFRESH_MS.submarineCableReference).toBe(DAY);
    expect(PUBLIC_REFRESH_MS.worldwidePublishedFrontlines).toBe(DAY);
    expect(PUBLIC_REFRESH_MS.cyberThreatSummary).toBe(DAY);
    expect(PUBLIC_REFRESH_MS.publicSatelliteCatalog).toBe(DAY);
  });
  it('reserves a 12h archival tier for neighboring African countries and a daily Ukraine tier', () => {
    expect(PUBLIC_REFRESH_MS.africanNeighboringConflictArchive).toBe(12 * 60 * 60 * 1000);
    expect(PUBLIC_REFRESH_MS.ukraineConflictArchive).toBe(DAY);
  });
  it('only shows the highest severity-coded public cyber indicators', () => {
    const sample = [
      { id: 'minor', severity: 5 },
      { id: 'strong', severity: 9 },
      { id: 'moderate', severity: 8 },
      { id: 'peak', severity: 10 },
      { id: 'invalid', severity: 'nan' },
    ];
    expect(significantCyberIndicators(sample, 2).map(entry => entry.id)).toEqual(['peak', 'strong']);
    expect(significantCyberIndicators('not-data')).toEqual([]);
    expect(significantCyberIndicators(sample, 0)).toEqual([]);
  });
});
