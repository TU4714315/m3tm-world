import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('network fallback popup semantics', () => {
  const worldMap = readFileSync(new URL('./WorldMap.tsx', import.meta.url), 'utf8');

  it('renders GDELT cyber reports as reports, not Cloudflare outages', () => {
    expect(worldMap).toContain("const isReportedCyber = p.event_type === 'REPORTED_CYBER_EVENT'");
    expect(worldMap).toContain('حدث سيبراني مُبلّغ عنه');
    expect(worldMap).toContain('لا يثبت انقطاعًا شاملاً للشبكة');
    expect(worldMap).toContain("source.startsWith('GDELT')");
  });

  it('renders Feodo rows as observed C2 infrastructure, not attacker attribution', () => {
    expect(worldMap).toContain("const isObservedC2 = p.indicator_type === 'observed-c2-infrastructure'");
    expect(worldMap).toContain('بنية C2 مرصودة');
    expect(worldMap).toContain('لا يمثل إسنادًا لهوية أو بلد المهاجم');
    expect(worldMap).toContain("source.includes('Feodo')");
  });
});
