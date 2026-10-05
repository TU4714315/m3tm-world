/** Public evidence fusion over an expanded Middle East and Red Sea belt. */
export const isMiddleEastBelt = (lat: unknown, lng: unknown): boolean =>
  typeof lat === 'number' && typeof lng === 'number' &&
  Number.isFinite(lat) && Number.isFinite(lng) &&
  lat >= 8 && lat <= 43 && lng >= 20 && lng <= 65;
export function gdeltWindowTime(name: string): string | null {
  const p=/^(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})\.export\.CSV\.zip$/.exec(name);
  if(!p)return null;
  const d=new Date(Date.UTC(+p[1],+p[2]-1,+p[3],+p[4],+p[5],+p[6]));
  return Number.isFinite(d.valueOf())&&d.getUTCFullYear()===+p[1]&&
    d.getUTCMonth()+1===+p[2]&&d.getUTCDate()===+p[3]&&
    d.getUTCHours()===+p[4]&&d.getUTCMinutes()===+p[5]?d.toISOString():null;
}
interface PublicEvent{
  id?:string;lat?:number;lng?:number;date?:string;timestamp?:string;
  title?:string;event_label_ar?:string;provider?:string;sourceLabel?:string;url?:string;
  reported_actor1?:string;reported_actor2?:string;reportedActors?:string[];
  corroboration?: 'single-source-report'|'multi-source-report';
  event_category?:string;type?:string;sources?:number;
}
export function regionalPublicSignals(data:{
  gdelt_events?:PublicEvent[]; civil_unrest?:PublicEvent[];
  conflict_live_events?:PublicEvent[];
  military_activity?:PublicEvent[]; naval_activity?:PublicEvent[];
}) {
  const reported:Array<{id:string;title:string;source:string;url:string;time:string|null;actors:string[];
    category:string;multiplePublishers:boolean;}>=[];
  const seen=new Set<string>();
  const rows=[...(data.conflict_live_events??[]),...(data.gdelt_events??[]),...(data.civil_unrest??[])];
  for(const e of rows){
    if(!isMiddleEastBelt(e.lat,e.lng))continue;
    const provider=e.provider??e.sourceLabel??'GDELT';
    const id=String(e.id||'').replace(/^gdelt-/,'');
    const key=(provider==='ACLED'?'acled:':'gdelt:')+(id||e.url||e.date||'unspecified');
    if(seen.has(key))continue;
    seen.add(key);
    const actors=[...(e.reportedActors??[]),e.reported_actor1,e.reported_actor2]
      .filter((name):name is string=>typeof name==='string'&&Boolean(name.trim())).slice(0,2);
    reported.push({id:key,title:e.event_label_ar||e.title||'حدث مُبلّغ عنه',
      source:provider,url:e.url||'',time:e.date||e.timestamp||null,actors,
      category:e.event_category||e.type||'other',
      multiplePublishers:e.corroboration==='multi-source-report' && (e.sources === undefined || e.sources>=2)});
  }
  reported.sort((a,b)=>(Date.parse(b.time||'')||0)-(Date.parse(a.time||'')||0));
  return {events:reported,reports:reported.length,
    airRegions:(data.military_activity??[]).filter(e=>isMiddleEastBelt(e.lat,e.lng)).length,
    seaRegions:(data.naval_activity??[]).filter(e=>isMiddleEastBelt(e.lat,e.lng)).length,
    precision:'regional-aggregate-only' as const};
}


/**
 * M3TM Fusion Radar — authored independently for M3TM.WORLD.
 *
 * Time windows describe a source report's coded/published timestamp, NOT
 * independently established incident time. No risk-probabilities are inferred.
 * Public military/sea cells are counted only at MENA belt scope: never fuse
 * their positions with conflict locations or expose unit-level identifiers.
 */
export type FusionWindow = 'h1' | 'h6' | 'h24' | 'd7';
export const FUSION_WINDOWS: Readonly<Record<FusionWindow,number>> = {
  h1: 60 * 60_000,
  h6: 6 * 60 * 60_000,
  h24: 24 * 60 * 60_000,
  d7: 7 * 24 * 60 * 60_000,
};
type RegionalData = Parameters<typeof regionalPublicSignals>[0];
type MilitarySummaryCell = PublicEvent & {
  trend?: string;
  data_state?: string;
  cell_degrees?: number;
};
type RadarData = Omit<RegionalData, 'military_activity'> & {
  military_activity?: MilitarySummaryCell[];
  military_activity_meta?: { mode?: string | null; provider_healthy?: boolean; stale_fallback?: boolean };
  conflict_source_status?: { gdelt?: { status?: string }; acled?: { status?: string } };
};

function reportedTimeAge(time: string | null, now: number): number | null {
  if (!time) return null;
  const epoch = Date.parse(time);
  // Reject synthetic/new dates, missing and future records; never count
  // undated evidence as a fresh incident.
  return Number.isFinite(epoch) && epoch <= now && now - epoch <= 365 * 24 * 60 * 60_000
    ? now - epoch : null;
}

export function buildMenaFusionRadar(
  data: RadarData,
  sourcePublishedAt: string | null = null,
  nowMs = Date.now(),
) {
  const summary = regionalPublicSignals(data);
  const events = summary.events.map(event => ({
    ...event,
    ageMs: reportedTimeAge(event.time, nowMs),
  }));
  const windows: Record<FusionWindow,number> = { h1: 0, h6: 0, h24: 0, d7: 0 };
  let previous6h = 0, invalidDates = 0, missingLinks = 0;
  for (const event of events) {
    if (event.ageMs === null) invalidDates++;
    else {
      for (const name of Object.keys(FUSION_WINDOWS) as FusionWindow[]) {
        if (event.ageMs <= FUSION_WINDOWS[name]) windows[name]++;
      }
      if (event.ageMs > FUSION_WINDOWS.h6 && event.ageMs <= FUSION_WINDOWS.h6 * 2) previous6h++;
    }
    if (!/^https?:\/\//i.test(event.url)) missingLinks++;
  }
  const publishedAge = reportedTimeAge(sourcePublishedAt, nowMs);
  const publicationState = publishedAge === null ? 'unknown'
    : publishedAge <= 30 * 60_000 ? 'fresh'
    : publishedAge <= 120 * 60_000 ? 'delayed' : 'stale';
  const airCells = (data.military_activity || []).filter(
    cell => isMiddleEastBelt(cell.lat,cell.lng),
  );
  // publicLayerData sanitizes absent metadata to {provider_healthy:false},
  // so false is meaningful only with an actual provider observation mode.
  const providerHealthy = data.military_activity_meta?.mode === 'coarse-regional-aggregate'
    ? data.military_activity_meta.provider_healthy : null;
  const staleCells = airCells.filter(cell=>cell.data_state==='cached-stale').length;
  return {
    ...summary,
    events,
    windows,
    previous6h,
    coverage: {
      multiplePublishers: events.filter(e=>e.multiplePublishers).length,
      singlePublisher: events.filter(e=>!e.multiplePublishers).length,
      invalidDates,
      missingLinks,
    },
    source: {
      publicationState,
      publishedAgeMinutes: publishedAge === null ? null : Math.floor(publishedAge / 60_000),
      gdeltStatus: data.conflict_source_status?.gdelt?.status ?? 'unknown',
      acledStatus: data.conflict_source_status?.acled?.status ?? 'unknown',
    },
    airObservation: {
      regionalCells: airCells.length,
      upwardOrNew: airCells.filter(cell=>cell.trend==='up'||cell.trend==='new').length,
      staleCells,
      providerHealthy: providerHealthy === true ? true : providerHealthy === false ? false : null,
      staleFallback: data.military_activity_meta?.stale_fallback === true,
      mode: 'aggregate-only' as const,
    },
  };
}
