/** Public UI refresh intervals. Do not confuse polling with source publication cadence.
 * Heavy providers should be collected once centrally and served from a durable
 * shared cache; these intervals only bound per-visible-tab requests. */
export const PUBLIC_REFRESH_MS = {
  menaPublishedEvents: 60_000,
  militaryRegionalFlightAggregate: 5 * 60_000,
  civilianFlightsOnDemand: 24 * 60 * 60_000,
  worldwidePublishedFrontlines: 24 * 60 * 60_000,
  africanNeighboringConflictArchive: 12 * 60 * 60_000,
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
