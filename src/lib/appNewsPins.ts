/**
 * Source-backed public news markers from M3TM.APP.
 *
 * Only the APP's published, geo-tagged Arabic items are mapped. The independent
 * RSS/Telegram fallback may provide a news list, but keyword-inferred country
 * centroids are not incident locations and must never become map markers.
 * All returned markers are generalized to a half-degree regional grid.
 */
export interface AppNewsPin {
  id: string;
  title: string;
  source: string;
  url: string;
  published: string;
  lat: number;
  lng: number;
  precision: 'regional-0.5deg';
  provenance: 'M3TM.APP public feed';
  status: 'source-reported';
  publisherCount: number;
  evidenceLabel: string;
  evidenceLinks: Array<{publisher:string;url:string}>;
}

const regional = (coord: number) => Math.round(coord * 2) / 2;

export function buildAppNewsPins(value: unknown): AppNewsPin[] {
  if (!Array.isArray(value)) return [];
  const result: AppNewsPin[] = [];
  const seen = new Set<string>();
  for (const row of value) {
    if (!row || typeof row !== 'object') continue;
    const item = row as Record<string, unknown>;
    if (item.feed_origin !== 'm3tm-app' || item.location_basis !== 'published-feed-coordinate') continue;
    const coords = item.coords;
    if (!Array.isArray(coords) || coords.length !== 2) continue;
    // Nulls and empty strings are not numbers (Number(null) === 0).
    if (coords.some(v => (typeof v !== 'number' && typeof v !== 'string') || String(v).trim() === '')) continue;
    const lat = Number(coords[0]);
    const lng = Number(coords[1]);
    if (!Number.isFinite(lat) || Math.abs(lat) > 90 || !Number.isFinite(lng) || Math.abs(lng) > 180) continue;
    const title = typeof item.title === 'string' ? item.title.trim() : '';
    if (!title) continue;
    const id = typeof item.id === 'string' && item.id.trim() ? item.id : `${item.link || ''}:${item.published || ''}`;
    if (!id || seen.has(id)) continue;
    const candidate = typeof item.link === 'string' ? item.link : '';
    let url = '';
    try {
      const resolved = new URL(candidate);
      if (['http:','https:'].includes(resolved.protocol) && !resolved.username && !resolved.password
        && !/^(localhost|127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/i.test(resolved.hostname)) url = resolved.href;
    } catch { /* link unavailable */ }
    const evidenceLinks:Array<{publisher:string;url:string}> = [];
    const dedup=new Set<string>();
    for (const raw of (Array.isArray(item.evidence_links) ? item.evidence_links : []).slice(0,8)) {
      if (!raw || typeof raw !== 'object') continue;
      const evidence=raw as Record<string,unknown>;
      const publishedUrl=typeof evidence.url==='string'?evidence.url:'';
      try {
        const link=new URL(publishedUrl);
        const src=typeof evidence.publisher==='string'?evidence.publisher.slice(0,90):'منشور';
        if (!['http:','https:'].includes(link.protocol)||link.username||link.password||
          /^(localhost|127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/i.test(link.hostname)||
          dedup.has(src.toLowerCase())) continue;
        dedup.add(src.toLowerCase());
        evidenceLinks.push({publisher:src,url:link.href});
      } catch { /* not a valid publisher link */ }
    }
    if (!evidenceLinks.length && url) evidenceLinks.push({
      publisher:typeof item.source==='string'?item.source.slice(0,90):'الناشر',url,
    });
    // Multiple publication venues are NOT independent incident verification.
    const publisherCount=Math.max(1,evidenceLinks.length);
    result.push({
      id, title, url,
      source: typeof item.source === 'string' && item.source.trim() ? item.source : 'M3TM.APP',
      published: typeof item.published === 'string' ? item.published : '',
      lat: regional(lat), lng: regional(lng),
      precision: 'regional-0.5deg', provenance: 'M3TM.APP public feed', status: 'source-reported',
      publisherCount,
      evidenceLabel: publisherCount>1 ? 'عدة ناشرين؛ غير مؤكد مستقلاً' : 'بلاغ ناشر واحد',
      evidenceLinks,
    });
    seen.add(id);
    if (result.length === 160) break;
  }
  return result;
}
