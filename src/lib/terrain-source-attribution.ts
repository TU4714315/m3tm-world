/**
 * Dynamic source credits for the one MapLibre renderer.
 *
 * Showing a source link in a hidden layer-settings panel is not equivalent to
 * map attribution. MapLibre collects the attribution from active sources.
 * The map-wide link explains composite terrain and never claims that proposed
 * replacement DEM datasets are currently running.
 */
export const MAP_ATTRIBUTION_OPTIONS = {
  compact: true,
  customAttribution: '<a href="/terrain-sources" target="_blank" rel="noopener noreferrer">مصادر الخريطة</a>',
} as const;

export const TILEZEN_TERRAIN_ATTRIBUTION =
  '<a href="https://github.com/tilezen/joerd/blob/master/docs/attribution.md" target="_blank" rel="noopener noreferrer">Elevation: Mapzen / Tilezen (source credits)</a>';

export const ARCGIS_IMAGERY_ATTRIBUTION =
  'Imagery &copy; Esri; sources: Esri, Maxar, Earthstar Geographics and the GIS User Community';
