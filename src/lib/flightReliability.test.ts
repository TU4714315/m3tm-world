import { describe, expect, it, vi } from 'vitest';
import { classifyFlightProviderHealth, retryFlightLayerLoad } from './flightReliability';

describe('flight reliability policy', () => {
  it('marks a layer fetched only after a usable response and bounds retries', async () => {
    const fetchOnce = vi.fn()
      .mockResolvedValueOnce(false)
      .mockResolvedValueOnce(true)
      .mockResolvedValueOnce(true);
    const states = ['empty', 'empty', 'degraded'];
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
      httpOk: false, status: null, publicTotal: null, fallbackActive: false,
    })).toEqual({ reachability: 'unreachable', failureClass: 'http_error' });
  });
});
