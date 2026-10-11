
import { NextResponse } from 'next/server';
import { isPublicFireRegion } from '@/lib/publicFireRegion';

export const dynamic = 'force-dynamic';

/**
 * M3TM.WORLD — Active Fire & Wildfire Tracking
 * Fire hotspots only: regional NASA FIRMS data. Volcanoes excluded by owner.
 */

export async function GET() {
  try {
    let fires: any[] = [];
    let source = '';
    let providerSucceeded = false;

    // Source 1: NASA FIRMS Open Data (Global 24h CSV) - no API key needed
    const firmsSources = [
      'https://firms.modaps.eosdis.nasa.gov/data/active_fire/noaa-20-viirs-c2/csv/J1_VIIRS_C2_Global_24h.csv',
      'https://firms.modaps.eosdis.nasa.gov/data/active_fire/modis-c6.1/csv/MODIS_C6_1_Global_24h.csv'
    ];

    for (const url of firmsSources) {
      try {
        const res = await fetch(url, {
          signal: AbortSignal.timeout(15000),
          headers: { 'User-Agent': 'M3TM-WORLD/1.0 (+https://m3tm.world)' },
        });
        if (res.ok) {
          const text = await res.text();
          // Valid provider data can contain zero regional fires.
          if (text && text.includes('latitude') && text.includes('longitude') && text.length > 200) {
            fires = parseCSV(text);
            source = url.includes('J1_VIIRS') ? 'NASA-FIRMS (VIIRS NOAA-20)' : 'NASA-FIRMS (MODIS)';
            providerSucceeded = true;
            break;
          }
        }
      } catch { continue; }
    }

    // No volcano/earthquake lookups: those categories are disabled.
    if (!providerSucceeded) return NextResponse.json({ fires: [], error: 'fire_provider_unavailable' }, { status: 503, headers: { 'Cache-Control': 'no-store' } });

    return NextResponse.json({
      fires,
      total: fires.length,
      source: source || 'Unknown',
      timestamp: new Date().toISOString(),
    }, {
      headers: {
        'Cache-Control': 'public, s-maxage=600, stale-while-revalidate=1200',
      },
    });
  } catch (error) {
    console.error('Fire fetch error:', error);
    return NextResponse.json({ fires: [], error: 'Failed to fetch fire data' }, { status: 500 });
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
    if (isNaN(lat) || isNaN(lng) || !isPublicFireRegion(lat, lng)) continue;

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

