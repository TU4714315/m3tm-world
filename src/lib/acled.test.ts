import { describe, expect, it } from 'vitest';
import {
  acledEventQuery, classifyAcledEvent,
  ACLED_EVENT_WINDOW_DAYS, ACLED_PUBLICATION_WINDOW_DAYS,
  acledRecencyEntitlement,
} from './acled';

describe('classifyAcledEvent', () => {
  it('creates a documented inclusive date query with only same-column OR types', () => {
    const params = acledEventQuery(new Date('2026-09-28T00:00:00Z'), new Date('2026-10-04T00:00:00Z'), 250);
    expect(params.get('event_date')).toBe('2026-09-28|2026-10-04');
    expect(params.get('event_date_where')).toBe('BETWEEN');
    expect(params.get('event_type')).toContain(':OR:event_type=Riots');
    expect(params.get('event_type')).not.toContain('sub_event_type=');
    expect(params.get('fields')).toContain('latitude');
    expect(params.get('limit')).toBe('250');
    expect(params.get('with_total')).toBe('true');
  });

  it('filters publication upload time separately from occurrence date', () => {
    const pub = new Date('2026-09-24T16:00:00Z');
    const q = acledEventQuery(
      new Date('2026-09-01T00:00:00Z'),
      new Date('2026-10-04T00:00:00Z'),
      300, pub,
    );
    expect(q.get('event_date')).toBe('2026-09-01|2026-10-04');
    expect(q.get('timestamp')).toBe(String(Math.floor(pub.getTime()/1000)));
    expect(q.get('timestamp_where')).toBe('>=');
    expect(ACLED_EVENT_WINDOW_DAYS).toBeGreaterThan(7);
    expect(ACLED_PUBLICATION_WINDOW_DAYS).toBeGreaterThan(7);
  });

  it('marks a recent-window entitlement mismatch without revealing account scope', () => {
    const start = new Date('2026-09-01T00:00:00Z');
    expect(acledRecencyEntitlement({
      date_recency: {date:'2025-10-05', description:'12 Months old'},
      countries:['private-account-data']
    }, start)).toEqual({
      latestPermittedEventDate:'2025-10-05',
      recentAccessRestricted:true,
    });
    expect(acledRecencyEntitlement({
      date_recency: {date:'2026-09-14', description:'one-week lag'}
    }, start).recentAccessRestricted).toBe(false);
    expect(acledRecencyEntitlement({}, start).latestPermittedEventDate).toBeNull();
  });

  it('maps public ACLED sub-event types into stable map categories', () => {
    expect(classifyAcledEvent('Explosions/Remote violence', 'Air/drone strike')).toEqual({
      category: 'aerial_attack',
      labelAr: 'ضربة جوية/مسيّرة مُبلّغ عنها',
    });
    expect(classifyAcledEvent('Explosions/Remote violence', 'Shelling/artillery/missile attack').category).toBe('heavy_weapons');
    expect(classifyAcledEvent('Explosions/Remote violence', 'Remote explosive/land mine/IED').category).toBe('bombing');
    expect(classifyAcledEvent('Battles', 'Armed clash').category).toBe('armed_clash');
    expect(classifyAcledEvent('Violence against civilians', 'Attack').category).toBe('assault');
  });

  it('does not upgrade uncategorized records into a specific strike type', () => {
    expect(classifyAcledEvent('Strategic developments', 'Other').category).toBe('other');
  });
});
