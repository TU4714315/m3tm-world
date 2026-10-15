import { describe, expect, it } from 'vitest';
import { publishedAreaAffiliation, publishedEquipmentSymbol } from './publishedMapPresentation';
describe('published map symbols', () => {
  it('maps named Yemen actors without collapsing other factions into government', () => {
    expect(publishedAreaAffiliation('AnsarAllah in Taiz')).toBe('houthi');
    expect(publishedAreaAffiliation('Hadi - Saudi Coalition in Aden')).toBe('government');
    expect(publishedAreaAffiliation('Southerners - STC in al Mahrah')).toBe('other');
  });
  it('does not invent equipment at cities, airports or generic military bases', () => {
    expect(publishedEquipmentSymbol('San`a')).toBeNull();
    expect(publishedEquipmentSymbol('Anad Air Base')).toBe('airfield');
    expect(publishedEquipmentSymbol('35th Armored Brigade Base')).toBe('base');
    expect(publishedEquipmentSymbol('Tank storage')).toBe('tank');
    expect(publishedEquipmentSymbol('Radar site')).toBe('radar');
    expect(publishedEquipmentSymbol('Airport square')).toBeNull();
  });
});
