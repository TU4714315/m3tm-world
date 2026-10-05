/**
 * M3TM Conflict Evolution: public news-report sample, NOT conflict front lines,
 * territorial control, troop movement or incident occurrence timing.
 */
import type { GdeltArchiveReport, GdeltHistoryView } from './gdeltPublicHistory';
export type ConflictFocus = 'mena'|'yemen'|'saudi-gulf'|'iraq-iran'|'levant';
export type ConflictKind = 'all'|'violence'|'unrest'|'diplomatic';
export type ConflictBand = Exclude<ConflictKind,'all'>;
export type GeoCell = {lat:number;lng:number;count:number;band:ConflictBand};
export const CONFLICT_FOCUS: Readonly<Record<ConflictFocus,{label:string;bounds:readonly[number,number,number,number]}>> = {
  mena:{label:'الشرق الأوسط والبحر الأحمر',bounds:[20,8,65,43]},
  yemen:{label:'اليمن والبحر الأحمر',bounds:[38,10,55,22]},
  'saudi-gulf':{label:'السعودية والخليج',bounds:[34,16,59,33]},
  'iraq-iran':{label:'العراق وإيران',bounds:[38,23,65,41]},
  levant:{label:'بلاد الشام',bounds:[33,29,44,39]},
};
// Bounding boxes are viewing frames, not geopolitical actor designations.
const VIOLENCE = new Set(['aerial_attack','heavy_weapons','bombing','armed_clash','mass_violence','assault','material_conflict']);
export function evidenceBand(category:string):ConflictBand|null {
  if(VIOLENCE.has(category))return 'violence';
  if(category==='civil_unrest')return 'unrest';
  if(category==='verbal_report')return 'diplomatic';
  return null;
}
const CELL=3;
export const CELL_SIZE_DEGREES=CELL;
export type ConflictFrame = {
  time:string;recordedReports:number;sampledReports:number;
  cells:GeoCell[];sampleRows:GdeltArchiveReport[];notRepresentative:boolean;
};
export function buildConflictEvolutionFrames(
  archive:GdeltHistoryView,focus:ConflictFocus='mena',kind:ConflictKind='all'
):ConflictFrame[] {
  const bounds=CONFLICT_FOCUS[focus].bounds;
  const times=archive.timeline.map(x=>Date.parse(x.publishedAt));
  const step=times.length>1?times[1]-times[0]:15*60_000;
  if(!Number.isFinite(step)||step<=0||!times.length||!Number.isFinite(times[0]))return [];
  const buckets=archive.timeline.map(x=>({
    time:x.publishedAt,recordedReports:x.reports,rows:[] as GdeltArchiveReport[],
  }));
  const seen=new Set<number>();
  for(const row of archive.events){
    if(!Number.isSafeInteger(row.id)||seen.has(row.id)||
       !Number.isFinite(row.lat)||!Number.isFinite(row.lng)||
       row.lng<bounds[0]||row.lat<bounds[1]||row.lng>bounds[2]||row.lat>bounds[3])continue;
    const band=evidenceBand(row.category);
    if(!band||(kind!=='all'&&kind!==band))continue;
    const at=Date.parse(row.publishedAt);
    if(!Number.isFinite(at))continue;
    const ix=Math.floor((at-times[0])/step);
    if(ix<0||ix>=buckets.length)continue;
    seen.add(row.id);
    buckets[ix].rows.push(row);
  }
  return buckets.map(bucket=>{
    const grouped=new Map<string,{lat:number;lng:number;count:number;bands:Record<ConflictBand,number>}>();
    for(const row of bucket.rows){
      const lat=8+Math.floor((row.lat-8)/CELL)*CELL+CELL/2;
      const lng=20+Math.floor((row.lng-20)/CELL)*CELL+CELL/2;
      const key=lat+':'+lng;
      const group=grouped.get(key)||{lat,lng,count:0,bands:{violence:0,unrest:0,diplomatic:0}};
      group.count++;
      group.bands[evidenceBand(row.category)!]++;
      grouped.set(key,group);
    }
    const cells=[...grouped.values()].map(group=>({
      lat:group.lat,lng:group.lng,count:group.count,
      band:(Object.entries(group.bands) as Array<[ConflictBand,number]>)
        .sort((a,b)=>b[1]-a[1]||a[0].localeCompare(b[0]))[0][0],
    })).sort((a,b)=>b.count-a.count);
    return {
      time:bucket.time,recordedReports:bucket.recordedReports,
      sampledReports:bucket.rows.length,cells,sampleRows:bucket.rows,
      notRepresentative:archive.totalReportRows>archive.events.length ||
        focus!=='mena'||kind!=='all',
    };
  });
}
export function conflictGridGeoJson(cells:readonly GeoCell[]) {
  return {
    type:'FeatureCollection' as const,
    features:cells.map((c,i)=>({
      type:'Feature' as const,id:i,
      geometry:{type:'Point' as const,coordinates:[c.lng,c.lat]},
      properties:{count:c.count,band:c.band,precision:'3-degree-observed-report-sample'},
    })),
  };
}
