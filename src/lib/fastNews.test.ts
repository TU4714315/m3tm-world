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
    expect(out[0].publication_count).toBe(1);
  });
  it('lists distinct publication venues for an exactly matching sourced headline without claiming independent verification',()=>{
    const first={...sample,title:'  تقرير  منشورٌ عن المنطقة ',published:'2026-10-06T12:00:00Z'};
    const second={...sample,id:'rss-2',title:'تقرير منشور عن المنطقة',source:'Publisher B',
      link:'https://example.org/another-report',published:'2026-10-06T12:20:00Z',
      coords:null,coords_default:true,feed_origin:'independent-rss',location_basis:'none'};
    const out=fusePublicNews([first],[second]);
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({
      feed_origin:'m3tm-app',coords:[25.5,45.5],publication_count:2,
    });
    expect(out[0].evidence_label).toContain('لا يعني تحققًا');
    expect(out[0].evidence_links?.map(e=>e.url)).toEqual([
      'https://www.bbc.com/news/story-1','https://example.org/another-report',
    ]);
  });
  it('keeps reports in different regions or time windows distinct, and leaves RSS unlocated',()=>{
    const sameTitle='خبر موثق عن المنطقة يستحق المتابعة';
    const older={...sample,title:sameTitle};
    const elsewhere={...sample,id:'app-elsewhere',link:'https://example.com/story',
      title:sameTitle,coords:[12,58] as [number,number]};
    const later={...sample,id:'rss-later',link:'https://example.org/story',
      title:sameTitle,coords:null,feed_origin:'independent-rss',
      location_basis:'none',published:'2026-10-06T16:00:00Z'};
    const out=fusePublicNews([older,elsewhere],[later]);
    expect(out).toHaveLength(3);
    expect(out.find(e=>e.id==='rss-later')?.coords).toBeNull();
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
