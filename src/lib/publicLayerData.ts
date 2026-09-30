/**
 * Explicit public WORLD data contract. The APP iframe shares this projection
 * with the standalone ?surface=public page. Never spread the full backend
 * payload into a public map: the raw SDK, exact military tracks and internal
 * tools are not public-layer inputs.
 */
type PublicRecord = Record<string, unknown>;
const list = (value: unknown): unknown[] => Array.isArray(value) ? value : [];
const vesselIsMilitary = (value: unknown): boolean => {
  if (typeof value !== 'object' || !value) return false;
  const vessel = value as PublicRecord;
  const label = String(vessel.type || vessel.category || '').toLowerCase();
  return vessel.isMilitary === true || /military|naval|warship/.test(label);
};
const satelliteIsMilitary = (value: unknown): boolean => {
  if (typeof value !== 'object' || !value) return false;
  const satellite = value as PublicRecord;
  return /military|defen[sc]e/i.test(String(satellite.category || satellite.type || ''));
};

const record = (value: unknown): PublicRecord =>
  typeof value === 'object' && value !== null && !Array.isArray(value) ? value as PublicRecord : {};

const finite = (value: unknown): number | null => {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
};

const stringOrNull = (value: unknown): string | null =>
  typeof value === 'string' && value.length ? value : null;

const stringList = (value: unknown): string[] =>
  Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];

const countRecord = (value: unknown): Record<string, number> => {
  const source = record(value);
  const out: Record<string, number> = {};
  for (const [key, raw] of Object.entries(source)) {
    const n = finite(raw);
    if (n !== null && n >= 0) out[key] = n;
  }
  return out;
};

const publicMilitaryActivityCells = (value: unknown) => list(value).flatMap((raw) => {
  const cell = record(raw);
  const lat = finite(cell.lat);
  const lng = finite(cell.lng);
  if (lat === null || lng === null || lat < -90 || lat > 90 || lng < -180 || lng > 180) return [];
  return [{
    id: stringOrNull(cell.id),
    lat,
    lng,
    level: finite(cell.level),
    activity: stringOrNull(cell.activity),
    approximate_count: stringOrNull(cell.approximate_count),
    cell_degrees: finite(cell.cell_degrees),
    precision: stringOrNull(cell.precision),
    time_precision: stringOrNull(cell.time_precision),
    observed_at_bucket: stringOrNull(cell.observed_at_bucket),
    reporting_mode: stringOrNull(cell.reporting_mode),
  }];
});

const publicMilitarySatelliteCells = (value: unknown) => list(value).flatMap((raw) => {
  const cell = record(raw);
  const lat = finite(cell.lat);
  const lng = finite(cell.lng);
  if (lat === null || lng === null || lat < -90 || lat > 90 || lng < -180 || lng > 180) return [];
  return [{
    lat,
    lng,
    level: finite(cell.level),
    activity: stringOrNull(cell.activity),
    approximate_count: stringOrNull(cell.approximate_count),
    average_altitude_band: stringOrNull(cell.average_altitude_band),
    cell_degrees: finite(cell.cell_degrees),
    observed_at_bucket: stringOrNull(cell.observed_at_bucket),
    reporting_mode: stringOrNull(cell.reporting_mode),
  }];
});

const publicMilitaryActivityMeta = (value: unknown) => {
  const meta = record(value);
  return {
    mode: stringOrNull(meta.mode),
    source_mode: stringOrNull(meta.source_mode),
    cell_degrees: finite(meta.cell_degrees),
    minimum_group: finite(meta.minimum_group),
    time_precision: stringOrNull(meta.time_precision),
    identifiers_exposed: meta.identifiers_exposed === true,
    exact_tracks_exposed: meta.exact_tracks_exposed === true,
    unobserved_aircraft_inferred: meta.unobserved_aircraft_inferred === true,
    observation_model: stringOrNull(meta.observation_model),
    absence_semantics: stringOrNull(meta.absence_semantics),
    known_limitations: stringList(meta.known_limitations),
  };
};

const publicFlightSourceStatus = (value: unknown) => {
  const status = record(value);
  const providers = record(status.providers);
  return {
    status: stringOrNull(status.status),
    provider: stringOrNull(status.provider),
    providers: {
      adsbfi_mil: finite(providers.adsbfi_mil),
      adsbfi_regional: finite(providers.adsbfi_regional),
      opensky: finite(providers.opensky),
      opensky_auth: providers.opensky_auth === true,
      opensky_age_s: finite(providers.opensky_age_s),
    },
    military_public_cells: finite(status.military_public_cells),
    exact_military_tracks_exposed: status.exact_military_tracks_exposed === true,
    timestamp: stringOrNull(status.timestamp),
  };
};

const publicMilitarySatelliteMeta = (value: unknown) => {
  const meta = record(value);
  return {
    mode: stringOrNull(meta.mode),
    source_mode: stringOrNull(meta.source_mode),
    cell_degrees: finite(meta.cell_degrees),
    minimum_group: finite(meta.minimum_group),
    time_precision: stringOrNull(meta.time_precision),
    identifiers_exposed: meta.identifiers_exposed === true,
    names_exposed: meta.names_exposed === true,
    exact_tracks_exposed: meta.exact_tracks_exposed === true,
    propagated_estimate: meta.propagated_estimate === true,
    observation_model: stringOrNull(meta.observation_model),
    absence_semantics: stringOrNull(meta.absence_semantics),
    observed_at_bucket: stringOrNull(meta.observed_at_bucket),
  };
};

const publicMilitarySatelliteSummary = (value: unknown) => {
  const summary = record(value);
  return {
    catalog_objects: finite(summary.catalog_objects),
    represented_objects: finite(summary.represented_objects),
    withheld_sparse_objects: finite(summary.withheld_sparse_objects),
    mission_family_counts: countRecord(summary.mission_family_counts),
    altitude_band_counts: countRecord(summary.altitude_band_counts),
  };
};

const publicSatelliteSourceStatus = (value: unknown) => {
  const status = record(value);
  return {
    status: stringOrNull(status.status),
    provider: stringOrNull(status.provider),
    raw_tle_count: finite(status.raw_tle_count),
    public_individual_objects: finite(status.public_individual_objects),
    military_catalog_objects: finite(status.military_catalog_objects),
    military_public_cells: finite(status.military_public_cells),
    timestamp: stringOrNull(status.timestamp),
  };
};

const publicMaritimeSourceStatus = (value: unknown) => {
  const status = record(value);
  const ais = record(status.ais);
  const reference = record(status.reference);
  return {
    ais: {
      status: stringOrNull(ais.status),
      configured: ais.configured === true,
      provider: stringOrNull(ais.provider),
      public_ships: finite(ais.public_ships),
      latest_observed_at: stringOrNull(ais.latest_observed_at),
      latest_observation_age_s: finite(ais.latest_observation_age_s),
      persistence: stringOrNull(ais.persistence),
      exact_military_tracks_exposed: ais.exact_military_tracks_exposed === true,
    },
    reference: {
      status: stringOrNull(reference.status),
      provider: stringOrNull(reference.provider),
      ports: finite(reference.ports),
      chokepoints: finite(reference.chokepoints),
    },
  };
};

const publicCloudflareSourceStatus = (value: unknown) => {
  const status = record(value);
  return {
    status: stringOrNull(status.status),
    configured: status.configured === true,
    provider: stringOrNull(status.provider),
    timestamp: stringOrNull(status.timestamp),
    partial: status.partial === true,
  };
};

export function buildPublicLayerData(data: PublicRecord, embeddedLiveFeeds: unknown[] = []) {
  return {
    live_feeds: embeddedLiveFeeds.length ? embeddedLiveFeeds : list(data.live_feeds),
    commercial_flights: list(data.commercial_flights),
    private_flights: list(data.private_flights),
    private_jets: list(data.private_jets),
    // Only the server-side generalized regional activity aggregate belongs
    // here. Exact military_flights, military satellites and raw SDK entities
    // are deliberately absent.
    military_activity: publicMilitaryActivityCells(data.military_activity),
    military_activity_meta: publicMilitaryActivityMeta(data.military_activity_meta),
    flight_source_status: publicFlightSourceStatus(data.flight_source_status),
    satellites: list(data.satellites).filter(s => !satelliteIsMilitary(s)),
    military_satellite_activity: publicMilitarySatelliteCells(data.military_satellite_activity),
    military_satellite_meta: publicMilitarySatelliteMeta(data.military_satellite_meta),
    military_satellite_summary: publicMilitarySatelliteSummary(data.military_satellite_summary),
    satellite_source_status: publicSatelliteSourceStatus(data.satellite_source_status),
    satellites_at: data.satellites_at || null,
    category_counts: data.category_counts || {},
    maritime_ports: list(data.maritime_ports),
    maritime_chokepoints: list(data.maritime_chokepoints),
    maritime_ships: list(data.maritime_ships).filter(s => !vesselIsMilitary(s)),
    maritime_source_status: publicMaritimeSourceStatus(data.maritime_source_status),
    maritime_source: stringOrNull(data.maritime_source),
    maritime_timestamp: stringOrNull(data.maritime_timestamp),
    submarine_cables: list(data.submarine_cables),
    cameras: list(data.cameras),
    camera_catalog_status: data.camera_catalog_status || null,
    camera_catalog_error: data.camera_catalog_error === true,
    fires: list(data.fires),
    weather_events: list(data.weather_events),
    infrastructure: list(data.infrastructure),
    // These upstream endpoints are not implemented in this deployment. Keep
    // the public contract empty rather than forwarding stale/injected rows.
    balloons: [],
    radiation: [],
    malware_threats: list(data.malware_threats),
    cf_outages: list(data.cf_outages),
    cf_attack_origins: list(data.cf_attack_origins),
    cloudflare_source_status: publicCloudflareSourceStatus(data.cloudflare_source_status),
    gdelt: list(data.gdelt),
    gdelt_events: list(data.gdelt_events),
    reported_routes: list(data.reported_routes),
    reported_routes_meta: data.reported_routes_meta || null,
    conflict_zones: list(data.conflict_zones),
    conflict_live_events: list(data.conflict_live_events),
    conflict_summary: data.conflict_summary || null,
    // Public source state is diagnostic metadata, not a secret or live track.
    conflict_source_status: data.conflict_source_status || null,
    conflict_category_counts: data.conflict_category_counts || {},
    country_boundaries_meta: data.country_boundaries_meta || null,
    frontlines: data.frontlines || { type: 'FeatureCollection', features: [] },
    frontlines_meta: data.frontlines_meta || null,
    earthquakes: list(data.earthquakes),
    sdk_entities: [],
  };
}
