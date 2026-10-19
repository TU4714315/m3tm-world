/**
 * World Imagery in WORLD uses 256 px tiles and an intentionally capped z15
 * upstream source because higher zoom levels can return valid JPEG placeholders.
 * Do not permit a 5-level overscale of that source; it makes photographic
 * pixels and low-resolution 3D terrain look like missing live map data.
 */
export const SATELLITE_IMAGE_SOURCE_MAX_ZOOM = 15;
export const SATELLITE_VIEW_MAX_ZOOM = 16.5;
export const VECTOR_VIEW_MAX_ZOOM = 20;

/** DEM's maximum real resolution is zoom 10; close-up 3D is buildings, not relief. */
export const TERRAIN_LAST_USEFUL_ZOOM = 15;
export const TERRAIN_HIGH_ZOOM_RELEASE = 15.5;

export function mapViewMaxZoom(style: string): number {
  // WorldMap receives the live ArcGIS tile URL, not the UI's 'satellite' flag.
  // As in WorldMap's raster visibility branch, any non-'dark' style is imagery.
  return style === 'dark' ? VECTOR_VIEW_MAX_ZOOM : SATELLITE_VIEW_MAX_ZOOM;
}
