import { createHash } from 'node:crypto';
import { XMLParser, XMLValidator } from 'fast-xml-parser';
import { inSaudiPublicBoundary } from './publicCountryVisibility';
import { geometryIntersectsSaudi } from './publicGeometryBoundary';
import { ISWN_MAP_URL, type AtlasBulletin, type AtlasCollection, type AtlasGeometry, type AtlasPosition } from './iswnAtlas';

export const MAX_KML_BYTES = 6 * 1024 * 1024;
export const MAX_FEED_BYTES = 1024 * 1024;
const MAX_FEATURES = 12_000;
const MAX_COORDINATES = 200_000;
type Node = Record<string, unknown>;
const object = (value: unknown): Node => value !== null && typeof value === 'object' && !Array.isArray(value) ? value as Node : {};
const list = (value: unknown): unknown[] => value == null ? [] : Array.isArray(value) ? value : [value];
const hash = (value: string) => createHash('sha256').update(value).digest('hex').slice(0, 24);
const plain = (value: unknown, limit = 200): string => String(typeof value === 'string' || typeof value === 'number' ? value : '')
  .replace(/<[^>]*>/g, '').replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, limit);

function xmlDocument(xml: string, maxBytes: number): Node {
  if (Buffer.byteLength(xml, 'utf8') > maxBytes) throw new Error('source_size_limit');
  if (/<!\s*(DOCTYPE|ENTITY)\b/i.test(xml)) throw new Error('xml_entities_forbidden');
  // Reject extreme nesting before either XML library traverses it.
  let depth = 0, tags = 0;
  for (const match of xml.matchAll(/<!--[\s\S]*?-->|<!\[CDATA\[[\s\S]*?\]\]>|<[^>]+>/g)) {
    const tag = match[0];
    if (tag.startsWith('<!') || tag.startsWith('<?')) continue;
    if (++tags > 400_000) throw new Error('xml_tag_limit');
    if (tag.startsWith('</')) depth--;
    else if (!tag.endsWith('/>')) depth++;
    if (depth > 64) throw new Error('xml_depth_limit');
  }
  if (XMLValidator.validate(xml) !== true) throw new Error('invalid_xml');
  return object(new XMLParser({ ignoreAttributes: false, removeNSPrefix: true,
    parseTagValue: false, processEntities: false, trimValues: true }).parse(xml));
}

function explicitFolderDate(name: string): string | null {
  const match = name.match(/last\s*update(?:d)?\s*:?\s*(\d{4}-\d{2}-\d{2})/i);
  if (!match) return null;
  const value = `${match[1]}T00:00:00.000Z`;
  return Number.isFinite(Date.parse(value)) && new Date(value).toISOString() === value ? value : null;
}

export function parseIswnKml(xml: string): AtlasCollection {
  const doc = object(object(xmlDocument(xml, MAX_KML_BYTES).kml).Document);
  if (!Object.keys(doc).length) throw new Error('missing_kml_document');
  const features: AtlasCollection['features'] = [];
  const areaOccurrences = new Map<string, number>();
  let coordinateCount = 0, placemarkCount = 0;
  function coordinates(value: unknown): AtlasPosition[] | null {
    if (typeof value !== 'string' || !value.trim()) return null;
    const tokens = value.trim().split(/\s+/);
    coordinateCount += tokens.length;
    if (coordinateCount > MAX_COORDINATES) throw new Error('coordinate_limit');
    const result: AtlasPosition[] = [];
    for (const token of tokens) {
      const parts = token.split(',');
      if (parts.length < 2 || parts.length > 3 || parts.some(part => !part.trim() || !Number.isFinite(Number(part)))) return null;
      const [lng, lat] = parts.map(Number);
      if (Math.abs(lng) > 180 || Math.abs(lat) > 90) return null;
      result.push([lng, lat]);
    }
    return result;
  }
  function ring(value: unknown): AtlasPosition[] | null {
    const points = coordinates(object(object(value).LinearRing).coordinates);
    if (!points || points.length < 4) return null;
    if (points[0][0] !== points.at(-1)![0] || points[0][1] !== points.at(-1)![1]) return null;
    if (new Set(points.map(point => point.join(','))).size < 3) return null;
    const area = points.slice(1).reduce((sum, point, index) => sum + points[index][0] * point[1] - point[0] * points[index][1], 0);
    if (Math.abs(area) < 1e-12) return null;
    return points;
  }
  function geometries(node: Node, level = 0): AtlasGeometry[] {
    if (level > 16) throw new Error('geometry_depth_limit');
    const result: AtlasGeometry[] = [];
    for (const point of list(node.Point)) {
      const position = coordinates(object(point).coordinates);
      if (position?.length === 1 && !inSaudiPublicBoundary(position[0][1], position[0][0])) {
        result.push({ type: 'Point', coordinates: position[0].map(value => Math.round(value * 4) / 4) as AtlasPosition });
      }
    }
    for (const polygon of list(node.Polygon)) {
      const p = object(polygon);
      const outer = ring(p.outerBoundaryIs);
      const holes = list(p.innerBoundaryIs).map(ring);
      if (outer && holes.every(hole => hole !== null)) result.push({ type: 'Polygon', coordinates: [outer, ...holes as AtlasPosition[][]] });
    }
    for (const line of list(node.LineString)) {
      const original = coordinates(object(line).coordinates);
      if (!original || original.length < 2 || geometryIntersectsSaudi({ type: 'LineString', coordinates: original })) continue;
      const generalized = original.map(position => position.map(value => Math.round(value * 4) / 4) as AtlasPosition)
        .filter((position, index, positions) => index === 0 || position[0] !== positions[index - 1][0] || position[1] !== positions[index - 1][1]);
      const geometry = { type: 'LineString' as const, coordinates: generalized };
      if (generalized.length >= 2 && !geometryIntersectsSaudi(geometry)) result.push(geometry);
    }
    for (const multi of list(node.MultiGeometry)) result.push(...geometries(object(multi), level + 1));
    // Time-bearing gx:Track, NetworkLink and remote icons remain excluded.
    return result;
  }
  function walk(node: Node, layerName: string, path: string, sourceDate: string | null, depth = 0) {
    if (depth > 16) throw new Error('folder_depth_limit');
    const layerId = `iswn-${hash(path)}`;
    for (const candidate of list(node.Placemark)) {
      if (++placemarkCount > MAX_FEATURES) throw new Error('feature_limit');
      const placemark = object(candidate);
      const name = plain(placemark.name) || 'Unnamed reference annotation';
      const shapes = geometries(placemark);
      // Keep each point independent; combine area parts while retaining holes.
      const areas = shapes.filter((shape): shape is Extract<AtlasGeometry, { type: 'Polygon' }> => shape.type === 'Polygon');
      const combined: AtlasGeometry[] = shapes.filter(shape => shape.type === 'Point' || shape.type === 'LineString');
      if (areas.length === 1) combined.push(areas[0]);
      else if (areas.length > 1) combined.push({ type: 'MultiPolygon', coordinates: areas.map(area => area.coordinates) });
      for (const [index, geometry] of combined.entries()) {
        if (features.length >= MAX_FEATURES) throw new Error('feature_limit');
        const identity = plain(placemark['@_id']) || `${name}:${index}`;
        // Duplicate named points need distinct identities without retaining precise coordinates.
        const areaKey = `${path}:${identity}:${geometry.type}`;
        const occurrence = areaOccurrences.get(areaKey) ?? 0;
        if (geometry.type !== 'Point') areaOccurrences.set(areaKey, occurrence + 1);
        const id = `iswn-${hash(`${areaKey}:${geometry.type === 'Point' ? geometry.coordinates.join(',') : occurrence}`)}`;
        features.push({ type: 'Feature', geometry, properties: { id, name, layerId, layerName,
          kind: geometry.type === 'Point' ? 'reference_point' : geometry.type === 'LineString' ? 'reference_line' : 'reference_area', sourcePublishedAt: sourceDate,
          sourceUrl: ISWN_MAP_URL, attribution: 'Islamic World News (ISWN) — publisher map claim',
          precision: geometry.type === 'Point' ? 'regional' : geometry.type === 'LineString' ? 'generalized_line' : 'published_area' } });
      }
    }
    for (const [index, candidate] of list(node.Folder).entries()) {
      const folder = object(candidate);
      const name = plain(folder.name) || `Layer ${index + 1}`;
      walk(folder, name, `${path}/${name}`, explicitFolderDate(name) ?? sourceDate, depth + 1);
    }
  }
  walk(doc, 'ISWN reference map', 'iswn', null);
  if (!features.length) throw new Error('no_supported_annotations');
  // Collapse exact generalized duplicates to prevent coincident IDs in map components.
  return { type: 'FeatureCollection', features: [...new Map(features.map(feature => [feature.properties.id, feature])).values()] };
}

export function parseIswnBulletins(xml: string): AtlasBulletin[] {
  const channel = object(object(xmlDocument(xml, MAX_FEED_BYTES).rss).channel);
  if (!Object.keys(channel).length) throw new Error('invalid_rss');
  return list(channel.item).slice(0, 100).flatMap(candidate => {
    const item = object(candidate), title = plain(item.title), link = plain(item.link, 1000);
    const date = Date.parse(plain(item.pubDate));
    try {
      const url = new URL(link);
      if (!title || !Number.isFinite(date) || url.origin !== 'https://english.iswnews.com' || url.username || url.password || url.port ||
          !/^\/\d+\/(?:[a-z0-9-]+\/)?$/i.test(url.pathname)) return [];
      url.search = ''; url.hash = '';
      return [{ id: hash(plain(item.guid, 1000) || url.href), title, url: url.href, publishedAt: new Date(date).toISOString() }];
    } catch { return []; }
  });
}

export function isMajorIswnBulletin(bulletin: AtlasBulletin, now: number): boolean {
  const age = now - Date.parse(bulletin.publishedAt);
  return age >= 0 && age <= 6 * 60 * 60 * 1000 &&
    /\b(?:ceasefire|invasion|offensive|withdrawal|captur(?:e|ed)|seiz(?:e|ed)|ground assault|major attack|ballistic missile|airstrikes?|missile strikes?)\b/i.test(bulletin.title);
}
