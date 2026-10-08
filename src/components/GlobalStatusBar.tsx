'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';

interface NewsTickerItem {
  id: string;
  title: string;
  published: string;
  source: string;
  risk_score: number;
  language?: string;
}

interface SourceHealth {
  status: 'operational' | 'degraded';
  timestamp: string;
  sources?: Record<string, {
    status?: string;
    configured?: boolean;
    authMode?: string;
    detail?: string;
  }>;
}

const M3TM_APP_NEWS_URL = 'https://m3tm.app/news#news';

/* ─── Inline SVG Icons ─── */
const DocsIcon = () => (
  <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M4 4.5A1.5 1.5 0 0 1 5.5 3H10a2 2 0 0 1 2 2 2 2 0 0 1 2-2h4.5A1.5 1.5 0 0 1 20 4.5v13a1.5 1.5 0 0 1-1.5 1.5H14a2 2 0 0 0-2 2 2 2 0 0 0-2-2H5.5A1.5 1.5 0 0 1 4 17.5z"/>
    <path d="M12 7v14"/>
  </svg>
);

const NewsIcon = () => (
  <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M4 5h16v14H4z" />
    <path d="M7 9h4M7 13h10M7 16h7M14 9h3" />
  </svg>
);

function importanceTone(score: number): string {
  if (score >= 9) return 'bg-[#FF3D57]';
  if (score >= 7) return 'bg-[#FF9500]';
  if (score >= 5) return 'bg-[#FFD54F]';
  return 'bg-[var(--cyan-primary)]';
}

function importanceLabel(score: number): string {
  if (score >= 9) return 'عاجل';
  if (score >= 7) return 'مرتفع';
  if (score >= 5) return 'مهم';
  return 'متابعة';
}

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
  const decodeNumericEntity = (entity: string, digits: string, radix: 10 | 16): string => {
    const codePoint = Number.parseInt(digits, radix);
    if (!Number.isInteger(codePoint)
      || codePoint < 0
      || codePoint > 0x10ffff
      || (codePoint >= 0xd800 && codePoint <= 0xdfff)) return entity;
    return String.fromCodePoint(codePoint);
  };
  return value
    .replace(/&#x([0-9a-f]+);/gi, (entity, hex) => decodeNumericEntity(entity, hex, 16))
    .replace(/&#(\d+);/g, (entity, dec) => decodeNumericEntity(entity, dec, 10))
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>');
}

export default function GlobalStatusBar({ news = [] }: { news?: NewsTickerItem[] }) {
  const [sourceHealth, setSourceHealth] = useState<SourceHealth | null>(null);
  const tickerItems = useMemo(() => sortImportantNews(news), [news]);

  useEffect(() => {
    let cancelled = false;

    const fetchSourceHealth = async () => {
      try {
        const res = await fetch('/api/health?deep=1', { cache: 'no-store' });
        if (!res.ok) throw new Error(`health HTTP ${res.status}`);
        const health = await res.json();
        if (!cancelled) setSourceHealth(health);
      } catch {
        if (!cancelled) {
          setSourceHealth({
            status: 'degraded',
            timestamp: new Date().toISOString(),
            sources: {},
          });
        }
      }
    };

    void fetchSourceHealth();
    const iv = window.setInterval(() => void fetchSourceHealth(), 300_000);
    return () => {
      cancelled = true;
      window.clearInterval(iv);
    };
  }, []);

  const sourceTitle = sourceHealth?.sources
    ? Object.entries(sourceHealth.sources)
        .map(([name, meta]) => `${name.toUpperCase()}: ${meta.status || 'unknown'}${meta.authMode ? ` (${meta.authMode})` : ''}`)
        .join(' · ')
    : 'جارٍ التحقق من المصادر';

  const sourceStatus = sourceHealth?.status ?? 'operational';
  const hasTicker = tickerItems.length > 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 3, duration: 0.6 }}
      className="hidden md:block absolute bottom-0 left-0 right-0 z-[210] pointer-events-none"
    >
      <div className="h-[28px] overflow-hidden bg-[#0a0a0f]/95 border-t border-white/[0.06] flex items-center text-[10px] font-mono tracking-wider backdrop-blur-xl relative">
        <div className="absolute top-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-[var(--cyan-primary)]/30 to-transparent" style={{ animation: 'hud-scanline 4s linear infinite' }} />

        {/* ── LEFT: M3TM.APP + project docs ── */}
        <div className="flex-shrink-0 h-full flex items-center pointer-events-auto">
          <a
            href={M3TM_APP_NEWS_URL}
            target="_blank"
            rel="noopener noreferrer"
            aria-label="فتح أهم الأخبار في M3TM.APP"
            className="h-full px-3 flex items-center gap-1.5 bg-[var(--cyan-primary)]/10 text-[var(--cyan-primary)] hover:bg-[var(--cyan-primary)]/20 border-r border-white/[0.04] transition-all duration-200"
          >
            <NewsIcon />
            <span className="text-[9px] font-bold tracking-[0.12em]">أهم الأخبار</span>
          </a>
          <Link href="/docs" prefetch title="الوثائق ودليل واجهات API" aria-label="الوثائق ودليل واجهات API"
            className="h-full px-3 flex items-center gap-1.5 bg-[var(--gold-primary)]/10 text-[var(--gold-primary)]/80 hover:text-[var(--gold-primary)] hover:bg-[var(--gold-primary)]/25 border-r border-white/[0.04] transition-all duration-200"
          >
            <DocsIcon />
            <span className="text-[9px] font-bold tracking-[0.15em] uppercase">الوثائق</span>
          </Link>
        </div>

        {/* ── CENTER: M3TM.APP Important News Ticker ── */}
        <div
          className="flex-1 overflow-hidden relative"
          dir="ltr"
          aria-label="أهم الأخبار من M3TM.APP"
          style={{ maskImage: 'linear-gradient(to right, transparent, black 3%, black 97%, transparent)' }}
        >
          {hasTicker ? (
            <div className="flex items-center animate-ticker whitespace-nowrap">
              {[...Array(4)].map((_, repeatIdx) => (
                <span key={repeatIdx} className="inline-flex items-center" aria-hidden={repeatIdx === 0 ? undefined : true}>
                  {tickerItems.map((item) => (
                    <a
                      key={`${item.id}-${repeatIdx}`}
                      href={M3TM_APP_NEWS_URL}
                      dir="rtl"
                      target="_blank"
                      rel="noopener noreferrer"
                      tabIndex={repeatIdx === 0 ? undefined : -1}
                      className="inline-flex items-center gap-1.5 mx-3 pointer-events-auto text-white/70 hover:text-white transition-colors"
                      aria-label={repeatIdx === 0 ? `فتح الخبر في M3TM.APP: ${decodeHtmlText(item.title)}` : undefined}
                      title={`${item.source} · ${importanceLabel(item.risk_score)}`}
                    >
                      <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${importanceTone(item.risk_score)}`} />
                      <span className="font-bold text-white/90">{decodeHtmlText(item.title)}</span>
                      <span className="text-[8px] text-[var(--gold-primary)]/80">{importanceLabel(item.risk_score)}</span>
                      <span className="text-[8px] text-white/30">{compactPublished(item.published)}</span>
                    </a>
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
              <NewsIcon />
              <span>جارٍ تحميل أهم الأخبار من M3TM.APP…</span>
            </a>
          )}
        </div>

        {/* ── RIGHT: source health ── */}
        <div className="flex-shrink-0 h-full flex items-center pointer-events-auto border-l border-white/[0.04]">
          <div className="h-full px-3 flex items-center gap-1.5" title={sourceTitle}>
            <div
              className={`w-1.5 h-1.5 rounded-full animate-pulse ${sourceStatus === 'operational' ? 'bg-[#00E676]' : 'bg-[#FF9500]'}`}
            />
            <span className={`text-[9px] tracking-[0.12em] ${sourceStatus === 'operational' ? 'text-[#00E676]/70' : 'text-[#FF9500]/80'}`}>
              {sourceHealth
                ? (sourceStatus === 'operational' ? 'المصادر سليمة' : 'مصدر متدهور')
                : 'فحص المصادر'}
            </span>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
