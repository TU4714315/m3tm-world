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
