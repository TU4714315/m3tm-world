import { describe, expect, it } from 'vitest';
import { HEADLINE_SCROLL_SECONDS, tickerLoopSeconds } from './ticker-pacing';

describe('public ticker pacing', () => {
  it('uses an seven-and-a-half-second interval per published headline', () => {
    expect(HEADLINE_SCROLL_SECONDS).toBe(7.5);
    expect(tickerLoopSeconds(2)).toBe(15);
    expect(tickerLoopSeconds(5)).toBe(37.5);
    expect(tickerLoopSeconds(10)).toBe(75);
  });
  it('keeps sparse feeds readable', () => {
    expect(tickerLoopSeconds(1)).toBe(12);
    expect(tickerLoopSeconds(0)).toBe(12);
  });
});
