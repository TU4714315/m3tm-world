type RtlPluginStatus = 'unavailable' | 'deferred' | 'requested' | 'loading' | 'loaded' | 'error' | string;

export type MapLibreRtlApi = {
  getVersion(): string;
  setWorkerUrl(url: string): void;
  getRTLTextPluginStatus(): RtlPluginStatus;
  setRTLTextPlugin(url: string, lazy: boolean): Promise<void>;
};

export const RTL_TEXT_PLUGIN_URL = '/vendor/maplibre/rtl-text-0.3.0.js';

/**
 * Configure MapLibre 6.x Arabic shaping without blocking initial map paint.
 *
 * The previous eager (`lazy=false`) rollout could stall the map canvas while
 * workers were starting. MapLibre 6.7 explicitly supports deferred RTL loading:
 * the map paints normally, then the worker imports the self-hosted shaping
 * plugin only after it encounters RTL text.
 */
export function configureMaplibreArabicText(api: MapLibreRtlApi): void {
  // Set the module worker first so the deferred plugin state is broadcast to
  // the same worker implementation used by the map instance.
  api.setWorkerUrl(`/vendor/maplibre/${api.getVersion()}/maplibre-gl-worker.mjs`);

  const status = api.getRTLTextPluginStatus();
  // MapLibre 6.7 keeps the configured plugin URL after an import error and its
  // public `setRTLTextPlugin()` rejects a second registration in the same JS
  // session. Do not turn a transient import failure into a remount loop; a
  // normal page reload recreates the module state and attempts the lazy import
  // again. `requested` is safe because no URL has been registered yet.
  if (status !== 'unavailable' && status !== 'requested') return;

  void api.setRTLTextPlugin(RTL_TEXT_PLUGIN_URL, true).catch(error => {
    console.warn('[M3TM.WORLD] Arabic map text shaping unavailable:', error);
  });
}
