import { describe, expect, it } from 'vitest';
import { isMapStartupDelayDue, remainingVisibleStartupMs } from './MapStartupWatchdog';

describe('WORLD first-map-ready watchdog policy', () => {
  it('never marks a successfully initialized map delayed', () => {
    expect(isMapStartupDelayDue(true, true, 120_000, 45_000)).toBe(false);
  });
  it('starts only after the visible-tab grace period', () => {
    expect(isMapStartupDelayDue(false, true, 44_999, 45_000)).toBe(false);
    expect(isMapStartupDelayDue(false, true, 45_000, 45_000)).toBe(true);
  });
  it('resumes the remaining delay after backgrounding instead of restarting a full timeout', () => {
    expect(remainingVisibleStartupMs(45_000, 44_000)).toBe(1000);
    expect(remainingVisibleStartupMs(45_000, 45_000)).toBe(0);
    expect(remainingVisibleStartupMs(45_000, 0)).toBe(45_000);
  });
  it('does not penalize background browser tabs', () => {
    expect(isMapStartupDelayDue(false, false, 180_000, 45_000)).toBe(false);
  });
});
