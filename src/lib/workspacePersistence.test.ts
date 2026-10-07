import { describe, expect, it } from 'vitest';
import { parseWorldWorkspaceSnapshot } from './workspacePersistence';

describe('WORLD workspace persistence', () => {
  it('accepts a bounded v1 snapshot', () => {
    const parsed = parseWorldWorkspaceSnapshot(JSON.stringify({
      version: 1,
      savedAt: '2026-10-07T10:00:00.000Z',
      activeLayers: { app_news: true, gdelt_events: false },
      projection: 'mercator',
      mapStyle: 'dark',
      theme: 'core',
      satelliteVisual: 'clarity',
      view: { lat: 24.7, lng: 46.7, zoom: 6 },
    }));
    expect(parsed?.activeLayers.app_news).toBe(true);
    expect(parsed?.view.lng).toBe(46.7);
  });

  it('rejects invalid or out-of-range view state', () => {
    expect(parseWorldWorkspaceSnapshot('{bad')).toBeNull();
    expect(parseWorldWorkspaceSnapshot(JSON.stringify({
      version: 1,
      savedAt: 'x',
      activeLayers: {},
      projection: 'globe',
      mapStyle: 'satellite',
      theme: 'core',
      satelliteVisual: 'clarity',
      view: { lat: 200, lng: 0, zoom: 2 },
    }))).toBeNull();
  });
});
