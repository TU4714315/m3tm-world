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
}
export function regionalPublicSignals(data:{
  gdelt_events?:PublicEvent[]; civil_unrest?:PublicEvent[];
  conflict_live_events?:PublicEvent[];
  military_activity?:PublicEvent[]; naval_activity?:PublicEvent[];
}) {
  const reported:Array<{id:string;title:string;source:string;url:string;time:string|null}>=[];
  const seen=new Set<string>();
  const rows=[...(data.conflict_live_events??[]),...(data.gdelt_events??[]),...(data.civil_unrest??[])];
  for(const e of rows){
    if(!isMiddleEastBelt(e.lat,e.lng))continue;
    const provider=e.provider??e.sourceLabel??'GDELT';
    const id=String(e.id||'').replace(/^gdelt-/,'');
    const key=(provider==='ACLED'?'acled:':'gdelt:')+(id||e.url||e.date||'unspecified');
    if(seen.has(key))continue;
    seen.add(key);
    reported.push({id:key,title:e.event_label_ar||e.title||'حدث مُبلّغ عنه',
      source:provider,url:e.url||'',time:e.date||e.timestamp||null});
  }
  reported.sort((a,b)=>(Date.parse(b.time||'')||0)-(Date.parse(a.time||'')||0));
  return {events:reported,reports:reported.length,
    airRegions:(data.military_activity??[]).filter(e=>isMiddleEastBelt(e.lat,e.lng)).length,
    seaRegions:(data.naval_activity??[]).filter(e=>isMiddleEastBelt(e.lat,e.lng)).length,
    precision:'regional-aggregate-only' as const};
}
