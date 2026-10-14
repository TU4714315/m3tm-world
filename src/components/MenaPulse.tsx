'use client';

import { useEffect, useMemo, useState } from 'react';
import { MapPinned, Radio } from 'lucide-react';
import { buildMenaFusionRadar, FUSION_WINDOWS, type FusionWindow } from '@/lib/menaSignals';
import { buildYemenHumanitarianSignals } from '@/lib/yemenHumanitarianSignals';

const PERIODS: ReadonlyArray<{ id: FusionWindow; label: string }> = [
  { id: 'h1', label: 'ساعة' }, { id: 'h6', label: '٦ ساعات' },
  { id: 'h24', label: '٢٤ ساعة' }, { id: 'd7', label: '٧ أيام' },
];

const REGIONAL_COUNTRIES = [
  { code: 'YE', label: 'اليمن' }, { code: 'IQ', label: 'العراق' },
  { code: 'IR', label: 'إيران' }, { code: 'OM', label: 'عُمان' },
  { code: 'SY', label: 'سوريا' }, { code: 'LB', label: 'لبنان' },
] as const;
type RegionalFocus = 'ALL' | typeof REGIONAL_COUNTRIES[number]['code'];
const HOUTHI_MENTION = /الحوثي(?:ون|ين|ة)?|أنصار\s*الله|\bhouthis?\b|\bansar\s+(?:allah|ullah)\b/i;

/** Public count-only dashboard. Detailed provenance and incident metadata remain
 * in backend APIs and source records; this component does not trigger extra
 * historical/source-coverage polling just to display explanations. */
export default function MenaPulse({ data, news, publishedAt, onFocus }: {
  data: unknown;
  news?: unknown;
  stale?: boolean;
  publishedAt?: string | null;
  onFocus: () => void;
  onLocate?: (lat: number, lng: number) => void;
}) {
  const [period, setPeriod] = useState<FusionWindow>('h24');
  const [focus, setFocus] = useState<RegionalFocus>('YE');
  // Age out expired windows locally even when the network is unavailable.
  const [nowMs, setNowMs] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNowMs(Date.now()), 60_000);
    return () => clearInterval(timer);
  }, []);
  // WORLD supplies a sanitized public projection with optional nullable fields.
  // The radar consumes only its known, aggregate attributes.
  const sourceTime = publishedAt ?? null;
  const radar = useMemo(() => buildMenaFusionRadar(
    data && typeof data === 'object' ? data as Parameters<typeof buildMenaFusionRadar>[0] : {},
    sourceTime, nowMs,
  ), [data, sourceTime, nowMs]);
  const humanitarian = useMemo(() => buildYemenHumanitarianSignals(news, nowMs), [news, nowMs]);
  const periodEvents = radar.events.filter(event =>
    event.ageMs !== null && event.ageMs <= FUSION_WINDOWS[period]);
  const events = focus === 'ALL' ? periodEvents : periodEvents.filter(event => event.country === focus);
  const aerial = events.filter(event => event.category === 'aerial_attack').length;
  const other = events.length - aerial;
  // Publisher keyword mention only, never attribution or unit-level tracking.
  const relatedMentions = events.filter(event =>
    [event.title, ...event.actors].some(value => HOUTHI_MENTION.test(value))).length;
  const sourceAge = radar.source.publishedAgeMinutes;

  return (
    <section dir="rtl" aria-label="أعداد أحداث الشرق الأوسط" className="pointer-events-auto w-full rounded-2xl border border-cyan-200/20 bg-[#03070d]/20 p-3 text-white shadow-md backdrop-blur-sm">
      <header className="flex items-center justify-between border-b border-cyan-300/20 pb-2">
        <strong className="flex items-center gap-1.5 text-sm text-cyan-100">
          <Radio className="h-4 w-4" /> مرصد اليمن والإقليم
        </strong>
        <button type="button" onClick={onFocus} className="flex items-center gap-1 rounded-md border border-cyan-300/35 bg-transparent p-1.5 text-xs text-cyan-100 hover:border-cyan-200/60 focus-visible:ring-2 focus-visible:ring-cyan-300">
          <MapPinned className="h-3.5 w-3.5" /> الخريطة
        </button>
      </header>
      <div className="mt-2 grid grid-cols-3 gap-1.5" aria-label="تصفية التقارير حسب دولة الحدث المنشور">
        {REGIONAL_COUNTRIES.map(country => (
          <button key={country.code} type="button" aria-pressed={focus === country.code}
            onClick={() => setFocus(country.code)}
            className={`rounded-lg border p-1.5 text-center text-xs focus-visible:ring-2 focus-visible:ring-cyan-300 ${focus === country.code ? 'border-amber-300/65 bg-amber-300/10 font-bold text-amber-100' : 'border-white/15 bg-transparent text-white/80 hover:border-white/35'}`}>
            <span className="block font-bold tabular-nums">{periodEvents.filter(event => event.country === country.code).length.toLocaleString('ar-SA')}</span>
            <span>{country.label}</span>
          </button>
        ))}
      </div>
      <button type="button" aria-pressed={focus === 'ALL'} onClick={() => setFocus('ALL')}
        className="mt-1.5 w-full rounded-md border border-white/20 bg-transparent px-2 py-1 text-[11px] text-white/80 hover:border-cyan-300/50">
        {focus === 'ALL' ? '✓ جميع تقارير الإقليم' : 'عرض كل تقارير الإقليم'}
      </button>
      <div className="mt-2 grid grid-cols-4 gap-1">
        {PERIODS.map(item => (
          <button key={item.id} type="button" onClick={() => setPeriod(item.id)} aria-pressed={period === item.id}
            className={`rounded-md border p-1.5 text-center ${period === item.id ? 'border-cyan-300/70 bg-transparent text-cyan-100 ring-1 ring-cyan-300/35' : 'border-white/15 bg-transparent text-white/80 hover:border-white/35'}`}>
            <span className="block text-[12px] font-bold tabular-nums">{radar.events.filter(event => event.ageMs !== null && event.ageMs <= FUSION_WINDOWS[item.id] && (focus === 'ALL' || event.country === focus)).length}</span>
            <span className="text-[10px]">{item.label}</span>
          </button>
        ))}
      </div>
      <div className="mt-2 grid grid-cols-3 gap-1.5 text-center">
        <div className="rounded-lg border border-white/10 bg-transparent p-2"><strong className="text-base text-cyan-200">{events.length.toLocaleString('ar-SA')}</strong><p className="text-[10px]">تقارير منشورة</p></div>
        <div className="rounded-lg border border-white/10 bg-transparent p-2"><strong className="text-base text-amber-200">{relatedMentions.toLocaleString('ar-SA')}</strong><p className="text-[10px]">ذِكر الحوثيين</p></div>
        <div className="rounded-lg border border-white/10 bg-transparent p-2"><strong className="text-base text-white/90">{other.toLocaleString('ar-SA')}</strong><p className="text-[10px]">تقارير غير جوية</p></div>
      </div>
      <p className="mt-2 text-[10px] leading-5 text-slate-300">
        {sourceAge !== null ? `آخر نشر مصدر معروف: قبل ${sourceAge.toLocaleString('ar-SA')} دقيقة.` : 'وقت نشر المصدر غير مؤكد.'}
        {' '}الأعداد تغطية صحفية مُرمّزة، لا حصيلة وقائع مؤكدة. ذكر الحوثيين لا يثبت المسؤولية.
        عُمان دولة مستقلة في العرض ولا تُصنّف تلقائيًا ضمن أي تحالف.
      </p>
      {focus === 'YE' && <div className="mt-3 space-y-2 border-t border-white/15 pt-2" aria-label="رصد النزوح المدني في اليمن والتقارير التاريخية عن تغير السيطرة">
        <div className="flex flex-wrap items-center justify-between gap-2 text-[11px]">
          <strong className="text-cyan-100">النزوح المدني — اليمن</strong>
          <a href="https://dtm.iom.int/yemen" target="_blank" rel="noopener noreferrer"
             className="underline underline-offset-2 text-cyan-200 hover:text-cyan-100">المصدر الرسمي IOM DTM</a>
        </div>
        <p className="text-[10px] leading-5 text-slate-300">بلاغات من الأخبار المنشورة خلال ٧ أيام، لا تعكس بالضرورة إجمالي النازحين أو المواقع الآنية لمخيماتهم.</p>
        {humanitarian.displacement.length ? (
          <ul className="max-h-32 space-y-1 overflow-y-auto text-[11px]">
            {humanitarian.displacement.map(item => <li key={item.id} className="rounded-md border border-white/10 px-2 py-1.5">
              <a href={item.url} target="_blank" rel="noopener noreferrer" className="text-slate-100 hover:text-cyan-100 underline-offset-2 hover:underline">{item.title}</a>
              <span className="block text-[10px] text-slate-400">{item.source} · {new Date(item.published).toLocaleDateString('ar-SA')} · بلاغ ناشر</span>
            </li>)}
          </ul>
        ) : <p className="text-[10px] text-slate-400">لا توجد تقارير نزوح مطابقة في التغذية الحالية؛ راجع مصدر IOM المباشر.</p>}
        <div className="rounded-lg border border-amber-300/20 bg-transparent px-2 py-1.5 text-[11px]">
          <strong className="text-amber-100">تغيّر السيطرة — أرشيف عام مؤخر</strong>
          <p className="mt-1 text-slate-300">{humanitarian.historicalControl.length.toLocaleString('ar-SA')} تقارير منشورة أقدم من ٧٢ ساعة تشير إلى تغيّر السيطرة. لا تنشئ المنصة منها خطوط تقدم أو مواقع قوات، ولا تعتبرها إثباتًا لتغيّر السيطرة.</p>
        </div>
      </div>}
    </section>
  );
}
