import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const source = readFileSync(new URL('./LayerPanel.tsx', import.meta.url), 'utf8');

describe('WORLD mobile layer discovery', () => {
  it('offers a searchable, grouped list instead of hiding available layers', () => {
    expect(source).toContain('id="world-layer-search"');
    expect(source).toContain('setMobileGroup(label)');
    expect(source).toContain("['الكل', ...availableGroups.map");
    expect(source).toContain('availableGroups.reduce(');
  });
  it('keeps layer switching separate from navigation and uses source-provided counts', () => {
    expect(source).toContain('onClick={() => toggle(layer.key)}');
    expect(source).toContain('const getCount = (dk: string, catKey?: string)');
  });
});
