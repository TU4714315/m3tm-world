import { centroidFor } from './countryCentroids';

/**
 * Country-level clusters of public NETWORK OUTAGE REPORTS, not clustered
 * devices, radio emissions, physical sites, military nodes, or IP addresses.
 * The map marker is a display centroid, not an inferred origin location.
 *
 * Reject ambiguous reports. Multiple annotations from one provider are never
 * presented as independent corroboration or a likelihood of a facility.
 */
export interface PublicDigitalCluster {
  country: string;
  lng: number;
  lat: number;
  report_count: number;
  latest_report_utc: string;
  source: 'Cloudflare Radar';
  precision: 'country-centroid-display-only';
  evidence: 'multiple-provider-annotations-not-independent';
  label_ar: 'تجمع مؤشرات رقمية';
}

type Row = Record<string, unknown>;
const MAX_REPORT_AGE_MS = 30 * 24 * 60 * 60_000;
const CLOCK_SKEW_MS = 5 * 60_000;

export function countryDigitalReportClusters(rows: unknown, nowMs: number = Date.now()): PublicDigitalCluster[] {
  if (!Array.isArray(rows) || !Number.isFinite(nowMs)) return [];
  const groups = new Map<string, { ids: Set<string>; latest: number }>();

  for (const row of rows.slice(0, 500)) {
    if (!row || typeof row !== 'object' || Array.isArray(row)) continue;
    const item = row as Row;
    // GDELT CAMEO 176 covers reported cyber events, not verified connectivity
    // incidents. Never silently count those as outages or physical clusters.
    if (item.source !== 'Cloudflare Radar' || item.event_type === 'REPORTED_CYBER_EVENT') continue;
    if (typeof item.id !== 'string' || !item.id.trim() || item.id.length > 180) continue;
    if (typeof item.start !== 'string' || !item.start.trim()) continue;
    const observed = Date.parse(item.start);
    if (!Number.isFinite(observed) || observed > nowMs + CLOCK_SKEW_MS || nowMs - observed > MAX_REPORT_AGE_MS) continue;
    const code = typeof item.country === 'string' ? item.country.trim().toUpperCase() : '';
    if (!/^[A-Z]{2}$/.test(code) || !centroidFor(code)) continue;
    let group = groups.get(code);
    if (!group) {
      group = { ids: new Set<string>(), latest: 0 };
      groups.set(code, group);
    }
    group.ids.add(item.id);
    group.latest = Math.max(group.latest, observed);
  }

  return [...groups.entries()]
    .filter(([, group]) => group.ids.size >= 2)
    .map(([country, group]) => {
      const [lng, lat] = centroidFor(country)!;
      return {
        country, lng, lat,
        report_count: group.ids.size,
        latest_report_utc: new Date(group.latest).toISOString(),
        source: 'Cloudflare Radar' as const,
        precision: 'country-centroid-display-only' as const,
        evidence: 'multiple-provider-annotations-not-independent' as const,
        label_ar: 'تجمع مؤشرات رقمية' as const,
      };
    })
    .sort((a, b) => b.report_count - a.report_count || a.country.localeCompare(b.country));
}
