import { describe, expect, it } from 'vitest';
import { FAST_NEWS_FEEDS, sourceRssNews, fusePublicNews, publicArticleLink, publishedTime, type RoutedNews } from './fastNews';

const sample: RoutedNews = {
  id:'app-1',title:'خبر منشور',description:'',link:'https://www.bbc.com/news/story-1',
  published:'2026-10-06T12:00:00Z',source:'BBC Arabic',risk_score:5,
  coords:[25.5,45.5],coords_default:false,language:'ar',
  feed_origin:'m3tm-app',location_basis:'published-feed-coordinate',
  verification_status:'source-reported',machine_assessment:null,
};
const now=Date.parse('2026-10-06T13:00:00Z');

describe('Fast independent source news',()=>{
  it('accepts canonical publisher links, never internal or alien hosts',()=>{
    expect(publicArticleLink('https://www.bbc.com/news/story-1?utm_source=abc#fragment',['bbc.com']))
      .toBe('https://www.bbc.com/news/story-1');
    expect(publicArticleLink('https://somewhere.invalid/act',['bbc.com'])).toBeNull();
    expect(publicArticleLink('http://127.0.0.1/a')).toBeNull();
    expect(publicArticleLink('javascript:alert(1)')).toBeNull();
  });
  it('rejects missing, stale and future timestamps instead of inventing recency',()=>{
    expect(publishedTime('')).toBeNull();
    expect(publishedTime('2026-10-07T12:00:00Z',now)).toBeNull();
    expect(publishedTime('2026-09-01T12:00:00Z',now)).toBeNull();
    expect(publishedTime('2026-10-06T12:10:00Z',now)).toBe('2026-10-06T12:10:00.000Z');
  });
  it('keeps RSS unlocated and avoids guessing incident geographies',()=>{
    const rows=sourceRssNews(FAST_NEWS_FEEDS[0],
      [{title:'Published news about the Middle East',link:'https://www.bbc.com/news/story-2',
        isoDate:'2026-10-06T12:25:00Z'}],now);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({coords:null,location_basis:'none',feed_origin:'independent-rss',
      verification_status:'source-reported',machine_assessment:null});
  });
  it('prefers APP geo evidence when the same published article is in RSS',()=>{
    const duplicate=sourceRssNews(FAST_NEWS_FEEDS[0],
      [{title:'BBC breaking story from a verified source',link:'https://www.bbc.com/news/story-1',
        isoDate:'2026-10-06T12:30:00Z'}],now);
    const out=fusePublicNews([sample],duplicate);
    expect(out).toHaveLength(1);
    expect(out[0].coords).toEqual([25.5,45.5]);
    expect(out[0].feed_origin).toBe('m3tm-app');
  });
  it('keeps older APP and newer RSS together, sorted by actual published time',()=>{
    const extra=sourceRssNews(FAST_NEWS_FEEDS[0],
      [{title:'New report about regional ceasefire',link:'https://www.bbc.com/news/story-3',
        isoDate:'2026-10-06T12:40:00Z'}],now);
    const out=fusePublicNews([sample],extra);
    expect(out).toHaveLength(2);
    expect(out[0].source).toBe('BBC Middle East');
    expect(out[1].source).toBe('BBC Arabic');
  });
});
