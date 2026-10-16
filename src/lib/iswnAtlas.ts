/** Public reference annotations, not verified events or control observations. */
export const ISWN_MAP_URL = 'https://www.google.com/maps/d/kml?mid=1M-_ymjR9xwOK7KMikOcUFSAE1ac&forcekml=1';
export const ISWN_PUBLISHER_URL = 'https://english.iswnews.com/';
export const ISWN_FEED_URL = 'https://english.iswnews.com/feed/';
export const ISWN_REFRESH_MS = 12 * 60 * 60 * 1000;
export const ISWN_CHECK_MS = 15 * 60 * 1000;
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
  layers: AtlasLayer[]; refreshReason: 'scheduled' | 'major_report' | 'initial' | null;
  changes: { added: number; removed: number; changed: number } | null;
  cacheBackend: string; bulletins: AtlasBulletin[]; error: string | null;
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
