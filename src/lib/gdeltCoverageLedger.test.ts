import { describe, it, expect } from 'vitest';
import { summarizeGdeltCoverage } from './gdeltCoverageLedger';

describe('GDELT 15-minute publication checkpoint ledger', () => {
  const now = Date.parse('2026-10-05T12:00:00Z');
  it('de-duplicates real windows, drops future/archive errors and reports gaps', () => {
    const data = [
      { window: '20261005120000.export.CSV.zip', firstObservedAt: now },
      { window: '20261005120000.export.CSV.zip', firstObservedAt: now },
      { window: '20261005114500.export.CSV.zip', firstObservedAt: now - 14*60000 },
      { window: '20261005121500.export.CSV.zip', firstObservedAt: now },
      { window: 'garbled', firstObservedAt: now },
    ];
    const result = summarizeGdeltCoverage(data, now);
    expect(result.observedWindows).toBe(2);
    expect(result.missingWindows).toBe(670);
    expect(result.coveragePercent).toBe(0.3);
    expect(result.firstSeenLagMinutes.p95).toBe(1);
    expect(result.uninterrupted).toBe(false);
  });
  it('rejects false arrival dates and stale years', () => {
    const rows = [
      { window: '20260910120000.export.CSV.zip', firstObservedAt: now },
      { window: '20261005120000.export.CSV.zip', firstObservedAt: now + 1 },
    ];
    expect(summarizeGdeltCoverage(rows, now, 'redis').observedWindows).toBe(0);
  });
  it('does not label full memory samples durable, even after backfill', () => {
    const rows = Array.from({ length: 672 }, (_, i) => {
      const t = new Date(now - i * 15 * 60000);
      const parts = [String(t.getUTCFullYear()),
        String(t.getUTCMonth()+1).padStart(2,'0'),String(t.getUTCDate()).padStart(2,'0'),
        String(t.getUTCHours()).padStart(2,'0'),String(t.getUTCMinutes()).padStart(2,'0')];
      return { window: parts.join('')+'00.export.CSV.zip',
        firstObservedAt: Math.min(now,t.getTime()+20000) };
    });
    expect(summarizeGdeltCoverage(rows, now).uninterrupted).toBe(false);
    expect(summarizeGdeltCoverage(rows, now, 'redis').uninterrupted).toBe(true);
    expect(JSON.stringify(summarizeGdeltCoverage(rows, now))).not.toContain('icao24');
  });
});
