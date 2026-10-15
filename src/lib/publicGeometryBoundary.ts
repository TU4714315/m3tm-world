import saudiAdmin0 from './saudiAdmin0.json';

type Position = [number, number];
const saudi = saudiAdmin0.coordinates[0] as Position[];
const EPS = 1e-9;
const position = (p: unknown): p is Position => Array.isArray(p) && p.length >= 2
  && typeof p[0] === 'number' && typeof p[1] === 'number'
  && Number.isFinite(p[0]) && Number.isFinite(p[1]);
const cross = (a: Position, b: Position, p: Position) => (b[0] - a[0]) * (p[1] - a[1]) - (b[1] - a[1]) * (p[0] - a[0]);
function onSegment(a: Position, b: Position, p: Position) {
  return Math.abs(cross(a, b, p)) <= EPS && p[0] >= Math.min(a[0], b[0]) - EPS
    && p[0] <= Math.max(a[0], b[0]) + EPS && p[1] >= Math.min(a[1], b[1]) - EPS
    && p[1] <= Math.max(a[1], b[1]) + EPS;
}
function intersects(a: Position, b: Position, c: Position, d: Position) {
  if (Math.max(a[0], b[0]) < Math.min(c[0], d[0]) || Math.max(c[0], d[0]) < Math.min(a[0], b[0])
    || Math.max(a[1], b[1]) < Math.min(c[1], d[1]) || Math.max(c[1], d[1]) < Math.min(a[1], b[1])) return false;
  const x = cross(a, b, c), y = cross(a, b, d), u = cross(c, d, a), v = cross(c, d, b);
  return (x * y < 0 && u * v < 0) || onSegment(a, b, c) || onSegment(a, b, d)
    || onSegment(c, d, a) || onSegment(c, d, b);
}
function contains(p: Position, ring: Position[]) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const a = ring[j], b = ring[i];
    if (onSegment(a, b, p)) return true;
    if ((a[1] > p[1]) !== (b[1] > p[1]) && p[0] < (b[0] - a[0]) * (p[1] - a[1]) / (b[1] - a[1]) + a[0]) inside = !inside;
  }
  return inside;
}
/** Unwrap short antimeridian edges; they must not become lines across Arabia. */
function unwrap(raw: unknown): Position[] {
  if (!Array.isArray(raw) || !raw.every(position)) return [];
  const out: Position[] = [];
  for (const p of raw) {
    let lng = p[0];
    const previous = out[out.length - 1]?.[0] ?? lng;
    while (lng - previous > 180) lng -= 360;
    while (lng - previous < -180) lng += 360;
    out.push([lng, p[1]]);
  }
  return out;
}
function boundaryNear(ring: Position[]) {
  const center = ring.reduce((sum, p) => sum + p[0], 0) / Math.max(1, ring.length);
  const shift = 360 * Math.round((center - 45) / 360);
  return saudi.map(([x, y]): Position => [x + shift, y]);
}
function ringIntersects(ring: Position[], boundary: Position[]) {
  if (ring.some(p => contains(p, boundary))) return true;
  for (let i = 1; i < ring.length; i++) {
    for (let j = 1; j < boundary.length; j++) {
      if (intersects(ring[i - 1], ring[i], boundary[j - 1], boundary[j])) return true;
    }
  }
  return false;
}
function polygonIntersects(raw: unknown) {
  if (!Array.isArray(raw)) return false;
  const rings = raw.map(unwrap);
  if (!rings[0]?.length) return false;
  const boundary = boundaryNear(rings[0]);
  if (rings.some(ring => ringIntersects(ring, boundary))) return true;
  // A polygon may enclose Saudi Arabia without putting a vertex inside it.
  return boundary.some(p => contains(p, rings[0]) && !rings.slice(1).some(hole => contains(p, hole)));
}

/** Approximate public suppression boundary, never an authoritative border. */
export function geometryIntersectsSaudi(value: unknown, depth = 0): boolean {
  if (depth > 8 || !value || typeof value !== 'object') return false;
  const g = value as Record<string, unknown>;
  const c = g.coordinates;
  if (g.type === 'Point') return position(c) && contains(c, saudi);
  if (g.type === 'MultiPoint') return Array.isArray(c) && c.some(p => position(p) && contains(p, saudi));
  if (g.type === 'Polygon') return polygonIntersects(c);
  if (g.type === 'MultiPolygon') return Array.isArray(c) && c.some(polygonIntersects);
  if (g.type === 'LineString') { const line = unwrap(c); return line.length > 0 && ringIntersects(line, boundaryNear(line)); }
  if (g.type === 'MultiLineString') return Array.isArray(c) && c.some(line => geometryIntersectsSaudi({ type: 'LineString', coordinates: line }, depth + 1));
  if (g.type === 'GeometryCollection') return Array.isArray(g.geometries) && g.geometries.some(g => geometryIntersectsSaudi(g, depth + 1));
  return false;
}
