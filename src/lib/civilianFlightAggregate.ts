export const PUBLIC_CIVILIAN_CELL_DEG = 2;
export const PUBLIC_CIVILIAN_MIN_CACHE_TOTAL = 100;

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
  return Array.from(buckets.entries())
    .map(([key, bucket]) => ({
      id: `civilian-flight-cell-${key}`,
      ...bucket,
      cell_degrees: PUBLIC_CIVILIAN_CELL_DEG,
      precision: 'coarse-2deg' as const,
      data_state: 'live' as const,
      observed_at: observedAt,
      age_seconds: 0,
    }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 600);
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

export function civilianFlightMapFeatures(cells: PublicCivilianFlightCell[] = []) {
  return cells.flatMap(cell => {
    if (!validCoordinate(Number(cell?.lat), Number(cell?.lng))) return [];
    const total = Number(cell.total);
    if (!Number.isFinite(total) || total < 1) return [];
    return [{
      type: 'Feature' as const,
      geometry: {
        type: 'Point' as const,
        coordinates: [Number(cell.lng), Number(cell.lat)] as [number, number],
      },
      properties: {
        total: Math.round(total),
        commercial: Math.max(0, Math.round(Number(cell.commercial) || 0)),
        private: Math.max(0, Math.round(Number(cell.private) || 0)),
        jets: Math.max(0, Math.round(Number(cell.jets) || 0)),
        cell_degrees: PUBLIC_CIVILIAN_CELL_DEG,
        precision: 'coarse-2deg',
        data_state: cell.data_state === 'cached-stale' ? 'cached-stale' : 'live',
        observed_at: typeof cell.observed_at === 'string' ? cell.observed_at : null,
        age_seconds: Math.max(0, Math.round(Number(cell.age_seconds) || 0)),
      },
    }];
  });
}
