'use client';

import { useMemo, useState } from 'react';
import { MapPinned, Radio } from 'lucide-react';
import { buildMenaFusionRadar, gdeltWindowTime, FUSION_WINDOWS, type FusionWindow } from '@/lib/menaSignals';

const PERIODS: ReadonlyArray<{ id: FusionWindow; label: string }> = [
  { id: 'h1', label: 'ساعة' }, { id: 'h6', label: '٦ ساعات' },
  { id: 'h24', label: '٢٤ ساعة' }, { id: 'd7', label: '٧ أيام' },
];

/** Public count-only dashboard. Detailed provenance and incident metadata remain
 * in backend APIs and source records; this component does not trigger extra
 * historical/source-coverage polling just to display explanations. */
export default function MenaPulse({ data, publishedAt, onFocus }: {
  data: any;
  stale?: boolean;
  publishedAt?: string | null;
  onFocus: () => void;
  onLocate?: (lat: number, lng: number) => void;
}) {
  const [period, setPeriod] = useState<FusionWindow>('h24');
  const sourceTime = publishedAt ?? gdeltWindowTime(data?.conflict_source_status?.gdelt?.window || '');
  const radar = useMemo(() => buildMenaFusionRadar(data, sourceTime), [data, sourceTime]);
  const events = radar.events.filter(event =>
    event.ageMs !== null && event.ageMs <= FUSION_WINDOWS[period]);
  const aerial = events.filter(event => event.category === 'aerial_attack').length;
  const other = events.length - aerial;

  return (
    <section dir="rtl" aria-label="أعداد أحداث الشرق الأوسط" className="pointer-events-auto w-full rounded-2xl border border-cyan-200/20 bg-[#03070d]/70 p-3 text-white shadow-xl backdrop-blur-xl">
      <header className="flex items-center justify-between border-b border-cyan-300/20 pb-2">
        <strong className="flex items-center gap-1.5 text-sm text-cyan-100">
          <Radio className="h-4 w-4" /> مرصد الشرق الأوسط
        </strong>
        <button type="button" onClick={onFocus} className="flex items-center gap-1 rounded-md border border-cyan-300/35 p-1.5 text-xs text-cyan-100">
          <MapPinned className="h-3.5 w-3.5" /> الخريطة
        </button>
      </header>
      <div className="mt-2 grid grid-cols-4 gap-1">
        {PERIODS.map(item => (
          <button key={item.id} type="button" onClick={() => setPeriod(item.id)} aria-pressed={period === item.id}
            className={`rounded-md border p-1.5 text-center ${period === item.id ? 'border-cyan-300/70 bg-cyan-300/15 text-cyan-100' : 'border-white/15 bg-white/5 text-white/70'}`}>
            <span className="block text-[12px] font-bold tabular-nums">{radar.windows[item.id]}</span>
            <span className="text-[10px]">{item.label}</span>
          </button>
        ))}
      </div>
      <div className="mt-2 grid grid-cols-3 gap-1.5 text-center">
        <div className="rounded-lg bg-white/5 p-2"><strong className="text-base text-cyan-200">{events.length}</strong><p className="text-[10px]">الأحداث</p></div>
        <div className="rounded-lg bg-white/5 p-2"><strong className="text-base text-amber-200">{aerial}</strong><p className="text-[10px]">أحداث جوية</p></div>
        <div className="rounded-lg bg-white/5 p-2"><strong className="text-base text-white/90">{other}</strong><p className="text-[10px]">أحداث أخرى</p></div>
      </div>
    </section>
  );
}
