/** The URL format must evolve without making newly added public layers invisible in old bookmarks. */
export const LAYER_URL_SCHEMA = '3';

/** These layers did not exist in pre-v2 shared URLs, and are default-on today. */
const LEGACY_ADDED_LAYERS = new Set(['app_news', 'country_borders', 'sat_military_activity']);

export function restoreLayerState<T extends Record<string, boolean>>(
  defaults: T,
  params: URLSearchParams,
): T {
  const raw = params.get('layers');
  if (raw === null) return defaults;
  const active = new Set(raw.split(',').filter(Boolean));
  // A pre-v2 bookmark has no way to opt a not-yet-existing layer in or out.
  // Restore new public defaults only if NEITHER newly added key was present.
  // From v2 onward, missing keys unambiguously mean the user turned them off.
  const legacyBookmark = !params.has('layers_v')
    && ![...LEGACY_ADDED_LAYERS].some(key => active.has(key));
  const restored = { ...defaults };
  for (const key of Object.keys(defaults)) {
    (restored as Record<string, boolean>)[key] = active.has(key)
      || (legacyBookmark && LEGACY_ADDED_LAYERS.has(key) && defaults[key]);
  }
  return restored;
}

export function serializeLayerState(layers: Record<string, boolean>, params: URLSearchParams): URLSearchParams {
  const next = new URLSearchParams(params);
  next.set('layers', Object.entries(layers).filter(([, enabled]) => enabled).map(([key]) => key).join(','));
  next.set('layers_v', LAYER_URL_SCHEMA);
  return next;
}
