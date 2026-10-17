/** Published-map viewing only. Internal tools retain separate authorization. */
import { maskSaudiPublicIndicators } from './publicCountryVisibility';

// Owner temporary mode: published layers, media and source-dated news are public.
// Roll back to invitation + 12-hour public news tiers by setting this to true.
// This never changes actual grants or internal-tool authorization.
export const PUBLISHED_MAP_INVITATION_REQUIRED = false;
export const PUBLIC_EVENT_DELAY_MS = 12 * 60 * 60 * 1000;
export const RESTRICTED_MAP_LAYERS = new Set([
  'military', 'military_flights', 'military_activity', 'naval_activity',
  'sat_military', 'satellites', 'cctv', 'cctv_previews', 'live_news',
  'frontlines', 'reference_atlas', 'conflict_zones', 'conflict_density',
  'reported_routes', 'alert_pins', 'gdelt_events', 'civil_unrest', 'sdk_naval', 'global_incidents',
]);
export const canViewPublishedMap = (hasGrant: boolean) => !PUBLISHED_MAP_INVITATION_REQUIRED || hasGrant;
export const layerRequiresInvitation = (key: string) => PUBLISHED_MAP_INVITATION_REQUIRED && RESTRICTED_MAP_LAYERS.has(key);

// Exact reviewed read routes only. No prefix wildcard can open a new raw API.
const PUBLISHED_READ_ENDPOINTS = new Set([
  '/api/reference-atlas', '/api/frontlines', '/api/conflicts',
  '/api/gdelt', '/api/gdelt-events', '/api/gdelt-history', '/api/radar',
  '/api/live-news', '/api/cctv', '/api/cctv/proxy', '/api/cctv/resolve',
  '/api/cctv/stream-status', '/api/cctv/texas/snapshot', '/api/cctv/lithuania/snapshot',
]);
export function temporaryPublicMapEndpoint(path: string, method = 'GET') {
  return !PUBLISHED_MAP_INVITATION_REQUIRED && ['GET', 'HEAD'].includes(method) && PUBLISHED_READ_ENDPOINTS.has(path);
}

export function visibleMapLayers(layers: Record<string, boolean>, allowed: boolean) {
  return Object.fromEntries(Object.entries(layers).map(([key, value]) =>
    [key, value && (allowed || !layerRequiresInvitation(key))]));
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
  if (!PUBLISHED_MAP_INVITATION_REQUIRED) {
    const result = publishedMapPayload('maritime', publishedMapPayload('flights', payload));
    result.military_activity = aggregateCells(payload.military_activity, 'flights');
    result.military_satellite_activity = aggregateCells(payload.military_satellite_activity, 'satellites');
    // Published map permission cannot reveal retained enrichment/analysis.
    for (const key of ['region_dossier', 'country_risk', 'entity', 'entities', 'analysis', 'ai', 'sdk_raw']) delete result[key];
    result.news = sourceDatedNews(payload.news);
    return maskSaudiPublicIndicators(result);
  }
  const result = { ...publicMixedMapPayload('maritime', publicMixedMapPayload('flights', payload)) };
  for (const key of ['reference_atlas', 'frontlines', 'frontlines_meta', 'conflict_summary', 'conflict_source_status',
    'military_activity_meta', 'military_satellite_meta', 'military_satellite_summary']) delete result[key];
  for (const key of ['cameras', 'live_feeds', 'gdelt', 'gdelt_events', 'civil_unrest', 'reported_routes', 'conflict_zones',
    'conflict_live_events', 'military_activity', 'military_flights', 'military_satellite_activity', 'naval_activity']) result[key] = [];
  result.news = delayedPublicNews(payload.news);
  return result;
}

function sourceDatedNews(value: unknown, now = Date.now()) {
  if (!Array.isArray(value)) return [];
  return value.filter((row): row is Record<string, unknown> => !!row && typeof row === 'object'
    && typeof row.published === 'string' && Number.isFinite(Date.parse(row.published)) && Date.parse(row.published) <= now);
}

/** Keep the existing coarse public projections; never reintroduce raw tracks. */
function aggregateCells(value: unknown, kind: 'flights' | 'maritime' | 'satellites') {
  if (!Array.isArray(value)) return [];
  const mode = { flights: 'public-adsb-aggregate', maritime: 'public-ais-aggregate', satellites: 'coarse-public-tle-propagation' }[kind];
  const fields = new Set(['lat', 'lng', 'level', 'activity', 'approximate_count', 'cell_degrees', 'precision', 'time_precision',
    'observed_at_bucket', 'reporting_mode', 'trend', 'data_state', 'observed_at', 'age_seconds', 'average_altitude_band']);
  return value.flatMap(raw => {
    if (!raw || typeof raw !== 'object') return [];
    const row = raw as Record<string, unknown>;
    if (row.reporting_mode !== mode || typeof row.cell_degrees !== 'number' || row.cell_degrees < (kind === 'satellites' ? 20 : 6)
      || typeof row.lat !== 'number' || !Number.isFinite(row.lat) || Math.abs(row.lat) > 90
      || typeof row.lng !== 'number' || !Number.isFinite(row.lng) || Math.abs(row.lng) > 180) return [];
    const cell = Object.fromEntries(Object.entries(row).filter(([key]) => fields.has(key)));
    if (typeof row.id === 'string' && /^(?:military|naval)-activity-[\d:]+$/.test(row.id)) cell.id = row.id;
    return [cell];
  });
}

export function publishedMapPayload(kind: 'news' | 'flights' | 'satellites' | 'maritime', payload: Record<string, unknown>, now = Date.now()) {
  const result = publicMixedMapPayload(kind, payload, now);
  if (kind === 'flights') result.military_activity = aggregateCells(payload.military_activity, kind);
  if (kind === 'maritime') result.naval_activity = aggregateCells(payload.naval_activity, kind);
  if (kind === 'satellites') result.military_satellite_activity = aggregateCells(payload.military_satellite_activity, kind);
  return maskSaudiPublicIndicators(result);
}

/** Avoid leaking restricted counts, status, or sample names via mixed feeds. */
export function publicMixedMapPayload(kind: 'news' | 'flights' | 'satellites' | 'maritime', payload: Record<string, unknown>, now = Date.now()) {
  if (kind === 'news') {
    const news = PUBLISHED_MAP_INVITATION_REQUIRED ? delayedPublicNews(payload.news, now) : sourceDatedNews(payload.news, now);
    return { news, total: news.length, delayHours: PUBLISHED_MAP_INVITATION_REQUIRED ? 12 : 0,
      access: PUBLISHED_MAP_INVITATION_REQUIRED ? 'public-delayed' : 'public-published',
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
    result.satellites = Array.isArray(result.satellites) ? result.satellites.filter(item => {
      const row = item as Record<string, unknown>;
      return ['comms', 'navigation', 'earth_obs', 'science'].includes(String(row?.category));
    }).map(item => Object.fromEntries(Object.entries(item as Record<string, unknown>).filter(([key]) =>
      ['name', 'lat', 'lng', 'alt', 'mission', 'color', 'category', 'noradId'].includes(key)))) : [];
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
