import { publicPublisherLink } from './publicPublisherLink';
import { maskSaudiPublicNewsLocation } from './publicCountryVisibility';
const clean = (v: unknown) => typeof v === 'string' ? v.replace(/<[^>]*>/g, '').replace(/&#(\d+);/g, (_, digits) => {
  const n = Number(digits); return n > 0 && n <= 0x10ffff ? String.fromCodePoint(n) : '';
}).replace(/&amp;/g, '&').replace(/&quot;/g, '"').trim().slice(0, 300) : '';
export function priorityNews(raw: unknown) {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<string>();
  return raw.slice(0, 250).flatMap(value => {
    if (!value || typeof value !== 'object') return [];
    const item = value as Record<string, unknown>, title = clean(item.title);
    if (!title) return [];
    const url = publicPublisherLink(item.link ?? item.url), key = url ?? title;
    if (seen.has(key)) return []; seen.add(key);
    const parsed = Date.parse(String(item.published ?? item.publishedAt ?? ''));
    const breaking = item.isBreaking === true || item.breaking === true || item.urgency === 'breaking'
      || /^(?:عاجل|breaking)\s*[:：!|\-–]/i.test(title);
    const masked = maskSaudiPublicNewsLocation(item);
    const coords = Array.isArray(masked.coords) && masked.coords.length === 2
      && masked.coords.every(v => typeof v === 'number' && Number.isFinite(v))
      ? masked.coords as [number, number] : null;
    const importance = typeof item.risk_score === 'number' && Number.isFinite(item.risk_score) ? Math.max(0, Math.min(10, item.risk_score)) : 0;
    return [{ key, title, source: clean(item.source) || 'ناشر الخبر', url, breaking, coords, importance,
      publishedAt: Number.isFinite(parsed) ? new Date(parsed).toISOString() : null }];
  }).sort((a, b) => Number(b.breaking) - Number(a.breaking) || b.importance - a.importance
    || Date.parse(b.publishedAt || '1970-01-01') - Date.parse(a.publishedAt || '1970-01-01')).slice(0, 8);
}
