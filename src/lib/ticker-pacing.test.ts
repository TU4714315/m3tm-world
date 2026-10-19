import { describe, expect, it } from 'vitest';
import { HEADLINE_SCROLL_SECONDS, tickerLoopSeconds } from './ticker-pacing';

describe('public ticker pacing', () => {
  it('uses an approximately four-to-five-second interval per published headline', () => {
    expect(HEADLINE_SCROLL_SECONDS).toBe(4.5);
    expect(tickerLoopSeconds(5)).toBe(22.5);
    expect(tickerLoopSeconds(10)).toBe(45);
  });
  it('keeps sparse feeds readable', () => {
    expect(tickerLoopSeconds(1)).toBe(9);
    expect(tickerLoopSeconds(0)).toBe(9);
  });
});
