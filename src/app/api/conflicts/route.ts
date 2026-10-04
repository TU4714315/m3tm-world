import { NextResponse } from 'next/server';
import { fetchGdeltEvents, publisherCoverage, toPublicGdeltEvent } from '@/lib/gdeltEvents';
import {
  fetchAcledPublicEvents, ACLED_EVENT_WINDOW_DAYS,
  ACLED_PUBLICATION_WINDOW_DAYS, ACLED_RECENT_OCCURRENCE_DAYS,
} from '@/lib/acled';
import { gdeltWindowTime } from '@/lib/menaSignals';
import { durableCacheConfigured, durableGetJson, durableSetJson } from '@/lib/durableCache';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/**
 * OSIRIS — Public Conflict Intelligence API.
 *
 * Primary source: GDELT 2.0 Events (15-minute event exports).
 * Optional curated source: ACLED when server-side credentials are configured.
 * Coordinates exposed to the public surface are generalized to 0.25°.
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
  eventKinds?: Record<string, number>;
  dominantKind?: string;
  activityBand?: 'quiet' | 'elevated' | 'active';
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
  /** Named parties in GDELT's automated CAMEO news coding, not verified responsibility. */
  reportedActors?: string[];
  fatalities: number;
  reportingStrength: number;
  ageHours: number | null;
  ageDays: number | null;
  timePrecision: number | null;
  recencyWeight: number;
}

const CONFLICT_CACHE_KEY = 'm3tm:public:conflicts:v4';
const CONFLICT_CACHE_TTL_SECONDS = 60 * 60;

function summarizeKinds(events: ConflictEvent[]) {
  const counts: Record<string, number> = {};
  for (const event of events) counts[event.type || 'other'] = (counts[event.type || 'other'] || 0) + 1;
  return counts;
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

function eventAgeDays(dateOnly: string): number | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateOnly)) return null;
  const eventDay = Date.parse(`${dateOnly}T00:00:00Z`);
  if (!Number.isFinite(eventDay)) return null;
  const today = Date.parse(new Date().toISOString().slice(0, 10) + 'T00:00:00Z');
  return Math.max(0, Math.floor((today - eventDay) / 86400000));
}

function gdeltRecencyWeight(ageHours: number | null): number {
  if (ageHours === null) return 0.45;
  if (ageHours <= 6) return 1;
  if (ageHours <= 24) return 0.9;
  if (ageHours <= 72) return 0.65;
  if (ageHours <= 168) return 0.35;
  return 0.2;
}

function acledRecencyWeight(ageDays: number | null, timePrecision: number | null): number {
  const precisionFactor = timePrecision === 1 ? 1 : timePrecision === 2 ? 0.72 : timePrecision === 3 ? 0.5 : 0.65;
  if (ageDays === null) return 0.35 * precisionFactor;
  const ageFactor = ageDays <= 0 ? 1 : ageDays <= 1 ? 0.9 : ageDays <= 3 ? 0.7 : ageDays <= 7 ? 0.45 : 0.25;
  return Math.round(ageFactor * precisionFactor * 100) / 100;
}

function reportingStrength(providerCount: number, sources: number, articles: number): number {
  // Coverage strength only — not a truth probability.
  return Math.min(100, providerCount * 24 + Math.min(6, sources) * 8 + Math.min(14, articles) * 2);
}

function combineConflictEvents(events: ConflictEvent[]): ConflictEvent[] {
  // Do not infer that records from different providers describe the same event
  // merely because they share a generalized cell/category/day. Preserve event
  // identity unless the provider itself supplies stronger corroboration.
  const seen = new Set<string>();
  return events
    .filter(event => {
      const key = `${event.provider}:${event.id}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .sort((a, b) => Date.parse(b.timestamp) - Date.parse(a.timestamp))
    .slice(0, 1000);
}

async function fetchAllLiveConflictData(): Promise<{
  events: ConflictEvent[];
  eventsByRegion: Record<string, number>;
  gdeltWindow: string;
  gdeltScanned: number;
  acledRegionalCounts: Record<string, number>;
  acledPublishedUpdates: Record<string, number>;
  sourceStatus: Record<string, unknown>;
}> {
  const acledTimeout = new Promise<Awaited<ReturnType<typeof fetchAcledPublicEvents>>>(resolve => {
    setTimeout(() => resolve({
      status: 'unavailable',
      events: [],
      lastUpdateHours: null,
      message: 'Optional ACLED source exceeded the 18s response budget.',
    }), 18000);
  });

  const [gdeltResult, acledResult] = await Promise.all([
    fetchGdeltEvents({ quads: [4], minArticles: 2, limit: 1400, regionalPriority: 'middle-east' }),
    Promise.race([fetchAcledPublicEvents(ACLED_EVENT_WINDOW_DAYS, 1200, ACLED_PUBLICATION_WINDOW_DAYS), acledTimeout]),
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
      reportedActors: [event.reported_actor1, event.reported_actor2].filter((name): name is string => Boolean(name)),
      fatalities: 0,
      reportingStrength: reportingStrength(1, event.sources, event.articles),
      ageHours: eventAgeHours(event.date),
      ageDays: eventAgeHours(event.date) === null ? null : Math.floor((eventAgeHours(event.date) as number) / 24),
      timePrecision: null,
      recencyWeight: gdeltRecencyWeight(eventAgeHours(event.date)),
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
    ageHours: null,
    ageDays: eventAgeDays(event.eventDate),
    timePrecision: event.timePrecision,
    recencyWeight: acledRecencyWeight(eventAgeDays(event.eventDate), event.timePrecision),
  }));

  // GDELT's source-backed individual reports remain public. ACLED's EULA
  // permits transformed, attributed analysis but not redistribution of its
  // reconstructable raw event records through an unrestricted map API.
  // Compute region/week counts while keeping its IDs/positions server-only.
  const events = combineConflictEvents(gdeltEvents);
  const acledRegionalCounts: Record<string, number> = {};
  const acledPublishedUpdates: Record<string, number> = {};
  for (const zone of KNOWN_CONFLICTS) {
    const inZone = acledEvents.filter(event =>
      event.lat >= zone.bounds.minLat && event.lat <= zone.bounds.maxLat &&
      event.lng >= zone.bounds.minLng && event.lng <= zone.bounds.maxLng
    );
    // Preserve the old seven-day occurrence meaning exactly.
    acledRegionalCounts[zone.id] = inZone.filter(event =>
      event.ageDays !== null && event.ageDays >= 0 &&
      event.ageDays < ACLED_RECENT_OCCURRENCE_DAYS
    ).length;
    // Separately display ACLED weekly publication/edits, whose event
    // dates may be older. Only regional counts go to the public response.
    acledPublishedUpdates[zone.id] = inZone.length;
  }

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
    acledRegionalCounts,
    acledPublishedUpdates,
    sourceStatus: {
      gdelt: { status: 'ok', window: gdeltResult.window, scanned: gdeltResult.scanned },
      acled: {
        status: acledResult.status,
        events: acledResult.events.length,
        lastUpdateHours: acledResult.lastUpdateHours,
        diagnostics: acledResult.diagnostics ?? null,
        access: acledResult.access ?? null,
        eventWindowDays: ACLED_EVENT_WINDOW_DAYS,
        publicationWindowDays: ACLED_PUBLICATION_WINDOW_DAYS,
        recentEventDays: ACLED_RECENT_OCCURRENCE_DAYS,
        publicMode: 'derived-regional-weekly-updates-and-seven-day-occurrences',
        attribution: 'Armed Conflict Location & Event Data (ACLED), https://acleddata.com/',
        message: acledResult.message ?? null,
      },
    },
  };
}

export async function GET() {
  const previous = await durableGetJson<any>(CONFLICT_CACHE_KEY);
  const servedAt = new Date().toISOString();
  try {
    const { events: liveEvents, gdeltWindow, gdeltScanned, acledRegionalCounts, acledPublishedUpdates, sourceStatus } = await fetchAllLiveConflictData();

    const zones: ConflictZone[] = KNOWN_CONFLICTS.map(zone => {
      const zoneEvents = liveEvents.filter(event =>
        event.lat >= zone.bounds.minLat && event.lat <= zone.bounds.maxLat &&
        event.lng >= zone.bounds.minLng && event.lng <= zone.bounds.maxLng
      );
      const eventCount = zoneEvents.length;
      const eventKinds = summarizeKinds(zoneEvents);
      const dominantKind = Object.entries(eventKinds).sort((a, b) => b[1] - a[1])[0]?.[0] || 'other';

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
        eventCount,
        acledReports7d: acledRegionalCounts[zone.id] || 0,
        acledPublishedUpdates10d: acledPublishedUpdates[zone.id] || 0,
        eventKinds,
        dominantKind,
        activityBand: eventCount >= 10 ? 'active' : eventCount >= 3 ? 'elevated' : 'quiet',
        lastUpdated: servedAt,
      };
    });

    const categoryCounts = liveEvents.reduce<Record<string, number>>((acc, event) => {
      acc[event.type] = (acc[event.type] || 0) + 1;
      return acc;
    }, {});

    const payload = {
      zones,
      liveEvents: liveEvents.slice(0, 800),
      totalZones: zones.length,
      totalLiveEvents: liveEvents.length,
      activeWarzones: zones.filter(zone => zone.severity === 'war').length,
      zonesWithRecentReports: zones.filter(zone => zone.eventCount > 0).length,
      categoryCounts,
      timestamp: servedAt,
      source: 'GDELT 2.0 + optional ACLED fusion',
      sourceWindow: gdeltWindow,
      sourcePublishedAt: gdeltWindowTime(gdeltWindow),
      sourceRowsScanned: gdeltScanned,
      sourceStatus,
      sourceMode: 'multi-source-public-conflict-layer',
      coordinatePrecision: 'generalized-0.25deg',
      refreshInterval: 300,
      dataState: 'live',
      durableCacheConfigured: durableCacheConfigured(),
      cacheBackend: previous.backend,
    };

    payload.cacheBackend = await durableSetJson(CONFLICT_CACHE_KEY, payload, CONFLICT_CACHE_TTL_SECONDS);

    return NextResponse.json(payload, {
      headers: {
        'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=120',
      },
    });
  } catch (error) {
    console.error('[OSIRIS] Conflict API error:', error);

    if (previous.value) {
      return NextResponse.json({
        ...previous.value,
        // Preserve durable last-good data while correcting the old publisher
        // classification, even when upstream is down.
        liveEvents: Array.isArray(previous.value.liveEvents)
          ? previous.value.liveEvents.map((event:any) => ({
              ...event, corroboration: publisherCoverage(event.sources),
            })) : [],
        zones: Array.isArray(previous.value.zones)
          ? previous.value.zones.map((zone:any) => ({
              ...zone,
              events: Array.isArray(zone.events)
                ? zone.events.map((event:any) => ({
                    ...event, corroboration: publisherCoverage(event.sources),
                  })) : [],
            })) : [],
        dataState: 'cached-stale',
        cacheBackend: previous.backend,
        durableCacheConfigured: durableCacheConfigured(),
        servedAt,
      }, { headers: { 'Cache-Control': 'no-store, max-age=0' } });
    }

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
      lastUpdated: servedAt,
    }));

    return NextResponse.json({
      zones: fallbackZones,
      liveEvents: [],
      totalZones: fallbackZones.length,
      totalLiveEvents: 0,
      activeWarzones: fallbackZones.filter(zone => zone.severity === 'war').length,
      zonesWithRecentReports: 0,
      categoryCounts: {},
      timestamp: servedAt,
      source: 'context-only-fallback',
      sourceMode: 'no-live-events',
      coordinatePrecision: 'none',
      refreshInterval: 300,
      dataState: 'static-only',
      durableCacheConfigured: durableCacheConfigured(),
      cacheBackend: 'miss',
    }, {
      headers: { 'Cache-Control': 'no-store' },
    });
  }
}
