import { describe, expect, it } from 'vitest';
import { inSaudiPublicBoundary, isSaudiPublicIndicator, maskSaudiPublicIndicators, maskSaudiPublicNewsLocation } from './publicCountryVisibility';

describe('Saudi-only public observation visibility', () => {
  it('publishes flight counts from the visible lists, including stale fallback cells', () => {
    const source = {
      commercial_flights: [{ lat: 24.7, lng: 46.7 }, { lat: 15.4, lng: 44.2 }],
      private_flights: [], private_jets: [], total: 5,
      civilian_flight_activity: [{ lat: 25, lng: 47 }, { lat: 15, lng: 45 }],
      civilian_flight_activity_meta: { public_total: 2, fallback_cells: 2, fallback_active: true },
      flight_source_status: { public_total: 2, status: 'degraded' },
    };
    const visible = maskSaudiPublicIndicators(source);
    expect(visible.commercial_flights).toHaveLength(1);
    expect(visible.total).toBe(1);
    expect(visible.civilian_flight_activity_meta).toEqual({ public_total: 1, fallback_cells: 1, fallback_active: true });
    expect(visible.flight_source_status).toEqual({ public_total: 1, status: 'degraded', civilian_fallback_cells: 1, military_public_cells: 0 });
    expect(source.total).toBe(5);
    expect(source.civilian_flight_activity_meta.public_total).toBe(2);
  });
  it('retains cited public headlines but strips Saudi API coordinates', () => {
    const saudi = { title: 'خبر منشور', link: 'https://example.org', coords: [24.7136, 46.6753], coords_default: false, location_basis: 'published-feed-coordinate' };
    const yemen = { title: 'خبر اليمن', coords: [15.3694, 44.191], coords_default: false, location_basis: 'published-feed-coordinate' };
    expect(maskSaudiPublicNewsLocation(saudi)).toMatchObject({ title: 'خبر منشور', coords: null, coords_default: true, location_basis: 'none' });
    expect(maskSaudiPublicNewsLocation(yemen)).toEqual(yemen);
  });
  it('uses a country boundary rather than a Middle-East bounding box', () => {
    expect(inSaudiPublicBoundary(24.7136, 46.6753)).toBe(true); // Riyadh
    expect(inSaudiPublicBoundary(21.4858, 39.1925)).toBe(true); // Jeddah
    expect(inSaudiPublicBoundary(15.3694, 44.1910)).toBe(false); // Sana'a
    expect(inSaudiPublicBoundary(12.7855, 45.0187)).toBe(false); // Aden
    expect(inSaudiPublicBoundary(33.3152, 44.3661)).toBe(false); // Baghdad
    expect(inSaudiPublicBoundary(23.5880, 58.3829)).toBe(false); // Muscat
  });

  it('recognizes explicit Saudi country tags and GeoJSON without guessing unlocated news', () => {
    expect(isSaudiPublicIndicator({ country: 'SA', lat: 15.3, lng: 44.2 })).toBe(true);
    expect(isSaudiPublicIndicator({ country: 'Saudi Arabia' })).toBe(true);
    expect(isSaudiPublicIndicator({ country: 'السعودية' })).toBe(true);
    expect(isSaudiPublicIndicator({ country: 'YE', lat: 15.3, lng: 44.2 })).toBe(false);
    expect(isSaudiPublicIndicator({ country: 'YE', lat: 18.6, lng: 44.4 })).toBe(false);
    expect(isSaudiPublicIndicator({ title: 'Saudi Arabia mentioned in a world news article' })).toBe(false);
    expect(isSaudiPublicIndicator({ type: 'Feature', geometry: { type: 'Point', coordinates: [46.6753, 24.7136] }, properties: {} })).toBe(true);
    expect(isSaudiPublicIndicator({ origin_lat: 15.3694, origin_lng: 44.1910, target_lat: 33.3152, target_lng: 44.3661 })).toBe(true);
  });

  it('removes only Saudi observation markers; leaves Yemen, other countries, source metadata, borders, and inputs intact', () => {
    const original = {
      gdelt_events: [{ country: 'SA', id: 'sa' }, { country: 'YE', lat: 15.3, lng: 44.2, id: 'ye' }, { country: 'IQ', id: 'iq' }],
      cf_outages: [{ country: 'SA', id: 'sa-digital' }, { country: 'YE', id: 'ye-digital' }],
      app_news: [{ lat: 24.7, lng: 46.6, id: 'sa-news' }, { lat: 12.78, lng: 45.01, id: 'aden-news' }],
      reported_routes: [{ origin_lat: 24.7, origin_lng: 46.6, target_lat: 15.3, target_lng: 44.2, id: 'sa-to-ye' }],
      frontlines: { type: 'FeatureCollection', features: [{ properties: { country: 'SA' } }, { properties: { country: 'YE' } }] },
      country_boundaries: { type: 'FeatureCollection', features: [{ country: 'SA' }] },
      source_status: { status: 'active' },
    };
    const result = maskSaudiPublicIndicators(original);
    expect(result.gdelt_events.map(row => row.id)).toEqual(['ye', 'iq']);
    expect(result.cf_outages.map(row => row.id)).toEqual(['ye-digital']);
    expect(result.app_news.map(row => row.id)).toEqual(['aden-news']);
    expect(result.reported_routes).toEqual([]);
    expect(result.frontlines.features).toHaveLength(1);
    expect(result.country_boundaries).toEqual(original.country_boundaries);
    expect(result.source_status).toEqual(original.source_status);
    expect(original.gdelt_events).toHaveLength(3);
  });

  it('masks direct public API lists, nested zone events and recomputes public counts', () => {
    const source = {
      events: [{ id: 'riyadh', lat: 24.7, lng: 46.7 }, { id: 'sanaa', lat: 15.4, lng: 44.2 }],
      zones: [{ country: 'SA', events: [{ id: 'sa' }] }, { country: 'YE', events: [{ country: 'SA' }, { country: 'YE' }] }],
      outages: [{ country: 'SA' }, { country: 'YE' }],
      total: 2, totalZones: 2, total_outages: 2,
    };
    const masked = maskSaudiPublicIndicators(source);
    expect(masked.events.map(event => event.id)).toEqual(['sanaa']);
    expect(masked.zones).toEqual([expect.objectContaining({
      country: 'YE', events: [{ country: 'YE' }], eventCount: 1,
      eventKinds: { other: 1 }, dominantKind: 'other', activityBand: 'quiet',
    })]);
    expect(masked.outages).toEqual([{ country: 'YE' }]);
    expect([masked.total, masked.totalZones, masked.total_outages]).toEqual([1, 1, 1]);
    expect(source.zones[1].events).toHaveLength(2);
  });
  it('filters URLhaus detections and totals at the public snapshot boundary', () => {
    const masked = maskSaudiPublicIndicators({
      threats: [
        { ip: '198.51.100.10', country: 'SA', lat: 24.7, lng: 46.6 },
        { ip: '198.51.100.20', country: 'YE', lat: 15.3, lng: 44.2 },
      ],
      total: 2,
    });
    expect(masked.total).toBe(1);
    expect(masked.threats.map(row => row.country)).toEqual(['YE']);
  });
});
