import { describe, expect, it } from 'vitest';
import { buildYemenHumanitarianSignals } from './yemenHumanitarianSignals';

const now = Date.parse('2026-10-14T08:00:00Z');
describe('Yemen humanitarian and historical reporting safeguards', () => {
  it('preserves source-backed humanitarian stories without creating tactical locations', () => {
    const result = buildYemenHumanitarianSignals([
      { title: 'نزوح أسر في اليمن بعد الفيضانات', link: 'https://dtm.iom.int/yemen', source: 'IOM', published: '2026-10-13T05:00:00Z', lat: 15.3, lng: 44.2 },
      { title: 'Displacement in Yemen', link: 'https://example.org/news', source: 'Publisher', published: '2026-10-13T06:00:00Z' },
      { title: 'نزوح في العراق', link: 'https://example.org/iraq', published: '2026-10-13T06:00:00Z' },
    ], now);
    expect(result.displacement).toHaveLength(2);
    expect(JSON.stringify(result)).not.toMatch(/"lat"|"lng"|"heading"|"route"/);
    expect(result.historicalControl).toEqual([]);
  });
  it('never publishes current advances as tactical events, and does not infer locations from armed-group references', () => {
    const output = buildYemenHumanitarianSignals([
      { title: 'تقدم قوات في اليمن', published: '2026-10-14T07:30:00Z', link: 'https://example.org/recent' },
      { title: 'تقرير عن تغير السيطرة في اليمن', published: '2026-10-09T07:00:00Z', link: 'https://example.org/old' },
      { title: 'تقدم قوات في إيران', published: '2026-10-09T07:00:00Z', link: 'https://example.org/iran' },
    ], now);
    expect(output.historicalControl).toHaveLength(1);
    expect(output.historicalControl[0].title).toBe('تقرير تاريخي منشور عن تغيّر السيطرة');
    expect(JSON.stringify(output)).not.toContain('recent');
  });
  it('rejects unverifiable timestamps, unsafe URLs and duplicates', () => {
    const r = buildYemenHumanitarianSignals([
      { title: 'نزوح في اليمن', published: '2026-10-13T00:00:00Z', link: 'javascript:alert(1)' },
      { title: 'نزوح في اليمن', published: '', link: 'https://example.org/a' },
      { title: 'نزوح في اليمن', published: '2026-10-13T00:00:00Z', link: 'https://example.org/a' },
      { title: 'نزوح في اليمن', published: '2026-10-13T00:00:00Z', link: 'https://example.org/a' },
    ], now);
    expect(r.displacement).toHaveLength(1);
  });
});
