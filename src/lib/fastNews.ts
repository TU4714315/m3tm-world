import Parser from 'rss-parser';
import crypto from 'node:crypto';

/**
 * Public RSS is a parallel, low-latency witness stream; it never invents
 * incident coordinates, dates, verification or agreement between publishers.
 * Source names represent the publisher, not a determination of truth.
 */
export const FAST_NEWS_FEEDS = [
  // Arabic primary text: show the publisher's actual headline, no invented
  // automatic translation and no inferred coordinates from country mentions.
  { name: 'BBC عربي', url: 'https://feeds.bbci.co.uk/arabic/rss.xml', hosts: ['bbc.co.uk','bbc.com'], focus: 'mena' },
  { name: 'BBC Middle East', url: 'https://feeds.bbci.co.uk/news/world/middle_east/rss.xml', hosts: ['bbc.co.uk', 'bbc.com'], focus: 'mena' },
  { name: 'UN News Arabic', url: 'https://news.un.org/feed/subscribe/ar/news/region/middle-east/feed/rss.xml', hosts: ['news.un.org'], focus: 'mena' },
  { name: 'Al Jazeera', url: 'https://www.aljazeera.com/xml/rss/all.xml', hosts: ['aljazeera.com'], focus: 'global' },
  { name: 'The Guardian Middle East', url: 'https://www.theguardian.com/world/middleeast/rss', hosts: ['theguardian.com'], focus: 'mena' },
  { name: 'Naharnet Lebanon', url: 'https://www.naharnet.com/tags/lebanon/en/feed.atom', hosts: ['naharnet.com'], focus: 'mena' },
  { name: 'The Maritime Executive', url: 'https://maritime-executive.com/articles.rss', hosts: ['maritime-executive.com'], focus: 'global' },
] as const;

export type RoutedNews = {
  id: string; title: string; description: string; link: string;
  published: string; source: string; risk_score: number;
  coords: [number, number] | null; coords_default: boolean;
  language: string; feed_origin: string; location_basis: string;
  verification_status: 'source-reported'; machine_assessment: null;
};

export function publicArticleLink(raw: unknown, allowedHosts?: readonly string[]): string | null {
  if (typeof raw !== 'string') return null;
  try {
    const url = new URL(raw);
    const host = url.hostname.toLowerCase().replace(/\.$/, '');
    if ((url.protocol !== 'https:' && url.protocol !== 'http:') ||
      url.username || url.password || url.port && !['80','443'].includes(url.port) ||
      host === 'localhost' || host.endsWith('.localhost') ||
      host.startsWith('127.') || host.startsWith('10.') ||
      host.startsWith('192.168.') || host.startsWith('169.254.') ||
      host.startsWith('172.16.') || host.endsWith('.local') ||
      !host.includes('.')) return null;
    if (allowedHosts?.length &&
      !allowedHosts.some(allowed => host === allowed || host.endsWith('.'+allowed))) return null;
    url.hash = '';
    for (const key of [...url.searchParams.keys()]) {
      if (/^(utm_.+|fbclid|gclid|mc_cid|mc_eid|ref_src|ref_url)$/i.test(key)) url.searchParams.delete(key);
    }
    return url.href;
  } catch { return null; }
}

export function publishedTime(value: unknown, nowMs = Date.now()): string | null {
  if (typeof value !== 'string' || !value.trim()) return null;
  const time = Date.parse(value);
  // A broken or dated feed is not evidence of a new report.
  if (!Number.isFinite(time) || time > nowMs + 10 * 60_000 ||
      time < nowMs - 72 * 60 * 60_000) return null;
  return new Date(time).toISOString();
}

function plain(value: unknown, max = 240): string {
  return typeof value === 'string'
    ? value.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim().slice(0,max)
    : '';
}

export function sourceRssNews(
  feed: typeof FAST_NEWS_FEEDS[number],
  entries: Array<{title?: string; link?: string; pubDate?: string; isoDate?: string; contentSnippet?: string; content?: string}>,
  nowMs = Date.now(),
): RoutedNews[] {
  return entries.flatMap(entry => {
    const link = publicArticleLink(entry.link, feed.hosts);
    const time = publishedTime(entry.isoDate || entry.pubDate, nowMs);
    const title = plain(entry.title, 180);
    if (!link || !time || title.length < 12) return [];
    return [{
      id: 'rss-'+crypto.createHash('sha256').update(link).digest('hex').slice(0,20),
      title,
      description: plain(entry.contentSnippet || entry.content, 400),
      link, published: time, source: feed.name, risk_score: 1,
      coords: null, coords_default: true, language: 'source',
      feed_origin: 'independent-rss', location_basis: 'none',
      verification_status: 'source-reported' as const, machine_assessment: null,
    }];
  }).slice(0, 8);
}

export function fusePublicNews(app: RoutedNews[], extra: RoutedNews[], limit=220): RoutedNews[] {
  // Original geo provenance from APP always wins if a URL repeats in RSS.
  const chosen = new Map<string,RoutedNews>();
  for (const item of [...app,...extra]) {
    const key = publicArticleLink(item.link);
    if (!key || !item.title || !Number.isFinite(Date.parse(item.published))) continue;
    if (!chosen.has(key)) chosen.set(key,item);
  }
  return [...chosen.values()]
    .sort((a,b) => Date.parse(b.published)-Date.parse(a.published))
    .slice(0,limit);
}

const parser = new Parser({ timeout: 4500, maxRedirects: 2 });

export async function fetchFastRssNews(): Promise<{
  news: RoutedNews[]; succeeded: number; failed: number;
}> {
  const results = await Promise.allSettled(FAST_NEWS_FEEDS.map(async feed => {
    const response = await fetch(feed.url, {
      signal: AbortSignal.timeout(4500),
      next: { revalidate: 45 },
      headers: { Accept:'application/rss+xml, application/atom+xml, text/xml, application/xml' },
    });
    if (!response.ok) throw new Error('RSS upstream unavailable');
    // Bound feeds before XML parsing to avoid unbounded upstream responses.
    const length = Number(response.headers.get('content-length'));
    if (length > 500_000) throw new Error('RSS feed too large');
    const xml = (await response.text()).slice(0,500_001);
    if (xml.length > 500_000) throw new Error('RSS feed too large');
    const parsed = await parser.parseString(xml);
    return sourceRssNews(feed, parsed.items || []);
  }));
  return {
    news: results.flatMap(r=>r.status==='fulfilled'?r.value:[]),
    succeeded: results.filter(r=>r.status==='fulfilled').length,
    failed: results.filter(r=>r.status==='rejected').length,
  };
}
