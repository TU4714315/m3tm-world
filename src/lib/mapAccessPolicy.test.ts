import { describe, expect, it } from 'vitest';
import { delayedPublicNews, PUBLIC_EVENT_DELAY_MS, publishedMapPayload, publicMapClientProjection, publicMixedMapPayload, restrictedMapEndpoint, visibleMapLayers } from './mapAccessPolicy';
const now = Date.parse('2026-10-15T12:00:00Z');
describe('published map access boundary', () => {
  it.each([
    ['flights', 'military_activity', 'public-adsb-aggregate', 6],
    ['maritime', 'naval_activity', 'public-ais-aggregate', 6],
    ['satellites', 'military_satellite_activity', 'coarse-public-tle-propagation', 20],
  ] as const)('retains safe %s aggregates without identifiers or exact tracks', (kind, field, mode, degrees) => {
    const cell = { lat: 3, lng: 3, cell_degrees: degrees, reporting_mode: mode, level: 2,
      approximate_count: '3-5', callsign: 'RAW-IDENTIFIER', raw_tle: 'RAW-TLE' };
    const result = publishedMapPayload(kind, { [field]: [cell, {...cell, cell_degrees: 0.01}], raw_count: 100,
      military_flights: [{callsign: 'RAW-IDENTIFIER'}] });
    expect(result[field]).toEqual([{ lat: 3, lng: 3, cell_degrees: degrees, reporting_mode: mode, level: 2, approximate_count: '3-5' }]);
    expect(JSON.stringify(result)).not.toMatch(/RAW-IDENTIFIER|RAW-TLE|raw_count/);
  });
  it('publishes only source-dated news at the exact 12h boundary', () => {
    const dated = (id: string, time: number) => ({ id, published: new Date(time).toISOString() });
    expect(delayedPublicNews([dated('older', now-PUBLIC_EVENT_DELAY_MS), dated('new', now-PUBLIC_EVENT_DELAY_MS+1),
      { id: 'undated', fetchedAt: '2020-01-01' }, dated('future', now+1)], now).map(row=>row.id)).toEqual(['older']);
  });
  it('publishes current Yemen news immediately while dropping undated/future records', () => {
    const response = publicMixedMapPayload('news', { news: [
      { id: 'yemen', title: 'خبر اليمن الآن', published: new Date(now).toISOString() },
      { id: 'future', published: new Date(now + 1).toISOString() }, { id: 'undated' },
    ], source_status: { count: 901 } }, now);
    expect(response).toMatchObject({ news: [{ id: 'yemen' }], total: 1, delayHours: 0, access: 'public-published' });
    expect(response).not.toHaveProperty('source_status');
  });
  it('blocks alternate feeds and media entrances independently of URL layer flags', () => {
    for (const path of ['/api/reference-atlas', '/api/frontlines', '/api/conflicts', '/api/live-news', '/api/cctv/proxy',
      '/api/cctv/texas/snapshot', '/api/sdk/stream', '/api/ai/overview', '/api/satellites/orbit', '/api/aircraft', '/api/stats'])
      expect(restrictedMapEndpoint(path), path).toBe(true);
    expect(restrictedMapEndpoint('/api/map-access')).toBe(false);
    expect(restrictedMapEndpoint('/api/news')).toBe(false);
  });
  it('keeps all published URL/persisted layer selections operable without a grant', () => {
    expect(visibleMapLayers({ military_activity:true, reference_atlas:true, maritime:true, day_night:true }, false))
      .toEqual({ military_activity:true, reference_atlas:true, maritime:true, day_night:true });
    expect(visibleMapLayers({ reference_atlas:true }, true)).toEqual({ reference_atlas:true });
  });
  it('retains published maps and cameras but strips private enrichment and exact military tracks', () => {
    const result = publicMapClientProjection({ cameras:[{name:'published-camera'}], military_activity:[{id:'exact-plane'}],
      reference_atlas:{name:'published-area'}, frontlines:{features:[]}, military_flights:[{id:'exact-plane'}],
      region_dossier:{secret:'private-dossier'}, commercial_flights:[{id:'civilian'}], news:[] });
    expect(JSON.stringify(result)).not.toMatch(/exact-plane|private-dossier/);
    expect(result.cameras).toEqual([{name:'published-camera'}]);
    expect(result.reference_atlas).toEqual({name:'published-area'});
    expect(result.commercial_flights).toEqual([{id:'civilian'}]);
  });
});
