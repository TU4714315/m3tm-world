export const PUBLIC_CIVILIAN_CELL_DEG = 2;
export const PUBLIC_CIVILIAN_MIN_CACHE_TOTAL = 100;
export const PUBLIC_CIVILIAN_MAX_CELLS = 600;
const PUBLIC_CIVILIAN_MACRO_CELL_DEG = 10;

export type CivilianFlightGroup = 'commercial' | 'private' | 'jets';

export interface PublicCivilianFlightCell {
  id: string;
  lat: number;
  lng: number;
  total: number;
  commercial: number;
  private: number;
  jets: number;
  cell_degrees: number;
  precision: 'coarse-2deg';
  data_state: 'live' | 'cached-stale';
  observed_at: string;
  age_seconds: number;
}

export interface PublicCivilianFlightSnapshot {
  cells: PublicCivilianFlightCell[];
  observed_at: string;
}

const validCoordinate = (lat: number, lng: number) =>
  Number.isFinite(lat) && Number.isFinite(lng) &&
  lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180;

const isMenaCoverageCell = (cell: Pick<PublicCivilianFlightCell, 'lat' | 'lng'>) =>
  cell.lat >= -5 && cell.lat <= 45 && cell.lng >= -20 && cell.lng <= 75;

/** Keep fallback storage bounded without turning it into a density-only sample.
 * One cell per populated 10-degree macro region is selected per round before a
 * second cell from the same region. MENA macro regions win ties so sparse
 * regional corridors survive a global provider outage.
 */
export function boundCivilianFlightAggregate(
  cells: PublicCivilianFlightCell[],
  limit = PUBLIC_CIVILIAN_MAX_CELLS,
): PublicCivilianFlightCell[] {
  const safeLimit = Math.max(0, Math.floor(limit));
  if (safeLimit === 0) return [];
  if (cells.length <= safeLimit) return [...cells].sort((a, b) => b.total - a.total);

  const macroBuckets = new Map<string, PublicCivilianFlightCell[]>();
  for (const cell of cells) {
    const latIndex = Math.floor((cell.lat + 90) / PUBLIC_CIVILIAN_MACRO_CELL_DEG);
    const lngIndex = Math.floor((cell.lng + 180) / PUBLIC_CIVILIAN_MACRO_CELL_DEG);
    const key = `${latIndex}:${lngIndex}`;
    const bucket = macroBuckets.get(key) ?? [];
    bucket.push(cell);
    macroBuckets.set(key, bucket);
  }

  const groups = Array.from(macroBuckets.entries()).map(([key, bucket]) => ({
    key,
    mena: bucket.some(isMenaCoverageCell),
    cells: bucket.sort((a, b) => b.total - a.total || a.id.localeCompare(b.id)),
  })).sort((a, b) =>
    Number(b.mena) - Number(a.mena) ||
    (b.cells[0]?.total ?? 0) - (a.cells[0]?.total ?? 0) ||
    a.key.localeCompare(b.key)
  );

  const selected: PublicCivilianFlightCell[] = [];
  for (let depth = 0; selected.length < safeLimit; depth += 1) {
    let added = false;
    for (const group of groups) {
      const cell = group.cells[depth];
      if (!cell) continue;
      selected.push(cell);
      added = true;
      if (selected.length >= safeLimit) break;
    }
    if (!added) break;
  }
  return selected;
}

export function buildCivilianFlightAggregate(
  groups: Record<CivilianFlightGroup, any[]>,
  observedAtMs = Date.now(),
): PublicCivilianFlightCell[] {
  const buckets = new Map<string, {
    lat: number; lng: number; total: number; commercial: number; private: number; jets: number;
  }>();
  for (const [group, flights] of Object.entries(groups) as Array<[CivilianFlightGroup, any[]]>) {
    for (const flight of flights || []) {
      const lat = Number(flight?.lat);
      const lng = Number(flight?.lng);
      if (!validCoordinate(lat, lng)) continue;
      const latIndex = Math.floor((lat + 90) / PUBLIC_CIVILIAN_CELL_DEG);
      const lngIndex = Math.floor((lng + 180) / PUBLIC_CIVILIAN_CELL_DEG);
      const centerLat = Math.max(-89, Math.min(89, -90 + latIndex * PUBLIC_CIVILIAN_CELL_DEG + PUBLIC_CIVILIAN_CELL_DEG / 2));
      const centerLng = Math.max(-179, Math.min(179, -180 + lngIndex * PUBLIC_CIVILIAN_CELL_DEG + PUBLIC_CIVILIAN_CELL_DEG / 2));
      const key = `${latIndex}:${lngIndex}`;
      const bucket = buckets.get(key) ?? {
        lat: centerLat, lng: centerLng, total: 0, commercial: 0, private: 0, jets: 0,
      };
      bucket.total += 1;
      bucket[group] += 1;
      buckets.set(key, bucket);
    }
  }

  const observedAt = new Date(observedAtMs).toISOString();
  const cells = Array.from(buckets.entries())
    .map(([key, bucket]) => ({
      id: `civilian-flight-cell-${key}`,
      ...bucket,
      cell_degrees: PUBLIC_CIVILIAN_CELL_DEG,
      precision: 'coarse-2deg' as const,
      data_state: 'live' as const,
      observed_at: observedAt,
      age_seconds: 0,
    }));
  return boundCivilianFlightAggregate(cells);
}

export function staleCivilianFlightAggregate(
  snapshot: PublicCivilianFlightSnapshot,
  now = Date.now(),
): PublicCivilianFlightCell[] {
  const observed = Date.parse(snapshot.observed_at);
  const ageSeconds = Number.isFinite(observed) && observed <= now
    ? Math.max(0, Math.round((now - observed) / 1000))
    : 0;
  return (snapshot.cells || []).map(cell => ({
    ...cell,
    data_state: 'cached-stale' as const,
    observed_at: snapshot.observed_at,
    age_seconds: ageSeconds,
  }));
}

export function civilianFlightMapFeatures(
  cells: PublicCivilianFlightCell[] = [],
  visible: Partial<Record<CivilianFlightGroup, boolean>> = {},
) {
  const showCommercial = visible.commercial !== false;
  const showPrivate = visible.private !== false;
  const showJets = visible.jets !== false;
  return cells.flatMap(cell => {
    if (!validCoordinate(Number(cell?.lat), Number(cell?.lng))) return [];
    const commercial = showCommercial ? Math.max(0, Math.round(Number(cell.commercial) || 0)) : 0;
    const privateFlights = showPrivate ? Math.max(0, Math.round(Number(cell.private) || 0)) : 0;
    const jets = showJets ? Math.max(0, Math.round(Number(cell.jets) || 0)) : 0;
    const total = commercial + privateFlights + jets;
    if (!Number.isFinite(total) || total < 1) return [];
    return [{
      type: 'Feature' as const,
      geometry: {
        type: 'Point' as const,
        coordinates: [Number(cell.lng), Number(cell.lat)] as [number, number],
      },
      properties: {
        total: Math.round(total),
        commercial,
        private: privateFlights,
        jets,
        cell_degrees: PUBLIC_CIVILIAN_CELL_DEG,
        precision: 'coarse-2deg',
        data_state: cell.data_state === 'cached-stale' ? 'cached-stale' : 'live',
        observed_at: typeof cell.observed_at === 'string' ? cell.observed_at : null,
        age_seconds: Math.max(0, Math.round(Number(cell.age_seconds) || 0)),
      },
    }];
  });
}
