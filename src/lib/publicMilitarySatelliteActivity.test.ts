import { describe, expect, it } from 'vitest';
import {
  buildPublicMilitarySatelliteActivity,
  PUBLIC_MILITARY_SATELLITE_CELL_DEG,
  PUBLIC_MILITARY_SATELLITE_MIN_GROUP,
} from './publicMilitarySatelliteActivity';

describe('public military satellite activity', () => {
  it('projects military TLE rows into coarse cells without identifiers or exact tracks', () => {
    const result = buildPublicMilitarySatelliteActivity([
      { lat: 11.1, lng: 21.1, alt: 500, mission: 'Military Recon', category: 'military' },
      { lat: 12.4, lng: 22.3, alt: 520, mission: 'Military Recon', category: 'military' },
      { lat: 13.8, lng: 24.9, alt: 540, mission: 'Early Warning', category: 'military' },
      { lat: -40, lng: 90, alt: 800, mission: 'Military Recon', category: 'military' },
      { lat: 1, lng: 1, alt: 20000, mission: 'Navigation', category: 'navigation' },
    ], Date.UTC(2026, 8, 30, 12, 34));

    expect(PUBLIC_MILITARY_SATELLITE_CELL_DEG).toBeGreaterThanOrEqual(20);
    expect(PUBLIC_MILITARY_SATELLITE_MIN_GROUP).toBeGreaterThanOrEqual(3);
    expect(result.activity).toHaveLength(1);
    expect(result.activity[0]).toMatchObject({
      lat: 20,
      lng: 30,
      approximate_count: '3-5',
      average_altitude_band: 'LEO',
      cell_degrees: 20,
      observed_at_bucket: '2026-09-30T12:00:00.000Z',
      reporting_mode: 'coarse-public-tle-propagation',
    });
    expect(JSON.stringify(result.activity)).not.toMatch(/norad|name|id|track/i);
    expect(result.summary).toMatchObject({
      catalog_objects: 4,
      represented_objects: 3,
      withheld_sparse_objects: 1,
    });
    expect(result.meta).toMatchObject({
      identifiers_exposed: false,
      names_exposed: false,
      exact_tracks_exposed: false,
      propagated_estimate: true,
    });
  });

  it('returns no fake cells when the source has no qualifying military group', () => {
    const result = buildPublicMilitarySatelliteActivity([
      { lat: 10, lng: 10, alt: 500, category: 'military', mission: 'Military Recon' },
      { lat: 11, lng: 11, alt: 500, category: 'military', mission: 'Military Recon' },
      { lat: 12, lng: 12, alt: 500, category: 'navigation', mission: 'Navigation' },
    ], 0);

    expect(result.activity).toEqual([]);
    expect(result.summary.catalog_objects).toBe(2);
    expect(result.summary.represented_objects).toBe(0);
    expect(result.summary.withheld_sparse_objects).toBe(2);
  });

  it('ignores invalid coordinates instead of manufacturing a location', () => {
    const result = buildPublicMilitarySatelliteActivity([
      { lat: 999, lng: 1, alt: 500, category: 'military', mission: 'Military Recon' },
      { lat: Number.NaN, lng: 1, alt: 500, category: 'military', mission: 'Military Recon' },
      { lat: 0, lng: 181, alt: 500, category: 'military', mission: 'Military Recon' },
    ], 0);
    expect(result.activity).toEqual([]);
  });
});
