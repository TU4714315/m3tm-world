import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { mergePublicNews, sourcePublishedPoint, type PublicNewsRow } from '@/lib/publicNewsFusion';

/**
 * M3TM.WORLD — Public News Aggregation API
 * Fetches configured public Telegram feeds directly, with a fallback
 * to public RSS sources if Telegram blocks the IP.
 */

const DEFAULT_TELEGRAM_CHANNELS = [
  'Faytuks',
  'Liveuamap',
  'insiderpaper',
  'aljazeeraenglish'
];

const configuredChannels = (process.env.M3TM_WORLD_TELEGRAM_CHANNELS || '')
  .split(',')
  .map(channel => channel.trim().replace(/^@/, ''))
  .filter(channel => /^[a-zA-Z0-9_]{5,32}$/.test(channel))
  .slice(0, 8);

const TELEGRAM_CHANNELS = configuredChannels.length > 0
  ? configuredChannels
  : DEFAULT_TELEGRAM_CHANNELS;

const FALLBACK_FEEDS = {
  BBC: 'https://feeds.bbci.co.uk/news/world/rss.xml',
  AlJazeera: 'https://www.aljazeera.com/xml/rss/all.xml',
  BBCArabic: 'https://feeds.bbci.co.uk/arabic/rss.xml',
  GDACS: 'https://www.gdacs.org/xml/rss.xml'
};

const RISK_KEYWORDS = ['war','missile','strike','attack','crisis','tension','military','conflict','defense','clash','nuclear','invasion','bomb','drone','weapon','sanctions','ceasefire','escalation', 'killed', 'destroyed', 'operation', 'casualty', 'frontline', 'threat'];
const M3TM_APP_PUBLIC_NEWS = 'https://m3tm.app/data/news.json';

const KEYWORD_COORDS: Record<string, [number, number]> = {
  'ukraine': [49.487, 31.272], 'kyiv': [50.450, 30.523], 'russia': [61.524, 105.318],
  'moscow': [55.755, 37.617], 'israel': [31.046, 34.851], 'gaza': [31.416, 34.333],
  'iran': [32.427, 53.688], 'lebanon': [33.854, 35.862], 'syria': [34.802, 38.996],
  'yemen': [15.552, 48.516], 'china': [35.861, 104.195], 'taiwan': [23.697, 120.960],
  'united states': [38.907, -77.036], 'europe': [48.800, 2.300], 'middle east': [31.500, 34.800]
};

function scoreRisk(text: string): number {
  const lower = text.toLowerCase();
  let score = 1;
  for (const kw of RISK_KEYWORDS) {
    if (lower.includes(kw)) score += 2;
  }
  return Math.min(10, score);
}

function findCoords(text: string): [number, number] | null {
  const lower = text.toLowerCase();
  for (const [keyword, coords] of Object.entries(KEYWORD_COORDS)) {
    if (lower.includes(keyword)) return coords;
  }
  return null;
}

function parseTelegramHTML(html: string, channel: string): any[] {
  const items: any[] = [];
  const messageBlockRegex = /<div class="tgme_widget_message_wrap js-widget_message_wrap"[\s\S]*?<\/div>\s*<\/div>\s*<\/div>/gi;
  let blockMatch;

  while ((blockMatch = messageBlockRegex.exec(html)) !== null) {
    const blockHtml = blockMatch[0];
    const textRegex = /<div class="tgme_widget_message_text[^>]*>([\s\S]*?)<\/div>/i;
    const textMatch = blockHtml.match(textRegex);
    if (!textMatch) continue;

    const text = textMatch[1].replace(/<br\s*\/?>/gi, '\n').replace(/<[^>]+>/g, '').replace(/&quot;/g, '"').replace(/&amp;/g, '&').trim();
    if (!text || text.length < 10) continue;

    const dateRegex = /<a class="tgme_widget_message_date" href="(https:\/\/t\.me\/[^"]+)".*?<time datetime="([^"]+)"/i;
    const dateMatch = blockHtml.match(dateRegex);
    const link = dateMatch ? dateMatch[1] : `https://t.me/${channel}`;
    const pubDate = dateMatch ? dateMatch[2] : ''; // Unknown must not become a fresh alert.

    const title = text.split('\n')[0].substring(0, 100);

    items.push({ title, description: text, link, pubDate, source: `t.me/${channel}` });
  }
  return items;
}

function parseRSSItems(xml: string, sourceName: string): any[] {
  const items: any[] = [];
  const itemRegex = /<item>([\s\S]*?)<\/item>/gi;
  let match;

  while ((match = itemRegex.exec(xml)) !== null) {
    const itemXml = match[1];
    const getTag = (tag: string) => {
      const m = itemXml.match(new RegExp(`<${tag}[^>]*><!\\[CDATA\\[([\\s\\S]*?)\\]\\]><\\/${tag}>|<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'i'));
      return (m?.[1] || m?.[2] || '').trim();
    };

    const title = getTag('title').replace(/<[^>]+>/g, '');
    const desc = getTag('description').replace(/<[^>]+>/g, '').replace(/&quot;/g, '"');

    items.push({
      title: title.length > 100 ? title.substring(0, 100) + '...' : title,
      description: desc,
      link: getTag('link'),
      pubDate: getTag('pubDate') || '',
      source: sourceName
    });
  }
  return items;
}


/** APP and independent feeds start concurrently. Feed health never converts
 * upstream errors or unparsed feeds to an asserted absence of events.
 */
type SourceObservation={source:string;kind:'telegram'|'rss';state:'ready'|'empty'|'unavailable';observed:number};
async function sampleIndependentPublicFeeds():Promise<{articles:any[];providers:SourceObservation[]}>{
  const sources=[
    ...TELEGRAM_CHANNELS.map(channel=>({
      source:'t.me/'+channel,kind:'telegram' as const,
      url:'https://t.me/s/'+channel,
      parse:(text:string)=>parseTelegramHTML(text,channel).slice(-8),
    })),
    ...Object.entries(FALLBACK_FEEDS).map(([source,url])=>({
      source,kind:'rss' as const,url,
      parse:(text:string)=>parseRSSItems(text,source).slice(0,5),
    })),
  ];
  const tasks=sources.map(async s=>{
    try{
      const r=await fetch(s.url,{
        signal:AbortSignal.timeout(s.kind==='telegram'?8000:5000),
        headers:s.kind==='telegram'
          ?{'User-Agent':'Mozilla/5.0 (compatible; M3TM.World News Source)'}
          :{'User-Agent':'M3TM-WORLD-NewsReview/1.0'},
      });
      if(!r.ok)return {source:s.source,kind:s.kind,
        state:'unavailable' as const,observed:0,rows:[]};
      const rows=s.parse(await r.text());
      return {source:s.source,kind:s.kind,
        state:rows.length?'ready' as const:'empty' as const,
        observed:rows.length,rows};
    }catch{
      return {source:s.source,kind:s.kind,
        state:'unavailable' as const,observed:0,rows:[]};
    }
  });
  const answers=await Promise.allSettled(tasks);
  const values=answers.map((r,i)=>r.status==='fulfilled'?r.value:
    {source:sources[i].source,kind:sources[i].kind,
      state:'unavailable' as const,observed:0,rows:[] as any[]});
  return {
    articles:values.flatMap(v=>v.rows),
    providers:values.map(({source,kind,state,observed})=>({source,kind,state,observed})),
  };
}

export async function GET() {
  try {
    const primaryNews: PublicNewsRow[] = [];
    let primaryTimestamp: string | null = null;
    let appOk = false;
    const independentPublicFeeds=sampleIndependentPublicFeeds();
    // M3TM.APP already publishes a sanitized, source-backed Arabic feed. Reuse
    // that public contract first so the standalone WORLD surface and the APP
    // embed speak the same language and do not independently reinterpret news.
    try {
      const published = await fetch(M3TM_APP_PUBLIC_NEWS, {
        signal: AbortSignal.timeout(15000),
        next: { revalidate: 60 },
      });
      if (published.ok) {
        appOk = true;
        const payload = await published.json() as { items?: unknown; fetchedAt?: unknown };
        const fetchedAt = typeof payload.fetchedAt === 'string'
          ? payload.fetchedAt
          : new Date().toISOString();
        const rows: Record<string, unknown>[] = Array.isArray(payload.items)
          ? payload.items.filter((item): item is Record<string, unknown> => Boolean(item && typeof item === 'object'))
          : [];
        const arabicRows = rows.filter((item) => /[\u0600-\u06FF]/.test(String(item.title || '')));
        const news = arabicRows.slice(0, 160).map((item) => {
          const point = sourcePublishedPoint(item.latitude,item.longitude);
          const severityScore: Record<string, number> = {
            critical: 9,
            high: 7,
            medium: 5,
            low: 3,
            info: 1,
          };
          return {
            id: String(item.id || crypto.createHash('md5').update(String(item.sourceUrl || '') + String(item.publishedAt || '')).digest('hex')),
            title: String(item.title || 'خبر منشور'),
            description: String(item.summary || ''),
            link: String(item.sourceUrl || ''),
            published: typeof item.publishedAt==='string' ? item.publishedAt : '',
            source: String(item.source || 'M3TM.APP'),
            risk_score: severityScore[String(item.severity || '').toLowerCase()] ?? 1,
            coords: point,
            coords_default: !point,
            language: 'ar',
            feed_origin: 'm3tm-app',
            location_basis: point ? 'published-feed-coordinate' : 'none',
            verification_status: 'source-reported',
            machine_assessment: null,
          };
        });
        if (news.length > 0) {
          primaryNews.push(...news as PublicNewsRow[]);
          primaryTimestamp = fetchedAt;
        }
      }
    } catch {
      // WORLD keeps its independent public-source fallback below.
    }

    const {articles:allArticles,providers} = await independentPublicFeeds;

    const newsItems:PublicNewsRow[] = allArticles.map(article => {
      const riskScore = scoreRisk(article.description || article.title);
      // A mentioned country is not a verifiable incident coordinate.
      // Keep the inferred match available only as a text-context basis.

      return {
        id: crypto.createHash('md5').update((article.link || '') + (article.pubDate || '')).digest('hex'),
        title: article.title,
        description: article.description,
        link: article.link,
        published: article.pubDate,
        source: article.source,
        risk_score: Math.min(5, riskScore),
        risk_basis: 'keyword-only',
        coords: null,
        coords_default: true,
        language: 'source',
        feed_origin: 'independent-fallback',
        location_basis: findCoords(article.description || article.title) ? 'keyword-context' : 'none',
        verification_status: 'source-reported',
        machine_assessment: null,
      };
    });

    const fused=mergePublicNews([...primaryNews,...newsItems],200);
    return NextResponse.json({
      news: fused,
      total: fused.length,
      timestamp: primaryTimestamp || new Date().toISOString(),
      language: primaryNews.length ? 'mixed-arabic-primary' : 'source',
      source: primaryNews.length ? 'M3TM.APP + public RSS/Telegram evidence' :
        (allArticles.length ? 'public RSS/Telegram fallback' : 'none'),
      source_health: {
        app: appOk ? (primaryNews.length ? 'data' : 'empty') : 'unavailable',
        rss_telegram: allArticles.length ? 'partial-sampled' : 'empty-or-unavailable',
        // Empty and unreachable are intentionally not treated as "no events".
        coverage: 'partial',
        providers,
      },
    }, {
      headers: {
        'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=120',
      },
    });
  } catch (error) {
    return NextResponse.json({ news: [], error: 'Failed to fetch data' }, { status: 500 });
  }
}
