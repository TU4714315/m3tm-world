import saudiAdmin0 from './saudiAdmin0.json';
import { geometryIntersectsSaudi } from './publicGeometryBoundary';

/**
 * Public presentation contract. Saudi-specific observation markers are omitted
 * from WORLD (including its untrusted iframe query variants). Country labels,
 * border outlines and public news articles are not observations and stay.
 *
 * This is deliberately NOT subscriber authorization: subscriber-only Saudi
 * views must come from an authenticated APP/Supabase endpoint with enforced RLS.
 * The boundary is the Public Domain Natural Earth 1:110m admin-0 polygon;
 * it is approximate and must not be interpreted as an authoritative border.
 */
type Row = Record<string, unknown>;
const SAUDI_NAMES = new Set([
  'sa', 'sau', 'saudi arabia', 'saudi', 'السعودية', 'المملكة العربية السعودية',
]);
const SAUDI_RING = saudiAdmin0.coordinates[0] as number[][];

const record = (value: unknown): Row | null =>
  value !== null && typeof value === 'object' && !Array.isArray(value) ? value as Row : null;

function numeric(value: unknown): number | null {
  if (typeof value !== 'number' && (typeof value !== 'string' || !value.trim())) return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

export function inSaudiPublicBoundary(lat: unknown, lng: unknown): boolean {
  const latitude = numeric(lat), longitude = numeric(lng);
  if (latitude === null || longitude === null || latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) return false;
  let inside = false;
  for (let i = 0, j = SAUDI_RING.length - 1; i < SAUDI_RING.length; j = i++) {
    const [xi, yi] = SAUDI_RING[i], [xj, yj] = SAUDI_RING[j];
    if ((yi > latitude) !== (yj > latitude) &&
        longitude < ((xj - xi) * (latitude - yi)) / (yj - yi) + xi) {
      inside = !inside;
    }
  }
  return inside;
}

const saudiCountryCode = (value: unknown): boolean =>
  typeof value === 'string' && SAUDI_NAMES.has(value.trim().toLowerCase());

function isSaudiCoordinates(coordinates: unknown): boolean {
  if (!Array.isArray(coordinates)) return false;
  if (coordinates.length >= 2 && numeric(coordinates[0]) !== null && numeric(coordinates[1]) !== null) {
    // GeoJSON positions use [longitude, latitude].
    return inSaudiPublicBoundary(coordinates[1], coordinates[0]);
  }
  return coordinates.some(isSaudiCoordinates);
}

function isSaudiPointBetween(lat1: unknown, lon1: unknown, lat2: unknown, lon2: unknown): boolean {
  const a = [numeric(lat1), numeric(lon1), numeric(lat2), numeric(lon2)];
  if (a.some(value => value === null)) return false;
  const [y1, x1, y2, x2] = a as number[];
  // Interpolate the shorter path through the antimeridian, not via Asia.
  let deltaLng = x2 - x1;
  if (deltaLng > 180) deltaLng -= 360;
  if (deltaLng < -180) deltaLng += 360;
  for (let step = 0; step <= 16; step++) {
    const fraction = step / 16;
    const wrappedLng = ((x1 + deltaLng * fraction + 540) % 360) - 180;
    if (inSaudiPublicBoundary(y1 + (y2 - y1) * fraction, wrappedLng)) return true;
  }
  return false;
}

/** Explicit non-Saudi country classifications take precedence near coarse borders. */
export function isSaudiPublicIndicator(value: unknown): boolean {
  const row = record(value);
  if (!row) return false;
  const props = record(row.properties);
  const source = props ? [row, props] : [row];
  for (const obj of source) {
    const countryKeys = ['country', 'country_code', 'countryCode', 'country_iso2', 'country_iso3', 'iso2', 'iso3', 'country_name'];
    for (const key of countryKeys) {
      if (saudiCountryCode(obj[key])) return true;
    }
    // Natural Earth 1:110m is not precise enough to override a named country
    // classification, especially for reports near the Yemen border.
    const hasNamedOtherCountry = countryKeys.some(key => typeof obj[key] === 'string' && obj[key].trim().length >= 2);
    if (!hasNamedOtherCountry && inSaudiPublicBoundary(obj.lat ?? obj.latitude, obj.lng ?? obj.lon ?? obj.longitude)) return true;
    if (inSaudiPublicBoundary(obj.target_lat, obj.target_lng) ||
        inSaudiPublicBoundary(obj.origin_lat, obj.origin_lng)) return true;
    if (saudiCountryCode(obj.target_country) ||
        inSaudiPublicBoundary(obj.dst_lat, obj.dst_lng) ||
        inSaudiPublicBoundary(obj.src_lat, obj.src_lng)) return true;
    if (isSaudiPointBetween(obj.origin_lat, obj.origin_lng, obj.target_lat, obj.target_lng)) return true;
    // APP geo-tagged feed uses [lat, lng], not GeoJSON [lng, lat].
    if (Array.isArray(obj.coords) && inSaudiPublicBoundary(obj.coords[0], obj.coords[1])) return true;
    if (isSaudiCoordinates(record(obj.geometry)?.coordinates) || geometryIntersectsSaudi(obj.geometry)) return true;
  }
  return false;
}

const PUBLIC_OBSERVATION_LISTS = [
  'commercial_flights', 'private_flights', 'private_jets', 'civilian_flight_activity',
  'military_activity', 'satellites', 'military_satellite_activity', 'naval_activity',
  'maritime_ports', 'maritime_chokepoints', 'maritime_ships', 'cameras',
  'fires', 'weather_events', 'infrastructure', 'malware_threats', 'cf_outages',
  'cf_attack_origins', 'gdelt', 'gdelt_events', 'civil_unrest', 'reported_routes',
  'conflict_zones', 'conflict_live_events', 'earthquakes', 'app_news',
  'alert_pins', 'sdk_entities', 'live_feeds',
  // Direct public API response names differ from the browser projection.
  'events', 'liveEvents', 'zones', 'outages', 'attack_origins', 'ships',
  'ports', 'flights', 'aircraft', 'countries', 'feeds', 'attacks', 'threats', 'detections',
] as const;

export function maskSaudiPublicIndicators<T extends Row>(projection: T): T {
  const result: Row = { ...projection };
  for (const key of PUBLIC_OBSERVATION_LISTS) {
    if (Array.isArray(result[key])) {
      result[key] = result[key].filter((row: unknown) => !isSaudiPublicIndicator(row)).map((row: unknown) => {
        if (key !== 'zones') return row;
        const zone = record(row);
        if (!zone || !Array.isArray(zone.events)) return row;
        const events = zone.events.filter((event: unknown) => !isSaudiPublicIndicator(event));
        const kinds: Record<string, number> = {};
        for (const event of events) {
          const kind = String(record(event)?.type || 'other');
          kinds[kind] = (kinds[kind] || 0) + 1;
        }
        const eventCount = events.length;
        return { ...zone, events, eventCount, eventKinds: kinds,
          dominantKind: Object.keys(kinds).sort((a, b) => kinds[b] - kinds[a])[0] || 'other',
          activityBand: eventCount >= 10 ? 'active' : eventCount >= 3 ? 'elevated' : 'quiet',
        };
      });
    }
  }
  const fronts = record(result.frontlines);
  if (fronts?.type === 'FeatureCollection' && Array.isArray(fronts.features)) {
    result.frontlines = { ...fronts, features: fronts.features.filter((f: unknown) => !isSaudiPublicIndicator(f)) };
  }
  const atlas = record(result.reference_atlas);
  const collection = record(atlas?.features);
  if (atlas && collection?.type === 'FeatureCollection' && Array.isArray(collection.features)) {
    const features = collection.features.filter((feature: unknown) => {
      const props = record(record(feature)?.properties);
      return !/saudi|السعودية/i.test(String(props?.layerName || '')) && !isSaudiPublicIndicator(feature);
    });
    const layers = Array.isArray(atlas.layers) ? atlas.layers.flatMap((raw: unknown) => {
      const layer = record(raw);
      if (!layer) return [];
      const count = features.filter((feature: unknown) => record(record(feature)?.properties)?.layerId === layer.id).length;
      return count ? [{ ...layer, count }] : [];
    }) : [];
    result.reference_atlas = { ...atlas, features: { type: 'FeatureCollection', features },
      featureCount: features.length, layers,
      changes: features.length === collection.features.length ? atlas.changes ?? null : null };
  }
  // Recompute count fields that belong to these lists; never show a raw
  // Saudi-inclusive count alongside a masked list.
  for (const [items, total] of [
    ['events', 'total'], ['zones', 'totalZones'], ['liveEvents', 'totalLiveEvents'],
    ['cameras', 'total'], ['fires', 'total'], ['ships', 'total_ships'],
    ['ports', 'total_ports'], ['chokepoints', 'total_chokepoints'],
    ['satellites', 'total'], ['outages', 'total_outages'],
    ['attack_origins', 'total_attack_origins'], ['attacks', 'total'], ['threats', 'total'],
    ['detections', 'total'],
    ['reported_routes', 'reported_routes_total'],
  ] as const) {
    if (Array.isArray(result[items]) && typeof result[total] === 'number') {
      result[total] = result[items].length;
    }
  }
  const rows = result.liveEvents;
  if (Array.isArray(result.commercial_flights) && Array.isArray(result.private_flights) && Array.isArray(result.private_jets)) {
    const publicTotal = result.commercial_flights.length + result.private_flights.length + result.private_jets.length;
    if (typeof result.total === 'number') result.total = publicTotal;
    const civilianMeta = record(result.civilian_flight_activity_meta);
    if (civilianMeta) {
      result.civilian_flight_activity_meta = { ...civilianMeta, public_total: publicTotal,
        fallback_cells: Array.isArray(result.civilian_flight_activity) ? result.civilian_flight_activity.length : 0 };
    }
    const flightStatus = record(result.flight_source_status);
    if (flightStatus) result.flight_source_status = { ...flightStatus, public_total: publicTotal,
      civilian_fallback_cells: Array.isArray(result.civilian_flight_activity) ? result.civilian_flight_activity.length : 0,
      military_public_cells: Array.isArray(result.military_activity) ? result.military_activity.length : 0 };
  }
  if (Array.isArray(rows) && 'categoryCounts' in result) {
    const categories: Record<string, number> = {};
    for (const row of rows) {
      const category = String(record(row)?.type || 'other');
      categories[category] = (categories[category] || 0) + 1;
    }
    result.categoryCounts = categories;
  }
  const zones = result.zones;
  if (Array.isArray(zones) && 'zonesWithRecentReports' in result) {
    result.zonesWithRecentReports = zones.filter(v => Number(record(v)?.eventCount) > 0).length;
  }
  const sourceStatus = record(result.source_status);
  const reference = record(sourceStatus?.reference);
  if (sourceStatus && reference && Array.isArray(result.ports)) {
    result.source_status = { ...sourceStatus, reference: { ...reference,
      ports: result.ports.length,
      ...(Array.isArray(result.chokepoints) ? { chokepoints: result.chokepoints.length } : {}),
    } };
  }
  return result as T;
}

/** News text and its cited publisher stay public; geotags are observations. */
export function maskSaudiPublicNewsLocation<T extends object>(news: T): T {
  if (!isSaudiPublicIndicator(news)) return news;
  return { ...news, coords: null, coords_default: true, location_basis: 'none' } as T;
}
