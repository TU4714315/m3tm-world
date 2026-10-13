import { describe, expect, it } from 'vitest';
import { PUBLIC_MAP_MARKER_LAYERS, hidePublicMapMarkers, QUIET_PUBLIC_EVENT_LAYERS, reducePublicEventClutter, restorePublicEventClutter } from './publicEmbedView';

describe('public embed source-preserving display presets', () => {
  const layers = {
    country_borders: true, conflict_zones: true, frontlines: true,
    app_news: true, military_activity: true, naval_activity: true,
    conflict_density: true, reported_routes: true, gdelt_events: true,
    civil_unrest: true, global_incidents: true, alert_pins: true,
    military: false, private: false,
  };

  it('reduces visual event clutter without suppressing wars, public news, borders or coarse military data', () => {
    const quiet = reducePublicEventClutter(layers);
    for (const key of QUIET_PUBLIC_EVENT_LAYERS) expect(quiet[key]).toBe(false);
    expect(quiet.conflict_zones).toBe(true);
    expect(quiet.frontlines).toBe(true);
    expect(quiet.country_borders).toBe(true);
    expect(quiet.app_news).toBe(true);
    expect(quiet.military_activity).toBe(true);
    expect(quiet.military).toBe(false);
    expect(layers.conflict_density).toBe(true);
  });

  it('restores only preset-controlled event layers while retaining changes to other toggles', () => {
    const quiet = reducePublicEventClutter(layers);
    const changed = { ...quiet, country_borders: false, conflict_zones: false };
    const restored = restorePublicEventClutter(changed, layers);
    for (const key of QUIET_PUBLIC_EVENT_LAYERS) expect(restored[key]).toBe(layers[key]);
    expect(restored.country_borders).toBe(false);
    expect(restored.conflict_zones).toBe(false);
  });
  it('hides only rendered public markers while preserving source layers, borders and polygon context', () => {
    const markerLayers = {
      ...layers, live_news: true, flights: true, sdk_air: true,
      fires: true, country_borders: true, frontlines: true,
      conflict_zones: true, conflict_density: true,
    };
    const hidden = hidePublicMapMarkers(markerLayers, false);
    for (const key of PUBLIC_MAP_MARKER_LAYERS) {
      if (key in markerLayers) expect(hidden[key as keyof typeof markerLayers]).toBe(false);
    }
    expect(hidden.country_borders).toBe(true);
    expect(hidden.frontlines).toBe(true);
    expect(hidden.conflict_zones).toBe(true);
    expect(hidden.conflict_density).toBe(true);
    expect(markerLayers.app_news).toBe(true);
    expect(markerLayers.flights).toBe(true);
    expect(hidePublicMapMarkers(markerLayers, true)).toBe(markerLayers);
  });

  it('restores newly chosen layer visibility when the icon filter is removed', () => {
    const hidden = hidePublicMapMarkers({ ...layers, app_news: true }, false);
    expect(hidden.app_news).toBe(false);
    const toggled = { ...layers, app_news: false, alert_pins: true };
    const visible = hidePublicMapMarkers(toggled, true);
    expect(visible.app_news).toBe(false);
    expect(visible.alert_pins).toBe(true);
  });

});
