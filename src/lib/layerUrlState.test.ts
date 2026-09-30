import { describe, expect, it } from 'vitest';
import { restoreLayerState, serializeLayerState } from './layerUrlState';

const defaults = {
  flights: true, conflict_zones: true, cctv: true,
  app_news: true, country_borders: true, sat_military_activity: true,
  weather: false,
};

describe('versioned WORLD layer bookmarks', () => {
  it('does not disable newly added source-backed layers when an old bookmark is reopened', () => {
    const restored = restoreLayerState(defaults, new URLSearchParams('surface=public&layers=flights%2Cconflict_zones'));
    expect(restored).toEqual({
      flights: true, conflict_zones: true, cctv: false,
      app_news: true, country_borders: true, sat_military_activity: true, weather: false,
    });
  });

  it('honors explicit off choices from v2 URLs, including new layers', () => {
    const restored = restoreLayerState(defaults, new URLSearchParams('layers_v=2&layers=flights'));
    expect(restored).toEqual({
      flights: true, conflict_zones: false, cctv: false,
      app_news: false, country_borders: false, sat_military_activity: true, weather: false,
    });
  });

  it('honors an unversioned URL that already contains a newly added key', () => {
    const restored = restoreLayerState(defaults, new URLSearchParams('layers=flights%2Capp_news'));
    expect(restored.app_news).toBe(true);
    expect(restored.country_borders).toBe(false);
    expect(restored.sat_military_activity).toBe(true);
  });

  it('honors an explicit schema-v3 opt-out for the new layer', () => {
    const restored = restoreLayerState(defaults, new URLSearchParams('layers_v=3&layers=flights'));
    expect(restored.sat_military_activity).toBe(false);
  });

  it('round-trips an explicitly disabled layer state with the URL schema marker', () => {
    const selected = { ...defaults, app_news: false, country_borders: false, cctv: false };
    const params = serializeLayerState(selected, new URLSearchParams('surface=public&foo=bar'));
    expect(params.get('layers_v')).toBe('3');
    expect(params.get('surface')).toBe('public');
    expect(params.get('foo')).toBe('bar');
    expect(restoreLayerState(defaults, params)).toEqual(selected);
  });

  it('does not modify defaults when the URL has no layer preference', () => {
    expect(restoreLayerState(defaults, new URLSearchParams('surface=public'))).toBe(defaults);
  });
});
