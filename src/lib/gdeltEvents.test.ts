import { describe, it, expect } from 'vitest';
import { buildGdeltReportedRoutes, fetchGdeltEvents, QUAD_LABELS, toPublicGdeltEvent, type GdeltEvent } from './gdeltEvents';

/**
 * Live integration test — opt in with RUN_LIVE_TESTS=1 (hits the real GDELT
 * export host).
 *
 * data.gdeltproject.org now 301s every plain-HTTP request to its HTTPS origin,
 * including the http:// archive URLs printed in its own lastupdate.txt. The
 * reader follows redirects by re-entering itself, so an http-only client threw
 * `Protocol "https:" not supported` on the very first hop and the whole layer
 * went dark behind a 502. Nothing in a unit test would have caught that — it is
 * a fact about someone else's server, so it needs a real request to assert.
 */
const liveIt = process.env.RUN_LIVE_TESTS === '1' ? it : it.skip;

describe('fetchGdeltEvents', () => {
  it('builds generalized public event links without representing a movement trajectory', () => {
    const event: GdeltEvent = {
      id: '123', lat: 24.7136, lng: 46.6753, name: 'Riyadh, Saudi Arabia', country: 'SA',
      actor1_geo_type: 1, actor1_name: 'Yemen', actor1_country: 'YM', actor1_lat: 15.5527, actor1_lng: 48.5164,
      event_code: '190', root_code: '19', quad: 4, quad_label: QUAD_LABELS[4], goldstein: -10, tone: -8,
      articles: 5, sources: 3, url: 'https://example.com/public-report', date: '2026-09-25T00:00:00.000Z',
    };
    const routes = buildGdeltReportedRoutes([event]);
    expect(routes).toHaveLength(1);
    expect(routes[0]).toMatchObject({ route_kind: 'public-event-link', precision: 'generalized-0.25deg', not_trajectory: true, source_url: event.url, origin_label: 'موقع الفاعل المنشور', target_label: 'Riyadh, Saudi Arabia' });
    expect(routes[0].origin_lat * 4).toBe(Math.round(routes[0].origin_lat * 4));
    expect(routes[0].origin_lng * 4).toBe(Math.round(routes[0].origin_lng * 4));
    expect(routes[0].target_lat * 4).toBe(Math.round(routes[0].target_lat * 4));
    expect(routes[0].target_lng * 4).toBe(Math.round(routes[0].target_lng * 4));
  });

  it('drops same-place and non-conflict links, including antimeridian-adjacent points', () => {
    const base: GdeltEvent = {
      id: 'same', lat: 24.7, lng: 46.7, name: 'Riyadh', country: 'SA', actor1_lat: 24.7, actor1_lng: 46.7,
      event_code: '190', root_code: '19', quad: 4, quad_label: QUAD_LABELS[4], goldstein: -10, tone: -8,
      articles: 3, sources: 2, url: 'https://example.com/report', date: '2026-09-25T00:00:00.000Z',
    };
    expect(buildGdeltReportedRoutes([base])).toEqual([]);
    expect(buildGdeltReportedRoutes([{ ...base, id: 'cooperate', quad: 2, quad_label: QUAD_LABELS[2], actor1_lat: 15 }])).toEqual([]);
    expect(buildGdeltReportedRoutes([{ ...base, id: 'dateline', lat: 10, lng: -179.9, actor1_lat: 10, actor1_lng: 179.9 }])).toEqual([]);
  });

  it('strips raw Actor1 fields from the public event payload', () => {
    const event: GdeltEvent = {
      id: 'public', lat: 24.7, lng: 46.7, name: 'Riyadh', country: 'SA',
      actor1_geo_type: 1, actor1_name: 'Actor label', actor1_country: 'AA', actor1_lat: 15.5, actor1_lng: 48.5,
      event_code: '190', root_code: '19', quad: 4, quad_label: QUAD_LABELS[4], goldstein: -10, tone: -8,
      articles: 3, sources: 2, url: 'https://example.com/report', date: '2026-09-25T00:00:00.000Z',
    };
    const publicEvent = toPublicGdeltEvent(event);
    expect(publicEvent).not.toHaveProperty('actor1_geo_type');
    expect(publicEvent).not.toHaveProperty('actor1_name');
    expect(publicEvent).not.toHaveProperty('actor1_country');
    expect(publicEvent).not.toHaveProperty('actor1_lat');
    expect(publicEvent).not.toHaveProperty('actor1_lng');
    expect(publicEvent).toMatchObject({ id: 'public', lat: 24.7, lng: 46.7, name: 'Riyadh' });
  });
  liveIt('follows the http -> https redirect and returns geocoded events', async () => {
    const { events, window, scanned } = await fetchGdeltEvents({ limit: 50 });

    expect(window).toMatch(/^\d{14}\.export\.CSV\.zip$/);
    expect(scanned).toBeGreaterThan(0);
    expect(events.length).toBeGreaterThan(0);
    expect(events.length).toBeLessThanOrEqual(50);

    for (const e of events) {
      expect(Number.isFinite(e.lat) && Number.isFinite(e.lng)).toBe(true);
      expect(Math.abs(e.lat)).toBeLessThanOrEqual(90);
      expect(Math.abs(e.lng)).toBeLessThanOrEqual(180);
      // Null island is the ungeocoded artefact the reader is meant to drop.
      expect(e.lat === 0 && e.lng === 0).toBe(false);
    }
  }, 60_000);

  liveIt('honours the quad filter', async () => {
    const { events } = await fetchGdeltEvents({ quads: [4], limit: 25 });

    for (const e of events) {
      expect(e.quad).toBe(4);
      expect(e.quad_label).toBe(QUAD_LABELS[4]);
    }
  }, 60_000);
});
