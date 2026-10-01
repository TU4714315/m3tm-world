export type FlightSummary = {
  status: 'operational' | 'degraded';
  counts: {
    commercial: number;
    private: number;
    jets: number;
    public_total: number;
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
  const militaryMeta = data?.military_activity_meta || {};

  return {
    status: sourceStatus === 'active' || publicTotal > 0 ? 'operational' : 'degraded',
    counts: {
      commercial,
      private: privateFlights,
      jets,
      public_total: publicTotal,
    },
    military_activity: {
      cells: count(data?.military_activity),
      mode: String(militaryMeta.mode || 'coarse-regional-aggregate'),
      exact_tracks_exposed: false,
      identifiers_exposed: false,
    },
    source: typeof data?.source === 'string' ? data.source : null,
    providers:
      data?.flight_source_status?.providers && typeof data.flight_source_status.providers === 'object'
        ? data.flight_source_status.providers
        : data?.providers && typeof data.providers === 'object'
          ? data.providers
          : {},
    timestamp: typeof data?.timestamp === 'string' ? data.timestamp : null,
  };
}
