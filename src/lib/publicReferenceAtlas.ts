/** Explicit browser contract: no KML HTML, network links, exact point locations,
 * private fields or caller-supplied publisher URLs cross this projection. */
import type { AtlasFeature, AtlasGeometry, AtlasPosition, AtlasSnapshot } from './iswnAtlas';
import { isSaudiPublicIndicator } from './publicCountryVisibility';
const SOURCE = 'https://www.google.com/maps/d/viewer?mid=1M-_ymjR9xwOK7KMikOcUFSAE1ac';
const PUBLISHER = 'https://english.iswnews.com/';
type Row = Record<string, unknown>;
const row = (v: unknown): Row => v !== null && typeof v === 'object' && !Array.isArray(v) ? v as Row : {};
const text = (v: unknown, max = 220) => typeof v === 'string' ? v.replace(/<[^>]*>/g, '').replace(/[\u0000-\u001f]/g, ' ').slice(0, max) : '';
const date = (v: unknown) => typeof v === 'string' && Number.isFinite(Date.parse(v)) ? new Date(v).toISOString() : null;
const point = (v: unknown): v is [number, number] => Array.isArray(v) && v.length === 2
  && typeof v[0] === 'number' && typeof v[1] === 'number' && Number.isFinite(v[0]) && Number.isFinite(v[1])
  && Math.abs(v[0]) <= 180 && Math.abs(v[1]) <= 90;
function ring(v: unknown): v is [number, number][] {
  return Array.isArray(v) && v.length >= 4 && v.length <= 20_000 && v.every(point)
    && v[0][0] === v[v.length - 1][0] && v[0][1] === v[v.length - 1][1];
}
function geometry(value: unknown): AtlasGeometry | null {
  const g = row(value), c = g.coordinates;
  if (g.type === 'Point' && point(c)) return { type: 'Point', coordinates: c.map(n => Math.round(n * 4) / 4) as AtlasPosition };
  if (g.type === 'Polygon' && Array.isArray(c) && c.length <= 64 && c.length && c.every(ring)) return { type: 'Polygon', coordinates: c };
  if (g.type === 'MultiPolygon' && Array.isArray(c) && c.length <= 128 && c.length
    && c.every(p => Array.isArray(p) && p.length > 0 && p.length <= 64 && p.every(ring))) return { type: 'MultiPolygon', coordinates: c as AtlasPosition[][][] };
  return null;
}

export function publicReferenceAtlas(value: unknown): AtlasSnapshot | null {
  const source = row(value);
  if (source.provider !== 'iswn' || source.version !== 1 || source.contentKind !== 'reference_annotations') return null;
  const rawFeatures = row(source.features).features;
  let remainingCoordinates = 250_000;
  const features = (Array.isArray(rawFeatures) ? rawFeatures.slice(0, 10_000) : []).flatMap<AtlasFeature>(raw => {
    const f = row(raw), p = row(f.properties);
    // Suppress original coordinates before generalization can move a border point.
    if (/saudi|السعودية/i.test(String(p.layerName || '')) || isSaudiPublicIndicator(f)) return [];
    const g = geometry(f.geometry);
    if (!g || !text(p.id) || !text(p.layerId)) return [];
    // Geometry is validated above, so counting positions never follows attacker objects.
    const coordinateCount = JSON.stringify(g.coordinates).split('[').length - 1;
    remainingCoordinates -= coordinateCount;
    if (remainingCoordinates < 0) return [];
    const kind = g.type === 'Point' ? 'reference_point' : 'reference_area';
    return [{ type: 'Feature', id: text(p.id), geometry: g, properties: {
      id: text(p.id), name: text(p.name), layerId: text(p.layerId), layerName: text(p.layerName), kind,
      sourcePublishedAt: date(p.sourcePublishedAt), sourceUrl: SOURCE,
      attribution: 'ISWN / Islamic World News', precision: kind === 'reference_point' ? 'regional' : 'published_area',
    } }];
  });
  const rawLayers = Array.isArray(source.layers) ? source.layers : [];
  const layers = rawLayers.slice(0, 50).flatMap(raw => {
    const p = row(raw), id = text(p.id), count = features.filter(f => f.properties.layerId === id).length;
    return count ? [{ id, name: text(p.name), sourcePublishedAt: date(p.sourcePublishedAt), count }] : [];
  });
  const bulletins = (Array.isArray(source.bulletins) ? source.bulletins : []).slice(0, 20).flatMap(raw => {
    const b = row(raw), publishedAt = date(b.publishedAt);
    try {
      const url = new URL(String(b.url));
      if (url.origin !== 'https://english.iswnews.com' || !/^\/\d+\//.test(url.pathname) || url.username || url.password || !publishedAt) return [];
      url.search = ''; url.hash = '';
      return [{ id: text(b.id), title: text(b.title), url: url.href, publishedAt }];
    } catch { return []; }
  });
  const changes = row(source.changes);
  const counts = ['added', 'removed', 'changed'].map(key => changes[key]);
  return {
    version: 1, provider: 'iswn', status: source.status === 'ok' || source.status === 'stale' ? source.status : 'unavailable',
    contentKind: 'reference_annotations', sourceUrl: SOURCE, publisherUrl: PUBLISHER,
    fetchedAt: date(source.fetchedAt), checkedAt: date(source.checkedAt), nextRefreshAt: date(source.nextRefreshAt),
    sourcePublishedAt: date(source.sourcePublishedAt), features: { type: 'FeatureCollection', features }, featureCount: features.length, layers,
    refreshReason: source.refreshReason === 'scheduled' || source.refreshReason === 'major_report' || source.refreshReason === 'initial' ? source.refreshReason : null,
    changes: features.length === (Array.isArray(rawFeatures) ? rawFeatures.length : 0)
      && counts.every(n => typeof n === 'number' && Number.isInteger(n) && n >= 0 && n <= 10_000)
      ? { added: Number(changes.added), removed: Number(changes.removed), changed: Number(changes.changed) } : null,
    cacheBackend: ['redis', 'memory', 'miss', 'not-stored'].includes(String(source.cacheBackend)) ? String(source.cacheBackend) : 'miss',
    bulletins, error: source.status === 'ok' ? null : 'تعذّر تحديث المصدر؛ تاريخ المحتوى مستقل عن وقت السحب.',
  };
}
