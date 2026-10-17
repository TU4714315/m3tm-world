import { describe, expect, it } from 'vitest';
import { stageMapLayers } from './mapStartupLayers';

const requested = Object.freeze({
  reference_atlas: true, conflict_density: true, frontlines: true,
  reported_routes: true, cables: true, fires: true,
  conflict_zones: true, gdelt_events: true, app_news: true,
  alert_pins: true, military_activity: true, country_borders: true,
  naval_activity: true, day_night: false,
});
describe('progressive public visual startup', () => {
  it('keeps the verified alerts and regional public events immediately', () => {
    const staged = stageMapLayers(requested, false);
    expect(staged).toMatchObject({
      conflict_zones: true, gdelt_events: true, app_news: true,
      alert_pins: true, military_activity: true, country_borders: true,
      naval_activity: true, day_night: false,
      reference_atlas: false, frontlines: false, conflict_density: false,
    });
    expect(requested.reference_atlas).toBe(true);
  });
  it('restores all requested user layers after first painted frame without losing preference', () => {
    const ready = stageMapLayers(requested, true);
    expect(ready).toBe(requested);
    expect(ready.reference_atlas).toBe(true);
    expect(ready.frontlines).toBe(true);
  });
  it('never enables a layer the user disabled', () => {
    const req = { ...requested, app_news: false, frontlines: false, alert_pins: false };
    expect(stageMapLayers(req, false)).toMatchObject({
      app_news: false, frontlines: false, alert_pins: false,
    });
    expect(stageMapLayers(req, true)).toEqual(req);
  });
});
