import { describe, it, expect } from 'vitest';
import { buildAppNewsPins } from './appNewsPins';

const row = { id: 'a1', title: 'خبر عربي', link: 'https://m3tm.app/news', published: '2026-09-30T00:00:00Z', source: 'M3TM.APP', coords: [25.12, 45.88], feed_origin: 'm3tm-app', location_basis: 'published-feed-coordinate' };

describe('APP news map provenance', () => {
  it('only plots regionalized coordinates provided by APP', () => {
    expect(buildAppNewsPins([row])[0]).toMatchObject({ lat: 25, lng: 46, precision: 'regional-0.5deg', status: 'source-reported' });
  });
  it('attaches real distinct source links without claiming independent confirmation', () => {
    const pins=buildAppNewsPins([{
      ...row,
      publication_count:3,
      evidence_links:[
        {publisher:'Publisher A',url:'https://news.example.org/article'},
        {publisher:'Publisher B',url:'https://another.example.org/report'},
        {publisher:'Publisher A',url:'https://news.example.org/duplicate'},
        {publisher:'internal',url:'http://localhost/private'},
      ],
    }]);
    expect(pins).toHaveLength(1);
    expect(pins[0].publisherCount).toBe(2);
    expect(pins[0].evidenceLabel).toContain('غير مؤكد');
    expect(pins[0].evidenceLinks.map(v=>v.publisher)).toEqual(['Publisher A','Publisher B']);
  });
  it('keeps unlocated RSS/Telegram off the map, even when already syndicated',()=>{
    expect(buildAppNewsPins([{...row,coords:[32,53],feed_origin:'independent-fallback',
      publication_count:5}])).toEqual([]);
  });
  it('does not plot inferred or fallback marker positions', () => {
    expect(buildAppNewsPins([{...row, feed_origin: 'independent-fallback'}, {...row, location_basis: 'keyword-context'}, {...row, coords: [null, null]}, row, row])).toHaveLength(1);
    expect(buildAppNewsPins(null)).toEqual([]);
  });
});
