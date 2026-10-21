import { NextResponse } from 'next/server';
import { inSaudiPublicBoundary, maskSaudiPublicIndicators } from '@/lib/publicCountryVisibility';
import { isPublicFireRegion } from '@/lib/publicFireRegion';
import { createPublicDailySnapshot } from '@/lib/publicDailySnapshot';
import { durableGetJson, durableSetJson } from '@/lib/durableCache';

export const dynamic = 'force-dynamic';

/** A public, source-attributed FIRMS observation snapshot, not a live incident claim. */
const getFireSnapshot = createPublicDailySnapshot<{ fires: any[]; total: number; source: string; timestamp: string }>(
  24 * 60 * 60_000, 5 * 60_000, snapshot => Date.parse(snapshot.timestamp));

async function loadFireObservations() {
  let fires: any[] = [];
  let source = '';
  let providerSucceeded = false;
  const firmsSources = [
    'https://firms.modaps.eosdis.nasa.gov/data/active_fire/noaa-20-viirs-c2/csv/J1_VIIRS_C2_Global_24h.csv',
    'https://firms.modaps.eosdis.nasa.gov/data/active_fire/modis-c6.1/csv/MODIS_C6_1_Global_24h.csv',
  ];
  for (const url of firmsSources) {
    try {
      const res = await fetch(url, {
        signal: AbortSignal.timeout(15000),
        headers: { 'User-Agent': 'M3TM-WORLD/1.0 (+https://m3tm.world)' },
      });
      if (!res.ok) continue;
      const text = await res.text();
      if (text && text.includes('latitude') && text.includes('longitude') && text.length > 200) {
        fires = parseCSV(text);
        source = url.includes('J1_VIIRS') ? 'NASA-FIRMS (VIIRS NOAA-20)' : 'NASA-FIRMS (MODIS)';
        providerSucceeded = true;
        break;
      }
    } catch { /* fall through to the next public source */ }
  }
  if (!providerSucceeded) throw new Error('fire_provider_unavailable');
  return maskSaudiPublicIndicators({
    fires, total: fires.length, source, timestamp: new Date().toISOString(),
  });
}

// Shared across WORLD servers when Redis/Valkey is available, with local fallback.
// Preserve real FIRMS acquisition metadata and existing public geofilters.
const FIRE_PUBLIC_CACHE_KEY = 'm3tm:world:public:firms-observations:v1';
const FIRE_PUBLIC_TTL_SECONDS = 24 * 60 * 60;
async function loadSharedFireObservations() {
  const shared = await durableGetJson<Awaited<ReturnType<typeof loadFireObservations>>>(FIRE_PUBLIC_CACHE_KEY);
  const previous = shared.value;
  if (previous && Array.isArray(previous.fires) && typeof previous.source === 'string'
    && typeof previous.timestamp === 'string') {
    const time = Date.parse(previous.timestamp);
    if (Number.isFinite(time) && time <= Date.now()
      && Date.now() - time < FIRE_PUBLIC_TTL_SECONDS * 1000) return previous;
  }
  const fresh = await loadFireObservations();
  await durableSetJson(FIRE_PUBLIC_CACHE_KEY, fresh, FIRE_PUBLIC_TTL_SECONDS);
  return fresh;
}

export async function GET() {
  try {
    const snapshot = await getFireSnapshot(loadSharedFireObservations);
    return NextResponse.json({
      ...snapshot.value,
      observation_snapshot_at: snapshot.value.timestamp,
      data_state: snapshot.retained ? 'retained-observations' : 'published-observations',
    }, { headers: {
      'Cache-Control': snapshot.retained ? 'no-store' : 'public, s-maxage=86400, stale-while-revalidate=300',
    } });
  } catch (error) {
    console.error('Fire snapshot retrieval error:', error);
    return NextResponse.json({ fires: [], error: 'fire_provider_unavailable' }, { status: 503, headers: { 'Cache-Control': 'no-store' } });
  }
}
export function parseCSV(csv: string): any[] {
  const lines = csv.trim().split('\n');
  if (lines.length < 2) return [];

  const header = lines[0].split(',');
  const latIdx = header.indexOf('latitude');
  const lngIdx = header.indexOf('longitude');
  const brightIdx = header.indexOf('bright_ti4') !== -1 ? header.indexOf('bright_ti4') : header.indexOf('brightness');
  const confIdx = header.indexOf('confidence');
  const dateIdx = header.indexOf('acq_date');
  const timeIdx = header.indexOf('acq_time');
  const frpIdx = header.indexOf('frp');

  const fires: any[] = [];
  // Filter to the owner's geographic scope BEFORE limiting output.
  const maxPoints = 2000;

  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(',');
    const lat = parseFloat(cols[latIdx]);
    const lng = parseFloat(cols[lngIdx]);
    if (isNaN(lat) || isNaN(lng) || !isPublicFireRegion(lat, lng) || inSaudiPublicBoundary(lat, lng)) continue;

    fires.push({
      lat: Math.round(lat * 1000) / 1000,
      lng: Math.round(lng * 1000) / 1000,
      brightness: parseFloat(cols[brightIdx]) || 0,
      confidence: cols[confIdx] || 'unknown',
      date: cols[dateIdx] || '',
      time: cols[timeIdx] || '',
      frp: parseFloat(cols[frpIdx]) || 0,
      type: 'fire'
    });
    if (fires.length >= maxPoints) break;
  }

  return fires;
}

