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

export function buildPublicLayerData(data: PublicRecord, embeddedLiveFeeds: unknown[] = []) {
  return {
    live_feeds: embeddedLiveFeeds.length ? embeddedLiveFeeds : list(data.live_feeds),
    commercial_flights: list(data.commercial_flights),
    private_flights: list(data.private_flights),
    private_jets: list(data.private_jets),
    // Only the server-side generalized regional activity aggregate belongs
    // here. Exact military_flights, military satellites and raw SDK entities
    // are deliberately absent.
    military_activity: list(data.military_activity),
    military_activity_meta: data.military_activity_meta || null,
    satellites: list(data.satellites).filter(s => !satelliteIsMilitary(s)),
    satellites_at: data.satellites_at || null,
    category_counts: data.category_counts || {},
    maritime_ports: list(data.maritime_ports),
    maritime_chokepoints: list(data.maritime_chokepoints),
    maritime_ships: list(data.maritime_ships).filter(s => !vesselIsMilitary(s)),
    submarine_cables: list(data.submarine_cables),
    cameras: list(data.cameras),
    camera_catalog_status: data.camera_catalog_status || null,
    camera_catalog_error: data.camera_catalog_error === true,
    fires: list(data.fires),
    weather_events: list(data.weather_events),
    infrastructure: list(data.infrastructure),
    balloons: list(data.balloons),
    radiation: list(data.radiation),
    malware_threats: list(data.malware_threats),
    cf_outages: list(data.cf_outages),
    cf_attack_origins: list(data.cf_attack_origins),
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
