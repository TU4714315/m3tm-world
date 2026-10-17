import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import PriorityNewsCards from './PriorityNewsCards';
import GlobalStatusBar from './GlobalStatusBar';
import LayerPanel from './LayerPanel';
import LiveAlerts from './LiveAlerts';

describe('access-aware public map presentation', () => {
  it('opens on news without inserting earthquake telemetry into the news list', () => {
    const html = renderToStaticMarkup(createElement(LiveAlerts, {
      data: { news: [{ title:'خبر منشور مستقل',source:'ناشر',link:'https://example.org/story' }],
        earthquakes:[{ magnitude:7,place:'QUAKE_TELEMETRY_MUST_BE_SEPARATE',lat:10,lng:20 }] },
      onLocate:vi.fn(),
    }));
    expect(html).toContain('خبر منشور مستقل');
    expect(html).toContain('أهم الأخبار');
    expect(html).toContain('الزلازل');
    expect(html).not.toContain('QUAKE_TELEMETRY_MUST_BE_SEPARATE');
    expect(html).not.toContain('زلزال بقوة');
  });
  it('uses synthetic shapes rather than hidden real news in a restricted card', () => {
    const html = renderToStaticMarkup(createElement(PriorityNewsCards, {
      items: [{ title: 'PRIVATE_UNAPPROVED_HEADLINE', link: 'https://private.example/news', source: 'PRIVATE_SOURCE' }],
      restricted: true, onLocate: vi.fn(), onRequestAccess: vi.fn(),
    }));
    expect(html).toContain('كود الدعوة');
    expect(html).toContain('aria-hidden="true"');
    expect(html).not.toContain('PRIVATE_UNAPPROVED_HEADLINE');
    expect(html).not.toContain('PRIVATE_SOURCE');
    expect(html).not.toContain('private.example');
  });
  it('renders allowed server-provided delayed news without applying the lock placeholder', () => {
    const html = renderToStaticMarkup(createElement(PriorityNewsCards, {
      items: [{ title: 'خبر متاح منشور سابقًا', source: 'ناشر', link: 'https://example.org/report' }], onLocate: vi.fn(),
    }));
    expect(html).toContain('خبر متاح منشور سابقًا');
    expect(html).toContain('https://example.org/report');
    expect(html).not.toContain('كود الدعوة');
  });
  it('keeps published military layers selected and operable without an invitation', () => {
    const props = { data: {}, activeLayers: { military_activity: true, reference_atlas: true, flights: true }, setActiveLayers: vi.fn(), isMobile: true };
    const locked = renderToStaticMarkup(createElement(LayerPanel, props));
    const unlocked = renderToStaticMarkup(createElement(LayerPanel, { ...props, hasMapAccess: true }));
    expect(locked).toMatch(/aria-disabled="false" aria-pressed="true" aria-label="نشاط جوي عسكري عام"/);
    expect(locked).not.toContain(" · كود الدعوة");
    expect(locked).toMatch(/aria-disabled="false" aria-pressed="true" aria-label="التجارية"/);
    expect(unlocked).toMatch(/aria-disabled="false" aria-pressed="true" aria-label="نشاط جوي عسكري عام"/);
  });
  it('separates successful empty field alerts from failed/unfinished API loads', () => {
    const props = { data: { alert_pins: [] }, activeLayers: { alert_pins: true }, setActiveLayers: vi.fn(), isMobile: true };
    const renderState = (status?: 'loading' | 'ok' | 'error') =>
      renderToStaticMarkup(createElement(LayerPanel, { ...props,
        endpointStatus: status ? { '/api/news': status } : {},
      }));
    expect(renderState('ok')).toContain('لا أحداث مؤهلة');
    expect(renderState('error')).toContain('تعذر جلب المصدر');
    expect(renderState('loading')).toContain('جارٍ جلب البيانات');
    expect(renderState()).toContain('لم يُتحقق من المصدر');
    expect(renderToStaticMarkup(createElement(LayerPanel, { ...props,
      activeLayers: { alert_pins: false }, endpointStatus: { '/api/news': 'ok' },
    }))).toContain('متوقفة');
  });

  it('keeps the bottom bar dedicated to news in both standalone and embedded views', () => {
    const news = [{ id: 'public', feed_origin: 'm3tm-app', title: 'خبر عام متاح', source: 'ناشر', risk_score: 1, published: new Date(Date.now() - 13 * 3_600_000).toISOString() }];
    for (const embed of [false, true]) {
      const html = renderToStaticMarkup(createElement(GlobalStatusBar, { news, embed }));
      expect(html).toContain('خبر عام متاح');
      expect(html).not.toContain('/docs');
      expect(html).not.toContain('الوثائق');
      expect(html).not.toContain('إعدادات');
    }
  });
});
