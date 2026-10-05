# M3TM Fusion Radar — original evidence/aviation awareness layer (2026-10-05)

**Owner/identity:** M3TM.WORLD / M3TM. Development is independently authored for `TU4714315/m3tm-world`, MIT license. WorldMonitor (`koala73/worldmonitor`) is an **external functional benchmark**, not a dependency nor original authorship: its source is AGPL-3.0 and is **not copied** into M3TM.

## Evidence-based comparison (as of 2026-10-05)
| Domain | WorldMonitor self-published characteristics | Verified M3TM baseline | Gap / implementation |
|---|---|---|---|
| Breadth | Official site claims 57 map layers, 461 news/OSINT feeds, 757 attributed providers, 5 independent alert origins | WORLD 2D/3D with GDELT, APP public news, satellite, flight and maritime sources; total integrated feed/provider inventory NOT independently measured | Do not advertise numeric superiority without a manifest-backed audited inventory |
| Event fusion | Documented cross-stream signals, 15-min GDELT plus heterogeneous real-time/daily/weekly inputs | M3TM 15-min GDELT archive & coded reports, source date and multiple-publisher attribution | Add M3TM original **source publication clock**, age filtering & coverage gaps; source clock ≠ incident clock |
| Military aviation | Public ADS-B partial; hidden/nontransmitting aircraft cannot be inferred absent | M3TM 6° / ≥2 public ADS-B observation cells, 30-min buckets and regional trend, no precise public military positions | Show regional cell coverage, stale/provider signals and explicit partial-observation state; no per-aircraft/track enhancements |
| ACLED | Curated source among many | myACLED account restricted to incidents dated no later than 2025-10-05 | Indicate historical-only, do not fake current incident coordinates or seek unlicensed sources |

Sources: https://www.worldmonitor.app/ ; https://www.worldmonitor.app/sources/military/ ; https://github.com/koala73/worldmonitor/blob/main/LICENSE ; https://www.worldmonitor.app/blog/posts/aviation-intelligence-airports-airspace-flight-prices/ ; M3TM production `/api/health`, `/api/conflicts`, `/api/gdelt-events`, `/api/flights?summary=1`.

## Implementation: M3TM Fusion Radar v1
- Reuse WORLD's own deduplicated, geo-generalized event reports in the MENA belt (8–43 N, 20–65 E). No new polling endpoints, budget, or transponder requests.
- 1h / 6h / 24h / 7d **coded report timestamp** filters over the **currently loaded events only**. `fetchGdeltEvents()` consumes **only latestArchive()**, so do not call them complete window counts or use them to infer change in fighting. A durable, idempotent event history with a proven 15-minute coverage watermark is prerequisite for full trend comparisons. Separate prior six hours as a comparison, never an unsupported claim of escalation. Exclude future and unparseable dates from fresh cohorts and make omissions visible.
- Independent `/api/conflicts` and `/api/gdelt-events` source publication clocks and cached-stale labels; never mark both cached because one fails. Page-level source state is passed through the sanitized public display contract.
- Cached military activity cells contribute to historical regional availability counts but **never** to current up/new trend tallies. When `/api/flights` process cache is returned after a refresh exception, *every* military aggregate is marked stale, its old up/new trend dropped, and the source health degraded. If the browser loses follow-up responses, the 60-second local clock expires a flight update older than five minutes. Do not confuse fallback data with new observations.
- Time since the GDELT **source archive** was published: fresh ≤30m, delayed 30–120m, stale >120m, unknown if invalid/future. HTTP reception time is NOT used as a substitute. Provider outages/old cache do not become live.
- The already-loaded `M3TM.APP` geo-tagged Arabic public pins (verified `published-feed-coordinate`, regional 0.5°, attributed URL and source) now appear as an independent news witness. Never promote APP news into GDELT conflict codes or independent incident verification; unknown/keyword coordinates, missing URLs and old dates are excluded. No additional provider/API fetches or military tracking.
- Source-quality counters: single vs multiple publishers (not independently confirmed), missing original links, missing/unusable timestamps.
- Aerial/naval **number of coarse regional cells** only; optional source-health flag and stale/shift counts **summed across the whole MENA belt**. Never correlate location of a military cell with a same-time conflict event, publish aircraft identifiers, reveal aircraft routes, infer specific units or claim silence = no aircraft.
- Original Arabic accessible UI; mobile-friendly time cohorts, 16 newest published reports in selected cohort, clear original-source links and known data limitations. Preserve all previous WORLD layers, APP bridge and licensed credits.

## Objective acceptance and future R&D
1. **Functional**: tests for dedup, window boundaries, future clock skew, source-lag classification and absence of identities. TypeScript, Vitest, Next build, Vercel preview and protected merge.
2. **Historical ingestion prerequisite**: authorized bounded historical batches and persistent Redis/KV cache (if available), event dedup, complete-window watermark, outage gaps, and retention. Until then **sample-only** labels are mandatory.
3. **Production**: deployed SHA; `/api/health` reports operational; GDELT archive timestamp vs UTC, `/api/conflicts` dataState, region desk desktop/mobile; monitor memory, websocket/cache and actual counts, never fabricate data.
4. **Continuous independent comparison**, before claiming M3TM outperforms WorldMonitor: collect ≥7 days of same-region sampled events with cited source timestamps, verified-source percentage, duplicate rate, latency P50/P95 from source-publication to display, false-positive sample and 2D/3D performance (FPS/memory), same connection conditions. Separate coverage from certainty. No scraping code/brand or API entitlement bypass.
5. **Next roadmap**: additive registry-based new publicly licensed sources with attributable host ledger, optional licensed ACLED recent tier (requires explicit provider permission), independent publisher corroboration, source-outage detection, historical non-operational military trend baselines (24h/7d) and civil aviation/airspace disruptions. Maintain data minimization and Vercel quotas.

## Restrictions
Do not copy AGPL code into M3TM without license-compliant adoption decision. No military exact tracks/flight identifiers, near-real-time force positions, dynamic target filtering, or unlicensed raw ACLED. OSINT tools remain private and gated. Maintain existing layer catalogue and no-op/deployment quota policy.
