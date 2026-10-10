import { describe, expect, it } from 'vitest';
import { isPublicFireRegion } from './publicFireRegion';

describe('public conflict-region vegetation fire boundary', () => {
  it('accepts Middle East, Gulf, Iran and African regions', () => {
    expect(isPublicFireRegion(24.7, 46.7)).toBe(true); // Saudi Arabia
    expect(isPublicFireRegion(15, 48)).toBe(true); // Yemen
    expect(isPublicFireRegion(35, 51)).toBe(true); // Iran
    expect(isPublicFireRegion(15, 30)).toBe(true); // Sudan
    expect(isPublicFireRegion(-2, 28)).toBe(true); // Central Africa
  });
  it('covers additional active-conflict regions without global wildfire polling', () => {
    expect(isPublicFireRegion(49, 32)).toBe(true); // Ukraine
    expect(isPublicFireRegion(20, 96)).toBe(true); // Myanmar
    expect(isPublicFireRegion(40, -120)).toBe(false); // outside coverage
    expect(isPublicFireRegion(-25, 135)).toBe(false);
    expect(isPublicFireRegion(NaN, 46)).toBe(false);
    expect(isPublicFireRegion('24', 46)).toBe(false);
  });
});
