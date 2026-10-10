import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('LayerPanel provider-state UX', () => {
  it('keeps provider-gated public layers operable without public readiness explanations', () => {
    const source = readFileSync(new URL('./LayerPanel.tsx', import.meta.url), 'utf8');

    expect(source).toContain("capabilities[layer.requires] !== true");
    expect(source).not.toContain("{getLayerStatus(layer,");
    expect(source).not.toContain('<FeedSourceStatus data={data}');
    expect(source).not.toContain('disabled={capabilityUnavailable}');
    expect(source).not.toContain('if (!capabilityUnavailable) toggle(layer.key)');
    expect(source).toContain('onClick={() => toggle(layer.key)}');
  });

  it('does not let the Cloudflare readiness probe overwrite user layer state', () => {
    const pageSource = readFileSync(new URL('../app/page.tsx', import.meta.url), 'utf8');

    expect(pageSource).not.toContain("if (!configured) setActiveLayers(prev => ({ ...prev, cf_outages: false, cf_attacks: false }))");
    expect(pageSource).toContain("readiness is status only and never overrides the user's layer selection.");
  });
});
