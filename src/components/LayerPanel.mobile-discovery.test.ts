import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import LayerPanel from './LayerPanel';
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
  it('keeps air, control areas, military, satellite and weather controls discoverable after grouping', () => {
    const html = renderToStaticMarkup(createElement(LayerPanel, {
      data: {}, activeLayers: { wind: false, wind_controls: true },
      setActiveLayers: () => {}, isMobile: true, hasMapAccess: true,
    }));
    for (const label of ['العسكري', 'خطوط وجبهات', 'الطيران', 'البحر والفضاء', 'الأحداث', 'الكل',
      'التجارية', 'مناطق النفوذ والمعالم', 'نشاط جوي عسكري عام', 'كل الأقمار الصناعية', 'الرياح', 'الأمطار']) {
      expect(html).toContain(label);
    }
    expect(html.match(/aria-label="التجارية"/g)).toHaveLength(1);
    expect(html).toContain('aria-disabled="true" aria-pressed="true" aria-label="وقت الرياح"');
  });
});
