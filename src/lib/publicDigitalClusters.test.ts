import { describe, expect, it } from 'vitest';
import { countryDigitalReportClusters } from './publicDigitalClusters';

const NOW = Date.parse('2026-10-13T12:00:00Z');
const outage = (id: string, overrides: Record<string, unknown> = {}) => ({
  id,
  country: 'YE',
  lat: 14.5, lng: 40.5, // intentionally WRONG: never use an individual observation location
  source: 'Cloudflare Radar',
  event_type: 'OUTAGE',
  start: '2026-10-12T10:00:00Z',
  ...overrides,
});

describe('countryDigitalReportClusters', () => {
  it('shows a source-backed country aggregate, not a geographical device cluster', () => {
    expect(countryDigitalReportClusters([outage('a'), outage('b')], NOW)).toEqual([{
      country: 'YE', lng: 48, lat: 15.5,
      report_count: 2, latest_report_utc: '2026-10-12T10:00:00.000Z',
      source: 'Cloudflare Radar', precision: 'country-centroid-display-only',
      evidence: 'multiple-provider-annotations-not-independent',
      label_ar: 'تجمع مؤشرات رقمية',
    }]);
  });
  it('does not convert one observation or duplicates into a cluster', () => {
    expect(countryDigitalReportClusters([outage('one'), outage('one')], NOW)).toEqual([]);
  });
  it('rejects unverified source, unknown country, stale, invalid and future-dated data', () => {
    const data = [
      outage('a', { source: 'GDELT 2.0 · CAMEO 176' }),
      outage('b', { country: 'ZZ' }),
      outage('c', { start: '2026-01-01T00:00:00Z' }),
      outage('d', { start: 'invalid' }),
      outage('e', { start: '2026-10-14T00:00:00Z' }),
      outage('f', { event_type: 'REPORTED_CYBER_EVENT' }),
    ];
    expect(countryDigitalReportClusters(data, NOW)).toEqual([]);
  });
  it('never guesses a country from raw coordinates when country field is absent', () => {
    expect(countryDigitalReportClusters([outage('a', { country: null }), outage('b', { country: null })], NOW)).toEqual([]);
  });
  it('keeps distinct national aggregates separate without inferring a shared physical site', () => {
    const clusters = countryDigitalReportClusters([
      outage('a'), outage('b'),
      outage('c', { country: 'SA' }), outage('d', { country: 'SA' }),
    ], NOW);
    expect(clusters.map(c => c.country)).toEqual(['SA', 'YE']);
    expect(clusters.every(c => c.precision === 'country-centroid-display-only')).toBe(true);
  });
});
