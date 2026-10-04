import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('public layer readiness messaging', () => {
  const panel = readFileSync(new URL('./LayerPanel.tsx', import.meta.url), 'utf8');

  it('does not present an active feed with missing data as a locked layer', () => {
    expect(panel).toContain("if (!data?.flight_source_status) return 'جارٍ التحميل'");
    expect(panel).toContain("if ((count ?? 0) === 0) return 'لا توجد بيانات'");
    expect(panel).toContain("return 'غير مهيأ'");
    expect(panel).toContain('الطبقة متاحة وغير مقفلة');
    expect(panel).toContain("case 'active_fallback': return 'نشط · مصدر عام بديل'");
    expect(panel).toContain("layer.key === 'cf_outages' || layer.key === 'cf_attacks'");
    expect(panel).toContain('بنية C2 مرصودة لا بلد المهاجم');
    expect(panel).toContain("source.source_mode === 'public-fallback'");
    expect(panel).toContain("source.source_mode === 'mixed'");
    expect(panel).toContain("source.fallback_sections?.outages === true");
    expect(panel).toContain("source.fallback_sections?.attacks === true");
    expect(panel).toContain("case 'not_used': return 'غير مستخدم'");
    expect(panel).toContain("source?.fallback_sections?.outages === true");
    expect(panel).toContain("source?.fallback_sections?.attacks === true");
    expect(panel).toContain("fallbackState === 'unavailable'");
    expect(panel).toContain("cloudflareState === 'unavailable'");
  });

  it('keeps the network flyout readable with full-width source descriptions', () => {
    expect(panel).toContain("group.label === 'شبكة وأحداث' ? 'w-[340px]");
    expect(panel).toContain('flex flex-col items-stretch gap-1.5 p-2');
    expect(panel).toContain('w-full text-right text-[10px]');
    expect(panel).not.toContain('disabled={capabilityUnavailable}');
  });

  it('keeps provider availability as status text rather than a disabled control', () => {
    expect(panel).not.toContain('disabled={capabilityUnavailable}');
    expect(panel).toContain("layer.key === 'naval_activity'");
    expect(panel).toContain("ais?.status === 'not_configured'");
  });
});
