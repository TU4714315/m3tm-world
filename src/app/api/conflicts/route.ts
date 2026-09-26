import { NextResponse } from 'next/server';
import { fetchGdeltEvents, toPublicGdeltEvent } from '@/lib/gdeltEvents';
import { fetchAcledPublicEvents } from '@/lib/acled';

export const dynamic = 'force-dynamic';

/**
 * OSIRIS — Live Conflict Zone Intelligence API
 * 
 * Aggregates real-time conflict data from:
 * 1. GDELT GEO 2.0 API — real-time geo-located conflict events
 * 2. GDELT DOC API — article-level conflict reporting with coordinates
 * 3. Known active conflict zones — enriched with live event counts
 * 
 * All sources are free, no auth required.
 */

interface ConflictZone {
  id: string;
  label: string;
  severity: 'war' | 'high' | 'elevated' | 'moderate';
  lat: number;
  lng: number;
  description: string;
  sourceUrl: string;
  region: string;
  events: ConflictEvent[];
  eventCount: number;
  lastUpdated: string;
}

interface ConflictEvent {
  id: string;
  lat: number;
  lng: number;
  title: string;
  location: string;
  url: string;
  type: string;
  eventCode: string;
  rootCode: string;
  timestamp: string;
  articles: number;
  sources: number;
  corroboration: 'single-source-report' | 'multi-source-report';
  precision: 'generalized-0.25deg';
  provider: 'GDELT' | 'ACLED' | 'GDELT+ACLED';
  providerCount: number;
  sourceLabel: string;
  fatalities: number;
  reportingStrength: number;
  ageHours: number | null;
}

// Known active conflict zones (anchors — enriched with live data)
const KNOWN_CONFLICTS = [
  { id: 'ukraine', label: 'UKRAINE WAR', severity: 'war' as const, lat: 48.5, lng: 31.2, region: 'ukraine', 
    description: 'Ongoing Russian invasion of Ukraine — active frontlines across eastern and southern regions.',
    sourceUrl: 'https://liveuamap.com/',
    queries: ['ukraine war', 'ukraine attack', 'ukraine frontline'],
    bounds: { minLat: 44, maxLat: 53, minLng: 22, maxLng: 40 } },
  { id: 'gaza', label: 'GAZA CONFLICT', severity: 'war' as const, lat: 31.35, lng: 34.35, region: 'gaza',
    description: 'Active military operations and humanitarian crisis in Gaza Strip.',
    sourceUrl: 'https://israelpalestine.liveuamap.com/',
    queries: ['gaza attack', 'gaza airstrike', 'israel hamas'],
    bounds: { minLat: 31, maxLat: 32, minLng: 34, maxLng: 34.8 } },
  { id: 'lebanon', label: 'LEBANON BORDER', severity: 'high' as const, lat: 33.377, lng: 35.483, region: 'lebanon',
    description: 'Active cross-border military operations in southern Lebanon.',
    sourceUrl: 'https://lebanon.liveuamap.com/',
    queries: ['lebanon airstrike', 'hezbollah attack', 'lebanon military'],
    bounds: { minLat: 33, maxLat: 34.5, minLng: 35, maxLng: 36.5 } },
  { id: 'sudan', label: 'SUDAN CIVIL WAR', severity: 'war' as const, lat: 15.0, lng: 30.0, region: 'sudan',
    description: 'Armed conflict between SAF and RSF factions across Sudan.',
    sourceUrl: 'https://sudan.liveuamap.com/',
    queries: ['sudan war', 'sudan conflict', 'RSF SAF'],
    bounds: { minLat: 10, maxLat: 22, minLng: 22, maxLng: 38 } },
  { id: 'myanmar', label: 'MYANMAR CONFLICT', severity: 'war' as const, lat: 19.5, lng: 96.5, region: 'myanmar',
    description: 'Internal conflict — military junta vs opposition forces.',
    sourceUrl: 'https://myanmar.liveuamap.com/',
    queries: ['myanmar conflict', 'myanmar military', 'myanmar junta'],
    bounds: { minLat: 10, maxLat: 28, minLng: 92, maxLng: 101 } },
  { id: 'yemen', label: 'YEMEN WAR', severity: 'war' as const, lat: 15.5, lng: 48.0, region: 'yemen',
    description: 'Houthi militant operations, Red Sea maritime threats, and coalition strikes.',
    sourceUrl: 'https://yemen.liveuamap.com/',
    queries: ['yemen houthi', 'red sea attack', 'yemen strike'],
    bounds: { minLat: 12, maxLat: 20, minLng: 42, maxLng: 55 } },
  { id: 'syria', label: 'SYRIA', severity: 'high' as const, lat: 35.0, lng: 38.5, region: 'syria',
    description: 'Ongoing civil conflict and localized insurgencies.',
    sourceUrl: 'https://syria.liveuamap.com/',
    queries: ['syria attack', 'syria military', 'syria conflict'],
    bounds: { minLat: 32, maxLat: 37, minLng: 35, maxLng: 42 } },
  { id: 'drc', label: 'DRC EASTERN CONFLICT', severity: 'war' as const, lat: -1.0, lng: 28.5, region: 'drc',
    description: 'M23 rebel offensive and regional instability in eastern Congo.',
    sourceUrl: 'https://drc.liveuamap.com/',
    queries: ['congo conflict', 'M23 DRC', 'congo attack'],
    bounds: { minLat: -5, maxLat: 5, minLng: 25, maxLng: 32 } },
  { id: 'red-sea', label: 'RED SEA THREAT', severity: 'high' as const, lat: 16.0, lng: 40.0, region: 'red-sea',
    description: 'Houthi anti-ship missile and drone attacks on maritime traffic.',
    sourceUrl: 'https://yemen.liveuamap.com/',
    queries: ['red sea ship attack', 'houthi missile ship'],
    bounds: { minLat: 12, maxLat: 22, minLng: 36, maxLng: 44 } },
  { id: 'taiwan-strait', label: 'TAIWAN STRAIT', severity: 'elevated' as const, lat: 24.0, lng: 119.5, region: 'taiwan',
    description: 'Elevated military drills and regional tension.',
    sourceUrl: 'https://china.liveuamap.com/',
    queries: ['taiwan strait military', 'china taiwan'],
    bounds: { minLat: 22, maxLat: 26, minLng: 117, maxLng: 122 } },
  { id: 'korean-dmz', label: 'KOREAN DMZ', severity: 'elevated' as const, lat: 38.3, lng: 127.0, region: 'korea',
    description: 'Ongoing cross-border tension and military posturing.',
    sourceUrl: 'https://liveuamap.com/',
    queries: ['north korea military', 'korean dmz'],
    bounds: { minLat: 37, maxLat: 39.5, minLng: 124, maxLng: 130 } },
  { id: 'sahel', label: 'SAHEL INSTABILITY', severity: 'high' as const, lat: 14.0, lng: 5.0, region: 'sahel',
    description: 'Insurgencies and military coups across Mali, Burkina Faso, Niger.',
    sourceUrl: 'https://africa.liveuamap.com/',
    queries: ['sahel insurgency', 'mali burkina niger conflict'],
    bounds: { minLat: 10, maxLat: 20, minLng: -5, maxLng: 15 } },
  { id: 'somalia', label: 'SOMALIA', severity: 'high' as const, lat: 5.0, lng: 46.0, region: 'somalia',
    description: 'Al-Shabaab insurgency and counter-terrorism operations.',
    sourceUrl: 'https://africa.liveuamap.com/',
    queries: ['somalia al-shabaab', 'somalia attack'],
    bounds: { minLat: -2, maxLat: 12, minLng: 40, maxLng: 52 } },
  { id: 'iraq', label: 'IRAQ INSTABILITY', severity: 'elevated' as const, lat: 33.3, lng: 44.4, region: 'iraq',
    description: 'Ongoing militia activity and counter-terrorism operations.',
    sourceUrl: 'https://iraq.liveuamap.com/',
    queries: ['iraq militia', 'iraq attack', 'iraq isis'],
    bounds: { minLat: 29, maxLat: 37.5, minLng: 38, maxLng: 49 } },
  { id: 'ethiopia', label: 'ETHIOPIA', severity: 'elevated' as const, lat: 9.0, lng: 38.7, region: 'ethiopia',
    description: 'Ethnic tensions and regional conflicts across multiple regions.',
    sourceUrl: 'https://africa.liveuamap.com/',
    queries: ['ethiopia conflict', 'tigray amhara'],
    bounds: { minLat: 3, maxLat: 15, minLng: 33, maxLng: 48 } },
];

const CONFLICT_ARABIC: Record<string, { label: string; description: string }> = {
  ukraine: { label: 'الحرب في أوكرانيا', description: 'منطقة نزاع مسلح مستمر في أوكرانيا وفق البلاغات والمصادر العامة.' },
  gaza: { label: 'نزاع غزة', description: 'منطقة نزاع وأزمة إنسانية في قطاع غزة وفق البلاغات والمصادر العامة.' },
  lebanon: { label: 'الحدود اللبنانية', description: 'بلاغات عامة عن توتر وعمليات عسكرية عبر الحدود في جنوب لبنان.' },
  sudan: { label: 'الحرب في السودان', description: 'نزاع مسلح مستمر بين أطراف سودانية وفق المصادر العامة.' },
  myanmar: { label: 'نزاع ميانمار', description: 'نزاع داخلي مستمر بين السلطة العسكرية وقوى معارضة وفق المصادر العامة.' },
  yemen: { label: 'نزاع اليمن', description: 'نزاع مستمر وبلاغات عن مخاطر إقليمية وبحرية مرتبطة باليمن.' },
  syria: { label: 'نزاع سوريا', description: 'نزاع داخلي وبلاغات أمنية متفرقة في سوريا وفق المصادر العامة.' },
  drc: { label: 'شرق الكونغو الديمقراطية', description: 'نزاع مسلح واضطراب إقليمي في شرق الكونغو الديمقراطية.' },
  'red-sea': { label: 'مخاطر البحر الأحمر', description: 'بلاغات عامة عن مخاطر واعتداءات تؤثر في الملاحة بالبحر الأحمر.' },
  'taiwan-strait': { label: 'مضيق تايوان', description: 'توتر إقليمي وتدريبات معلنة في محيط مضيق تايوان.' },
  'korean-dmz': { label: 'المنطقة المنزوعة السلاح الكورية', description: 'توتر مستمر وبلاغات عامة على الحدود بين الكوريتين.' },
  sahel: { label: 'اضطرابات الساحل', description: 'نزاعات واضطرابات أمنية وسياسية متفرقة في منطقة الساحل.' },
  somalia: { label: 'الصومال', description: 'نزاع وعمليات أمنية مستمرة في الصومال وفق المصادر العامة.' },
  iraq: { label: 'اضطرابات العراق', description: 'بلاغات عامة عن نشاط مسلح واضطرابات أمنية متفرقة في العراق.' },
  ethiopia: { label: 'إثيوبيا', description: 'توترات ونزاعات إقليمية متفرقة في إثيوبيا وفق المصادر العامة.' },
};

// GDELT updates every 15 minutes. ACLED is an optional curated second source.
// Public coordinates are generalized to 0.25° before this route exposes them.
function eventAgeHours(timestamp: string): number | null {
  const ms = Date.parse(timestamp);
  if (!Number.isFinite(ms)) return null;
  return Math.max(0, Math.round(((Date.now() - ms) / 3600000) * 10) / 10);
}

function reportingStrength(providerCount: number, sources: number, articles: number): number {
  // Coverage strength only — not a truth probability.
  return Math.min(100, providerCount * 24 + Math.min(6, sources) * 8 + Math.min(14, articles) * 2);
}

function fuseConflictEvents(events: ConflictEvent[]): ConflictEvent[] {
  const merged = new Map<string, ConflictEvent>();

  for (const event of events) {
    const day = String(event.timestamp || '').slice(0, 10);
    const key = `${event.lat.toFixed(2)}:${event.lng.toFixed(2)}:${event.type}:${day}`;
    const current = merged.get(key);
    if (!current) {
      merged.set(key, event);
      continue;
    }

    const providers = new Set(
      [current.provider, event.provider]
        .flatMap(value => String(value).split('+'))
        .filter(Boolean),
    );
    const provider = providers.size > 1 ? 'GDELT+ACLED' : current.provider;
    const sources = Math.max(current.sources, event.sources);
    const articles = Math.max(current.articles, event.articles);
    const providerCount = providers.size;
    const timestamp = Date.parse(event.timestamp) > Date.parse(current.timestamp)
      ? event.timestamp
      : current.timestamp;

    merged.set(key, {
      ...current,
      provider,
      providerCount,
      url: current.url || event.url,
      sourceLabel: [current.sourceLabel, event.sourceLabel].filter(Boolean).join(' · '),
      location: current.location.length >= event.location.length ? current.location : event.location,
      timestamp,
      articles,
      sources,
      fatalities: Math.max(current.fatalities, event.fatalities),
      corroboration: providerCount > 1 || sources >= 2 || articles >= 3
        ? 'multi-source-report'
        : 'single-source-report',
      reportingStrength: reportingStrength(providerCount, sources, articles),
      ageHours: eventAgeHours(timestamp),
    });
  }

  return [...merged.values()]
    .sort((a, b) => Date.parse(b.timestamp) - Date.parse(a.timestamp))
    .slice(0, 1000);
}

async function fetchAllLiveConflictData(): Promise<{
  events: ConflictEvent[];
  eventsByRegion: Record<string, number>;
  gdeltWindow: string;
  gdeltScanned: number;
  sourceStatus: Record<string, unknown>;
}> {
  const [gdeltResult, acledResult] = await Promise.all([
    fetchGdeltEvents({ quads: [4], minArticles: 2, limit: 1400 }),
    fetchAcledPublicEvents(7, 1200),
  ]);

  const gdeltEvents: ConflictEvent[] = gdeltResult.events
    .map(toPublicGdeltEvent)
    .filter(event => event.url && Number.isFinite(event.lat) && Number.isFinite(event.lng))
    .map(event => ({
      id: `gdelt-${event.id}`,
      lat: event.lat,
      lng: event.lng,
      title: event.event_label_ar,
      location: event.name || event.country || 'موقع منشور',
      url: event.url,
      type: event.event_category,
      eventCode: event.event_code,
      rootCode: event.root_code,
      timestamp: event.date,
      articles: event.articles,
      sources: event.sources,
      corroboration: event.corroboration,
      precision: 'generalized-0.25deg',
      provider: 'GDELT',
      providerCount: 1,
      sourceLabel: 'GDELT 2.0',
      fatalities: 0,
      reportingStrength: reportingStrength(1, event.sources, event.articles),
      ageHours: eventAgeHours(event.date),
    }));

  const acledEvents: ConflictEvent[] = acledResult.events.map(event => ({
    id: event.id,
    lat: event.lat,
    lng: event.lng,
    title: event.labelAr,
    location: event.location,
    url: 'https://acleddata.com/',
    type: event.category,
    eventCode: event.subEventType,
    rootCode: event.eventType,
    timestamp: event.eventDate ? `${event.eventDate}T00:00:00Z` : (event.sourceUpdatedAt || new Date().toISOString()),
    articles: 0,
    sources: event.sources,
    corroboration: event.sources >= 2 ? 'multi-source-report' : 'single-source-report',
    precision: 'generalized-0.25deg',
    provider: 'ACLED',
    providerCount: 1,
    sourceLabel: event.sourceLabel || 'ACLED',
    fatalities: event.fatalities,
    reportingStrength: reportingStrength(1, event.sources, 0),
    ageHours: eventAgeHours(event.eventDate ? `${event.eventDate}T00:00:00Z` : (event.sourceUpdatedAt || '')),
  }));

  const events = fuseConflictEvents([...gdeltEvents, ...acledEvents]);

  const eventsByRegion: Record<string, number> = {};
  for (const zone of KNOWN_CONFLICTS) {
    eventsByRegion[zone.id] = events.filter(event =>
      event.lat >= zone.bounds.minLat && event.lat <= zone.bounds.maxLat &&
      event.lng >= zone.bounds.minLng && event.lng <= zone.bounds.maxLng
    ).length;
  }

  return {
    events,
    eventsByRegion,
    gdeltWindow: gdeltResult.window,
    gdeltScanned: gdeltResult.scanned,
    sourceStatus: {
      gdelt: { status: 'ok', window: gdeltResult.window, scanned: gdeltResult.scanned },
      acled: {
        status: acledResult.status,
        events: acledResult.events.length,
        lastUpdateHours: acledResult.lastUpdateHours,
        message: acledResult.message ?? null,
      },
    },
  };
}

export async function GET() {
  try {
    const { events: liveEvents, eventsByRegion, gdeltWindow, gdeltScanned, sourceStatus } = await fetchAllLiveConflictData();

    const zones: ConflictZone[] = KNOWN_CONFLICTS.map(zone => {
      const zoneEvents = liveEvents.filter(event =>
        event.lat >= zone.bounds.minLat && event.lat <= zone.bounds.maxLat &&
        event.lng >= zone.bounds.minLng && event.lng <= zone.bounds.maxLng
      );

      return {
        id: zone.id,
        label: zone.label,
        labelAr: CONFLICT_ARABIC[zone.id]?.label ?? zone.label,
        severity: zone.severity,
        lat: zone.lat,
        lng: zone.lng,
        description: zone.description,
        descriptionAr: CONFLICT_ARABIC[zone.id]?.description ?? zone.description,
        sourceUrl: 'https://www.gdeltproject.org/',
        region: zone.region,
        events: zoneEvents.slice(0, 40),
        eventCount: eventsByRegion[zone.id] || 0,
        lastUpdated: new Date().toISOString(),
      };
    });

    return NextResponse.json({
      zones,
      liveEvents: liveEvents.slice(0, 800),
      totalZones: zones.length,
      totalLiveEvents: liveEvents.length,
      zonesWithRecentReports: zones.filter(zone => zone.eventCount > 0).length,
      timestamp: new Date().toISOString(),
      source: 'GDELT 2.0 + optional ACLED fusion',
      sourceWindow: gdeltWindow,
      sourceRowsScanned: gdeltScanned,
      sourceStatus,
      sourceMode: 'multi-source-public-conflict-fusion',
      coordinatePrecision: 'generalized-0.25deg',
      refreshInterval: 300,
    }, {
      headers: {
        'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600',
      },
    });
  } catch (error) {
    console.error('[OSIRIS] Conflict API error:', error);

    // Keep contextual zones visible if GDELT is temporarily unavailable, but do
    // not manufacture "live" events or synthetic coordinates.
    const fallbackZones = KNOWN_CONFLICTS.map(zone => ({
      id: zone.id,
      label: zone.label,
      labelAr: CONFLICT_ARABIC[zone.id]?.label ?? zone.label,
      severity: zone.severity,
      lat: zone.lat,
      lng: zone.lng,
      description: zone.description,
      descriptionAr: CONFLICT_ARABIC[zone.id]?.description ?? zone.description,
      sourceUrl: zone.sourceUrl,
      region: zone.region,
      events: [],
      eventCount: 0,
      lastUpdated: new Date().toISOString(),
    }));

    return NextResponse.json({
      zones: fallbackZones,
      liveEvents: [],
      totalZones: fallbackZones.length,
      totalLiveEvents: 0,
      zonesWithRecentReports: 0,
      timestamp: new Date().toISOString(),
      source: 'context-only-fallback',
      sourceMode: 'no-live-events',
      coordinatePrecision: 'none',
      refreshInterval: 300,
    }, {
      headers: { 'Cache-Control': 'no-store' },
    });
  }
}
