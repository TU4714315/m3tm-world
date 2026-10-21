/** Public UI refresh intervals. Do not confuse polling with source publication cadence.
 * Heavy providers should be collected once centrally and served from a durable
 * shared cache; these intervals only bound per-visible-tab requests. */
export const PUBLIC_REFRESH_MS = {
  newsTicker: 60_000,
  markets: 24 * 60 * 60_000,
  internetObservations: 24 * 60 * 60_000,
  menaPublishedEvents: 24 * 60 * 60_000,
  militaryRegionalFlightAggregate: 24 * 60 * 60_000,
  civilianFlightsOnDemand: 24 * 60 * 60_000,
  worldwidePublishedFrontlines: 24 * 60 * 60_000,
  referenceAtlasCheck: 24 * 60 * 60_000,
  africanNeighboringConflictArchive: 24 * 60 * 60_000,
  ukraineConflictArchive: 24 * 60 * 60_000,
  commercialMaritime: 24 * 60 * 60_000,
  submarineCableReference: 24 * 60 * 60_000,
  publicSatelliteCatalog: 24 * 60 * 60_000,
  cyberThreatSummary: 24 * 60 * 60_000,
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
  return now - previousSuccessAt >= 24 * 60 * 60_000 || now < previousSuccessAt;
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
