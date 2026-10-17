/**
 * Startup scheduler for public map *rendering* only. Feed ingestion, panel
 * counters, grant gates and user layer preferences remain unchanged.
 * Keep immediate event, military-region, news, borders and alert visibility.
 * Expensive reference polygons and decorative overlays follow first paint.
 */
export const DEFERRED_STARTUP_VISUALS = Object.freeze([
  'reference_atlas', 'conflict_density', 'frontlines', 'reported_routes',
  'cables', 'sdk_sea', 'satellites', 'sat_comms',
  'sat_military', 'sat_navigation', 'sat_earth', 'sat_science',
  'cf_attacks', 'cf_outages', 'fires',
] as const);

export function stageMapLayers<T extends Record<string, boolean>>(
  requested: T, firstMapReady: boolean,
): T {
  if (firstMapReady) return requested;
  const staged: Record<string, boolean> = { ...requested };
  for (const key of DEFERRED_STARTUP_VISUALS) {
    if (key in staged) staged[key] = false;
  }
  return staged as T;
}
