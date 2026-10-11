import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('WORLD public defaults and branding', () => {
  const page = readFileSync(new URL('./page.tsx', import.meta.url), 'utf8');
  const brand = readFileSync(new URL('../components/WorldBrandMark.tsx', import.meta.url), 'utf8');

  it('starts the visible public feeds from the screenshots enabled', () => {
    expect(page).toContain('flights: false, private: false, jets: false');
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
    expect(brand).toContain('bg-transparent');
    expect(brand).toContain('بيانات عالمية · مصادر منشورة · عرض حي');
    expect(brand).toContain('{hero && (');
    expect(brand).toContain('ellipse');
    expect(brand).toContain('m3tm-gold');
    expect(brand).not.toContain('<img');
    expect(brand).not.toContain('<rect');
  });

  it('keeps operational explanations collapsed in the public map chrome', () => {
    expect(page).toContain('دليل الرموز ▾');
    expect(page).not.toContain('open={!isMobile}');
  });
});
