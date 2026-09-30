import { describe, it, expect } from 'vitest';
import { buildAppNewsPins } from './appNewsPins';

const row = { id: 'a1', title: 'خبر عربي', link: 'https://m3tm.app/news', published: '2026-09-30T00:00:00Z', source: 'M3TM.APP', coords: [25.12, 45.88], feed_origin: 'm3tm-app', location_basis: 'published-feed-coordinate' };

describe('APP news map provenance', () => {
  it('only plots regionalized coordinates provided by APP', () => {
    expect(buildAppNewsPins([row])[0]).toMatchObject({ lat: 25, lng: 46, precision: 'regional-0.5deg', status: 'source-reported' });
  });
  it('does not plot inferred or fallback marker positions', () => {
    expect(buildAppNewsPins([{...row, feed_origin: 'independent-fallback'}, {...row, location_basis: 'keyword-context'}, {...row, coords: [null, null]}, row, row])).toHaveLength(1);
    expect(buildAppNewsPins(null)).toEqual([]);
  });
});
