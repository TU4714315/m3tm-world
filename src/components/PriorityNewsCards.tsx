'use client';
import { useMemo } from 'react';
import { Clock3, Globe2, MapPin, Newspaper, LockKeyhole } from 'lucide-react';
import { priorityNews } from '@/lib/priorityNews';

export function RestrictedNewsCard({ onRequestAccess }: { onRequestAccess?: () => void }) {
  return <section dir="rtl" aria-label="الأخبار الحديثة المقفلة" className="p-3">
    <div className="relative overflow-hidden rounded-xl border border-cyan-100/20 bg-[#172333]/35 p-4 shadow-[inset_0_1px_0_#ffffff12,0_8px_24px_#0002] backdrop-blur-xl">
      <div aria-hidden="true" className="select-none space-y-3 blur-[5px]">
        <div className="h-2 w-1/3 rounded bg-slate-300/15" />
        <div className="h-2.5 w-full rounded bg-slate-300/20" />
        <div className="h-2.5 w-4/5 rounded bg-slate-300/20" />
        <div className="h-2 w-1/2 rounded bg-slate-300/15" />
      </div>
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-[#0a1723]/55 px-3 text-center">
        <p className="flex items-center gap-2 text-xs font-semibold text-slate-100"><LockKeyhole aria-hidden="true" className="h-4 w-4 text-cyan-100" />الأخبار الحديثة</p>
        <button type="button" onClick={onRequestAccess} className="min-h-9 rounded-lg border border-cyan-100/30 bg-cyan-100/10 px-4 text-xs text-cyan-50 hover:bg-cyan-100/15 focus-visible:ring-2 focus-visible:ring-cyan-100">كود الدعوة</button>
      </div>
    </div>
  </section>;
}

export default function PriorityNewsCards({ items, onLocate, restricted = false, onRequestAccess }: {
  items: unknown; onLocate: (lat: number, lng: number) => void; restricted?: boolean; onRequestAccess?: () => void;
}) {
  const news = useMemo(() => restricted ? [] : priorityNews(items), [items, restricted]);
  if (restricted) return <RestrictedNewsCard onRequestAccess={onRequestAccess} />;
  return <section dir="rtl" aria-label="أهم الأخبار" className="space-y-2 p-3">
    <h3 className="mb-2 flex items-center gap-2 text-xs font-semibold text-slate-100"><Newspaper className="h-4 w-4 text-slate-300" />أهم الأخبار</h3>
    {news.map(item => <article key={item.key} className="rounded-xl border border-white/20 bg-[#172333]/35 p-3 shadow-[inset_0_1px_0_#ffffff12,0_8px_24px_#0002] backdrop-blur-xl">
      <div className="mb-2 flex items-center gap-2">
        <Newspaper aria-hidden="true" className="h-3.5 w-3.5 text-slate-300" />
        {item.breaking && <span className="rounded-md border border-red-200/25 bg-red-300/10 px-2 py-0.5 text-[10px] font-semibold text-red-100">عاجل</span>}
        {item.publishedAt && <time dateTime={item.publishedAt} className="ms-auto flex items-center gap-1 text-[9px] text-slate-300"><Clock3 className="h-3 w-3" />{new Date(item.publishedAt).toLocaleString('ar', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</time>}
      </div>
      <h4 className="text-[12px] font-medium leading-6 text-white">{item.url ? <a href={item.url} target="_blank" rel="noopener noreferrer" className="hover:text-cyan-100 focus-visible:outline-cyan-200">{item.title}</a> : item.title}</h4>
      <footer className="mt-2 flex items-center gap-1.5 border-t border-white/10 pt-2 text-[10px] text-slate-300"><Globe2 aria-hidden="true" className="h-3 w-3" /><span>{item.source}</span>
        {item.coords && <button type="button" aria-label={`عرض موقع الخبر: ${item.title}`} onClick={() => onLocate(...item.coords!)} className="ms-auto rounded-md p-1 text-slate-200 hover:bg-white/10"><MapPin className="h-3.5 w-3.5" /></button>}
      </footer>
    </article>)}
    {!news.length && <p className="py-4 text-center text-xs text-slate-400">لا توجد أخبار متاحة الآن.</p>}
  </section>;
}
