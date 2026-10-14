import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const ticker = readFileSync(new URL('./GlobalStatusBar.tsx', import.meta.url), 'utf8');
const css = readFileSync(new URL('../app/globals.css', import.meta.url), 'utf8');
const page = readFileSync(new URL('../app/page.tsx', import.meta.url), 'utf8');

describe('WORLD mobile ticker and uncluttered glass controls', () => {
  it('keeps the public ticker accessible on phones with an honest empty state', () => {
    expect(ticker).toContain('className="world-news-ticker');
    expect(ticker).not.toContain("'hidden md:block'");
    expect(ticker).toContain('لا توجد عناوين حديثة متاحة الآن');
    expect(css).toContain('.world-news-ticker {');
    expect(css).toContain('safe-area-inset-bottom');
  });
  it('folds dense secondary HUD controls on phones', () => {
    expect(page).toContain('showMobileHudDetails');
    expect(page).toContain('(!isMobile || showMobileHudDetails)');
    expect(page).toContain('world-mobile-drawer');
  });
});
