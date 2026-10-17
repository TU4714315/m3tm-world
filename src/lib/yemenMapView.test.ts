import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { restoreYemenMapLayers, YEMEN_MONITOR_LAYERS } from './yemenMapView';
import { reducePublicEventClutter, hidePublicMapMarkers } from './publicEmbedView';

describe('Yemen monitoring focus', () => {
  it('restores events, boundaries and areas after a saved empty/quiet view', () => {
    const hidden = Object.fromEntries(YEMEN_MONITOR_LAYERS.map(key => [key, false]));
    const quiet = reducePublicEventClutter(hidden);
    const restored = restoreYemenMapLayers(quiet);
    for (const key of YEMEN_MONITOR_LAYERS) expect(restored[key], key).toBe(true);
    expect(hidden.reference_atlas).toBe(false);
    const visible = hidePublicMapMarkers(restored, true);
    expect(visible.gdelt_events).toBe(true);
    expect(visible.alert_pins).toBe(true);
  });
  it('preserves weather, aviation, display settings and future capabilities', () => {
    const preferences = { wind: true, rain: false, flights: false, day_night: true, terrain_elevation: false, future_layer: true };
    const restored = restoreYemenMapLayers(preferences);
    for (const [key, value] of Object.entries(preferences)) expect(restored[key as keyof typeof preferences]).toBe(value);
  });
  it('uses one shared action for desktop and embedded/mobile Yemen buttons', () => {
    const source = readFileSync(new URL('../app/page.tsx', import.meta.url), 'utf8');
    expect(source.match(/onClick=\{focusYemenMonitoring\}/g)).toHaveLength(2);
    const action = source.slice(source.indexOf('const focusYemenMonitoring ='), source.indexOf('const displayedMapLayers ='));
    expect(action).toContain('setShowPublicMapMarkers(true)');
    expect(action).toContain('setPublicEmbedQuiet(false)');
    expect(action).toContain('setActiveLayers(previous => restoreYemenMapLayers(previous))');
  });
});
