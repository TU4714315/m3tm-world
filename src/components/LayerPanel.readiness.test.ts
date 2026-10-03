import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('public layer readiness messaging', () => {
  const panel = readFileSync(new URL('./LayerPanel.tsx', import.meta.url), 'utf8');

  it('does not present an active feed with missing data as a locked layer', () => {
    expect(panel).toContain("if (!data?.flight_source_status) return 'جارٍ التحميل'");
    expect(panel).toContain("if ((count ?? 0) === 0) return 'لا توجد بيانات'");
    expect(panel).toContain("return 'غير مهيأ'");
    expect(panel).toContain('الطبقة متاحة وغير مقفلة');
  });

  it('keeps provider availability as status text rather than a disabled control', () => {
    expect(panel).not.toContain('disabled={capabilityUnavailable}');
    expect(panel).toContain("layer.key === 'naval_activity'");
    expect(panel).toContain("ais?.status === 'not_configured'");
  });
});
