import { describe, expect, it } from 'vitest';
import { isPublicConflictRegion, scopePublicConflictEvents, scopePublicContextZones } from './publicConflictRegion';

describe('M3TM region-scoped public conflicts', () => {
  it('covers the explicit Middle East, Iran, Sudan and Horn of Africa focus', () => {
    expect(isPublicConflictRegion(15.5, 48)).toBe(true); // Yemen
    expect(isPublicConflictRegion(32.4, 53.7)).toBe(true); // Iran
    expect(isPublicConflictRegion(15.6, 32.5)).toBe(true); // Sudan
    expect(isPublicConflictRegion(9.1, 40.5)).toBe(true); // Ethiopia
    expect(isPublicConflictRegion(2.1, 45.3)).toBe(true); // Somalia
    expect(isPublicConflictRegion(11.5, 43.1)).toBe(true); // Djibouti
    expect(isPublicConflictRegion(27.0, 30.0)).toBe(true); // Egypt
  });
  it('filters unrelated worldwide zones without generating fake points', () => {
    expect(isPublicConflictRegion(48.5,31.2)).toBe(false); // Ukraine
    expect(isPublicConflictRegion(19.5,96.5)).toBe(false); // Myanmar
    expect(isPublicConflictRegion(0,0)).toBe(false);
    expect(isPublicConflictRegion(Number.NaN,40)).toBe(false);
    expect(scopePublicContextZones([{id:'ukraine'}, {id:'gaza'}, {id:'sudan'}, {id:'myanmar'}, {id:'ethiopia'}]))
      .toEqual([{id:'gaza'}, {id:'sudan'}, {id:'ethiopia'}]);
    expect(scopePublicConflictEvents([{lat:15,lng:48,id:'y'}, {lat:48.5,lng:31.2,id:'u'}]))
      .toEqual([{lat:15,lng:48,id:'y'}]);
  });
});
