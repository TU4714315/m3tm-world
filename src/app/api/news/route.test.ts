import { describe, expect, it } from 'vitest';
import { buildIndependentFallbackNewsItem } from './route';

describe('public news fallback location boundary', () => {
  it('does not turn place mentions into incident coordinates', () => {
    const item = buildIndependentFallbackNewsItem({
      title: 'Iran mentioned in a public report about another location',
      description: 'Published reporting mentions Tehran and regional tensions.',
      link: 'https://example.org/report',
      pubDate: '2026-10-08T08:00:00Z',
      source: 'Public source',
    });

    expect(item.coords).toBeNull();
    expect(item.coords_default).toBe(true);
    expect(item.location_basis).toBe('none');
    expect(item.feed_origin).toBe('independent-fallback');
    expect(item.risk_score).toBeGreaterThan(1);
  });
});
