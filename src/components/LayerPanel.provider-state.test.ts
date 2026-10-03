import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('LayerPanel provider-state UX', () => {
  it('keeps provider-gated public layers operable while reporting readiness separately', () => {
    const source = readFileSync(new URL('./LayerPanel.tsx', import.meta.url), 'utf8');

    expect(source).toContain("capabilities[layer.requires] !== true");
    expect(source).toContain("'غير مهيأ'");
    expect(source).not.toContain('disabled={capabilityUnavailable}');
    expect(source).not.toContain('if (!capabilityUnavailable) toggle(layer.key)');
    expect(source).toContain('onClick={() => toggle(layer.key)}');
  });
});
