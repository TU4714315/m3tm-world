'use client';
import {useMemo} from 'react';
import {MapPinned,Radio,ExternalLink} from 'lucide-react';
import {gdeltWindowTime,regionalPublicSignals} from '@/lib/menaSignals';
export default function MenaPulse({data,stale,publishedAt,onFocus}:{
  data:any;stale?:boolean;publishedAt?:string|null;onFocus:()=>void;
}){
  const summary=useMemo(()=>regionalPublicSignals(data),[data]);
  const sourceTime=publishedAt??gdeltWindowTime(data.conflict_source_status?.gdelt?.window||'');
  const time=(v:string|null|undefined)=>v&&Number.isFinite(Date.parse(v))
    ?new Date(v).toLocaleString('ar-SA',{timeZone:'UTC',day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'})+' UTC':'غير معلوم';
  return <section dir="rtl" aria-label="موجز الشرق الأوسط" className="glass-panel pointer-events-auto max-h-[min(70dvh,600px)] w-full overflow-y-auto styled-scrollbar rounded-lg border border-white/10 p-3 text-white">
    <div className="flex items-center justify-between gap-2">
      <strong className="flex items-center gap-1.5 text-xs"><Radio className="h-4 w-4 text-cyan-300"/>الشرق الأوسط والبحر الأحمر</strong>
      <button type="button" onClick={onFocus} className="flex items-center gap-1 rounded border border-cyan-300/40 p-1 text-xs text-cyan-300"><MapPinned className="h-3 w-3"/>تركيز</button>
    </div>
    <p className="mt-1 text-[10px] leading-relaxed text-white/60">تقارير منشورة بمواقع معمّمة، وليست تحققًا مستقلًا أو مسارات عسكرية تشغيلية دقيقة.</p>
    <div className="mt-2 grid grid-cols-3 gap-2 text-center">
      <div className="rounded bg-white/5 p-2"><strong className="text-lg text-cyan-300">{summary.reports}</strong><p className="text-[10px]">تقارير أحداث</p></div>
      <div className="rounded bg-white/5 p-2"><strong className="text-lg text-amber-300">{summary.airRegions}</strong><p className="text-[10px]">مناطق جوية مجمّعة</p></div>
      <div className="rounded bg-white/5 p-2"><strong className="text-lg text-amber-300">{summary.seaRegions}</strong><p className="text-[10px]">مناطق بحرية مجمّعة</p></div>
    </div>
    <p className="mt-2 text-[10px] text-white/60">تاريخ دفعة المصدر: {time(sourceTime)} · {stale?'مخزون سابق':'حسب المصدر المنشور'}</p>
    <p className="mt-1 text-[10px] leading-relaxed text-white/65">
      ACLED: {data.conflict_source_status?.acled?.status==='ok'?'متصل — مؤشرات إقليمية':
        data.conflict_source_status?.acled?.status==='cached-stale'?'آخر بيانات محفوظة، تحديث المصدر غير متاح':
        data.conflict_source_status?.acled?.status==='not_configured'?'غير مهيأ — حساب myACLED مطلوب':
        data.conflict_source_status?.acled?.status==='unavailable'?'غير متاح حاليًا':'قيد الفحص'}.
      {' '}<a href="https://acleddata.com/" target="_blank" rel="noopener noreferrer" className="text-cyan-300 underline">المصدر ACLED</a>؛
      تفاصيل الأحداث أدناه مستمدة من GDELT ولا تتوقف على حساب ACLED.
    </p>
    <div className="mt-2 divide-y divide-white/10">{summary.events.slice(0,8).map(e=><div key={e.id} className="py-2">
      <div className="text-[11px]">{e.title}</div>
      {e.actors.length>0 && <div className="mt-1 text-[10px] text-amber-100/80">
        الجهات المذكورة في ترميز الخبر (دون إثبات المسؤولية): {e.actors.join(' / ')}
      </div>
      <div className="mt-1 flex justify-between gap-2 text-[10px] text-white/60">
        <span>{e.source} · {time(e.time)}</span>
        {/^https?:\/\//i.test(e.url)&&<a href={e.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-cyan-300">المصدر<ExternalLink className="h-3 w-3"/></a>}
      </div>
    </div>)}</div>
    {!summary.reports&&<p className="py-2 text-center text-xs text-white/60">لا توجد تقارير لهذه المنطقة في دفعة المصادر الحالية.</p>}
  </section>;
}
