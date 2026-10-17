/** A regional focus restores its map inputs even after a saved/quiet view hid them. */
export const YEMEN_MONITOR_LAYERS = [
  'reference_atlas', 'frontlines', 'conflict_zones', 'conflict_density',
  'gdelt_events', 'civil_unrest', 'reported_routes', 'global_incidents',
  'live_news', 'app_news', 'alert_pins', 'country_borders',
] as const;

export const YEMEN_MAP_FOCUS = { lat: 15.6, lng: 47.5, zoom: 5.5 } as const;

export function restoreYemenMapLayers<T extends Record<string, boolean>>(previous: T): T {
  const next: Record<string, boolean> = { ...previous };
  for (const key of YEMEN_MONITOR_LAYERS) next[key] = true;
  return next as T;
}
