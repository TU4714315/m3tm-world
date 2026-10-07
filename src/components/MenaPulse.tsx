'use client';

import {useEffect, useMemo, useState} from 'react';
import {MapPinned, Radio, ExternalLink, Clock3, Plane, Waves, Activity, Newspaper} from 'lucide-react';
import { locatePublishedMenaNews, locatePublishedMenaReport } from '@/lib/menaNewsLocation';
import {
  buildMenaFusionRadar, gdeltWindowTime, FUSION_WINDOWS,
  type FusionWindow,
} from '@/lib/menaSignals';

const PERIODS:{id:FusionWindow;label:string}[]=[
  {id:'h1',label:'ساعة'}, {id:'h6',label:'٦ ساعات'},
  {id:'h24',label:'٢٤ ساعة'}, {id:'d7',label:'٧ أيام'},
];
const COMBAT=new Set(['heavy_weapons','armed_clash','bombing','material_conflict','mass_violence','assault']);
const timestamp=(v:string|null|undefined)=>v&&Number.isFinite(Date.parse(v))
  ?new Date(v).toLocaleString('ar-SA',{timeZone:'UTC',day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'})+' UTC'
  :'غير معلوم';
const decodeHtmlText=(value:string)=>value
  .replace(/&#x([0-9a-f]+);/gi,(_,hex)=>String.fromCodePoint(Number.parseInt(hex,16)))
  .replace(/&#(\d+);/g,(_,dec)=>String.fromCodePoint(Number.parseInt(dec,10)))
  .replace(/&quot;/g,'"').replace(/&#39;/g,"'")
  .replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>');

export default function MenaPulse({data,stale,publishedAt,onFocus,onLocate}:{
  data:any;stale?:boolean;publishedAt?:string|null;onFocus:()=>void;
  /** Fly to a *published and already generalized* article/report map position. */
  onLocate?:(lat:number,lng:number)=>void;
}){
  const [period,setPeriod]=useState<FusionWindow>('h24');
  const [newsLanguage,setNewsLanguage]=useState<'ar'|'all'>('ar');
  const [archiveCoverage,setArchiveCoverage]=useState<{
    observedWindows:number|null;expectedWindows:number;coveragePercent:number|null;
    durable:boolean;firstSeenLagMinutes:{p50:number|null;p95:number|null};
  }|null>(null);
  const [nowMs,setNowMs]=useState(()=>Date.now());
  // A failed refresh leaves data object identity unchanged. Keep source age,
  // time-window cohorts and stale warnings moving while the desk is open.
  useEffect(()=>{
    const tick=()=>setNowMs(Date.now());
    const onVisible=()=>{if(!document.hidden)tick();};
    const id=window.setInterval(tick,60_000);
    document.addEventListener('visibilitychange',onVisible);
    return ()=>{window.clearInterval(id);document.removeEventListener('visibilitychange',onVisible);};
  },[]);
  useEffect(()=>{
    let live=true;
    const load=()=>fetch('/api/source-coverage')
      .then(r=>r.ok?r.json():null)
      .then(r=>{if(live&&r?.expectedWindows===672)setArchiveCoverage(r);})
      .catch(()=>{if(live)setArchiveCoverage(null);});
    load();
    const id=window.setInterval(load,5*60_000);
    return ()=>{live=false;window.clearInterval(id);};
  },[]);
  const sourceTime=publishedAt??gdeltWindowTime(data.conflict_source_status?.gdelt?.window||'');
  const radar=useMemo(()=>buildMenaFusionRadar(data,sourceTime,nowMs),[data,sourceTime,nowMs]);
  const visible=radar.events.filter(e=>e.ageMs!==null && e.ageMs<=FUSION_WINDOWS[period]);
  const publishedNews=radar.appNewsSignals.filter(n=>n.ageMs<=FUSION_WINDOWS[period]);
  const arabicNews=publishedNews.filter(n=>/[\u0600-\u06FF]/.test(n.title));
  const visibleNews=newsLanguage==='ar' ? arabicNews : publishedNews;
  const preliminary=visible.filter(e=>!e.multiplePublishers).length;
  const multiple=visible.length-preliminary;
  const globalAirCells = Array.isArray(data?.military_activity) ? data.military_activity.length : 0;
  const air=visible.filter(e=>e.category==='aerial_attack').length;
  const clash=visible.filter(e=>COMBAT.has(e.category)).length;
  const unrest=visible.filter(e=>e.category==='civil_unrest').length;
  const acled=data.conflict_source_status?.acled;
  const src=radar.source;
  const conflictCached=stale||data.conflict_data_state==='cached-stale';
  const conflictFreshness=conflictCached?'آخر دفعة محفوظة'
    :src.publicationState==='fresh'?'دفعة حديثة'
    :src.publicationState==='delayed'?'تأخر دفعة المصدر'
    :src.publicationState==='stale'?'دفعة قديمة':'وقت المصدر غير معلوم';
  // /api/gdelt-events and /api/conflicts are independent requests/caches.
  // A cached snapshot in one must not downgrade or freshen the other.
  const standaloneTime=typeof data.gdelt_source_published_at==='string'
    ?data.gdelt_source_published_at:null;
  const rawStandaloneAge=Date.parse(standaloneTime||'');
  const standaloneAge=Number.isFinite(rawStandaloneAge)&&rawStandaloneAge<=nowMs
    ?Math.floor((nowMs-rawStandaloneAge)/60_000):null;
  const standaloneFreshness=data.gdelt_data_state==='cached-stale'?'آخر دفعة محفوظة'
    :standaloneAge===null?'وقت المصدر غير معلوم'
    :standaloneAge<=30?'دفعة حديثة'
    :standaloneAge<=120?'تأخر دفعة المصدر':'دفعة قديمة';
  return <section dir="rtl" aria-label="مرصد M3TM للشرق الأوسط"
    className="pointer-events-auto max-h-[min(76dvh,720px)] w-full overflow-y-auto styled-scrollbar rounded-2xl border border-cyan-200/20 bg-[#03070d]/52 p-3 text-white shadow-[0_20px_70px_rgba(0,0,0,0.34)] backdrop-blur-2xl">
    <header className="flex items-center justify-between gap-2 border-b border-cyan-300/20 pb-2">
      <div>
        <strong className="flex items-center gap-1.5 text-sm text-cyan-100"><Radio className="h-4 w-4 text-cyan-300"/>مرصد M3TM</strong>
        <p className="mt-0.5 text-[11px] text-white/60">الشرق الأوسط والبحر الأحمر</p>
      </div>
      <button type="button" onClick={onFocus}
        className="flex items-center gap-1 rounded-md border border-cyan-300/45 bg-cyan-300/10 p-1.5 text-xs text-cyan-100 hover:bg-cyan-300/20">
        <MapPinned className="h-3.5 w-3.5"/>الخريطة
      </button>
    </header>
    <div className="mt-2 grid grid-cols-4 gap-1" aria-label="فرز عينة البلاغات المحمّلة بحسب زمن الترميز">
      {PERIODS.map(p=><button key={p.id} type="button" onClick={()=>setPeriod(p.id)}
        aria-pressed={period===p.id}
        className={`rounded-md border p-1.5 text-center transition-colors ${period===p.id?'border-cyan-300/70 bg-cyan-300/20 text-cyan-100':'border-white/15 bg-white/5 text-white/70 hover:bg-white/10'}`}>
        <span className="block text-[12px] font-bold tabular-nums">{radar.windows[p.id]}</span>
        <span className="text-[10px]">{p.label}</span>
      </button>)}
    </div>
    <div className="mt-2 grid grid-cols-3 gap-1.5 text-center">
      <div className="rounded-lg bg-white/5 p-2"><strong className="text-base text-cyan-200">{visible.length}</strong><p className="text-[10px] text-white/70">بلاغات الفترة</p></div>
      <div className="rounded-lg bg-white/5 p-2"><strong className="text-base text-amber-200">{radar.airRegions}</strong><p className="text-[10px] text-white/70">مناطق جوية مجمّعة</p></div>
      <div className="rounded-lg bg-white/5 p-2"><strong className="text-base text-amber-200">{radar.seaRegions}</strong><p className="text-[10px] text-white/70">مناطق بحرية مجمّعة</p></div>
    </div>
    <section aria-label="أخبار الشرق الأوسط المرتبطة بموقع منشور"
      className="mt-3 rounded-lg border border-emerald-300/30 bg-emerald-300/[0.06] p-2.5">
      <div className="flex items-center justify-between gap-2">
        <strong className="flex items-center gap-1.5 text-[12px] text-emerald-100">
          <Newspaper className="h-4 w-4" /> أخبار مرتبطة بالخريطة
        </strong>
        <div className="flex gap-1" role="group" aria-label="لغة الأخبار">
          <button type="button" onClick={()=>setNewsLanguage('ar')} aria-pressed={newsLanguage==='ar'}
            className={`rounded border px-2 py-1 text-[11px] ${newsLanguage==='ar'?'border-emerald-200 bg-emerald-300/20 text-emerald-100':'border-white/20 text-white/60'}`}>العربية</button>
          <button type="button" onClick={()=>setNewsLanguage('all')} aria-pressed={newsLanguage==='all'}
            className={`rounded border px-2 py-1 text-[11px] ${newsLanguage==='all'?'border-emerald-200 bg-emerald-300/20 text-emerald-100':'border-white/20 text-white/60'}`}>كل اللغات</button>
        </div>
      </div>
      <p className="mt-1 text-[11px] text-white/55">تحديد الموقع يستخدم الإحداثية المنشورة فقط.</p>
      <div className="mt-1.5 max-h-[195px] divide-y divide-white/10 overflow-y-auto styled-scrollbar">
        {visibleNews.slice(0,8).map(n=>{
          const location=locatePublishedMenaNews(data,n.url);
          return <div key={n.id} className="py-2">
            <p dir="auto" className="text-[12px] leading-5 font-semibold text-white/90">{decodeHtmlText(n.title)}</p>
            <div className="mt-1 flex flex-wrap items-center gap-2 text-[10px] text-white/60">
              <span>{n.source} · {timestamp(n.time)}</span>
              {location&&<button type="button" onClick={()=>onLocate?.(location.lat,location.lng)}
                className="inline-flex items-center gap-1 rounded border border-cyan-300/35 bg-cyan-300/10 px-2 py-1 text-cyan-100 hover:bg-cyan-300/20">
                <MapPinned className="h-3 w-3" /> تحديد على الخريطة
              </button>}
              <a href={n.url} rel="noopener noreferrer" target="_blank"
                className="inline-flex items-center gap-1 text-emerald-200 underline">المصدر الأصلي<ExternalLink className="h-3 w-3"/></a>
            </div>
          </div>;
        })}
        {visibleNews.length===0&&<div className="py-3 text-[11px] text-white/60">
          {newsLanguage==='ar' ? 'لا توجد أخبار عربية مسندة جغرافيًا ضمن هذه الفترة. اختر «كل اللغات» لعرض المتاح.' :
          'لا توجد أخبار مرتبطة بإحداثية منشورة ضمن هذه الفترة؛ الأخبار غير المحددة الموقع تبقى في موجز الأخبار العام.'}
        </div>}
      </div>
    </section>
    {visible.length>0&&<section aria-label="البلاغات المؤرخة ومواقعها على الخريطة"
      className="mt-2 rounded-lg border border-white/15 bg-white/[0.035] p-2.5">
      <strong className="text-[12px] text-white/90">أحدث البلاغات المرتبطة بالخريطة</strong>
      <div className="mt-1 max-h-[130px] divide-y divide-white/10 overflow-y-auto styled-scrollbar">
        {visible.slice(0,5).map(e=>{
          const location=locatePublishedMenaReport(data,e.id);
          return <div key={e.id} className="flex items-start justify-between gap-2 py-1.5">
            <div className="min-w-0">
              <p dir="auto" className="text-[11px] leading-5 text-white/85">{decodeHtmlText(e.title)}</p>
              <p className="text-[10px] text-white/50">{e.source} · {timestamp(e.time)}</p>
            </div>
            <span className="flex shrink-0 items-center gap-1">
              {location&&<button type="button" onClick={()=>onLocate?.(location.lat,location.lng)}
                className="rounded border border-cyan-300/40 px-2 py-1.5 text-[10px] text-cyan-100 hover:bg-cyan-300/15">
                الموقع <MapPinned className="inline h-3 w-3"/>
              </button>}
              {/^https?:\/\//i.test(e.url)&&<a href={e.url} target="_blank" rel="noopener noreferrer"
                className="rounded border border-white/15 px-2 py-1.5 text-[10px] text-white/70 hover:bg-white/10">المصدر</a>}
            </span>
          </div>;
        })}
      </div>
    </section>}
    {visible.length>0&&<div className="mt-2 rounded-lg border border-white/15 bg-white/[0.035] px-2.5 py-2">
      <strong className="flex items-center gap-1 text-xs text-white/90"><Activity className="h-3.5 w-3.5 text-cyan-300"/>مؤشرات الأدلة — ليست احتمالات مؤكدة</strong>
      <div className="mt-1.5 flex flex-wrap gap-1 text-[11px]">
        <span className="rounded bg-slate-400/15 px-2 py-1">ناشر واحد · {preliminary}</span>
        <span className="rounded bg-amber-300/15 px-2 py-1">عدة ناشرين · {multiple}</span>
        <span className="rounded bg-red-400/15 px-2 py-1">جوي · {air}</span>
        <span className="rounded bg-orange-400/15 px-2 py-1">نزاعات · {clash}</span>
        <span className="rounded bg-yellow-400/15 px-2 py-1">اضطرابات · {unrest}</span>
      </div>
    </div>}
    <details className="mt-2 rounded-lg border border-cyan-300/15 bg-cyan-300/[0.035] p-2 text-white/75">
      <summary className="cursor-pointer select-none text-[11px] font-semibold text-cyan-100">تفاصيل المصادر</summary>
      <div className="pt-1">
      <strong className="flex items-center gap-1 text-xs text-cyan-100"><Clock3 className="h-3.5 w-3.5"/>حداثة البيانات</strong>
      <p className="mt-1 text-[11px] leading-5 text-white/85">GDELT النزاعات: {conflictFreshness} · {timestamp(sourceTime)}</p>
      <p className="text-[11px] leading-5 text-white/85">GDELT الأحداث والاضطرابات: {standaloneFreshness} · {timestamp(standaloneTime)}</p>
      <p className="text-[10px] text-white/65">زمن دفعة النزاعات: {src.publishedAgeMinutes===null?'غير معلوم':`${src.publishedAgeMinutes} دقيقة`} · زمن دفعة الأحداث: {standaloneAge===null?'غير معلوم':`${standaloneAge} دقيقة`}</p>
      <p className="text-[10px] text-white/65">بلاغ بلا تاريخ صالح: {radar.coverage.invalidDates} · دون رابط مباشر: {radar.coverage.missingLinks}</p>
      <div className="mt-1.5 rounded-md border border-white/10 bg-black/25 p-2 text-[10px] leading-5 text-white/80" aria-label="سجل جودة استقبال ملفات GDELT">
        <strong className="text-cyan-100">تغطية استقبال ملفات GDELT خلال ٧ أيام</strong>
        {archiveCoverage?.durable
          ? <><p>نوافذ موثقة: {archiveCoverage.observedWindows} / {archiveCoverage.expectedWindows} ({archiveCoverage.coveragePercent}%)</p>
             <p>تأخر أول وصول للخادم P95: {archiveCoverage.firstSeenLagMinutes.p95 ?? '—'} دقيقة</p></>
          : <p className="text-amber-100/80">تعذّر قياس تغطية الأسبوع: التخزين المشترك Redis/KV غير مهيأ أو متعثر؛ لا يعني ذلك انقطاع الأخبار.</p>}
        <p className="text-amber-100/75">القياس يخص استقبال ملفات النشر، وليس أرشيف حوادث كاملًا أو زمن عرض البلاغ للمستخدم.</p>
      </div>
      <p className="mt-1 text-[10px] leading-4 text-white/65">
        ACLED: {src.acledStatus==='restricted_recency'
          ? `صلاحية تاريخية فقط (حتى ${acled?.access?.latestPermittedEventDate||'تاريخ غير متاح'})`
          :src.acledStatus==='ok'?'مؤشرات تاريخية مرجعية حسب أحدث نافذة متاحة'
          :src.acledStatus==='cached-stale'?'البيانات السابقة محفوظة؛ تعذّر تحديث ACLED'
          :src.acledStatus==='not_configured'?'حساب المصدر غير مهيأ'
          :src.acledStatus==='unavailable'?'المصدر غير متاح الآن':'حالة المصدر قيد التحقق'}
        {' '}<a href="https://acleddata.com/" target="_blank" rel="noopener noreferrer" className="text-cyan-200 underline">ACLED</a>
      </p>
      </div>
    </details>
    <div className="mt-2 rounded-lg border border-white/15 bg-white/[0.03] px-2.5 py-2">
      <strong className="flex items-center gap-1.5 text-xs text-white/90"><Plane className="h-3.5 w-3.5 text-amber-200"/>النشاط الجوي العسكري المجمّع</strong>
      <p className="mt-1 text-[11px] text-white/80">المنطقة: {radar.airObservation.regionalCells} · عالميًا: {globalAirCells}</p>
      {radar.airObservation.regionalCells === 0 && globalAirCells > 0 &&
       radar.airObservation.providerHealthy === true &&
       radar.airObservation.staleFallback === false &&
        <p className="mt-1 rounded border border-amber-300/25 bg-amber-300/10 px-2 py-1 text-[10px] leading-4 text-amber-100">
          المزوّد يستقبل نشاطًا عالميًا، لكن الدفعة الحالية لا تحتوي خلايا ضمن نطاق الشرق الأوسط المحدد؛ العدد صفر هنا ليس عطلًا عالميًا ولا دليلًا على انعدام النشاط.
        </p>}
      <p className="mt-1 text-[10px] leading-4 text-white/55">{radar.airObservation.staleFallback?'آخر لقطة محفوظة · ':''}تغطية البث العسكري جزئية.</p>
      {radar.airObservation.staleFallback && globalAirCells > 0 &&
        <p className="mt-1 text-[10px] leading-4 text-amber-100/70">خلايا عالمية من لقطة محفوظة قديمة؛ لا تُعد رصدًا مباشرًا حاليًا.</p>}
      <p className="mt-1 flex items-center gap-1 text-[10px] text-white/45"><Waves className="h-3 w-3"/>عرض إقليمي تقريبي بلا مسارات أو معرفات فردية.</p>
    </div>
  </section>;
}
