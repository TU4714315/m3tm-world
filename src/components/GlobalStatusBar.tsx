'use client';

import { useMemo } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { Newspaper } from 'lucide-react';
import { priorityNews } from '@/lib/priorityNews';

interface NewsTickerItem {
  id: string;
  title: string;
  published: string;
  source: string;
  risk_score: number;
  language?: string;
  link?: string;
  url?: string;
  isBreaking?: boolean;
  breaking?: boolean;
  urgency?: string;
}

const M3TM_APP_NEWS_URL = 'https://m3tm.app/news#news';

function sortImportantNews(items: NewsTickerItem[]): NewsTickerItem[] {
  const now = Date.now();
  const valid = items.filter((item) => {
    const publishedAt = Date.parse(item.published || '');
    return item.title.trim().length > 0
      && Number.isFinite(publishedAt)
      && publishedAt <= now + 10 * 60_000;
  });
  const arabic = valid.filter((item) => /[\u0600-\u06FF]/.test(item.title));
  const languagePool = arabic.length >= 3 ? arabic : valid;
  const within = (hours: number) => languagePool.filter((item) => now - Date.parse(item.published) <= hours * 3_600_000);
  const recent72h = within(72);
  const recent7d = within(24 * 7);
  // "Top news" must stay current even when an older headline has a higher
  // risk score. Only widen the window when the fresher window is completely
  // empty; never pad today's ticker with archival high-risk stories.
  const pool = recent72h.length > 0 ? recent72h : recent7d.length > 0 ? recent7d : languagePool;

  return [...pool]
    .sort((a, b) => {
      const riskDelta = Number(b.risk_score || 0) - Number(a.risk_score || 0);
      if (riskDelta !== 0) return riskDelta;
      return Date.parse(b.published) - Date.parse(a.published);
    })
    .slice(0, 10);
}

function compactPublished(value: string): string {
  const time = Date.parse(value);
  if (!Number.isFinite(time)) return '';
  const minutes = Math.max(0, Math.round((Date.now() - time) / 60_000));
  if (minutes < 1) return 'الآن';
  if (minutes < 60) return `قبل ${minutes.toLocaleString('ar-SA')} د`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `قبل ${hours.toLocaleString('ar-SA')} س`;
  const days = Math.round(hours / 24);
  return `قبل ${days.toLocaleString('ar-SA')} ي`;
}

function decodeHtmlText(value: string): string {
  const numeric = (entity: string, digits: string, radix: 10 | 16): string => {
    const point = Number.parseInt(digits, radix);
    return Number.isInteger(point) && point >= 0 && point <= 0x10ffff && !(point >= 0xd800 && point <= 0xdfff)
      ? String.fromCodePoint(point) : entity;
  };
  return value
    .replace(/&#x([0-9a-f]+);/gi, (entity, hex) => numeric(entity, hex, 16))
    .replace(/&#(\d+);/g, (entity, decimal) => numeric(entity, decimal, 10))
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'")
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>');
}

export default function GlobalStatusBar({ news = [], embed = false }: { news?: NewsTickerItem[]; embed?: boolean }) {
  // Preserve the ticker's time windows, ordering and limit. Reuse the card's
  // publisher-link and explicit-breaking rules only after selecting the rows.
  const tickerItems = useMemo(() => sortImportantNews(news).flatMap(item => {
    const presentation = priorityNews([{ ...item, title: decodeHtmlText(item.title), source: decodeHtmlText(item.source) }])[0];
    return presentation ? [{ ...item, presentation }] : [];
  }), [news]);
  const reduceMotion = useReducedMotion();

  const hasTicker = tickerItems.length > 0;

  return (
    <motion.div
      initial={reduceMotion ? false : { opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: embed ? 0 : 0.2, duration: reduceMotion ? 0 : 0.35 }}
      data-embed={embed ? "true" : "false"}
      className="world-news-ticker absolute bottom-0 left-0 right-0 z-[210] pointer-events-none"
    >
      <div className="h-[32px] overflow-hidden border border-white/15 bg-white/[0.035] shadow-[inset_0_1px_0_rgba(255,255,255,.07)] flex items-center text-[10px] backdrop-blur-xl relative">

        {/* ── NEWS ── */}
        <div className="flex-shrink-0 h-full flex items-center pointer-events-auto">
          <a
            href={M3TM_APP_NEWS_URL}
            target="_blank"
            rel="noopener noreferrer"
            aria-label="فتح أهم الأخبار في M3TM.APP"
            className="h-full px-3 flex items-center gap-1.5 text-slate-200 hover:text-cyan-100 hover:bg-white/5 border-r border-white/10 transition-colors duration-200"
          >
            <Newspaper aria-hidden="true" className="h-3.5 w-3.5 text-slate-300" />
            <span className="text-[9px] font-bold tracking-[0.12em]">أهم الأخبار</span>
          </a>
        </div>

        {/* ── CENTER: M3TM.APP Important News Ticker ── */}
        <div
          className="flex-1 overflow-hidden relative pointer-events-auto focus-visible:outline-cyan-200 motion-reduce:overflow-x-auto"
          dir="ltr"
          role="region"
          tabIndex={0}
          aria-label="أهم الأخبار من M3TM.APP"
          style={{ maskImage: 'linear-gradient(to right, transparent, black 3%, black 97%, transparent)' }}
        >
          {hasTicker ? (
            <div className="flex items-center animate-ticker whitespace-nowrap hover:[animation-play-state:paused] focus-within:[animation-play-state:paused] motion-reduce:animate-none motion-reduce:transform-none">
              {[...Array(4)].map((_, repeatIdx) => (
                <span key={repeatIdx} className={`inline-flex items-center ${repeatIdx > 0 ? 'motion-reduce:hidden' : ''}`} aria-hidden={repeatIdx === 0 ? undefined : true}>
                  {tickerItems.map((item) => (
                    <span
                      key={`${item.id}-${repeatIdx}`}
                      dir="rtl"
                      className="inline-flex items-center gap-2 mx-3 pointer-events-auto text-slate-300"
                    >
                      <Newspaper aria-hidden="true" className="h-3.5 w-3.5 shrink-0 text-slate-300" />
                      {item.presentation.breaking && <span className="rounded border border-[#FF4D4D]/30 bg-[#FF4D4D]/10 px-1.5 py-0.5 text-[9px] font-semibold text-[#FF4D4D]">عاجل</span>}
                      <span className="text-[11px] font-semibold text-slate-100">{item.presentation.title}</span>
                      {item.presentation.url ? <a href={item.presentation.url} target="_blank" rel="noopener noreferrer"
                        tabIndex={repeatIdx === 0 ? undefined : -1}
                        aria-label={repeatIdx === 0 ? `المصدر: ${item.presentation.source}` : undefined}
                        className="rounded-sm text-[10px] text-slate-300 underline decoration-white/25 underline-offset-4 hover:text-cyan-100 focus-visible:outline-cyan-200">{item.presentation.source}</a>
                        : <span className="text-[10px] text-slate-400">{item.presentation.source}</span>}
                      <span className="text-[9px] text-slate-400">{compactPublished(item.published)}</span>
                    </span>
                  ))}
                  <span className="text-white/10 mx-2">│</span>
                </span>
              ))}
            </div>
          ) : (
            <a
              href={M3TM_APP_NEWS_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="pointer-events-auto h-full flex items-center justify-center gap-2 text-white/40 hover:text-white/70"
            >
              <Newspaper aria-hidden="true" className="h-3.5 w-3.5 text-slate-300" />
              <span>لا توجد عناوين حديثة متاحة الآن — فتح أخبار M3TM.APP</span>
            </a>
          )}
        </div>

      </div>
    </motion.div>
  );
}
