import { describe, expect, it } from 'vitest';
import { countryDigitalReportClusters, sharedCountryOutageContexts } from './publicDigitalClusters';

const NOW = Date.parse('2026-10-13T12:00:00Z');
const outage = (id: string, overrides: Record<string, unknown> = {}) => ({
  id,
  country: 'YE',
  lat: 14.5, lng: 40.5, // intentionally WRONG: never use an individual observation location
  source: 'Cloudflare Radar',
  event_type: 'OUTAGE',
  start: '2026-10-12T14:00:00Z',
  ...overrides,
});

describe('countryDigitalReportClusters', () => {
  it('shows a source-backed country aggregate, not a geographical device cluster', () => {
    expect(countryDigitalReportClusters([outage('a'), outage('b')], NOW)).toEqual([{
      country: 'YE', lng: 48, lat: 15.5,
      report_count: 2, latest_report_utc: '2026-10-12T14:00:00.000Z',
      source: 'Cloudflare Radar', precision: 'country-centroid-display-only',
      evidence: 'multiple-provider-annotations-not-independent',
      label_ar: 'تجمع مؤشرات رقمية',
    }]);
  });
  it('removes reports after the public 24-hour display period', () => {
    expect(countryDigitalReportClusters([outage('a'), outage('b')], NOW + 25 * 60 * 60_000)).toEqual([]);
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

describe('sharedCountryOutageContexts', () => {
  it('connects national display centroids ONLY for one verified provider outage ID', () => {
    const reports = [
      outage('x-YE', {annotation_id:'same-annotation', country:'YE', end:null}),
      outage('x-OM', {annotation_id:'same-annotation', country:'OM', end:null}),
    ];
    const links = sharedCountryOutageContexts(reports, NOW);
    expect(links).toHaveLength(1);
    expect(links[0]).toMatchObject({
      from_country:'OM', to_country:'YE',
      source:'Cloudflare Radar',
      relation:'shared-reported-outage-not-network-link',
      precision:'country-centroid-display-only',
      reported_ongoing:true,
    });
    expect(links[0].from).toEqual([56,21]);
    expect(links[0].to).toEqual([48,15.5]);
  });
  it('shows no links between independently reported national outages', () => {
    expect(sharedCountryOutageContexts([
      outage('x', {annotation_id:'a',country:'YE'}),
      outage('y', {annotation_id:'b',country:'OM'}),
    ],NOW)).toEqual([]);
  });
  it('rejects fallback cyber reports, same-country duplicates and outdated annotations', () => {
    expect(sharedCountryOutageContexts([
      outage('a', {annotation_id:'xyz',country:'YE',source:'GDELT 2.0 · CAMEO 176'}),
      outage('b', {annotation_id:'xyz',country:'OM',source:'GDELT 2.0 · CAMEO 176'}),
      outage('c', {annotation_id:'dup',country:'YE'}),
      outage('d', {annotation_id:'dup',country:'YE'}),
      outage('e', {annotation_id:'old',country:'YE',start:'2026-10-10T00:00:00Z'}),
      outage('f', {annotation_id:'old',country:'OM',start:'2026-10-10T00:00:00Z'}),
    ],NOW)).toEqual([]);
  });
  it('derives reported duration only from event timestamps', () => {
    const links = sharedCountryOutageContexts([
      outage('x', {annotation_id:'end-event',country:'YE',end:'2026-10-12T15:30:00Z'}),
      outage('y', {annotation_id:'end-event',country:'OM',end:'2026-10-12T15:30:00Z'}),
    ],NOW);
    expect(links[0].reported_duration_minutes).toBe(90);
    expect(links[0].reported_ongoing).toBe(false);
  });
});
