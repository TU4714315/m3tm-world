export type FlightSummary = {
  status: 'operational' | 'degraded';
  counts: {
    commercial: number;
    private: number;
    jets: number;
    public_total: number;
  };
  civilian_activity: {
    cells: number;
    fallback_active: boolean;
  };
  military_activity: {
    cells: number;
    mode: string;
    exact_tracks_exposed: false;
    identifiers_exposed: false;
  };
  source: string | null;
  providers: Record<string, unknown>;
  timestamp: string | null;
};

const count = (value: unknown) => Array.isArray(value) ? value.length : 0;

export function buildFlightSummary(data: any): FlightSummary {
  const commercial = count(data?.commercial_flights);
  const privateFlights = count(data?.private_flights);
  const jets = count(data?.private_jets);
  const publicTotal = commercial + privateFlights + jets;
  const sourceStatus = String(data?.flight_source_status?.status || '');
  const source = typeof data?.source === 'string' ? data.source : null;
  const civilianMeta = data?.civilian_flight_activity_meta || {};
  const militaryMeta = data?.military_activity_meta || {};
  const stale = Boolean(source && source.endsWith('+stale')) ||
    civilianMeta.fallback_active === true ||
    militaryMeta.stale_fallback === true ||
    sourceStatus === 'degraded';

  return {
    status: !stale && sourceStatus === 'active' ? 'operational' : 'degraded',
    counts: {
      commercial,
      private: privateFlights,
      jets,
      public_total: publicTotal,
    },
    civilian_activity: {
      cells: count(data?.civilian_flight_activity),
      fallback_active: civilianMeta.fallback_active === true,
    },
    military_activity: {
      cells: count(data?.military_activity),
      mode: String(militaryMeta.mode || 'coarse-regional-aggregate'),
      exact_tracks_exposed: false,
      identifiers_exposed: false,
    },
    source,
    providers:
      data?.flight_source_status?.providers && typeof data.flight_source_status.providers === 'object'
        ? data.flight_source_status.providers
        : data?.providers && typeof data.providers === 'object'
          ? data.providers
          : {},
    timestamp: typeof data?.timestamp === 'string' ? data.timestamp : null,
  };
}


/** A failed refresh must not keep process-cached regional ADS-B cells marked
 * live or re-issue a previous aggregate trend as a fresh observation. */
export function markCachedFlightDataStale<T extends Record<string, any>>(
  data: T, now = Date.now(),
): T {
  const origin = String(data.source || 'unknown');
  const source = origin.endsWith('+stale') ? origin : origin + '+stale';
  const cells = Array.isArray(data.military_activity) ? data.military_activity : [];
  const civilianCells = Array.isArray(data.civilian_flight_activity) ? data.civilian_flight_activity : [];
  const ageCell = (cell: Record<string, unknown>) => {
    const observed = typeof cell.observed_at === 'string' ? Date.parse(cell.observed_at) : NaN;
    const age_seconds = Number.isFinite(observed) && observed <= now
      ? Math.floor((now - observed) / 1000)
      : null;
    return { ...cell, data_state: 'cached-stale', age_seconds };
  };
  return {
    ...data,
    source,
    civilian_flight_activity: civilianCells.map(ageCell),
    civilian_flight_activity_meta: {
      ...(data.civilian_flight_activity_meta || {}),
      fallback_active: civilianCells.length > 0 || data.civilian_flight_activity_meta?.fallback_active === true,
      data_state: 'cached-stale',
    },
    // Preserve the original source timestamp and cell date; age the cells
    // rather than manufacturing a new sample timestamp.
    military_activity: cells.map((cell: Record<string, unknown>) => ({
      ...ageCell(cell),
      trend: undefined,
    })),
    military_activity_meta: {
      ...(data.military_activity_meta || {}),
      stale_fallback: true,
      // This is a cache, not evidence that the provider is healthy now.
      provider_healthy: false,
    },
    flight_source_status: {
      ...(data.flight_source_status || {}),
      status: 'degraded',
    },
  } as T;
}
