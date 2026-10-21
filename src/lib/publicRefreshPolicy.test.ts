import { describe, expect, it } from 'vitest';
import { PUBLIC_REFRESH_MS, significantCyberIndicators, canRefreshDailyPublicMapPath, isDailyPublicMapPath } from './publicRefreshPolicy';

describe('public WORLD regional refresh schedule', () => {
  const DAY = 24 * 60 * 60 * 1000;
  it('keeps heavy map snapshots daily and fast APP news separate', () => {
    expect(PUBLIC_REFRESH_MS.menaPublishedEvents).toBe(DAY);
    expect(PUBLIC_REFRESH_MS.militaryRegionalFlightAggregate).toBe(DAY);
    expect(PUBLIC_REFRESH_MS.newsTicker).toBe(60_000);
    expect(PUBLIC_REFRESH_MS.markets).toBe(DAY);
    expect(PUBLIC_REFRESH_MS.internetObservations).toBe(DAY);
    expect(PUBLIC_REFRESH_MS.commercialMaritime).toBe(DAY);
    expect(PUBLIC_REFRESH_MS.submarineCableReference).toBe(DAY);
    expect(PUBLIC_REFRESH_MS.worldwidePublishedFrontlines).toBe(DAY);
    expect(PUBLIC_REFRESH_MS.cyberThreatSummary).toBe(DAY);
    expect(PUBLIC_REFRESH_MS.publicSatelliteCatalog).toBe(DAY);
  });
  it('keeps the neighboring archives on a daily tier', () => {
    expect(PUBLIC_REFRESH_MS.africanNeighboringConflictArchive).toBe(DAY);
    expect(PUBLIC_REFRESH_MS.ukraineConflictArchive).toBe(DAY);
  });
  it('checks the shared atlas at a daily cadence', () => {
    expect(PUBLIC_REFRESH_MS.referenceAtlasCheck).toBe(DAY);
    expect(PUBLIC_REFRESH_MS.worldwidePublishedFrontlines).toBe(DAY);
  });
  it('does not throttle approved APP news or authentication while gating map snapshots', () => {
    expect(isDailyPublicMapPath('/api/flights')).toBe(true);
    expect(isDailyPublicMapPath('/api/gdelt-events?quad=3')).toBe(true);
    expect(isDailyPublicMapPath('/api/news')).toBe(false);
    expect(isDailyPublicMapPath('/api/map-access')).toBe(false);
    expect(canRefreshDailyPublicMapPath('/api/gdelt', undefined, 100)).toBe(true);
    expect(canRefreshDailyPublicMapPath('/api/gdelt', 100, 100 + DAY - 1)).toBe(false);
    expect(canRefreshDailyPublicMapPath('/api/gdelt', 100, 100 + DAY)).toBe(true);
    expect(canRefreshDailyPublicMapPath('/api/news', 100, 101)).toBe(true);
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
