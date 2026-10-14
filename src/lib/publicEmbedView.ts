/** Public WORLD iframe display-only presets.
 * These settings alter presentation only and never change source events, positions or authorization. */
export const QUIET_PUBLIC_EVENT_LAYERS = [
  'conflict_density', 'reported_routes', 'gdelt_events',
  'civil_unrest', 'global_incidents', 'alert_pins',
] as const;

export function reducePublicEventClutter<T extends Record<string, boolean>>(layers: T): T {
  const next: Record<string, boolean> = { ...layers };
  for (const key of QUIET_PUBLIC_EVENT_LAYERS) next[key] = false;
  return next as T;
}

export function restorePublicEventClutter<T extends Record<string, boolean>>(current: T, previous: T): T {
  const next: Record<string, boolean> = { ...current };
  for (const key of QUIET_PUBLIC_EVENT_LAYERS) next[key] = previous[key];
  return next as T;
}


/**
 * Presentation-only public marker switch. The underlying active layers remain
 * enabled (and source-backed data intact); only the map renderer receives this
 * visually filtered copy. Geographic borders and polygon context are separate.
 */
export const PUBLIC_MAP_MARKER_LAYERS = [
  'live_news', 'app_news', 'alert_pins', 'gdelt_events', 'global_incidents',
  'civil_unrest', 'fires', 'earthquakes', 'weather', 'radiation',
  'flights', 'private', 'jets', 'military_activity',
  'maritime', 'naval_activity', 'satellites', 'sat_comms', 'sat_military',
  'sat_navigation', 'sat_earth', 'sat_science', 'cctv', 'cctv_previews',
  'sdk_air', 'sdk_sea', 'sdk_naval', 'infrastructure', 'malware',
  'cf_outages', 'cf_attacks', 'digital_clusters',
] as const;

export function hidePublicMapMarkers<T extends Record<string, boolean>>(layers: T, visible: boolean): T {
  if (visible) return layers;
  const next: Record<string, boolean> = { ...layers };
  for (const key of PUBLIC_MAP_MARKER_LAYERS) {
    if (key in next) next[key] = false;
  }
  return next as T;
}
