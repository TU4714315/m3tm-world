import { describe, expect, it, vi } from 'vitest';
import { configureMaplibreArabicText, RTL_TEXT_PLUGIN_URL, type MapLibreRtlApi } from './maplibreRtl';

function api(status: string = 'unavailable') {
  const mock: MapLibreRtlApi = {
    getVersion: vi.fn(() => '6.7.0'),
    setWorkerUrl: vi.fn(),
    getRTLTextPluginStatus: vi.fn(() => status),
    setRTLTextPlugin: vi.fn(async () => undefined),
  };
  return mock;
}

describe('MapLibre Arabic RTL configuration', () => {
  it('sets the pinned worker before enabling the self-hosted plugin lazily', () => {
    const mock = api();
    configureMaplibreArabicText(mock);
    expect(mock.setWorkerUrl).toHaveBeenCalledWith('/vendor/maplibre/6.7.0/maplibre-gl-worker.mjs');
    expect(mock.setRTLTextPlugin).toHaveBeenCalledWith(RTL_TEXT_PLUGIN_URL, true);
    expect((mock.setWorkerUrl as ReturnType<typeof vi.fn>).mock.invocationCallOrder[0])
      .toBeLessThan((mock.setRTLTextPlugin as ReturnType<typeof vi.fn>).mock.invocationCallOrder[0]);
  });

  it.each(['deferred', 'loading', 'loaded'])('does not configure the plugin twice when status is %s', status => {
    const mock = api(status);
    configureMaplibreArabicText(mock);
    expect(mock.setWorkerUrl).toHaveBeenCalledOnce();
    expect(mock.setRTLTextPlugin).not.toHaveBeenCalled();
  });
});
