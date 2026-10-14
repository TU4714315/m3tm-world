# M3TM.WORLD — Public digital observation clusters (2026-10-13)

## Purpose
Display **country-level clusters of public network-outage annotations**, not device clusters, physical communication platforms, covert installations, or geolocated IPs.

## Owner-defined geographical scope
- Digital observation clusters and shared-annotation lines: **YE, IQ, OM, IR, AE, QA, BH, KW only**. Saudi Arabia (`SA`) is excluded in the aggregation code, including cross-border event lines; no country centroid or marker for SA.

## Evidence gates
- Input: `/api/cloudflare-radar` existing `outages` observations, *only* records explicitly sourced to `Cloudflare Radar`.
- An eligible cluster requires at least **two distinct outage annotation IDs** in one ISO alpha-2 country in the preceding **24 hours**.
- Invalid timestamps, future observations, unknown countries, empty IDs, duplicates and GDELT CAMEO 176 cyber *reports* are rejected.
- All input latitude/longitude values are ignored. Country centroid from `countryCentroids.ts` is used **only for display**. Zoom must never progressively disclose an alleged device or relay location.
- Heatmap intensity is a country-centroid visualization of **report counts**, visible only at low zoom. It does not imply a measured hotspot or a rural cluster.
- The bubble count is a count of distinct **source annotations**, NOT devices, hosts, entities, independent witnesses, or probabilities.
- Cloudflare's `/annotations/outages` endpoint includes outages **and anomalies**. A row contributes only when its original provider `annotation_id` exists and `event_type` is exactly `OUTAGE`; do not infer `OUTAGE` for missing classification.
- Future-dated rows, malformed end timestamps, or contradictory timestamps under a shared annotation ID are excluded from the corresponding visualization.
- A country with 0 or 1 eligible annotations displays no cluster. Empty results are valid and are not replaced by synthetic markers.
- The popup says clearly that one provider's repeated reports do not independently corroborate the cause or establish a physical site.
- A user-visible layer toggle and URL v5 migration preserve both new defaults and later explicit opt-outs.
- The layer reuses an existing data response; no scans, secrets, background polling or new paid endpoints.
- When `cloudflare_source_status.providers.cloudflare_outages` is `not_configured` or `unavailable`, the map remains empty for this layer and controls explain its source state quietly. GDELT and Feodo fallback events remain available to their established layers but are never treated as Cloudflare outage annotations.

## Live source validation (2026-10-13)
- Independent [PR #122](https://github.com/TU4714315/m3tm-world/pull/122) read-only GitHub Actions smoke run [`38417672454`](https://github.com/TU4714315/m3tm-world/actions/runs/38417672454) at `2026-10-13T14:56:22Z` reported Render `GET /api/cloudflare-radar?probe=1` HTTP 200 with `configured=false` and `fallback_available=true`.
- The same probe reported `HEAD /` HTTP 200 and CCTV region catalog available (`westasia=true`, 56 regions). These checks establish transport and public catalog availability, not active webcam streams or MapLibre WebGL paint.
- Thus the deployed Render environment at that observation **cannot** supply eligible Cloudflare digital clusters. Do not manufacture symbols from GDELT cyber events or infer a Yemen cluster. A server-only `CLOUDFLARE_API_TOKEN` configuration, verified Cloudflare API response and at least two eligible fresh distinct outage IDs in an allowed country are all necessary before any national marker appears.
- Render production is still pinned to baseline commit `9bdc7237` with autoDeploy off; this PR remains a draft pending visual and source verification. Do not expose credentials in logs, UI or Git.

## Scope limitations
- Shodan/Censys device index searches are **not** wired into this layer and must not be presented as active.
- A country-scale digital observation cluster cannot detect the location, identity, purpose, or movement of a sensitive communication platform.
- Do not attempt to infer sensitive sites in Yemen or other conflict zones from geolocation errors or digital sightings.
- Any future municipal aggregation requires source-defined geography and independently verified provenance; raw IP geolocation is insufficient.

## Release gates
1. Run `npm test`, `npx tsc --noEmit --incremental false`, `npm run build`, privacy/provenance CI.
2. Visual smoke (desktop and mobile) on PR preview: marker, count, tooltip, toggle, quiet mode and APP embed.
3. Confirm deployed SHA, source timestamps, and empty-state behavior before production rollout. Do **not** claim successful deployment from a code commit alone.
