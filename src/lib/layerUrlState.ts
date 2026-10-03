/** The URL format must evolve without making newly added public layers invisible in old bookmarks. */
export const LAYER_URL_SCHEMA = '4';

/** Defaults added in earlier schemas must only be migrated for bookmarks that
 * predate that schema. A v3 bookmark can contain an intentional off-choice for a
 * v3 layer, so v4 migration must not silently switch those layers back on. */
const V3_DEFAULT_ON_LAYERS = new Set([
  'app_news', 'country_borders',
  'military_activity', 'maritime', 'naval_activity',
  'conflict_zones', 'conflict_density', 'frontlines', 'reported_routes',
  'gdelt_events', 'civil_unrest', 'alert_pins', 'global_incidents',
]);

const V4_DEFAULT_ON_LAYERS = new Set([
  'private', 'jets', 'sdk_air', 'cf_outages', 'cf_attacks',
]);

export function restoreLayerState<T extends Record<string, boolean>>(
  defaults: T,
  params: URLSearchParams,
): T {
  const raw = params.get('layers');
  if (raw === null) return defaults;
  const active = new Set(raw.split(',').filter(Boolean));
  const schemaRaw = params.get('layers_v');
  const parsedSchema = Number(schemaRaw);
  const schema = Number.isFinite(parsedSchema) && parsedSchema >= 0 ? parsedSchema : 0;
  const restored = { ...defaults };
  for (const key of Object.keys(defaults)) {
    const migratedDefault =
      (schema < 3 && V3_DEFAULT_ON_LAYERS.has(key) && defaults[key])
      || (schema < 4 && V4_DEFAULT_ON_LAYERS.has(key) && defaults[key]);
    (restored as Record<string, boolean>)[key] = active.has(key) || migratedDefault;
  }
  return restored;
}

export function serializeLayerState(layers: Record<string, boolean>, params: URLSearchParams): URLSearchParams {
  const next = new URLSearchParams(params);
  next.set('layers', Object.entries(layers).filter(([, enabled]) => enabled).map(([key]) => key).join(','));
  next.set('layers_v', LAYER_URL_SCHEMA);
  return next;
}
