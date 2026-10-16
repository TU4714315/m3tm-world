import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import PriorityNewsCards from './PriorityNewsCards';
import GlobalStatusBar from './GlobalStatusBar';

const story = (extra = {}) => ({
  id: 'story', title: 'عنوان منشور واضح', source: 'ناشر الخبر',
  link: 'https://news.org/story', risk_score: 1,
  published: new Date(Date.now() - 13 * 3_600_000).toISOString(), ...extra,
});
const cards = (items: unknown, restricted = false) => renderToStaticMarkup(createElement(PriorityNewsCards, { items, restricted, onLocate: vi.fn() }));
const ticker = (news: ReturnType<typeof story>[]) => renderToStaticMarkup(createElement(GlobalStatusBar, { news }));

describe('shared glass news presentation', () => {
  it('uses the same transparent glass treatment and newspaper icon on both surfaces', () => {
    for (const html of [cards([story()]), ticker([story()])]) {
      expect(html).toContain('bg-white/[0.035]');
      expect(html).toContain('border-white/15');
      expect(html).toContain('backdrop-blur-xl');
      expect(html).toContain('lucide-newspaper');
      expect(html).not.toContain('bg-[#172333]');
      expect(html).not.toContain('bg-[#0a0a0f]');
    }
  });
  it('never promotes a high risk score to a breaking badge or urgency color', () => {
    for (const html of [cards([story({ risk_score: 10 })]), ticker([story({ risk_score: 10 })])]) {
      expect(html).not.toContain('عاجل');
      expect(html).not.toContain('#FF4D4D');
      expect(html).not.toContain('#FF9500');
    }
  });
  it('uses explicit publisher flags and breaking prefixes for the red badge', () => {
    for (const extra of [{ breaking: true }, { isBreaking: true }, { urgency: 'breaking' }, { title: 'عاجل: خبر منشور' }, { title: 'BREAKING: Published report' }]) {
      for (const html of [cards([story(extra)]), ticker([story(extra)])]) {
        expect(html).toContain('>عاجل</span>');
        expect(html).toContain('text-[#FF4D4D]');
      }
    }
  });
  it('keeps card headlines plain and makes the publisher the only source link', () => {
    const html = cards([story({ title: '<b>عنوان واضح</b> &amp; تفاصيل' })]);
    expect(html).toMatch(/<h4[^>]*>عنوان واضح &amp; تفاصيل<\/h4>/);
    expect(html.match(/<a\b/g)).toHaveLength(1);
    expect(html).toMatch(/<a[^>]+href="https:\/\/news.org\/story"[^>]*>ناشر الخبر<\/a>/);
    expect(html).not.toContain('<b>');
  });
  it('gives each ticker copy one publisher link, with only the first copy in the tab order', () => {
    const html = ticker([story()]);
    expect(html.match(/href="https:\/\/news.org\/story"/g)).toHaveLength(4);
    expect(html.match(/aria-label="المصدر: ناشر الخبر"/g)).toHaveLength(1);
    expect(html.match(/tabindex="-1"/g)).toHaveLength(3);
    expect(html).toContain('focus-within:[animation-play-state:paused]');
    expect(html).toContain('motion-reduce:animate-none');
    expect(html).toContain('motion-reduce:overflow-x-auto');
  });
  it('preserves decoded ticker text without creating markup from publisher HTML', () => {
    const html = ticker([story({ title: '&#x639;&#x627;&#x62c;&#x644;: &lt;b&gt;خبر&lt;/b&gt; &amp; تفاصيل' })]);
    expect(html).toContain('عاجل: خبر &amp; تفاصيل');
    expect(html).toContain('text-[#FF4D4D]');
    expect(html).not.toContain('<b>');
  });
  it('renders unsafe publisher URLs as text without an external link', () => {
    for (const link of ['javascript:alert(1)', 'https://user:test-only@example.org/story', 'http://127.0.0.1/story']) {
      const card = cards([story({ link })]);
      const bar = ticker([story({ link })]);
      expect(card).not.toContain('<a ');
      expect(bar).not.toContain('aria-label="المصدر:');
      expect(card).toContain('ناشر الخبر');
      expect(bar).toContain('ناشر الخبر');
    }
  });
  it('retains ticker currentness windows and score ordering without archival padding', () => {
    const html = ticker([
      story({ id: 'archive', title: 'ARCHIVE_HIGH_SCORE', risk_score: 10, published: new Date(Date.now() - 8 * 24 * 3_600_000).toISOString() }),
      story({ id: 'fresh-low', title: 'FRESH_LOW_SCORE', risk_score: 1 }),
      story({ id: 'fresh-high', title: 'FRESH_HIGH_SCORE', risk_score: 8 }),
      story({ id: 'future', title: 'UNPUBLISHED_FUTURE', published: new Date(Date.now() + 2 * 3_600_000).toISOString() }),
    ]);
    expect(html).not.toContain('ARCHIVE_HIGH_SCORE');
    expect(html).not.toContain('UNPUBLISHED_FUTURE');
    expect(html.indexOf('FRESH_HIGH_SCORE')).toBeLessThan(html.indexOf('FRESH_LOW_SCORE'));
  });
  it('keeps locked cards synthetic while sharing the glass surface', () => {
    const html = cards([story({ title: 'PRIVATE_HEADLINE' })], true);
    expect(html).toContain('bg-white/[0.035]');
    expect(html).toContain('كود الدعوة');
    expect(html).not.toContain('PRIVATE_HEADLINE');
    expect(html).not.toContain('https://news.org/story');
  });
});
