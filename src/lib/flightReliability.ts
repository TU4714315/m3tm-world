export type FlightProviderReachability = 'reachable' | 'degraded' | 'unreachable' | 'not_probed';

export type FlightFailureClass =
  | 'http_error'
  | 'public_total_zero'
  | 'live_provider_degraded'
  | 'insufficient_live_sample'
  | 'probe_exception'
  | null;

export function hasUsableCivilianFlightData(input: {
  publicTotal: number | null;
  fallbackActive: boolean;
  minimumLiveTotal?: number;
}): boolean {
  const minimumLiveTotal = Math.max(1, Math.floor(input.minimumLiveTotal ?? 100));
  const publicTotal = Number.isFinite(Number(input.publicTotal)) ? Number(input.publicTotal) : 0;
  return input.fallbackActive || publicTotal >= minimumLiveTotal;
}

export function classifyFlightProviderHealth(input: {
  httpOk: boolean;
  status?: string | null;
  publicTotal: number | null;
  fallbackActive: boolean;
}): {
  reachability: Exclude<FlightProviderReachability, 'not_probed'>;
  failureClass: FlightFailureClass;
} {
  if (!input.httpOk) {
    return { reachability: 'unreachable', failureClass: 'http_error' };
  }
  if (input.status === 'operational' && (input.publicTotal ?? 0) > 0) {
    return { reachability: 'reachable', failureClass: null };
  }
  if (input.fallbackActive) {
    return { reachability: 'degraded', failureClass: 'live_provider_degraded' };
  }
  if (input.publicTotal === 0) {
    return { reachability: 'degraded', failureClass: 'public_total_zero' };
  }
  if (input.status === 'degraded' && (input.publicTotal ?? 0) > 0) {
    return { reachability: 'degraded', failureClass: 'insufficient_live_sample' };
  }
  return { reachability: 'unreachable', failureClass: 'probe_exception' };
}

export async function retryFlightLayerLoad(
  fetchOnce: () => Promise<boolean>,
  isUsable: () => boolean,
  options: {
    attempts?: number;
    retryDelaysMs?: number[];
    wait?: (ms: number) => Promise<void>;
  } = {},
): Promise<boolean> {
  const attempts = Math.max(1, Math.floor(options.attempts ?? 3));
  const retryDelaysMs = options.retryDelaysMs ?? [5000, 10000];
  const wait = options.wait ?? ((ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms)));

  for (let attempt = 0; attempt < attempts; attempt += 1) {
    let fetched = false;
    try {
      fetched = await fetchOnce();
    } catch {
      fetched = false;
    }
    if (fetched && isUsable()) return true;
    if (attempt >= attempts - 1) break;
    const delay = retryDelaysMs[Math.min(attempt, Math.max(0, retryDelaysMs.length - 1))] ?? 0;
    if (delay > 0) await wait(delay);
  }
  return false;
}
