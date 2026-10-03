import { describe, expect, it } from 'vitest';
import { restoreLayerState, serializeLayerState } from './layerUrlState';

const defaults = {
  flights: true, cctv: true,
  app_news: true, country_borders: true,
  military_activity: true, maritime: true, naval_activity: true,
  private: true, jets: true, sdk_air: true, cf_outages: true, cf_attacks: true,
  conflict_zones: true, conflict_density: true, frontlines: true, reported_routes: true,
  gdelt_events: true, civil_unrest: true, alert_pins: true, global_incidents: true,
  weather: false,
};

describe('versioned WORLD layer bookmarks', () => {
  it('migrates a v3 bookmark only to the newly promoted v4 defaults', () => {
    const restored = restoreLayerState(defaults, new URLSearchParams('layers_v=3&layers=flights'));
    expect(restored.flights).toBe(true);
    expect(restored.cctv).toBe(false);
    expect(restored.military_activity).toBe(false);
    expect(restored.maritime).toBe(false);
    expect(restored.naval_activity).toBe(false);
    expect(restored.conflict_zones).toBe(false);
    expect(restored.private).toBe(true);
    expect(restored.jets).toBe(true);
    expect(restored.sdk_air).toBe(true);
    expect(restored.cf_outages).toBe(true);
    expect(restored.cf_attacks).toBe(true);
  });

  it('still applies v3 and v4 defaults to bookmarks that predate v3', () => {
    const restored = restoreLayerState(defaults, new URLSearchParams('layers_v=2&layers=flights'));
    expect(restored.military_activity).toBe(true);
    expect(restored.maritime).toBe(true);
    expect(restored.naval_activity).toBe(true);
    expect(restored.conflict_zones).toBe(true);
    expect(restored.gdelt_events).toBe(true);
    expect(restored.civil_unrest).toBe(true);
    expect(restored.alert_pins).toBe(true);
    expect(restored.private).toBe(true);
    expect(restored.jets).toBe(true);
    expect(restored.sdk_air).toBe(true);
  });

  it('preserves explicit off choices once the URL is v4', () => {
    const restored = restoreLayerState(defaults, new URLSearchParams('layers_v=4&layers=flights'));
    expect(restored.flights).toBe(true);
    expect(restored.military_activity).toBe(false);
    expect(restored.naval_activity).toBe(false);
    expect(restored.private).toBe(false);
    expect(restored.jets).toBe(false);
    expect(restored.sdk_air).toBe(false);
    expect(restored.cf_outages).toBe(false);
    expect(restored.cf_attacks).toBe(false);
    expect(restored.conflict_zones).toBe(false);
    expect(restored.civil_unrest).toBe(false);
  });

  it('round-trips an explicitly disabled layer state with the v4 schema marker', () => {
    const selected = {
      ...defaults,
      military_activity: false,
      naval_activity: false,
      conflict_zones: false,
      civil_unrest: false,
      cctv: false,
    };
    const params = serializeLayerState(selected, new URLSearchParams('surface=public&foo=bar'));
    expect(params.get('layers_v')).toBe('4');
    expect(params.get('surface')).toBe('public');
    expect(params.get('foo')).toBe('bar');
    expect(restoreLayerState(defaults, params)).toEqual(selected);
  });

  it('does not modify defaults when the URL has no layer preference', () => {
    expect(restoreLayerState(defaults, new URLSearchParams('surface=public'))).toBe(defaults);
  });
});
