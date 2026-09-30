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
    try { if (/^https?:\/\//i.test(candidate)) url = new URL(candidate).href; } catch { /* link unavailable */ }
    result.push({
      id, title, url,
      source: typeof item.source === 'string' && item.source.trim() ? item.source : 'M3TM.APP',
      published: typeof item.published === 'string' ? item.published : '',
      lat: regional(lat), lng: regional(lng),
      precision: 'regional-0.5deg', provenance: 'M3TM.APP public feed', status: 'source-reported',
    });
    seen.add(id);
    if (result.length === 160) break;
  }
  return result;
}
