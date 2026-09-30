import type { Map } from 'maplibre-gl';
import { NOAA_ETOPO_2022_TILE_URL, NOAA_ETOPO_2022_ATTRIBUTION } from './terrain-source-attribution';

export const ETOPO_2022_SOURCE = 'm3tm-etopo-2022';
export const ETOPO_2022_LAYER = 'm3tm-etopo-2022-relief';
const FIRST_M3TM_OVERLAY = 'conflict-density-heat';
export const ETOPO_2022_MAX_DISPLAY_ZOOM = 11;

/**
 * Toggle NOAA's public, opt-in **visual** relief. This is NOT raster-dem input
 * for the separate Mapzen/Tilezen 3D terrain engine. Preserve M3TM markers and
 * restore the user's satellite/regular map choice when the relief is hidden.
 */
export function syncEtopo2022Relief(map: Map, enabled: boolean, mapStyle: 'dark' | 'satellite'): boolean {
  // At high zoom NOAA relief has no more source detail. Fall back to the
  // exact basemap the user selected instead of leaving an unintended dark map.
  // The toggle remains ON so returning to overview automatically restores NOAA.
  const showRelief = enabled && map.getZoom() < ETOPO_2022_MAX_DISPLAY_ZOOM;
  if (showRelief) {
    // If bootstrapping is unfinished, do not create an orphan raster source.
    // Its 2022 hillshade must sit beneath ALL public-event overlays.
    if (!map.getLayer(FIRST_M3TM_OVERLAY)) return false;
    if (!map.getSource(ETOPO_2022_SOURCE)) {
      map.addSource(ETOPO_2022_SOURCE, {
        type: 'raster',
        tiles: [NOAA_ETOPO_2022_TILE_URL],
        tileSize: 256,
        minzoom: 0,
        maxzoom: 10,
        attribution: NOAA_ETOPO_2022_ATTRIBUTION,
      });
    }
    if (!map.getLayer(ETOPO_2022_LAYER)) {
      map.addLayer({
        id: ETOPO_2022_LAYER,
        type: 'raster',
        source: ETOPO_2022_SOURCE,
        maxzoom: ETOPO_2022_MAX_DISPLAY_ZOOM,
        paint: { 'raster-opacity': 0.95, 'raster-resampling': 'linear' },
      }, FIRST_M3TM_OVERLAY);
    }
  } else {
    if (map.getLayer(ETOPO_2022_LAYER)) map.removeLayer(ETOPO_2022_LAYER);
    if (map.getSource(ETOPO_2022_SOURCE)) map.removeSource(ETOPO_2022_SOURCE);
  }
  if (map.getLayer('satellite-layer')) {
    map.setLayoutProperty('satellite-layer', 'visibility',
      showRelief ? 'none' : mapStyle === 'satellite' ? 'visible' : 'none');
  }
  return true;
}
