/** Public-only geographic allowlist for vegetation fire hotspots.
 * Broad regions are intentional; no military geofencing or precise operations.
 * Do not infer that a thermal hotspot is an attack or conflict incident.
 */
type Box = Readonly<{ south: number; north: number; west: number; east: number }>;
const PUBLIC_FIRE_REGIONS: readonly Box[] = [
  { south: 8, north: 43, west: 20, east: 66 },  // Middle East / Gulf / Iran / Yemen
  { south: -35, north: 38, west: -18, east: 52 }, // Africa
  { south: 44, north: 54, west: 22, east: 41 }, // Ukraine conflict theatre (published regional scope)
  { south: 9, north: 28, west: 92, east: 101 }, // Myanmar conflict theatre
];
export function isPublicFireRegion(lat: unknown, lng: unknown): boolean {
  if (typeof lat !== 'number' || typeof lng !== 'number'
    || !Number.isFinite(lat) || !Number.isFinite(lng)) return false;
  return PUBLIC_FIRE_REGIONS.some(box =>
    lat >= box.south && lat <= box.north && lng >= box.west && lng <= box.east);
}
