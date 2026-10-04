export interface MilitarySatelliteRow {
  lat: number;
  lng: number;
  alt?: number | null;
  mission?: string | null;
  category?: string | null;
}

export const PUBLIC_MILITARY_SATELLITE_CELL_DEG = 20;
export const PUBLIC_MILITARY_SATELLITE_MIN_GROUP = 3;
export const PUBLIC_MILITARY_SATELLITE_TIME_BUCKET_MS = 60 * 60 * 1000;

type Counter = Record<string, number>;

function increment(counter: Counter, key: string) {
  counter[key] = (counter[key] || 0) + 1;
}

function altitudeBand(altKm: number | null): string {
  if (altKm === null) return 'unknown';
  if (altKm < 2000) return 'LEO';
  if (altKm < 30000) return 'MEO';
  if (altKm < 45000) return 'GEO-like';
  return 'HEO/deep';
}

function missionFamily(mission: string): string {
  const value = mission.toLowerCase();
  if (/recon|sar|imaging/.test(value)) return 'reconnaissance';
  if (/early warning/.test(value)) return 'early-warning';
  if (/communication|sigint/.test(value)) return 'communications-intelligence';
  if (/military/.test(value)) return 'military-other';
  return 'other';
}

function approximateCount(count: number): string {
  if (count >= 10) return '10+';
  if (count >= 6) return '6-9';
  return '3-5';
}

function activityLevel(count: number): number {
  if (count >= 10) return 3;
  if (count >= 6) return 2;
  return 1;
}

export function buildPublicMilitarySatelliteActivity(
  satellites: MilitarySatelliteRow[],
  nowMs = Date.now(),
) {
  const observedAtBucket = new Date(
    Math.floor(nowMs / PUBLIC_MILITARY_SATELLITE_TIME_BUCKET_MS) * PUBLIC_MILITARY_SATELLITE_TIME_BUCKET_MS,
  ).toISOString();

  const military = satellites.filter((satellite) => satellite?.category === 'military');
  const buckets = new Map<string, {
    latIndex: number;
    lngIndex: number;
    count: number;
    altitudeTotal: number;
    altitudeSamples: number;
  }>();
  const missionCounts: Counter = {};
  const altitudeBandCounts: Counter = {};

  for (const satellite of military) {
    const lat = Number(satellite?.lat);
    const lng = Number(satellite?.lng);
    if (!Number.isFinite(lat) || !Number.isFinite(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) continue;

    const latIndex = Math.min(
      Math.floor(180 / PUBLIC_MILITARY_SATELLITE_CELL_DEG) - 1,
      Math.max(0, Math.floor((lat + 90) / PUBLIC_MILITARY_SATELLITE_CELL_DEG)),
    );
    const lngIndex = Math.min(
      Math.floor(360 / PUBLIC_MILITARY_SATELLITE_CELL_DEG) - 1,
      Math.max(0, Math.floor((lng + 180) / PUBLIC_MILITARY_SATELLITE_CELL_DEG)),
    );
    const key = `${latIndex}:${lngIndex}`;
    const current = buckets.get(key) || { latIndex, lngIndex, count: 0, altitudeTotal: 0, altitudeSamples: 0 };
    current.count += 1;

    const alt = Number(satellite?.alt);
    if (Number.isFinite(alt)) {
      current.altitudeTotal += alt;
      current.altitudeSamples += 1;
    }
    buckets.set(key, current);

    increment(missionCounts, missionFamily(String(satellite?.mission || 'other')));
    increment(altitudeBandCounts, altitudeBand(Number.isFinite(alt) ? alt : null));
  }

  const activity = Array.from(buckets.values())
    .filter((bucket) => bucket.count >= PUBLIC_MILITARY_SATELLITE_MIN_GROUP)
    .map((bucket) => ({
      lat: -90 + (bucket.latIndex + 0.5) * PUBLIC_MILITARY_SATELLITE_CELL_DEG,
      lng: -180 + (bucket.lngIndex + 0.5) * PUBLIC_MILITARY_SATELLITE_CELL_DEG,
      level: activityLevel(bucket.count),
      activity: bucket.count >= 10 ? 'high' : bucket.count >= 6 ? 'medium' : 'limited',
      approximate_count: approximateCount(bucket.count),
      average_altitude_band: altitudeBand(
        bucket.altitudeSamples ? bucket.altitudeTotal / bucket.altitudeSamples : null,
      ),
      cell_degrees: PUBLIC_MILITARY_SATELLITE_CELL_DEG,
      observed_at_bucket: observedAtBucket,
      reporting_mode: 'coarse-public-tle-propagation',
    }))
    .sort((a, b) => b.level - a.level || a.lat - b.lat || a.lng - b.lng);

  const representedObjects = Array.from(buckets.values())
    .filter((bucket) => bucket.count >= PUBLIC_MILITARY_SATELLITE_MIN_GROUP)
    .reduce((sum, bucket) => sum + bucket.count, 0);

  return {
    activity,
    summary: {
      catalog_objects: military.length,
      represented_objects: representedObjects,
      withheld_sparse_objects: Math.max(0, military.length - representedObjects),
      mission_family_counts: missionCounts,
      altitude_band_counts: altitudeBandCounts,
    },
    meta: {
      mode: 'coarse-orbital-aggregate',
      source_mode: 'public-tle-propagation',
      cell_degrees: PUBLIC_MILITARY_SATELLITE_CELL_DEG,
      minimum_group: PUBLIC_MILITARY_SATELLITE_MIN_GROUP,
      time_precision: '1-hour-bucket',
      identifiers_exposed: false,
      names_exposed: false,
      exact_tracks_exposed: false,
      propagated_estimate: true,
      observation_model: 'public-tle-propagation',
      absence_semantics: 'not-represented-does-not-mean-absent',
      observed_at_bucket: observedAtBucket,
    },
  };
}
