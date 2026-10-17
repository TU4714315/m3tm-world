import { describe, expect, it } from 'vitest';
import { priorityNews } from './priorityNews';
describe('priority glass news cards', () => {
  it('preserves publisher breaking labels without inventing urgency from a risk score', () => {
    const items = priorityNews([{ title: 'Regular report', risk_score: 10, source: 'A' }, { title: 'عاجل: خبر منشور', source: 'B' }]);
    expect(items[0].breaking).toBe(true);
    expect(items[1].breaking).toBe(false);
  });
  it('deduplicates safe links and suppresses Saudi news locations', () => {
    const items = priorityNews([{ title: 'خبر', source: 'A', coords: [24.7, 46.7], link: 'https://news.org/story' },
      { title: 'نسخة', source: 'B', link: 'https://news.org/story' }]);
    expect(items).toHaveLength(1); expect(items[0].coords).toBeNull();
    expect(priorityNews([{ title: 'خبر', link: 'javascript:alert(1)' }])[0].url).toBeNull();
  });
});
