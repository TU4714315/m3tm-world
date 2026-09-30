/**
 * Public provenance for the DEM currently rendered by M3TM.WORLD.
 *
 * Data-model names are not active tile services: only the active Tilezen
 * Terrarium endpoint is directly compatible with this MapLibre loader.
 * A newer GeoTIFF/COG must be licensed, normalized to compatible elevation
 * units/vertical datum, tiled, published, and independently runtime-tested
 * before it can replace this endpoint.
 */
export const ACTIVE_TERRAIN = {
  id: 'tilezen-mapzen-terrarium',
  labelAr: 'Mapzen / Tilezen – بيانات التضاريس الحالية',
  tileBaseUrl: 'https://s3.amazonaws.com/elevation-tiles-prod/terrarium/',
  tileFormat: 'terrarium' as const,
  tileSize: 256,
  maxTileZoom: 10,
  creditsUrl: 'https://github.com/tilezen/joerd/blob/master/docs/attribution.md',
  sourceDetailsUrl: 'https://github.com/tilezen/joerd/blob/master/docs/data-sources.md',
  registryUrl: 'https://registry.opendata.aws/terrain-tiles/',
  status: 'active' as const,
  /** Published input dates and provider availability vary by geographic tile. */
  freshness: 'mixed-source-historical' as const,
};

/** Discovery-only data; none of these is falsely advertised as a live tile URL. */
export const NEWER_DEM_CANDIDATES = [
  {
    id: 'copernicus-glo90',
    label: 'Copernicus DEM GLO-90 (2021)',
    resolution: '90m worldwide',
    format: 'cloud-optimized-geotiff',
    reference: 'https://registry.opendata.aws/copernicus-dem/',
    status: 'requires-licensed-tiling-and-runtime-validation',
  },
  {
    id: 'copernicus-glo30-public',
    label: 'Copernicus DEM GLO-30 Public (2021)',
    resolution: '30m in publicly released areas only',
    format: 'cloud-optimized-geotiff',
    reference: 'https://registry.opendata.aws/copernicus-dem/',
    status: 'requires-coverage-rights-tiling-and-runtime-validation',
  },
  {
    id: 'etopo-2022',
    label: 'NOAA ETOPO 2022',
    resolution: '15 arc-second global topography and bathymetry',
    format: 'geotiff-netcdf',
    reference: 'https://www.ncei.noaa.gov/products/etopo-global-relief-model',
    status: 'requires-tiling-and-runtime-validation',
  },
  {
    id: 'usgs-3dep-s1m',
    label: 'USGS 3DEP seamless 1m',
    resolution: '1m where released in the United States',
    format: 'cloud-optimized-geotiff',
    reference: 'https://www.usgs.gov/3d-elevation-program/about-3dep-products-services',
    status: 'regional-coverage-requires-tiling-and-runtime-validation',
  },
] as const;
