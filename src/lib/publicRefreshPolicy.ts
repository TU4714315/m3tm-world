/** Public UI refresh intervals, not evidence publication timestamps.
 * The reference atlas now enforces collector-only source access. Other heavy
 * endpoints retain their own server-side policies until separately migrated;
 * changing the UI interval alone never guarantees zero upstream requests. */
export const PUBLIC_MAP_SNAPSHOT_INTERVAL_MS = 12 * 60 * 60_000;
export const PUBLIC_REFRESH_MS = {
  newsTicker: 60_000,
  markets: PUBLIC_MAP_SNAPSHOT_INTERVAL_MS,
  internetObservations: PUBLIC_MAP_SNAPSHOT_INTERVAL_MS,
  menaPublishedEvents: PUBLIC_MAP_SNAPSHOT_INTERVAL_MS,
  militaryRegionalFlightAggregate: PUBLIC_MAP_SNAPSHOT_INTERVAL_MS,
  civilianFlightsOnDemand: PUBLIC_MAP_SNAPSHOT_INTERVAL_MS,
  worldwidePublishedFrontlines: PUBLIC_MAP_SNAPSHOT_INTERVAL_MS,
  referenceAtlasCheck: PUBLIC_MAP_SNAPSHOT_INTERVAL_MS,
  africanNeighboringConflictArchive: PUBLIC_MAP_SNAPSHOT_INTERVAL_MS,
  ukraineConflictArchive: PUBLIC_MAP_SNAPSHOT_INTERVAL_MS,
  commercialMaritime: PUBLIC_MAP_SNAPSHOT_INTERVAL_MS,
  submarineCableReference: PUBLIC_MAP_SNAPSHOT_INTERVAL_MS,
  publicSatelliteCatalog: PUBLIC_MAP_SNAPSHOT_INTERVAL_MS,
  cyberThreatSummary: PUBLIC_MAP_SNAPSHOT_INTERVAL_MS,
} as const;

/**
 * Severity is a provider-derived malware-family heuristic, NOT proof of an
 * attack or attribution to a country. Display only the highest rated public
 * infrastructure indicators, avoiding repeated synthetic arcs.
 */
export const DAILY_PUBLIC_MAP_PATHS = new Set([
  '/api/reference-atlas', '/api/flights', '/api/fires', '/api/satellites',
  '/api/maritime', '/api/gdelt', '/api/gdelt-events', '/api/conflicts',
  '/api/frontlines', '/api/cloudflare-radar', '/api/markets',
]);

export function isDailyPublicMapPath(url: string): boolean {
  return DAILY_PUBLIC_MAP_PATHS.has(url.split('?')[0]);
}

export function canRefreshDailyPublicMapPath(url: string, previousSuccessAt: number | undefined, now = Date.now()): boolean {
  if (!isDailyPublicMapPath(url) || previousSuccessAt === undefined) return true;
  return now - previousSuccessAt >= PUBLIC_MAP_SNAPSHOT_INTERVAL_MS || now < previousSuccessAt;
}

export function significantCyberIndicators(
  raw: unknown,
  maximum = 10,
): Array<Record<string, unknown>> {
  if (!Array.isArray(raw) || !Number.isInteger(maximum) || maximum < 1) return [];
  return raw
    .filter((item): item is Record<string, unknown> =>
      item !== null && typeof item === 'object'
      && Number.isFinite(Number((item as Record<string, unknown>).severity))
      && Number((item as Record<string, unknown>).severity) >= 8)
    .sort((a, b) => Number(b.severity) - Number(a.severity))
    .slice(0, maximum);
}
