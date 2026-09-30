/**
 * Dynamic source credits for the one MapLibre renderer.
 *
 * Showing a source link in a hidden layer-settings panel is not equivalent to
 * map attribution. MapLibre collects the attribution from active sources.
 * The map-wide link explains composite terrain and never claims that proposed
 * replacement DEM datasets are currently running.
 */
export const MAP_ATTRIBUTION_OPTIONS = {
  // Visible at rest and during map interaction; responsive CSS wraps small screens.
  compact: false,
  customAttribution: '<a href="/terrain-sources" target="_blank" rel="noopener noreferrer">مصادر الخريطة</a>',
} as const;

export const TILEZEN_TERRAIN_ATTRIBUTION =
  '<a href="https://github.com/tilezen/joerd/blob/master/docs/attribution.md" target="_blank" rel="noopener noreferrer">Elevation: Mapzen / Tilezen (source credits)</a>';

export const ARCGIS_IMAGERY_ATTRIBUTION =
  'Imagery &copy; Esri; sources: Esri, Maxar, Earthstar Geographics and the GIS User Community';

// NOAA's public ArcGIS cache of ETOPO 2022 *colored relief*. These are
// presentation tiles, NOT numeric raster DEMs suitable for 3D or navigation.
export const NOAA_ETOPO_2022_TILE_URL =
  'https://tiles.arcgis.com/tiles/C8EMgrsFcRFL6LrL/arcgis/rest/services/ETOPO_hillshade/MapServer/tile/{z}/{y}/{x}';

export const NOAA_ETOPO_2022_ATTRIBUTION =
  '<a href="https://www.ncei.noaa.gov/products/etopo-global-relief-model" target="_blank" rel="noopener noreferrer">NOAA NCEI &copy; ETOPO 2022</a> (not for navigation)';
