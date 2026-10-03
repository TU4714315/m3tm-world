/** The URL format must evolve without making newly added public layers invisible in old bookmarks. */
export const LAYER_URL_SCHEMA = '3';

/** Public-awareness layers promoted to default-on in v3. Old bookmarks could not
 * express these defaults reliably, so they are enabled once during migration.
 * Once a URL is serialized as v3, explicit user off-choices are preserved. */
const V3_DEFAULT_ON_LAYERS = new Set([
  'app_news', 'country_borders',
  'military_activity', 'maritime', 'naval_activity',
  'conflict_zones', 'conflict_density', 'frontlines', 'reported_routes',
  'gdelt_events', 'civil_unrest', 'alert_pins', 'global_incidents',
]);

export function restoreLayerState<T extends Record<string, boolean>>(
  defaults: T,
  params: URLSearchParams,
): T {
  const raw = params.get('layers');
  if (raw === null) return defaults;
  const active = new Set(raw.split(',').filter(Boolean));
  const schema = params.get('layers_v');
  const migrateToV3 = schema !== LAYER_URL_SCHEMA;
  const restored = { ...defaults };
  for (const key of Object.keys(defaults)) {
    (restored as Record<string, boolean>)[key] = active.has(key)
      || (migrateToV3 && V3_DEFAULT_ON_LAYERS.has(key) && defaults[key]);
  }
  return restored;
}

export function serializeLayerState(layers: Record<string, boolean>, params: URLSearchParams): URLSearchParams {
  const next = new URLSearchParams(params);
  next.set('layers', Object.entries(layers).filter(([, enabled]) => enabled).map(([key]) => key).join(','));
  next.set('layers_v', LAYER_URL_SCHEMA);
  return next;
}
