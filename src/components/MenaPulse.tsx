'use client';

import {useMemo, useState} from 'react';
import {MapPinned, Radio, ExternalLink, Clock3, Plane, Waves, Activity, ShieldAlert} from 'lucide-react';
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

export default function MenaPulse({data,stale,publishedAt,onFocus}:{
  data:any;stale?:boolean;publishedAt?:string|null;onFocus:()=>void;
}){
  const [period,setPeriod]=useState<FusionWindow>('h24');
  const sourceTime=publishedAt??gdeltWindowTime(data.conflict_source_status?.gdelt?.window||'');
  const radar=useMemo(()=>buildMenaFusionRadar(data,sourceTime),[data,sourceTime]);
  const visible=radar.events.filter(e=>e.ageMs!==null && e.ageMs<=FUSION_WINDOWS[period]);
  const preliminary=visible.filter(e=>!e.multiplePublishers).length;
  const multiple=visible.length-preliminary;
  const air=visible.filter(e=>e.category==='aerial_attack').length;
  const clash=visible.filter(e=>COMBAT.has(e.category)).length;
  const unrest=visible.filter(e=>e.category==='civil_unrest').length;
  const acled=data.conflict_source_status?.acled;
  const src=radar.source;
  const freshness=stale?'مخزون سابق'
    :src.publicationState==='fresh'?'دفعة حديثة'
    :src.publicationState==='delayed'?'تأخر دفعة المصدر'
    :src.publicationState==='stale'?'دفعة قديمة':'لا يمكن تحديد زمن الدفعة';
  return <section dir="rtl" aria-label="M3TM Fusion Radar للشرق الأوسط"
    className="glass-panel pointer-events-auto max-h-[min(76dvh,720px)] w-full overflow-y-auto styled-scrollbar rounded-xl border border-cyan-300/25 bg-black/80 p-3 text-white shadow-2xl">
    <header className="flex items-center justify-between gap-2 border-b border-cyan-300/20 pb-2">
      <div>
        <strong className="flex items-center gap-1.5 text-sm text-cyan-100"><Radio className="h-4 w-4 text-cyan-300"/>M3TM Fusion Radar</strong>
        <p className="mt-0.5 text-[11px] text-white/65">الشرق الأوسط والبحر الأحمر · بلاغات منشورة</p>
      </div>
      <button type="button" onClick={onFocus}
        className="flex items-center gap-1 rounded-md border border-cyan-300/45 bg-cyan-300/10 p-1.5 text-xs text-cyan-100 hover:bg-cyan-300/20">
        <MapPinned className="h-3.5 w-3.5"/>الخريطة
      </button>
    </header>
    <p className="mt-2 text-[11px] leading-5 text-white/65">الرصد يقيس **توقيت ترميز/نشر البلاغ** لا يثبت وقت الواقعة أو المسؤولية؛ الإحداثيات المنشورة معمّمة.</p>
    <div className="mt-2 grid grid-cols-4 gap-1" aria-label="تصفية البلاغات بحسب الفترة">
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
    <div className="mt-2 rounded-lg border border-white/15 bg-white/[0.035] px-2.5 py-2">
      <strong className="flex items-center gap-1 text-xs text-white/90"><Activity className="h-3.5 w-3.5 text-cyan-300"/>مؤشرات الأدلة — ليست احتمالات مؤكدة</strong>
      <div className="mt-1.5 flex flex-wrap gap-1 text-[11px]">
        <span className="rounded bg-slate-400/15 px-2 py-1">ناشر واحد · {preliminary}</span>
        <span className="rounded bg-amber-300/15 px-2 py-1">عدة ناشرين · {multiple}</span>
        <span className="rounded bg-red-400/15 px-2 py-1">جوي · {air}</span>
        <span className="rounded bg-orange-400/15 px-2 py-1">نزاعات · {clash}</span>
        <span className="rounded bg-yellow-400/15 px-2 py-1">اضطرابات · {unrest}</span>
      </div>
      <p className="mt-1.5 text-[10px] leading-4 text-white/60">آخر ٦ ساعات: {radar.windows.h6} بلاغًا، مقابل {radar.previous6h} في الساعات الست السابقة. تغيّر وتيرة البلاغات ليس إثباتًا لتصاعد القتال.</p>
    </div>
    <div className="mt-2 rounded-lg border border-cyan-300/20 bg-cyan-300/[0.055] p-2">
      <strong className="flex items-center gap-1 text-xs text-cyan-100"><Clock3 className="h-3.5 w-3.5"/>سلامة وحداثة المصدر</strong>
      <p className="mt-1 text-[11px] text-white/85">GDELT: {freshness} · تاريخ الدفعة: {timestamp(sourceTime)}</p>
      <p className="text-[10px] text-white/65">زمن الدفعة: {src.publishedAgeMinutes===null?'غير معلوم':`${src.publishedAgeMinutes} دقيقة`} · سجل بلا تاريخ صالح: {radar.coverage.invalidDates} · دون رابط مباشر: {radar.coverage.missingLinks}</p>
      <p className="mt-1 text-[10px] leading-4 text-white/65">
        ACLED: {src.acledStatus==='restricted_recency'
          ? `صلاحية تاريخية فقط (حتى ${acled?.access?.latestPermittedEventDate||'تاريخ غير متاح'})`
          :src.acledStatus==='ok'?'مؤشرات تاريخية مرجعية حسب أحدث نافذة متاحة'
          :src.acledStatus==='not_configured'?'حساب المصدر غير مهيأ'
          :src.acledStatus==='unavailable'?'المصدر غير متاح الآن':'حالة المصدر قيد التحقق'}
        {' '}<a href="https://acleddata.com/" target="_blank" rel="noopener noreferrer" className="text-cyan-200 underline">ACLED</a>
      </p>
    </div>
    <div className="mt-2 rounded-lg border border-white/15 bg-white/[0.03] px-2.5 py-2">
      <strong className="flex items-center gap-1.5 text-xs text-white/90"><Plane className="h-3.5 w-3.5 text-amber-200"/>النشاط الجوي العسكري: وعي إقليمي مجمّع فقط</strong>
      <p className="mt-1 text-[11px] text-white/80">مناطق منشورة مجمّعة: {radar.airObservation.regionalCells} · ارتفاع/ظهور تجميعي: {radar.airObservation.upwardOrNew} · بيانات قديمة: {radar.airObservation.staleCells}</p>
      <p className="mt-1 text-[10px] leading-4 text-white/60">{radar.airObservation.providerHealthy===false?'مزود الطيران العسكري متعثر؛ لا تفسر الصفر بغياب الطائرات.':radar.airObservation.providerHealthy===true?'المزود يستجيب، لكن تغطية البث العسكري جزئية.':'صحة المزود غير مثبتة.'} {radar.airObservation.staleFallback?'آخر حالة محفوظة (ليست مباشرة).':''}</p>
      <p className="mt-1 flex items-center gap-1 text-[10px] text-white/55"><Waves className="h-3 w-3"/>لا يُعرض تعريف أو مسار أو موقع تشغيلي دقيق لأي طائرة عسكرية.</p>
    </div>
    <p className="mt-2 flex items-start gap-1 text-[10px] leading-4 text-white/60"><ShieldAlert className="mt-0.5 h-3.5 w-3.5 shrink-0"/>تعدد الناشرين لا يثبت استقلالهم، ولا يدل ترميز الخبر على المسؤولية. تحقق من الرابط الأصلي.</p>
    <div className="mt-1 divide-y divide-white/10">
      {visible.slice(0,16).map(e=><div key={e.id} className="py-2">
        <div className="flex items-start justify-between gap-2">
          <div className="text-xs leading-5 font-medium">{e.title}</div>
          <span className={`shrink-0 rounded border px-1.5 py-0.5 text-[10px] ${e.multiplePublishers?'border-amber-200/40 text-amber-100':'border-slate-300/40 text-slate-200'}`}>{e.multiplePublishers?'عدة ناشرين':'أولي'}</span>
        </div>
        {e.actors.length>0&&<p className="mt-1 text-[10px] text-amber-100/75">الجهات المذكورة في الخبر (دون إثبات المسؤولية): {e.actors.join(' / ')}</p>}
        <div className="mt-1 flex justify-between gap-2 text-[10px] text-white/65">
          <span>{e.source} · {timestamp(e.time)}</span>
          {/^https?:\/\//i.test(e.url)&&<a href={e.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-cyan-300 underline">المصدر<ExternalLink className="h-3 w-3"/></a>}
        </div>
      </div>)}
      {visible.length===0&&<p className="py-3 text-center text-xs text-white/65">لا توجد بلاغات مؤرخة ضمن الفترة المختارة؛ لا يعني ذلك عدم وقوع أحداث.</p>}
    </div>
  </section>;
}
