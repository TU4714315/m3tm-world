import { describe, expect, it } from 'vitest';
import { delayedPublicNews, PUBLIC_EVENT_DELAY_MS, publicMapClientProjection, publicMixedMapPayload, restrictedMapEndpoint, visibleMapLayers } from './mapAccessPolicy';
const now = Date.parse('2026-10-15T12:00:00Z');
describe('published map access boundary', () => {
  it('publishes only source-dated news at the exact 12h boundary', () => {
    const dated = (id: string, time: number) => ({ id, published: new Date(time).toISOString() });
    expect(delayedPublicNews([dated('older', now-PUBLIC_EVENT_DELAY_MS), dated('new', now-PUBLIC_EVENT_DELAY_MS+1),
      { id: 'undated', fetchedAt: '2020-01-01' }, dated('future', now+1)], now).map(row=>row.id)).toEqual(['older']);
  });
  it('never sends blurred headlines, source URLs, counts, or freshest dates to the public', () => {
    const response = publicMixedMapPayload('news', { news: [{ title: 'PRIVATE-HEADLINE', url: 'https://example.org/private',
      published: new Date(now).toISOString() }], source_status: { count: 901 }, source_published_at: new Date(now).toISOString() }, now);
    expect(response).toMatchObject({ news: [], total: 0, delayHours: 12, source_published_at: null });
    expect(JSON.stringify(response)).not.toMatch(/PRIVATE|901|example.org/);
  });
  it('blocks alternate feeds and media entrances independently of URL layer flags', () => {
    for (const path of ['/api/reference-atlas', '/api/frontlines', '/api/conflicts', '/api/live-news', '/api/cctv/proxy',
      '/api/cctv/texas/snapshot', '/api/sdk/stream', '/api/ai/overview', '/api/satellites/orbit', '/api/aircraft', '/api/stats'])
      expect(restrictedMapEndpoint(path), path).toBe(true);
    expect(restrictedMapEndpoint('/api/map-access')).toBe(false);
    expect(restrictedMapEndpoint('/api/news')).toBe(false);
  });
  it('preserves civilian layers and locks URL/persisted military selections', () => {
    expect(visibleMapLayers({ military_activity:true, reference_atlas:true, maritime:true, day_night:true }, false))
      .toEqual({ military_activity:false, reference_atlas:false, maritime:true, day_night:true });
    expect(visibleMapLayers({ reference_atlas:true }, true)).toEqual({ reference_atlas:true });
  });
  it('removes all retained restricted map objects immediately on access loss', () => {
    const result = publicMapClientProjection({ cameras:[{name:'private-camera'}], military_activity:[{id:'private-plane'}],
      reference_atlas:{name:'private-area'}, frontlines:{features:[{name:'private-line'}]}, commercial_flights:[{id:'civilian'}], news:[] });
    expect(JSON.stringify(result)).not.toContain('private-');
    expect(result.commercial_flights).toEqual([{id:'civilian'}]);
  });
});
