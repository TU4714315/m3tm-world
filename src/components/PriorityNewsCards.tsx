'use client';
import { useMemo } from 'react';
import { Clock3, Globe2, MapPin, Newspaper } from 'lucide-react';
import { priorityNews } from '@/lib/priorityNews';

export default function PriorityNewsCards({ items, onLocate }: { items: unknown; onLocate: (lat: number, lng: number) => void }) {
  const news = useMemo(() => priorityNews(items), [items]);
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
