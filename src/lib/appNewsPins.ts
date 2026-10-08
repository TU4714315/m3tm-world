import { publicPublisherLink } from './publicPublisherLink';

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
  language: string;
  evidenceLinks?: Array<{publisher:string;url:string}>;
  publicationCount?: number;
}

const regional = (coord: number) => Math.round(coord * 2) / 2;
function publicEvidenceLink(value: unknown): string {
  return publicPublisherLink(value) ?? '';
}

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
    const url = publicEvidenceLink(item.link);
    const evidenceLinks: Array<{publisher:string;url:string}> = [];
    const seenPublishers = new Set<string>();
    for (const evidence of Array.isArray(item.evidence_links) ? item.evidence_links.slice(0,8) : []) {
      if (!evidence || typeof evidence !== 'object') continue;
      const row = evidence as Record<string,unknown>;
      const href = publicEvidenceLink(row.url);
      const publisher = typeof row.publisher === 'string' ? row.publisher.trim().slice(0,90) : '';
      if (!href || !publisher || seenPublishers.has(new URL(href).hostname)) continue;
      seenPublishers.add(new URL(href).hostname);
      evidenceLinks.push({publisher,url:href});
    }
    if (!evidenceLinks.length && url) evidenceLinks.push({
      publisher:typeof item.source === 'string' ? item.source.slice(0,90) : 'الناشر',url,
    });
    result.push({
      id, title, url,
      source: typeof item.source === 'string' && item.source.trim() ? item.source : 'M3TM.APP',
      published: typeof item.published === 'string' ? item.published : '',
      language: typeof item.language === 'string' ? item.language : '',
      evidenceLinks, publicationCount:evidenceLinks.length,
      lat: regional(lat), lng: regional(lng),
      precision: 'regional-0.5deg', provenance: 'M3TM.APP public feed', status: 'source-reported',
    });
    seen.add(id);
    if (result.length === 160) break;
  }
  return result;
}
