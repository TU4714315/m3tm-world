import { describe, expect, it } from 'vitest';
import { buildPublicFieldAlerts } from './publicFieldAlerts';

const base = {
  feed_origin: 'm3tm-app',
  location_basis: 'published-feed-coordinate',
  coords: [24.71, 46.67],
  source: 'Publisher',
  published: '2026-09-30T18:00:00Z',
  link: 'https://example.com/item',
};

describe('generalized source-backed field alerts', () => {
  it('classifies Arabic conflict reports without inventing locations', () => {
    const rows = [
      { ...base, id: 'a', title: 'اعتراض صاروخ بواسطة الدفاع الجوي' },
      { ...base, id: 'b', title: 'رصد طائرة مسيّرة في خبر منشور', coords: [15.1, 44.2] },
      { ...base, id: 'c', title: 'اشتباكات وقصف مدفعي', coords: [33.33, 36.3] },
      { ...base, id: 'd', title: 'تحرك دبابة ومدرعات بحسب المصدر', coords: [31.9, 35.2] },
    ];
    const alerts = buildPublicFieldAlerts(rows);
    expect(alerts.map(x => x.category)).toEqual(['air_defence','drone','strike','equipment']);
    expect(alerts[0]).toMatchObject({
      lat: 24.5, lng: 46.5, precision: 'regional-0.5deg',
      provenance: 'M3TM.APP public feed', status: 'source-reported',
    });
  });

  it('rejects fallback/guessed locations and ordinary news', () => {
    expect(buildPublicFieldAlerts([
      { ...base, id: 'x', feed_origin: 'independent-fallback', title: 'airstrike reported' },
      { ...base, id: 'y', location_basis: 'keyword-context', title: 'missile reported' },
      { ...base, id: 'z', title: 'اقتصاد وأسواق اليوم' },
    ])).toEqual([]);
  });

  it('deduplicates and validates coordinates', () => {
    const rows = [
      { ...base, id: 'same', title: 'صاروخ معلن' },
      { ...base, id: 'same', title: 'صاروخ معلن مرة أخرى' },
      { ...base, id: 'bad', title: 'قصف معلن', coords: [91, 0] },
    ];
    expect(buildPublicFieldAlerts(rows)).toHaveLength(1);
  });
});
