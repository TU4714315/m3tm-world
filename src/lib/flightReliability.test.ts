import { describe, expect, it, vi } from 'vitest';
import { classifyFlightProviderHealth, hasUsableCivilianFlightData, retryFlightLayerLoad } from './flightReliability';

describe('flight reliability policy', () => {
  it('marks a layer fetched only after a usable response and bounds retries', async () => {
    const fetchOnce = vi.fn()
      .mockResolvedValueOnce(false)
      .mockResolvedValueOnce(true)
      .mockResolvedValueOnce(true);
    const states = ['empty', 'degraded'];
    const wait = vi.fn(async () => undefined);

    const usable = await retryFlightLayerLoad(
      fetchOnce,
      () => states.shift() !== 'empty',
      { attempts: 3, retryDelaysMs: [5, 10], wait },
    );

    expect(usable).toBe(true);
    expect(fetchOnce).toHaveBeenCalledTimes(3);
    expect(wait).toHaveBeenNthCalledWith(1, 5);
    expect(wait).toHaveBeenNthCalledWith(2, 10);
  });

  it('returns false after the bounded attempt budget', async () => {
    const fetchOnce = vi.fn(async () => false);
    const wait = vi.fn(async () => undefined);

    const usable = await retryFlightLayerLoad(
      fetchOnce,
      () => false,
      { attempts: 3, retryDelaysMs: [1, 2], wait },
    );

    expect(usable).toBe(false);
    expect(fetchOnce).toHaveBeenCalledTimes(3);
    expect(wait).toHaveBeenCalledTimes(2);
  });

  it('classifies provider reachability without inferring healthy data from an HTTP 200', () => {
    expect(classifyFlightProviderHealth({
      httpOk: true, status: 'operational', publicTotal: 1200, fallbackActive: false,
    })).toEqual({ reachability: 'reachable', failureClass: null });

    expect(classifyFlightProviderHealth({
      httpOk: true, status: 'degraded', publicTotal: 0, fallbackActive: true,
    })).toEqual({ reachability: 'degraded', failureClass: 'live_provider_degraded' });

    expect(classifyFlightProviderHealth({
      httpOk: true, status: 'degraded', publicTotal: 0, fallbackActive: false,
    })).toEqual({ reachability: 'degraded', failureClass: 'public_total_zero' });

    expect(classifyFlightProviderHealth({
      httpOk: true, status: 'degraded', publicTotal: 42, fallbackActive: false,
    })).toEqual({ reachability: 'degraded', failureClass: 'insufficient_live_sample' });

    expect(classifyFlightProviderHealth({
      httpOk: false, status: null, publicTotal: null, fallbackActive: false,
    })).toEqual({ reachability: 'unreachable', failureClass: 'http_error' });
  });

  it('treats only a sufficient live sample or coarse last-good fallback as usable', () => {
    expect(hasUsableCivilianFlightData({ publicTotal: 99, fallbackActive: false })).toBe(false);
    expect(hasUsableCivilianFlightData({ publicTotal: 100, fallbackActive: false })).toBe(true);
    expect(hasUsableCivilianFlightData({ publicTotal: 0, fallbackActive: true })).toBe(true);
  });
});
