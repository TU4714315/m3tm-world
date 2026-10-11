export type CatalogCamera = { id: string | number; [key: string]: unknown };

export type CameraCatalogStatus = {
  /** Provider names are independent sources, not the number of online cameras. */
  sourceNames: string[];
  pendingRegions: string[];
  lastResponseAt: string;
  retriesRemaining: number;
};

/** Partial retries must add cameras, not erase previously loaded regions. */
export function mergeCameraCatalog<T extends { id: string | number }>(previous: T[], incoming: T[]): T[] {
  const merged = new Map(previous.map(camera => [String(camera.id), camera]));
  for (const camera of incoming) merged.set(String(camera.id), camera);
  return [...merged.values()];
}

// MENA cameras become available first; other public regions remain available
// in progressive batches rather than a 40+ provider fan-out on each cold start.
export const CAMERA_INITIAL_REGIONS = ['middle-east', 'westasia', 'asia-live'] as const;
const CAMERA_REGION_BATCH_SIZE = 4;
const CAMERA_BATCH_DELAY_MS = 1_500;
const CAMERA_RETRY_DELAY_MS = 15_000;
const CAMERA_MAX_RETRY_PASSES = 2;

function chunks(items: string[], size: number): string[][] {
  const batches: string[][] = [];
  for (let index = 0; index < items.length; index += size) {
    batches.push(items.slice(index, index + size));
  }
  return batches;
}

/**
 * Preserve worldwide camera coverage while protecting map first paint from
 * the previous ?region=all fetch storm. Only requested regions run upstream
 * fetchers, no more than four per request, with bounded retries and aborts.
 */
export function loadCameraCatalog(
  onBatch: (cameras: CatalogCamera[]) => void,
  onError: () => void,
  onStatus?: (status: CameraCatalogStatus) => void,
) {
  const controller = new AbortController();
  const sources = new Set<string>();
  const remaining = new Set<string>();
  const retry = new Set<string>();
  let lastResponseAt = '';
  let retryPass = 0;

  const status = () => {
    if (controller.signal.aborted) return;
    onStatus?.({
      sourceNames: [...sources],
      pendingRegions: [...new Set([...remaining, ...retry])],
      lastResponseAt,
      retriesRemaining: Math.max(0, CAMERA_MAX_RETRY_PASSES - retryPass),
    });
  };

  const pause = (ms: number) => new Promise<void>(resolve => {
    if (controller.signal.aborted) return resolve();
    const finish = () => {
      clearTimeout(timer);
      controller.signal.removeEventListener('abort', finish);
      resolve();
    };
    const timer = setTimeout(finish, ms);
    controller.signal.addEventListener('abort', finish, { once: true });
  });

  async function loadRegions(regions: string[]) {
    if (!regions.length || controller.signal.aborted) return;
    try {
      const query = new URLSearchParams({ region: regions.join(',') });
      const response = await fetch(`/api/cctv?${query}`, { signal: controller.signal, cache: 'no-store' });
      if (!response.ok) throw new Error(`Camera catalogue HTTP ${response.status}`);
      const data = await response.json();
      if (!Array.isArray(data.cameras)) throw new Error('Invalid camera catalogue');
      if (controller.signal.aborted) return;
      if (data.cameras.length) onBatch(data.cameras);
      const outstanding = new Set<string>(
        Array.isArray(data.pendingRegions)
          ? data.pendingRegions.filter((region: unknown): region is string => typeof region === 'string' && regions.includes(region))
          : data.cameras.length ? [] : regions,
      );
      for (const region of regions) {
        remaining.delete(region);
        if (outstanding.has(region)) retry.add(region);
        else retry.delete(region);
      }
      if (data.sources && typeof data.sources === 'object' && !Array.isArray(data.sources)) {
        for (const name of Object.keys(data.sources)) {
          if (name.length > 0 && name.length < 100) sources.add(name);
        }
      }
      lastResponseAt = typeof data.timestamp === 'string' ? data.timestamp : new Date().toISOString();
    } catch {
      if (controller.signal.aborted) return;
      for (const region of regions) {
        remaining.delete(region);
        retry.add(region);
      }
      onError();
    }
    status();
  }

  void (async () => {
    await loadRegions([...CAMERA_INITIAL_REGIONS]);
    if (controller.signal.aborted) return;

    let allRegions: string[] = [];
    // Index failure is independent from individual CCTV providers. Give the
    // tiny discovery endpoint three attempts with bounded backoff before
    // abandoning this run. Do not pin browser-private cache across releases.
    for (let discoveryAttempt = 0; discoveryAttempt < 3 && !controller.signal.aborted; discoveryAttempt++) {
      try {
        const response = await fetch('/api/cctv?catalog=regions', { signal: controller.signal, cache: 'no-store' });
        if (!response.ok) throw new Error(`Camera regions HTTP ${response.status}`);
        const data = await response.json();
        if (!Array.isArray(data.regions) || data.regions.length === 0) throw new Error('Camera regions unavailable');
        allRegions = [...new Set<string>(
          data.regions.filter((region: unknown): region is string =>
            typeof region === 'string' && /^[a-z-]+$/.test(region)),
        )];
        if (allRegions.length === 0) throw new Error('Camera regions invalid');
        break;
      } catch {
        if (controller.signal.aborted) return;
        onError();
        if (discoveryAttempt < 2) await pause(CAMERA_RETRY_DELAY_MS * (discoveryAttempt + 1));
      }
    }
    if (controller.signal.aborted || allRegions.length === 0) return;

    const initial = new Set<string>(CAMERA_INITIAL_REGIONS);
    const background = allRegions.filter(region => !initial.has(region));
    for (const region of background) remaining.add(region);
    status();
    // Leave the WebGL style/initial data time to paint before warming the full
    // worldwide camera inventory. The delay is cancellable on layer disable.
    await pause(CAMERA_BATCH_DELAY_MS);
    for (const batch of chunks(background, CAMERA_REGION_BATCH_SIZE)) {
      if (controller.signal.aborted) return;
      await loadRegions(batch);
      await pause(CAMERA_BATCH_DELAY_MS);
    }

    for (retryPass = 1; retryPass <= CAMERA_MAX_RETRY_PASSES && retry.size; retryPass++) {
      if (controller.signal.aborted) return;
      await pause(CAMERA_RETRY_DELAY_MS * retryPass);
      const missing = [...retry];
      retry.clear();
      for (const batch of chunks(missing, CAMERA_REGION_BATCH_SIZE)) {
        if (controller.signal.aborted) return;
        await loadRegions(batch);
        await pause(CAMERA_BATCH_DELAY_MS);
      }
    }
    retryPass = CAMERA_MAX_RETRY_PASSES;
    status();
  })();

  return () => controller.abort();
}
