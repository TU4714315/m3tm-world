'use client';

import { useMemo } from 'react';
import { ExternalLink, Newspaper } from 'lucide-react';
import { priorityNews } from '@/lib/priorityNews';

const APP_NEWS = 'https://m3tm.app/news#news';

/** Read-only source-backed M3TM.APP headlines, never raw/internal feeds. */
export default function PublicNewsSheet({ news }: { news: unknown }) {
  const stories = useMemo(() => priorityNews(Array.isArray(news)
    ? news.filter(item => item && typeof item === 'object' && item.feed_origin === 'm3tm-app')
    : []), [news]);

  return (
    <section aria-label="أهم الأخبار والعاجل" className="rounded-xl border border-cyan-200/20 bg-slate-950/45 p-2 backdrop-blur-xl">
      <div className="mb-2 flex items-center justify-between gap-2 text-xs text-cyan-100">
        <strong className="flex items-center gap-1.5"><Newspaper className="h-4 w-4" /> أهم الأخبار والعاجل</strong>
        <a href={APP_NEWS} target="_blank" rel="noopener noreferrer" className="text-[10px] text-amber-100 underline underline-offset-4">كل الأخبار <ExternalLink className="inline h-3 w-3" /></a>
      </div>
      <div className="max-h-[min(38dvh,350px)] space-y-1.5 overflow-y-auto overscroll-contain pr-0.5" role="list" tabIndex={0}>
        {stories.length ? stories.map(story => (
          <a key={story.key} role="listitem" target="_blank" rel="noopener noreferrer"
            href={story.id ? `https://m3tm.app/news?story=${encodeURIComponent(story.id)}#news` : APP_NEWS}
            className="block rounded-lg border border-white/10 bg-white/[0.055] px-3 py-2.5 text-right transition-colors hover:border-cyan-200/40 hover:bg-white/[0.11] focus-visible:outline focus-visible:outline-2 focus-visible:outline-cyan-300">
            <span className="mb-1 flex flex-wrap items-center gap-2 text-[10px] text-slate-300">
              {story.breaking && <strong className="rounded border border-rose-400/40 bg-rose-500/15 px-1.5 py-0.5 text-rose-200">عاجل</strong>}
              <span>{story.source}</span>
              {story.publishedAt && <time dateTime={story.publishedAt}>{new Date(story.publishedAt).toLocaleString('ar-SA', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}</time>}
            </span>
            <span className="block text-[12px] font-semibold leading-relaxed text-slate-50">{story.title}</span>
          </a>
        )) : <p role="status" className="rounded-lg border border-white/10 px-3 py-3 text-[11px] text-slate-300">لا توجد عناوين حديثة معتمدة من M3TM.APP حاليًا.</p>}
      </div>
    </section>
  );
}
