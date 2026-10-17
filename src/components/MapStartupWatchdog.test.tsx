import { describe, expect, it } from 'vitest';
import { isMapStartupDelayDue } from './MapStartupWatchdog';

describe('WORLD first-map-ready watchdog policy', () => {
  it('never marks a successfully initialized map delayed', () => {
    expect(isMapStartupDelayDue(true, true, 120_000, 45_000)).toBe(false);
  });
  it('starts only after the visible-tab grace period', () => {
    expect(isMapStartupDelayDue(false, true, 44_999, 45_000)).toBe(false);
    expect(isMapStartupDelayDue(false, true, 45_000, 45_000)).toBe(true);
  });
  it('does not penalize background browser tabs', () => {
    expect(isMapStartupDelayDue(false, false, 180_000, 45_000)).toBe(false);
  });
});
