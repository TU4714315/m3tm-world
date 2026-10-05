# M3TM upstream community research, original news-fusion upgrade
Date: 2026-10-05. Scope: PUBLIC M3TM.WORLD only. Review/QA PR, not production.

## Upstream findings (direct project evidence, not copied code)
1. **WorldMonitor** https://github.com/koala73/worldmonitor ; https://github.com/koala73/worldmonitor/blob/main/docs/architecture.mdx :
  - Ingest from curated local/global desks; emphasize source reliability tiers, publisher families, region coverage and feed-health, clustering and source snippet grounding, resiliency/circuit-breakers/cooldowns.
  - Open issue tracker/reviews identify pitfalls that M3TM must explicitly avoid: RSS source syndicated authorship counted as corroboration (#6430), report location mentions becoming unsupported protest events (#8610), stale feed-health/recall metrics after a single redirected feed blocks a workflow (#6484), missing theater-local publisher coverage (#5948).
  - 2026 site/README feature counts are upstream **self-reported**; do not assert field verification. AGPL-3.0-only and trademark restrictions: no WorldMonitor copying, vendor code reuse or misleading affiliation in M3TM. Data providers retain own terms.
2. **OSIRIS** upstream https://github.com/simplifaisoul/osiris : high-density Next.js/MapLibre provider mix, streamed public CCTV, flights, geocoded GDELT, RSS, Telegram previews and reference conflict zones. An upstream issue #96 documented risk of attributed synthetic strikes disguised as actual military evidence. M3TM must never infer perpetrator from location or mask simulated events as live.
3. We could not reliably access all full Telegram/news community feeds under this environment. A feed's HTTP 200 or listed URL does not guarantee current articles; local provider validation and licensing remain required before onboarding new sources.

## Audited M3TM weakness before this branch
- src/app/api/news/route.ts returned APP news immediately when available; RSS was fetched only when Telegram had *zero* stories. A diverse set of sources could not be exposed together.
- Fallback geolocation used keyword->fixed country centroids; this falsely encourages map pins and corroboration claims. A phrase about Iranian reactions could be rendered as the incident location in Iran.
- Missing pubDate was fabricated as now() and created false freshness. Keyword count drove risk labels without distinction from assessed source severity. Raw Telegram usernames from env were not bounded by channel grammar.
- WorldFeed clicked straight to the first publisher link, leaving its internal evidence-expand state effectively unreachable. Basemap country labels were English from CARTO style.

## Original implemented changes (no upstream code imported)
- Original src/lib/publicNewsFusion.ts: safe URL canonicalization/allowlist, deterministic title+six-hour dedup, primary APP priority, timestamp validity and bounded cross-publisher links; **plurality is publication, not independent confirmation**.
- Public /api/news concurrently reads sanitized APP items and samples bounded Telegram plus BBC, BBC Arabic, Al Jazeera English and GDACS RSS, regardless of partial Telegram availability; source_health reports each provider as ready/empty/unavailable with row counts, distinguishes partial from complete. Public route integration tests use mocked upstream responses. Data-source outages do not invent a zero incident rate. No new keys or recurring jobs. Missing/future publication dates excluded. Keyword-only risk capped below public critical alerts. Inferred location mention is **not** a geocoded incident.
- WorldFeed clearly identifies multiple publications as unverified, reveals original publisher links on keyboard-accessible expand, and labels keyword-risk as machine text indicator instead of verified assessment.
- LiveAlerts shows only fresh, high-priority APP-reported news (past 3h) rather than repeating all syndicated low-priority headlines or keyword-only social posts; complete data remain in WorldFeed.
- Geolocated M3TM.APP headline clusters now render in MapLibre itself, expand on click, and retain up to six sanitized publisher links in the map popup. Gold means multiple publishing venues, not independently confirmed incidents; unlocated RSS/Telegram do **not** become incident markers. The existing `app_news` public toggle remains the control.
- CARTO vector style country labels are Arabic for ISO-identified countries using Intl.DisplayNames(ar), vetted MENA short names, available Arabic for place/state/cities. Does not modify borders, source geometries, military sources or map contracts.
- Pure unit tests for unsafe links, publisher duplicate cases, source timestamps, geographic non-fabrication, Arabic vector layer changes. CI workflow monitors changed paths.

## Unverified / mandatory review gates
- Sources BBC Arabic, BBC, Al Jazeera, Telegram are *configured* public endpoints; their current reachability/freshness must be verified in deployed runtime with source_health diagnostics and source-level observation counts. No claims of verified live ingestion before such tests.
- Limits: heuristic exact-title cross-publisher grouping misses paraphrases and can merge same-title stories within 6 hours. Next phase requires verifiable source-level publisher-family attribution + semantic event clustering and bias sampling QA under strict provenance.
- Require TypeScript, Vitest, Next build (full PR final SHA); Vercel Preview/WebKit mobile and 390x844; verify public /api/news first-source rank, rejected stale, Arabic RTL labels, no console/runtime errors; production main SHA, APP hello/ready/sync/select gate.
- WORLD's separate PR #68 data-store dependency on APP issue #360 remains unresolved and is NOT modified, merged or bypassed here. Private tools stay private; military identifiers/tracks remain excluded.
