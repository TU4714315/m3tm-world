import { readFileSync } from 'node:fs';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import LayerPanel from './LayerPanel';

const source = readFileSync(new URL('./LayerPanel.tsx', import.meta.url), 'utf8');

describe('WORLD layer activation visual cue', () => {
  it('never shows a synthetic loading cue until a user activates a layer', () => {
    const html = renderToStaticMarkup(createElement(LayerPanel, {
      data: { commercial_flights: [{ id: 1 }] }, activeLayers: { flights: false },
      setActiveLayers: vi.fn(), isMobile: true,
    }));
    expect(html).not.toContain('جاري جلب بيانات');
    expect(source).toContain('if (activeLayers[key]) clearActivationHint(key);');
    expect(source).toContain('else showActivationHint(key);');
    expect(source).toContain('setActivationHints(previous => ({ ...previous, [key]: true }))');
  });

  it('expires at five seconds and cancels immediately if switched off', () => {
    expect(source).toContain('}, 5_000);');
    expect(source).toContain('clearTimeout(activationTimers.current[key]);');
    expect(source).toContain('delete activationTimers.current[key];');
  });

  it('uses one shared visual state on mobile and desktop including group activation', () => {
    expect(source).toContain('const layerObservationState = (key: string): string | null');
    expect(source.match(/layerObservationState\(layer.key\)/g)).toHaveLength(2);
    expect(source).toContain('if (enabled && !activeLayers[layer.key]) showActivationHint(layer.key);');
    expect(source).toContain('if (!enabled && activeLayers[layer.key]) clearActivationHint(layer.key);');
  });

  it('omits failure and outdated banners without altering provider diagnostics', () => {
    expect(source).not.toContain('بيانات سابقة · تعذر التحديث');
    expect(source).not.toContain('تعذر جلب المصدر');
    expect(source).toContain('endpointStatus[endpoint]');
    expect(source).toContain("data?.source_errors?.[key]");
    expect(source).not.toContain('fetchEndpoint(');
  });
});