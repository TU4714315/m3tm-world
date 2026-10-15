/** Published-map viewing only. Internal tools retain separate authorization. */
export const PUBLIC_EVENT_DELAY_MS = 12 * 60 * 60 * 1000;
export const RESTRICTED_MAP_LAYERS = new Set([
  'military', 'military_flights', 'military_activity', 'naval_activity',
  'sat_military', 'satellites', 'cctv', 'cctv_previews', 'live_news',
  'frontlines', 'reference_atlas', 'conflict_zones', 'conflict_density',
  'reported_routes', 'alert_pins', 'gdelt_events', 'civil_unrest', 'sdk_naval', 'global_incidents',
]);

export function visibleMapLayers(layers: Record<string, boolean>, allowed: boolean) {
  return Object.fromEntries(Object.entries(layers).map(([key, value]) =>
    [key, value && (allowed || !RESTRICTED_MAP_LAYERS.has(key))]));
}

/** Undated records never become public merely because the collector ran. */
export function delayedPublicNews(value: unknown, now = Date.now()): Record<string, unknown>[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is Record<string, unknown> => {
    if (!item || typeof item !== 'object') return false;
    const row = item as Record<string, unknown>;
    const time = typeof row.published === 'string' ? Date.parse(row.published) : NaN;
    return Number.isFinite(time) && time <= now - PUBLIC_EVENT_DELAY_MS;
  });
}

/** All alternate entrances to restricted feeds are guarded, including media. */
export function restrictedMapEndpoint(path: string): boolean {
  return /^\/api\/(?:reference-atlas|frontlines|conflicts|gdelt|gdelt-events|gdelt-history|live-news|radar|aircraft|flight-route|region-dossier|country-risk|source-coverage|sentinel|astra|stats)(?:\/|$)/.test(path)
    || /^\/api\/(?:cctv|sdk|entity|ai)(?:\/|$)/.test(path)
    || /^\/api\/satellites\/orbit(?:\/|$)/.test(path);
}

/** Clears already loaded material immediately on demotion, before effects run. */
export function publicMapClientProjection(payload: Record<string, unknown>) {
  const result = { ...publicMixedMapPayload('maritime', publicMixedMapPayload('flights', payload)) };
  for (const key of ['reference_atlas', 'frontlines', 'frontlines_meta', 'conflict_summary', 'conflict_source_status',
    'military_activity_meta', 'military_satellite_meta', 'military_satellite_summary']) delete result[key];
  for (const key of ['cameras', 'live_feeds', 'gdelt', 'gdelt_events', 'civil_unrest', 'reported_routes', 'conflict_zones',
    'conflict_live_events', 'military_activity', 'military_flights', 'military_satellite_activity', 'naval_activity']) result[key] = [];
  result.news = delayedPublicNews(payload.news);
  return result;
}

/** Avoid leaking restricted counts, status, or sample names via mixed feeds. */
export function publicMixedMapPayload(kind: 'news' | 'flights' | 'satellites' | 'maritime', payload: Record<string, unknown>, now = Date.now()) {
  if (kind === 'news') {
    const news = delayedPublicNews(payload.news, now);
    return { news, total: news.length, delayHours: 12, access: 'public-delayed',
      source_published_at: news.reduce<string | null>((last, row) => !last || Date.parse(String(row.published)) > Date.parse(last) ? String(row.published) : last, null),
      timestamp: new Date(now).toISOString() };
  }
  const strip = (value: unknown): unknown => {
    if (Array.isArray(value)) return value.map(strip);
    if (!value || typeof value !== 'object') return value;
    return Object.fromEntries(Object.entries(value).filter(([key, item]) =>
      !/military|naval|raw_count|raw_tle|catalog_objects/i.test(key) || (/_exposed$/.test(key) && item === false)).map(([key, item]) => [key, strip(item)]));
  };
  const result = strip(payload) as Record<string, unknown>;
  if (kind === 'flights') {
    result.military_activity = []; result.military_flights = [];
    // Summary responses contain additional derived military totals; publish
    // only explicitly civilian lists instead of recursively trusting names.
    for (const key of ['summary', 'counts', 'source_status', 'flight_source_status']) delete result[key];
  }
  if (kind === 'satellites') {
    result.satellites = Array.isArray(payload.satellites) ? payload.satellites.filter(item => {
      const row = item as Record<string, unknown>;
      return ['comms', 'navigation', 'earth_obs', 'science'].includes(String(row?.category));
    }) : [];
    result.total = (result.satellites as unknown[]).length;
    const categoryCounts: Record<string, number> = {};
    for (const row of result.satellites as Record<string, unknown>[]) categoryCounts[String(row.category)] = (categoryCounts[String(row.category)] || 0) + 1;
    result.category_counts = categoryCounts;
    result.satellite_source_status = { public_individual_objects: result.total };
    result.military_satellite_activity = [];
  }
  if (kind === 'maritime') result.naval_activity = [];
  return result;
}
