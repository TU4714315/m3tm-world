import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import WorldBrandMark from '../components/WorldBrandMark';
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('WORLD public defaults and branding', () => {
  const page = readFileSync(new URL('./page.tsx', import.meta.url), 'utf8');
  const brand = renderToStaticMarkup(createElement(WorldBrandMark));

  it('starts the visible public feeds from the screenshots enabled', () => {
    expect(page).toContain('flights: true, private: false, jets: false');
    expect(page).toContain('sdk_sea: true, sdk_air: false, sdk_naval: true');
    expect(page).toContain('cf_outages: true, cf_attacks: true');
    expect(page).toContain('earthquakes: false, fires: true');
    expect(page).toContain("'cf_outages', 'cf_attacks'");
  });

  it('uses a vector brand mark instead of the raster logo with a white halo', () => {
    expect(page).toContain('<WorldBrandMark variant="hero"');
    expect(page).toContain('<WorldBrandMark variant="header"');
    expect(page).not.toContain('/branding/m3tm-world-logo-transparent.png');
    expect(brand).toContain('<svg');
    expect(brand).toContain('aria-label="M3TM.WORLD"');
    expect(brand).toContain('m3tm-brand-mark__core-shell');
    expect(brand).toContain('data-animated="false"');
    expect(brand).not.toContain('مصادر منشورة');
    expect(brand).not.toContain('<img');
    expect(brand).not.toContain('<rect');
  });

  it('reuses public map data between unrelated UI renders but invalidates on access/payload changes', () => {
    expect(page).toContain('const data = useMemo(');
    expect(page).toContain('() => hasMapAccess ? dataRef.current : publicMapClientProjection(dataRef.current)');
    expect(page).toContain('[hasMapAccess, dataVersion]');
    expect(page).toContain('setDataVersion(v => v + 1)');
    expect(page).not.toContain('const data = hasMapAccess ? dataRef.current : publicMapClientProjection(dataRef.current);');
  });

  it('keeps operational explanations collapsed in the public map chrome', () => {
    expect(page).toContain('دليل الرموز ▾');
    expect(page).not.toContain('open={!isMobile}');
  });
});
