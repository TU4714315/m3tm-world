export interface MilitarySpaceInput {
  lat?: unknown;
  lng?: unknown;
  alt?: unknown;
  category?: unknown;
}

export interface GeneralizedMilitarySpaceCell {
  id: string;
  lat: number;
  lng: number;
  level: 1 | 2 | 3;
  activity: 'محدود' | 'متوسط' | 'مرتفع';
  approximate_count: '3-5' | '6-11' | '12+';
  cell_degrees: 30;
  precision: 'coarse-regional';
  time_precision: '60-minute-bucket';
  observed_at_bucket: string;
  reporting_mode: 'public-tle-aggregate';
  orbit_band: 'LEO' | 'MEO' | 'GEO' | 'mixed';
}

const CELL_DEG = 30;
const MIN_GROUP = 3;
const TIME_BUCKET_MS = 60 * 60 * 1000;

function orbitBand(altKm: number): 'LEO' | 'MEO' | 'GEO' {
  if (altKm < 2_000) return 'LEO';
  if (altKm >= 30_000) return 'GEO';
  return 'MEO';
}

export function observedCountBand(count: number): '0' | '1' | '2-4' | '5-9' | '10-19' | '20-49' | '50+' {
  if (count <= 0) return '0';
  if (count === 1) return '1';
  if (count < 5) return '2-4';
  if (count < 10) return '5-9';
  if (count < 20) return '10-19';
  if (count < 50) return '20-49';
  return '50+';
}

/**
 * Aggregate publicly catalogued military/government TLE observations into
 * intentionally broad map cells. Exact object identifiers and individual
 * positions never leave this helper.
 */
export function buildGeneralizedMilitarySpaceActivity(
  rows: MilitarySpaceInput[],
  now = Date.now(),
): GeneralizedMilitarySpaceCell[] {
  const bucketTime = new Date(Math.floor(now / TIME_BUCKET_MS) * TIME_BUCKET_MS).toISOString();
  const buckets = new Map<string, {
    lat: number;
    lng: number;
    count: number;
    bands: Record<'LEO' | 'MEO' | 'GEO', number>;
  }>();

  for (const row of rows) {
    if (String(row?.category || '').toLowerCase() !== 'military') continue;
    const lat = Number(row?.lat);
    const lng = Number(row?.lng);
    const alt = Number(row?.alt);
    if (!Number.isFinite(lat) || !Number.isFinite(lng) || !Number.isFinite(alt)) continue;
    if (Math.abs(lat) > 90 || Math.abs(lng) > 180 || alt < 0) continue;

    const latIndex = Math.floor((lat + 90) / CELL_DEG);
    const lngIndex = Math.floor((lng + 180) / CELL_DEG);
    const centerLat = Math.max(-75, Math.min(75, -90 + latIndex * CELL_DEG + CELL_DEG / 2));
    const centerLng = Math.max(-165, Math.min(165, -180 + lngIndex * CELL_DEG + CELL_DEG / 2));
    const key = `${latIndex}:${lngIndex}`;

    const current = buckets.get(key) || {
      lat: centerLat,
      lng: centerLng,
      count: 0,
      bands: { LEO: 0, MEO: 0, GEO: 0 },
    };
    current.count += 1;
    current.bands[orbitBand(alt)] += 1;
    buckets.set(key, current);
  }

  return [...buckets.entries()].flatMap(([key, bucket]) => {
    if (bucket.count < MIN_GROUP) return [];

    const level: 1 | 2 | 3 = bucket.count >= 12 ? 3 : bucket.count >= 6 ? 2 : 1;
    const bandEntries = Object.entries(bucket.bands) as Array<['LEO' | 'MEO' | 'GEO', number]>;
    bandEntries.sort((a, b) => b[1] - a[1]);
    const [topBand, topCount] = bandEntries[0];
    const orbit_band: 'LEO' | 'MEO' | 'GEO' | 'mixed' =
      topCount / bucket.count >= 0.67 ? topBand : 'mixed';

    return [{
      id: `military-space-activity-${key}`,
      lat: bucket.lat,
      lng: bucket.lng,
      level,
      activity: level === 3 ? 'مرتفع' : level === 2 ? 'متوسط' : 'محدود',
      approximate_count: bucket.count >= 12 ? '12+' : bucket.count >= 6 ? '6-11' : '3-5',
      cell_degrees: CELL_DEG as 30,
      precision: 'coarse-regional',
      time_precision: '60-minute-bucket',
      observed_at_bucket: bucketTime,
      reporting_mode: 'public-tle-aggregate',
      orbit_band,
    }];
  });
}
