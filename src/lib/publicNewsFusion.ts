/** M3TM-owned public news normalization, no syndicated claim of independent confirmation. */
export type PublicNewsRow = {
  id:string; title:string; description:string; link:string; published:string;
  source:string; risk_score:number; coords:[number,number]|null;
  coords_default:boolean; language:string;feed_origin:string;
  location_basis:string;verification_status:'source-reported';
  machine_assessment:null;
  risk_basis?:string;
  publication_count?:number; publishers?:string[];
  evidence_links?:Array<{publisher:string;url:string;origin:string}>;
  evidence_label?:string;
};
const normalize = (s:string) => s.toLocaleLowerCase().normalize('NFKC')
  .replace(/[\u064B-\u065F\u0670\u0640]/g,'')
  .replace(/[^\p{L}\p{N}]+/gu,' ').trim().replace(/\s+/g,' ');
export const sourceTitleKey = (s:string) => normalize(s).slice(0,180);
export function publicUrl(url:string):string {
  try {
    const u=new URL(url);
    if(!['http:','https:'].includes(u.protocol))return '';
    if(u.username||u.password||u.hostname==='localhost'||u.hostname.endsWith('.local'))return '';
    for(const param of [...u.searchParams.keys()]){
      if(/^utm_|^(fbclid|gclid|mc_cid|mc_eid)$/i.test(param))u.searchParams.delete(param);
    }
    u.hash='';
    return u.toString();
  }catch{return '';}
}
const safeDate=(text:string)=>{
  const time=Date.parse(text);
  // A missing/invalid or future source clock must never become "now".
  return Number.isFinite(time)&&time>=Date.parse('2018-01-01')&&time<=Date.now()+5*60_000
    ?new Date(time).toISOString():'';
};
const publisherKey=(row:PublicNewsRow)=>normalize(row.source)||'unknown';
export function mergePublicNews(raw:readonly PublicNewsRow[],limit=200):PublicNewsRow[]{
  const groups:Array<{key:string;time:number;best:PublicNewsRow;
    byPublisher:Map<string,{publisher:string;url:string;origin:string}>;urls:Set<string>}>= [];
  const MAX_SCAN=650;
  for(const row of raw.slice(0,MAX_SCAN)){
    const title=row.title?.trim();
    const url=publicUrl(row.link||'');
    const published=safeDate(row.published||'');
    const key=sourceTitleKey(title||'');
    if(!title||key.length<12||!url||!published)continue;
    const observedTime=Date.parse(published);
    const normalized:PublicNewsRow={
      ...row,link:url,published,
      title:title.slice(0,240),description:String(row.description||'').slice(0,700),
      risk_score:Math.min(10,Math.max(0,Number(row.risk_score)||0)),
      // The only allowed geo precision is explicitly from the APP published
      // item; keyword mention is neither a located incident nor a map pin.
      coords:row.location_basis==='published-feed-coordinate'?row.coords:null,
      coords_default:row.location_basis!=='published-feed-coordinate',
      verification_status:'source-reported',machine_assessment:null,
    };
    const publisher=publisherKey(normalized);
    let group=groups.find(g=>
      Math.abs(observedTime-g.time)<=6*60*60_000 &&
      (g.key===key||g.urls.has(url)));
    if(!group){
      group={key,time:observedTime,best:normalized,
        byPublisher:new Map(),urls:new Set()};
      groups.push(group);
    }
    if(!group.byPublisher.has(publisher)){
      group.byPublisher.set(publisher,{publisher:normalized.source,url,origin:normalized.feed_origin});
    }
    group.urls.add(url);
    // Prefer APP's human-curated Arabic geotag, then most recent evidence.
    const prev=group.best;
    if((normalized.feed_origin==='m3tm-app'&&prev.feed_origin!=='m3tm-app')||
      (normalized.feed_origin===prev.feed_origin&&observedTime>Date.parse(prev.published)))
      group.best=normalized;
    group.time=Math.max(group.time,observedTime);
  }
  return groups.map(g=>({
    ...g.best,
    publication_count:g.byPublisher.size,
    publishers:[...g.byPublisher.values()].map(x=>x.publisher),
    evidence_links:[...g.byPublisher.values()].slice(0,8),
    evidence_label:g.byPublisher.size>1?'عدة قنوات نشر (ليس تحققًا مستقلًا)':'تقرير منشور أولي',
  })).sort((a,b)=>Date.parse(b.published)-Date.parse(a.published))
    .slice(0,Math.min(250,Math.max(1,Math.trunc(limit))));
}


/** Alerts are NOT all news: only timely, explicitly prioritized APP reporting.
 * Keyword-based fallback/social posts never create breaking-alert severity.
 */
export function selectPublicHeadlineAlerts(
  rows:readonly PublicNewsRow[],nowMs=Date.now(),limit=30,
):PublicNewsRow[]{
  return rows.filter(row=>{
    const when=Date.parse(row.published);
    return row.feed_origin==='m3tm-app'&&row.risk_basis!=='keyword-only'&&
      row.risk_score>=6&&Boolean(publicUrl(row.link))&&
      Number.isFinite(when)&&when<=nowMs+5*60_000&&nowMs-when<=3*60*60_000;
  }).sort((a,b)=>Date.parse(b.published)-Date.parse(a.published)).slice(0,limit);
}
