import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('WORLD public layer controls', () => {
  const panel = readFileSync(new URL('./LayerPanel.tsx', import.meta.url), 'utf8');

  it('keeps toggles accessible even if provider capability is missing', () => {
    expect(panel).not.toContain('disabled={capabilityUnavailable}');
    expect(panel).toContain('aria-pressed={!!isLayerActive}');
    expect(panel).toContain('onClick={() => toggle(layer.key)}');
  });

  it('shows counts without per-layer provider explanations on mobile or desktop', () => {
    expect(panel).toContain('const getCount = (dk: string, catKey?: string)');
    expect(panel).toContain('count.toLocaleString()');
    expect(panel).not.toContain('{layer.description &&');
    expect(panel).not.toContain('getLayerStatus(layer,');
    expect(panel).not.toContain('<FeedSourceStatus data={data}');
    expect(panel).not.toContain('<ConflictEvidenceStatus data={data}');
    expect(panel).not.toContain('<MilitaryActivityStatus data={data}');
    expect(panel).not.toContain('<MilitarySatelliteActivityStatus data={data}');
  });

  it('keeps provider diagnostics available in code without rendering them in the public layer list', () => {
    expect(panel).toContain('function FeedSourceStatus(');
    expect(panel).toContain('function MilitaryActivityStatus(');
  });
});
