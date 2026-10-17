import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const ticker = readFileSync(new URL('./GlobalStatusBar.tsx', import.meta.url), 'utf8');
const css = readFileSync(new URL('../app/globals.css', import.meta.url), 'utf8');
const page = readFileSync(new URL('../app/page.tsx', import.meta.url), 'utf8');

describe('WORLD mobile ticker and uncluttered glass controls', () => {
  it('keeps the public ticker accessible on phones with an honest empty state', () => {
    expect(ticker).toContain('className="world-news-ticker');
    expect(ticker).not.toContain("'hidden md:block'");
    expect(ticker).toContain('لا توجد عناوين منشورة من M3TM.APP');
    expect(css).toContain('.world-news-ticker {');
    expect(css).toContain('safe-area-inset-bottom');
  });
  it('renders news in the internal iframe without stealing APP navigation', () => {
    expect(page).toContain('<GlobalStatusBar news={Array.isArray(data.news) ? data.news : []} embed={embedMode} />');
    expect(page).not.toContain("(!embedMode || embedSurface === 'public') && <GlobalStatusBar");
    expect(ticker).toContain('delay: embed ? 0 : 0.2');
    expect(ticker).not.toContain('href="/docs"');
    expect(css).toContain(".world-news-ticker[data-embed='true']");
    expect(css).toContain('bottom: env(safe-area-inset-bottom, 0px) !important;');
  });
  it('folds dense secondary HUD controls on phones', () => {
    expect(page).toContain('showMobileHudDetails');
    expect(page).toContain('(!isMobile || showMobileHudDetails)');
    expect(page).toContain('world-mobile-drawer');
  });
});
