/** Public reference annotations, not verified events or control observations. */
export const ISWN_MAP_URL = 'https://www.google.com/maps/d/kml?mid=1M-_ymjR9xwOK7KMikOcUFSAE1ac&forcekml=1';
export const ISWN_PUBLISHER_URL = 'https://english.iswnews.com/';
export const ISWN_FEED_URL = 'https://english.iswnews.com/feed/';
// Archive collection: twice per day or an explicitly authenticated manual run.
// Never infer evidence freshness from this acquisition schedule.
export const ISWN_REFRESH_MS = 12 * 60 * 60 * 1000;
// Internal collector retry cooldown; NOT a public polling interval.
export const ISWN_CHECK_MS = 2 * 60 * 1000;
export type AtlasPosition = [number, number];
export type AtlasGeometry = { type: 'Point'; coordinates: AtlasPosition }
  | { type: 'LineString'; coordinates: AtlasPosition[] }
  | { type: 'Polygon'; coordinates: AtlasPosition[][] }
  | { type: 'MultiPolygon'; coordinates: AtlasPosition[][][] };
export interface AtlasFeature {
  type: 'Feature';
  geometry: AtlasGeometry;
  properties: {
    id: string; name: string; layerId: string; layerName: string;
    kind: 'reference_point' | 'reference_area' | 'reference_line'; sourcePublishedAt: string | null;
    sourceUrl: string; attribution: string; precision: 'regional' | 'published_area' | 'generalized_line';
  };
}
export interface AtlasCollection { type: 'FeatureCollection'; features: AtlasFeature[] }
export interface AtlasLayer { id: string; name: string; sourcePublishedAt: string | null; count: number }
export interface AtlasBulletin { id: string; title: string; url: string; publishedAt: string }
export interface AtlasSnapshot {
  version: 1; provider: 'iswn'; status: 'ok' | 'stale' | 'unavailable';
  sourceUrl: string; publisherUrl: string; fetchedAt: string | null; checkedAt: string | null;
  nextRefreshAt: string | null; sourcePublishedAt: string | null;
  contentKind: 'reference_annotations'; features: AtlasCollection; featureCount: number;
  layers: AtlasLayer[]; refreshReason: 'scheduled' | 'major_report' | 'major_event' | 'initial' | 'manual' | null;
  /** Retrieval health never establishes present-day territorial control. */
  evidenceState?: 'unknown' | 'historical' | 'dated-reference' | 'mixed';
  sourceOldestPublishedAt?: string | null;
  undatedFeatureCount?: number;
  currentControl?: false;
  majorEventState?: 'pending' | 'none';
  changes: { added: number; removed: number; changed: number } | null;
  cacheBackend: string; bulletins: AtlasBulletin[]; error: string | null;
}

/** Only publisher metadata dates the evidence; collection time is irrelevant. */
export function atlasEvidence(features: AtlasFeature[], now = Date.now()) {
  const dates = features.flatMap(feature => {
    const date = feature.properties.sourcePublishedAt;
    const time = typeof date === 'string' ? Date.parse(date) : NaN;
    return Number.isFinite(time) && time <= now ? [time] : [];
  }).sort((a, b) => a - b);
  const undatedFeatureCount = features.length - dates.length;
  const historical = dates.filter(time => now - time >= 12 * 60 * 60 * 1000).length;
  const evidenceState: NonNullable<AtlasSnapshot['evidenceState']> = !dates.length ? 'unknown'
    : undatedFeatureCount > 0 || (historical > 0 && historical < dates.length) ? 'mixed'
      : historical === dates.length ? 'historical' : 'dated-reference';
  return { evidenceState, currentControl: false as const, undatedFeatureCount,
    sourcePublishedAt: dates.length ? new Date(dates[dates.length - 1]).toISOString() : null,
    sourceOldestPublishedAt: dates.length ? new Date(dates[0]).toISOString() : null };
}

/** Bounded opaque ids are data, never upstream addresses or instructions. */
export function validAtlasEventId(value: unknown): value is string {
  return typeof value === 'string' && /^[A-Za-z0-9][A-Za-z0-9_.:-]{0,95}$/.test(value);
}

export function atlasLayers(features: AtlasFeature[]): AtlasLayer[] {
  const layers = new Map<string, AtlasLayer>();
  for (const { properties: p } of features) {
    const layer = layers.get(p.layerId) ?? { id: p.layerId, name: p.layerName, sourcePublishedAt: p.sourcePublishedAt, count: 0 };
    layer.count++;
    layers.set(p.layerId, layer);
  }
  return [...layers.values()];
}

export function calculateAtlasChanges(previous: AtlasCollection, current: AtlasCollection): NonNullable<AtlasSnapshot['changes']> {
  const before = new Map(previous.features.map(feature => [feature.properties.id, JSON.stringify(feature)]));
  const after = new Map(current.features.map(feature => [feature.properties.id, JSON.stringify(feature)]));
  return {
    added: [...after.keys()].filter(id => !before.has(id)).length,
    removed: [...before.keys()].filter(id => !after.has(id)).length,
    changed: [...after].filter(([id, value]) => before.has(id) && before.get(id) !== value).length,
  };
}
