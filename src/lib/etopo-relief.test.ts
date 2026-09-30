import { describe, expect, it, vi } from 'vitest';
import type { Map as MapLibreMap } from 'maplibre-gl';
import { ETOPO_2022_SOURCE, ETOPO_2022_LAYER, syncEtopo2022Relief } from './etopo-relief';
import { NOAA_ETOPO_2022_TILE_URL, NOAA_ETOPO_2022_ATTRIBUTION } from './terrain-source-attribution';

function mapFixture(withOverlay = true, initialZoom = 6.5) {
  let zoom = initialZoom;
  const sources = new Set<string>();
  const layers = new Set(withOverlay ? ['conflict-density-heat', 'satellite-layer'] : []);
  const map = {
    getZoom: vi.fn(() => zoom),
    getLayer: vi.fn((name: string) => layers.has(name) ? { id: name } : undefined),
    getSource: vi.fn((name: string) => sources.has(name) ? { id: name } : undefined),
    addSource: vi.fn((name: string) => { sources.add(name); }),
    removeSource: vi.fn((name: string) => sources.delete(name)),
    addLayer: vi.fn((layer: { id: string }) => { layers.add(layer.id); }),
    removeLayer: vi.fn((name: string) => layers.delete(name)),
    setLayoutProperty: vi.fn(),
  };
  return { map: map as unknown as MapLibreMap, methods: map, sources, layers, zoomTo: (next: number) => { zoom = next; } };
}

describe('opt-in NOAA 2022 relief overlay', () => {
  it('makes no extra tile source/layer on startup or for an off toggle', () => {
    const { map, methods } = mapFixture();
    expect(syncEtopo2022Relief(map, false, 'satellite')).toBe(true);
    expect(methods.addSource).not.toHaveBeenCalled();
    expect(methods.addLayer).not.toHaveBeenCalled();
    expect(methods.setLayoutProperty).toHaveBeenCalledWith('satellite-layer', 'visibility', 'visible');
  });

  it('loads an attributed NOAA raster underneath every M3TM event layer and hides satellite', () => {
    const { map, methods, sources, layers } = mapFixture();
    expect(syncEtopo2022Relief(map, true, 'satellite')).toBe(true);
    expect(sources.has(ETOPO_2022_SOURCE)).toBe(true);
    expect(layers.has(ETOPO_2022_LAYER)).toBe(true);
    expect(methods.addSource).toHaveBeenCalledWith(ETOPO_2022_SOURCE, expect.objectContaining({
      type: 'raster',
      tiles: [NOAA_ETOPO_2022_TILE_URL],
      maxzoom: 10,
      attribution: NOAA_ETOPO_2022_ATTRIBUTION,
    }));
    expect(methods.addLayer).toHaveBeenCalledWith(expect.objectContaining({
      id: ETOPO_2022_LAYER, type: 'raster', source: ETOPO_2022_SOURCE, maxzoom: 11,
    }), 'conflict-density-heat');
    expect(methods.setLayoutProperty).toHaveBeenCalledWith('satellite-layer', 'visibility', 'none');
    syncEtopo2022Relief(map, true, 'satellite');
    expect(methods.addLayer).toHaveBeenCalledTimes(1);
    expect(methods.addSource).toHaveBeenCalledTimes(1);
  });

  it('restores chosen satellite style after ETOPO is switched off', () => {
    const { map, methods, sources } = mapFixture();
    syncEtopo2022Relief(map, true, 'satellite');
    syncEtopo2022Relief(map, false, 'satellite');
    expect(methods.removeLayer).toHaveBeenCalledWith(ETOPO_2022_LAYER);
    expect(methods.removeSource).toHaveBeenCalledWith(ETOPO_2022_SOURCE);
    expect(sources.size).toBe(0);
    expect(methods.setLayoutProperty).toHaveBeenLastCalledWith('satellite-layer', 'visibility', 'visible');
  });

  it('does not invent a data source if the M3TM map has not initialized', () => {
    const { map, methods } = mapFixture(false);
    expect(syncEtopo2022Relief(map, true, 'dark')).toBe(false);
    expect(methods.addSource).not.toHaveBeenCalled();
    expect(methods.addLayer).not.toHaveBeenCalled();
  });

  it('preserves dark view when relief is disabled', () => {
    const { map, methods } = mapFixture();
    syncEtopo2022Relief(map, true, 'dark');
    syncEtopo2022Relief(map, false, 'dark');
    expect(methods.setLayoutProperty).toHaveBeenLastCalledWith('satellite-layer', 'visibility', 'none');
  });
  it('automatically returns to satellite beyond NOAA zoom 11, then restores NOAA when zoomed out', () => {
    const { map, methods, sources, layers, zoomTo } = mapFixture(true, 12);
    expect(syncEtopo2022Relief(map, true, 'satellite')).toBe(true);
    expect(sources.has(ETOPO_2022_SOURCE)).toBe(false);
    expect(methods.setLayoutProperty).toHaveBeenLastCalledWith('satellite-layer', 'visibility', 'visible');

    zoomTo(6);
    syncEtopo2022Relief(map, true, 'satellite');
    expect(sources.has(ETOPO_2022_SOURCE)).toBe(true);
    expect(layers.has(ETOPO_2022_LAYER)).toBe(true);
    expect(methods.setLayoutProperty).toHaveBeenLastCalledWith('satellite-layer', 'visibility', 'none');

    zoomTo(12);
    syncEtopo2022Relief(map, true, 'satellite');
    expect(layers.has(ETOPO_2022_LAYER)).toBe(false);
    expect(sources.has(ETOPO_2022_SOURCE)).toBe(false);
    expect(methods.setLayoutProperty).toHaveBeenLastCalledWith('satellite-layer', 'visibility', 'visible');

    zoomTo(7);
    syncEtopo2022Relief(map, true, 'satellite');
    expect(sources.has(ETOPO_2022_SOURCE)).toBe(true);
    expect(methods.addSource).toHaveBeenCalledTimes(2);
  });

  it('keeps the dark base style at high zoom without requesting extra NOAA raster', () => {
    const { map, methods, sources } = mapFixture(true, 13);
    syncEtopo2022Relief(map, true, 'dark');
    expect(sources.has(ETOPO_2022_SOURCE)).toBe(false);
    expect(methods.addSource).not.toHaveBeenCalled();
    expect(methods.setLayoutProperty).toHaveBeenLastCalledWith('satellite-layer', 'visibility', 'none');
  });

});
