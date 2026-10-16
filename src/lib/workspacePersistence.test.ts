import { describe, expect, it } from 'vitest';
import { parseWorldWorkspaceSnapshot } from './workspacePersistence';

describe('WORLD workspace persistence', () => {
  it('replaces the old forced-dark view without resetting location or data choices', () => {
    const base = {version:1,savedAt:'2026-10-15T12:00:00Z',activeLayers:{reference_atlas:true,terrain_etopo_2022:true,day_night:true},
      projection:'mercator',mapStyle:'dark',theme:'core',satelliteVisual:'clarity',view:{lat:15,lng:45,zoom:6}};
    const migrated=parseWorldWorkspaceSnapshot(JSON.stringify(base));
    expect(migrated?.mapStyle).toBe('satellite');
    expect(migrated?.satelliteVisual).toBe('bright');
    expect(migrated?.view).toEqual(base.view);
    expect(migrated?.activeLayers).toEqual({reference_atlas:true,terrain_etopo_2022:false,day_night:false});
    const chosenNight=parseWorldWorkspaceSnapshot(JSON.stringify({...base,presentationVersion:2}));
    expect(chosenNight?.mapStyle).toBe('dark');
    expect(chosenNight?.activeLayers.terrain_etopo_2022).toBe(true);
  });
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
