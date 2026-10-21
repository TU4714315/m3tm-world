import { afterEach, describe, expect, it, vi } from 'vitest';
import { createPublicDailySnapshot } from './publicDailySnapshot';

describe('daily public snapshot cache', () => {
  afterEach(() => vi.useRealTimers());
  it('serves one upstream response to multiple visitors across a day', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-21T00:00:00Z'));
    const cache = createPublicDailySnapshot<{ events: number[] }>();
    const loader = vi.fn(async () => ({ events: [1, 2] }));
    const one = await cache(loader);
    expect(one.value.events).toEqual([1, 2]);
    vi.advanceTimersByTime(24 * 60 * 60_000 - 1);
    expect((await cache(loader)).fetchedAt).toBe(one.fetchedAt);
    expect(loader).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(1);
    await cache(loader);
    expect(loader).toHaveBeenCalledTimes(2);
  });
  it('coalesces concurrent cold requests and never caches an initial failure as success', async () => {
    const cache = createPublicDailySnapshot<number>();
    let release: (value: number) => void = () => {};
    const loader = vi.fn(() => new Promise<number>(resolve => { release = resolve; }));
    const a = cache(loader);
    const b = cache(loader);
    expect(loader).toHaveBeenCalledTimes(1);
    release(4);
    expect((await a).value).toBe(4);
    expect((await b).value).toBe(4);
  });
  it('keeps last-good observations with original fetch time after a provider failure', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-21T00:00:00Z'));
    const cache = createPublicDailySnapshot<{ observations: number[] }>();
    const first = await cache(async () => ({ observations: [1] }));
    vi.advanceTimersByTime(24 * 60 * 60_000 + 1);
    const error = vi.fn(async (): Promise<{ observations: number[] }> => { throw new Error('provider down'); });
    const retained = await cache(error);
    expect(retained.retained).toBe(true);
    expect(retained.fetchedAt).toBe(first.fetchedAt);
    await cache(error);
    expect(error).toHaveBeenCalledTimes(1);
  });
});
