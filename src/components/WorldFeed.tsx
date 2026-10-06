'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Newspaper, ChevronDown, ChevronUp, ExternalLink, MapPin, Zap } from 'lucide-react';

/* ═══════════════════════════════════════════════════════════════
   M3TM.WORLD — موجز الأخبار
   تجميع أخبار منشورة مع ترتيب حسب درجة الأهمية
   ═══════════════════════════════════════════════════════════════ */

interface WorldFeedProps {
  data: any;
  onLocate?: (lat: number, lng: number) => void;
}

function getRiskClass(score: number): string {
  if (score >= 8) return 'risk-critical';
  if (score >= 6) return 'risk-high';
  if (score >= 4) return 'risk-medium';
  return 'risk-low';
}

function getRiskLabel(score: number): string {
  if (score >= 8) return 'حرج';
  if (score >= 6) return 'مرتفع';
  if (score >= 4) return 'متوسط';
  return 'منخفض';
}

function timeAgo(dateStr: string): string {
  try {
    const date = new Date(dateStr);
    const diff = Date.now() - date.getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 60) return `منذ ${mins} د`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `منذ ${hrs} س`;
    return `منذ ${Math.floor(hrs / 24)} ي`;
  } catch {
    return '';
  }
}

export default function WorldFeed({ data, onLocate }: WorldFeedProps) {
  const [expanded, setExpanded] = useState(true);
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null);
  const [language,setLanguage] = useState<'ar'|'all'>('ar');
  const news: any[] = Array.isArray(data?.news) ? data.news : [];
  const arabicNews = news.filter((item: any) => /[\u0600-\u06FF]/.test(String(item.title || '')));
  const visibleNews = language === 'ar' ? arabicNews : news;

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: 0.6, duration: 0.6 }}
      className="glass-panel flex flex-col overflow-hidden pointer-events-auto"
    >
      {/* Header */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center justify-between px-4 py-3 hover:bg-[var(--hover-accent)] transition-colors"
      >
        <div className="flex items-center gap-2">
          <Newspaper className="w-3.5 h-3.5 text-[var(--gold-primary)]" />
          <span className="hud-text text-[11px] text-[var(--text-primary)]">موجز الأخبار</span>
          <span className="gotham-tag gotham-tag--info" style={{ fontSize: '9px', padding: '1px 5px' }}>{news.length}</span>
          {news.some((n: any) => n.risk_score >= 8) && (
            <span className="gotham-tag gotham-tag--critical" style={{ fontSize: '9px', padding: '1px 4px' }}>تنبيهات</span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <div className="w-1.5 h-1.5 rounded-full bg-[var(--alert-green)] animate-m3tm-pulse" />
          {expanded ? <ChevronUp className="w-3 h-3 text-[var(--text-muted)]" /> : <ChevronDown className="w-3 h-3 text-[var(--text-muted)]" />}
        </div>
      </button>

      <div dir="rtl" className="flex items-center justify-between gap-2 px-3 pb-2 text-[11px]">
        <span className="text-[var(--text-muted)]">عربية {arabicNews.length} / كل المصادر {news.length}</span>
        <div role="group" aria-label="لغة عناوين الأخبار" className="flex gap-1">
          <button type="button" onClick={() => {setLanguage('ar');setSelectedIdx(null);}} aria-pressed={language==='ar'}
            className={`rounded border px-2 py-1 ${language==='ar'?'border-emerald-300/50 bg-emerald-400/15 text-emerald-100':'border-white/15 text-white/65'}`}>العربية</button>
          <button type="button" onClick={() => {setLanguage('all');setSelectedIdx(null);}} aria-pressed={language==='all'}
            className={`rounded border px-2 py-1 ${language==='all'?'border-emerald-300/50 bg-emerald-400/15 text-emerald-100':'border-white/15 text-white/65'}`}>جميع اللغات</button>
        </div>
      </div>
      {/* News Items */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0 }}
            animate={{ height: 'auto' }}
            exit={{ height: 0 }}
            className="overflow-hidden"
          >
            <div className="max-h-[400px] overflow-y-auto styled-scrollbar divide-y divide-[var(--border-secondary)]">
              {visibleNews.length === 0 ? (
                <div className="px-4 py-6 text-center">
                  <span className="text-[10px] font-mono text-[var(--text-muted)] tracking-widest">
                    {language==='ar' ? 'لا توجد أخبار بالعربية في العينة الحالية؛ اختر «جميع اللغات».' : 'في انتظار أخبار جديدة...'}
                  </span>
                </div>
              ) : (
                visibleNews.slice(0, 25).map((item: any, i: number) => (
                  <div
                    key={i}
                    role="button"
                    tabIndex={0}
                    className="px-4 py-2.5 hover:bg-[var(--hover-accent)] transition-colors cursor-pointer"
                    onClick={() => setSelectedIdx(selectedIdx === i ? null : i)}
                    onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') {e.preventDefault();setSelectedIdx(selectedIdx === i ? null : i);} }}
                  >
                    {/* Top row: risk badge + source + time */}
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`text-[10px] font-mono font-bold tracking-widest ${getRiskClass(item.risk_score)}`}>
                        {getRiskLabel(item.risk_score)}
                      </span>
                      <span className="text-[9px] font-mono text-[var(--text-muted)] bg-[var(--bg-tertiary)] px-1.5 py-0.5 rounded">
                        {item.source}
                      </span>
                      {item.location_basis === 'published-feed-coordinate' &&
                        Array.isArray(item.coords) &&
                        item.coords.length === 2 &&
                        Number.isFinite(item.coords[0]) &&
                        Number.isFinite(item.coords[1]) && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onLocate?.(item.coords[0], item.coords[1]);
                          }}
                          className="text-[var(--text-muted)] hover:text-[var(--cyan-primary)] transition-colors"
                        >
                          <MapPin className="w-2.5 h-2.5" />
                        </button>
                      )}
                      <span className="text-[9px] font-mono text-[var(--text-muted)] ml-auto">
                        {timeAgo(item.published)}
                      </span>
                    </div>

                    {/* Title */}
                    <h4 className="text-[10px] text-[var(--text-primary)] leading-tight line-clamp-2">
                      {item.title}
                    </h4>

                    {/* Machine Assessment (if critical) */}
                    {item.machine_assessment && (
                      <div className="mt-1.5 flex items-start gap-1.5 bg-red-950/20 border border-red-900/20 rounded px-2 py-1">
                        <Zap className="w-2.5 h-2.5 text-red-400 flex-shrink-0 mt-0.5" />
                        <span className="text-[10px] font-mono text-red-400/80 leading-relaxed">
                          {item.machine_assessment}
                        </span>
                      </div>
                    )}

                    {/* Expanded details */}
                    <AnimatePresence>
                      {selectedIdx === i && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          className="mt-2 overflow-hidden"
                        >
                          <>
                            <p className="mb-1 text-[10px] text-white/55">
                              {item.location_basis==='published-feed-coordinate' ? 'الموقع منشور ومُعمّم؛ استخدم علامة الموقع لتحديده.' : 'المصدر لم ينشر إحداثية موثقة؛ لا تُنشأ نقطة تخمينية.'}
                            </p>
                            {typeof item.link === 'string' && /^https?:\/\//i.test(item.link) && <a
                              href={item.link}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex items-center gap-1 text-[11px] font-mono text-[var(--cyan-primary)] hover:underline"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <ExternalLink className="w-2.5 h-2.5" /> قراءة المصدر الأصلي
                            </a>}
                          </>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                ))
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
