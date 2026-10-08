/** Source-coded GDELT Middle East / Red Sea archive.
 * This is public published news evidence, not field-confirmed events or
 * operational military telemetry. No secrets are required in WORLD.
 */
const SOURCE = 'https://heibzaolhwlzqaweludm.supabase.co/functions/v1/world-gdelt-archive';
const ALLOWED_HOURS = new Set([1, 6, 24, 168]);
const CATEGORIES = new Set([
  'aerial_attack', 'heavy_weapons', 'bombing', 'armed_clash',
  'mass_violence', 'assault', 'civil_unrest', 'material_conflict', 'verbal_report',
]);
const safeCount = (x: unknown) => Number.isFinite(Number(x)) && Number(x) >= 0
  ? Math.min(1_000_000, Math.floor(Number(x))) : 0;
const isUrl = (x: unknown) => typeof x === 'string' && /^https?:\/\//i.test(x);
const safeText = (x: unknown, max = 180) => typeof x === 'string'
  ? x.replace(/[\x00-\x1f<>]/g, ' ').trim().slice(0, max) : '';
const publishedTime = (s: unknown) => {
  if (typeof s !== 'string' || !/^20\d{12}\.export\.CSV\.zip$/.test(s)) return null;
  const d = s.slice(0,14);
  const date = new Date(Date.UTC(
    Number(d.slice(0,4)),Number(d.slice(4,6))-1,Number(d.slice(6,8)),
    Number(d.slice(8,10)),Number(d.slice(10,12)),Number(d.slice(12,14))
  ));
  return Number.isFinite(date.getTime()) && date.toISOString().replace(/[-:T.Z]/g,'').slice(0,14) === d
    ? date.toISOString() : null;
};
export type GdeltCategory = {
  category: string; reports: number;
};
export type GdeltTimelineBucket = {
  publishedAt: string; reports: number;
};
export type GdeltArchiveReport = {
  id: number;
  publishedAt: string;
  reportTime: string | null;
  eventDate: string | null;
  lat: number; lng: number;
  category: string;
  country: string;
  place: string;
  url: string;
  articles: number;
  publishers: number;
  publisherCoverage: 'single-source-report' | 'multi-source-report';
};
export type GdeltHistoryView = {
  data_state: 'historical-sample';
  source: 'GDELT 2.0 Events';
  region: 'middle-east-red-sea';
  lookbackHours: number;
  reportLimit: number;
  totalReportRows: number;
  distinctEventIds: number;
  singlePublisher: number;
  multiplePublishers: number;
  categories: GdeltCategory[];
  countries: Array<{country: string; reports: number}>;
  timeline: GdeltTimelineBucket[];
  events: GdeltArchiveReport[];
  guidance: string;
};

export function normalizeGdeltHistory(raw: unknown, requestedHours: number, limit: number): GdeltHistoryView {
  if (!raw || typeof raw !== 'object') throw new Error('Invalid history payload');
  const record = raw as Record<string, any>;
  if (record.source !== 'GDELT 2.0 Events' ||
      record.precision !== 'generalized-0.25deg' ||
      record.sampling !== 'stored-source-reports' ||
      record.region !== 'middle-east-red-sea' ||
      !record.analytics ||
      record.analytics.lookbackHours !== requestedHours) {
    throw new Error('History source provenance mismatch');
  }
  const analytics = record.analytics as Record<string, unknown>;
  const categories = (Array.isArray(analytics.categories) ? analytics.categories : [])
    .filter((r): r is Record<string,unknown> => !!r && typeof r === 'object')
    .filter(r => typeof r.category === 'string' && CATEGORIES.has(r.category))
    .map(r => ({category: String(r.category), reports: safeCount(r.reports)}))
    .sort((a,b) => b.reports - a.reports || a.category.localeCompare(b.category))
    .slice(0, 9);
  // The SQL source aggregates only nonempty buckets. Build a complete
  // evenly spaced display timeline so hours/days with zero *stored* coded
  // reports do not visually collapse into adjacent high-volume bars.
  // Zero means no recorded reports in the archive, not no real events.
  const minuteStep = ({1:15,6:30,24:60,168:180} as Record<number,number>)[requestedHours];
  const step = minuteStep * 60000;
  const anchor = Date.parse(String(analytics.asOf || ''));
  const sourceBins = (Array.isArray(analytics.timeline) ? analytics.timeline : [])
    .filter((r): r is Record<string,unknown> => !!r && typeof r === 'object')
    .filter(r => typeof r.publishedAt === 'string' && Number.isFinite(Date.parse(r.publishedAt)));
  const anchoredAt = Number.isFinite(anchor) ? anchor :
    Math.max(...sourceBins.map(r => Date.parse(String(r.publishedAt))), 0);
  const latest = Math.floor(anchoredAt / step) * step;
  const values = new Map<number,number>();
  for (const r of sourceBins) {
    const time = Math.floor(Date.parse(String(r.publishedAt)) / step) * step;
    values.set(time,(values.get(time)||0)+safeCount(r.reports));
  }
  const slots = Math.min(70, Math.ceil(requestedHours * 60 / minuteStep));
  const timeline = Array.from({length:slots},(_,i)=>{
    const time = latest - (slots - i - 1) * step;
    return {publishedAt:new Date(time).toISOString(),reports:values.get(time)||0};
  });
  const countries = (Array.isArray(analytics.countries) ? analytics.countries : [])
    .filter((r): r is Record<string,unknown> => !!r && typeof r === 'object')
    .slice(0,12)
    .map(r => ({country:safeText(r.country,6),reports:safeCount(r.reports)}));
  const events: GdeltArchiveReport[] = [];
  const seen = new Set<number>();
  for (const r of (Array.isArray(record.events) ? record.events : []).slice(0,limit)) {
    if (!r || typeof r !== 'object') continue;
    const id = Number(r.event_id), lat = Number(r.latitude), lng = Number(r.longitude);
    const publishedAt = publishedTime(r.window_name);
    if (!Number.isSafeInteger(id) || id<=0 || seen.has(id) ||
        !Number.isFinite(lat) || !Number.isFinite(lng) ||
        lat<8 || lat>43 || lng<20 || lng>65 || !publishedAt ||
        !CATEGORIES.has(r.event_category)) continue;
    seen.add(id);
    const publishers = safeCount(r.source_count);
    const reportTime = typeof r.report_time === 'string' &&
      Number.isFinite(Date.parse(r.report_time)) ? r.report_time : null;
    events.push({
      id,publishedAt,reportTime,
      eventDate: typeof r.event_date === 'string' &&
        /^\d{4}-\d{2}-\d{2}$/.test(r.event_date) ? r.event_date : null,
      // Coarsen again at the WORLD boundary in case a provider regresses.
      lat:Math.round(lat*4)/4,lng:Math.round(lng*4)/4,
      category:r.event_category,
      place:safeText(r.place,180),country:safeText(r.country,6),
      url:isUrl(r.source_url)?safeText(r.source_url,700):'',
      articles:safeCount(r.article_count),publishers,
      publisherCoverage:publishers>=2?'multi-source-report':'single-source-report',
    });
  }
  return {
    data_state:'historical-sample',
    source:'GDELT 2.0 Events',
    region:'middle-east-red-sea',
    lookbackHours:requestedHours,reportLimit:limit,
    totalReportRows:safeCount(analytics.totalReportRows),
    distinctEventIds:safeCount(analytics.distinctEventIds),
    singlePublisher:safeCount(analytics.singlePublisher),
    multiplePublishers:safeCount(analytics.multiplePublishers),
    categories,countries,timeline,events,
    guidance:'Published and automatically coded news reports. Publisher multiplicity does not prove independent confirmation. Source event locations are regional, not exact military or operational coordinates.',
  };
}

export async function fetchGdeltPublishedHistory(hours = 24, limit = 80): Promise<GdeltHistoryView> {
  const boundedHours = ALLOWED_HOURS.has(hours) ? hours : 24;
  const boundedLimit = Math.min(200,Math.max(10,Math.trunc(limit)));
  const url = new URL(SOURCE);
  url.searchParams.set('mode','events');
  url.searchParams.set('hours',String(boundedHours));
  url.searchParams.set('limit',String(boundedLimit));
  const response = await fetch(url, {next:{revalidate:90},signal:AbortSignal.timeout(6000)});
  if (!response.ok) throw new Error('GDELT public history currently unavailable: HTTP '+response.status);
  return normalizeGdeltHistory(await response.json(),boundedHours,boundedLimit);
}
