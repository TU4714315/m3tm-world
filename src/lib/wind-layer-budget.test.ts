import { describe, expect, it } from 'vitest';
import { windParticleBudget } from './wind-layer';

describe('wind particle memory budget', () => {
  it('never exceeds the 5,000-particle limit even at extreme density', () => {
    expect(windParticleBudget(3840, 2160, 4)).toBe(5000);
    expect(windParticleBudget(3840, 2160, 100)).toBe(5000);
  });

  it('allows low density and does not allocate for zero density', () => {
    expect(windParticleBudget(500, 500, 0)).toBe(0);
    expect(windParticleBudget(500, 500, 0.5)).toBe(300);
    expect(windParticleBudget(500, 500, Number.NaN)).toBe(600);
  });
});
