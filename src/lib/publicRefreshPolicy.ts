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
