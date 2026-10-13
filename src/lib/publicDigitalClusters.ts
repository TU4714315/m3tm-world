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
const MAX_REPORT_AGE_MS = 24 * 60 * 60_000;
// Owner-defined regional scope: Saudi Arabia explicitly excluded.
const REGIONAL_CODES = new Set(['YE', 'IQ', 'OM', 'IR', 'AE', 'QA', 'BH', 'KW']);

export function countryDigitalReportClusters(rows: unknown, nowMs: number = Date.now()): PublicDigitalCluster[] {
  if (!Array.isArray(rows) || !Number.isFinite(nowMs)) return [];
  const groups = new Map<string, { ids: Set<string>; latest: number }>();

  for (const row of rows.slice(0, 500)) {
    if (!row || typeof row !== 'object' || Array.isArray(row)) continue;
    const item = row as Row;
    // GDELT CAMEO 176 covers reported cyber events, not verified connectivity
    // incidents. Never silently count those as outages or physical clusters.
    if (item.source !== 'Cloudflare Radar' || item.event_type !== 'OUTAGE') continue;
    // One annotation across countries still represents one source report per country.
    // Reject generated row IDs when no provider annotation ID was supplied.
    if (typeof item.annotation_id !== 'string' || !item.annotation_id.trim() || item.annotation_id.length > 180) continue;
    if (typeof item.start !== 'string' || !item.start.trim()) continue;
    const observed = Date.parse(item.start);
    if (!Number.isFinite(observed) || observed > nowMs || nowMs - observed > MAX_REPORT_AGE_MS) continue;
    const code = typeof item.country === 'string' ? item.country.trim().toUpperCase() : '';
    if (!REGIONAL_CODES.has(code) || !centroidFor(code)) continue;
    let group = groups.get(code);
    if (!group) {
      group = { ids: new Set<string>(), latest: 0 };
      groups.set(code, group);
    }
    group.ids.add(item.annotation_id);
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

/**
 * Display connections ONLY between country centroids that are explicitly
 * mentioned in the *same* Cloudflare OUTAGE annotation. A line represents a
 * shared cross-country REPORT, not an actual cable, BGP hop, radio link or
 * operational relationship. Do not interpret it as a link failure.
 */
export interface DigitalSharedOutageContext {
  id: string;
  from_country: string;
  to_country: string;
  from: [number, number];
  to: [number, number];
  started_at: string;
  ended_at: string | null;
  reported_ongoing: boolean;
  reported_duration_minutes: number;
  source: 'Cloudflare Radar';
  precision: 'country-centroid-display-only';
  relation: 'shared-reported-outage-not-network-link';
}

export function sharedCountryOutageContexts(rows: unknown, nowMs = Date.now()): DigitalSharedOutageContext[] {
  if (!Array.isArray(rows) || !Number.isFinite(nowMs)) return [];
  const grouped = new Map<string, { start: number; end: number | null; countries: Set<string> }>();
  const ambiguousIds = new Set<string>();
  for (const raw of rows.slice(0, 500)) {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) continue;
    const r = raw as Row;
    if (r.source !== 'Cloudflare Radar' || r.event_type !== 'OUTAGE') continue;
    if (typeof r.annotation_id !== 'string' || !r.annotation_id.trim() || r.annotation_id.length > 180) continue;
    if (typeof r.country !== 'string') continue;
    const country = r.country.trim().toUpperCase();
    if (!REGIONAL_CODES.has(country) || !centroidFor(country)) continue;
    if (typeof r.start !== 'string') continue;
    const start = Date.parse(r.start);
    if (!Number.isFinite(start) || start > nowMs) continue;
    if (r.end !== null && r.end !== undefined && (typeof r.end !== 'string' || !r.end.trim())) continue;
    const end = typeof r.end === 'string' ? Date.parse(r.end) : null;
    if (end !== null && (!Number.isFinite(end) || end < start || end > nowMs)) continue;
    // Only annotate the last 24 hours on WORLD. A continuing event whose
    // start was earlier can still be visible when source confirms ongoing.
    if (end !== null && nowMs - end > MAX_REPORT_AGE_MS) continue;
    if (end === null && nowMs - start > MAX_REPORT_AGE_MS) continue;
    const id = r.annotation_id;
    if (ambiguousIds.has(id)) continue;
    const group = grouped.get(id);
    if (group) {
      // A provider annotation ID with mismatched clocks is ambiguous.
      if (group.start !== start || group.end !== end) {
        grouped.delete(id);
        ambiguousIds.add(id);
        continue;
      }
      group.countries.add(country);
    } else {
      grouped.set(id, { start, end, countries: new Set([country]) });
    }
  }
  const result: DigitalSharedOutageContext[] = [];
  for (const [id, event] of grouped.entries()) {
    const codes = [...event.countries].sort();
    if (codes.length < 2) continue;
    const first = codes[0];
    for (const to_country of codes.slice(1, 7)) {
      result.push({
        id: id + ':' + first + '-' + to_country,
        from_country: first, to_country,
        from: centroidFor(first)!,
        to: centroidFor(to_country)!,
        started_at: new Date(event.start).toISOString(),
        ended_at: event.end === null ? null : new Date(event.end).toISOString(),
        reported_ongoing: event.end === null,
        reported_duration_minutes: Math.max(0, Math.floor(((event.end ?? nowMs) - event.start) / 60_000)),
        source: 'Cloudflare Radar',
        precision: 'country-centroid-display-only',
        relation: 'shared-reported-outage-not-network-link',
      });
      if (result.length >= 60) return result;
    }
  }
  return result;
}
