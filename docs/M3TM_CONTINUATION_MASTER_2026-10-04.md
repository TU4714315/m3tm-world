# M3TM — MASTER CONTINUATION / خريطة الاستكمال (2026-10-04)

> **Entry:** Start with this file; do not regenerate project discovery. Runtime Git/CI and production health always outrank an older handoff. WORLD remains public; APP owns shell, news, auth and private tools.

## CHECKPOINT — Owner regional refresh tiers (2026-10-10)
**DONE (branch only):** Added typed scheduling values and safety-filtered significant cyber overview in `src/lib/publicRefreshPolicy.ts`, tests, and targeted browser refresh reductions for maritime (daily), cyber threats (daily), frontline snapshots (daily), civilian-only flights (daily; regional military aggregate remains 5m). Inherits #105 no hidden-tab polling/static cable cache-bust. `/api/cyber-attacks` positive cache + CDN TTL set to 24h. Official requirements/remaining unimplemented portions: [WORLD_SOURCE_REFRESH_POLICY_2026-10-10.md](WORLD_SOURCE_REFRESH_POLICY_2026-10-10.md).

**VERIFY:** Run `npx tsc --noEmit --incremental false`, `npx vitest run src/lib/publicRefreshPolicy.test.ts`, `npm test`, `npm run build`, source/privacy CI and browser smoke. **No production deployment yet.** Check API timings and before/after CPU once live.

**BLOCKERS:** Global conflict/GDELT source is still shared; geographic MENA/Ukraine/Africa frequency partitioning needs backend source snapshots. Satellite endpoint refreshes mixed catalogue after one hour; AIS listener remains live; cyber illustrative origins not evidence of attacker attribution. Do not describe cadence declaration alone as upstream compute savings. APP/public map status not live browser-verified in this branch.

**NEXT:** Finish green checks and resolve review; merge base PR #105 safely before retargeting this stacked PR; separate low-frequency regional archives from MENA published incident updates and confirm owner decisions on remaining layers.

## CHECKPOINT — Arabic MapLibre shaping and live-news audit (2026-10-08)
**DONE:** Root cause of reversed/disconnected Arabic country names is confirmed: WORLD was pinned to MapLibre 6.7 after hotfix `0d97990` disabled the legacy RTL plugin because eager loading stalled first paint. The final repair upgrades to MapLibre 6.9, whose built-in implementation shapes Arabic and reorders bidirectional text without the deprecated plugin. The old plugin asset/helper are removed. Country-name fallback also changes the ISO match default from an empty string to `null`, so missing/unmatched ISO codes correctly fall through to `name:ar`/`name` instead of rendering blank/broken labels.

**VERIFY:** TypeScript, focused Arabic/satellite tests, full Vitest, Next build, protected public-layer/privacy checks, Vercel Preview, then browser smoke must show a painted map and correctly ordered Arabic labels before production merge.

**BLOCKERS:** No source-data blocker for Arabic shaping. APP live news still has a separate unmerged current-WORLD bridge (#361) that must be reconciled onto current APP main rather than force-merging its stale base.

**NEXT:** Complete #361 reconciliation after WORLD RTL production verification; independently reconcile stale durable-GDELT PR #68 against the actual Supabase schema instead of merging its old branch wholesale.
## CHECKPOINT — Public chrome cleanup after live QA (2026-10-08)
**DONE:** PR #88 trims the remaining verbose public military-provider wording in `MenaPulse` and decodes common/numeric HTML entities in the M3TM.APP ticker. Reviewer follow-up preserves the explicit zero-region qualification and rejects invalid/out-of-range numeric entities instead of allowing a malformed upstream headline to throw during render.

**VERIFY:** `git diff --check`, TypeScript, focused tests, full Vitest and Next production build must pass on the final #88 head; protected WORLD public-layer/privacy checks and Vercel Preview must be green before merge.

**BLOCKERS:** No feature blocker. Do not interpret `المنطقة: 0` as proof of no real-world activity; the public military layer remains coarse, partial and identifier-free.

**NEXT:** Resolve the three #88 review threads, merge on green protected checks, then continue current Arabic MapLibre shaping/news-freshness work from the resulting protected `main`.

## CHECKPOINT — One-click WORLD workspace persistence (2026-10-07)
**DONE:** PR #82 adds validated local workspace persistence on top of current protected `main`: explicit **حفظ** control, Ctrl/Cmd+S, debounced autosave, and restoration of layers, projection, basemap style, theme, satellite visual preset, and full map center/zoom. Shared URL `layers` / `lat` / `lon` / `zoom` remain higher priority than the local snapshot. APP-embedded WORLD neither autosaves nor responds to the save shortcut, preserving host/standalone separation.

**VERIFY:** Focused persistence/layer/Arabic-basemap tests PASS (9/9); TypeScript PASS; Next production build PASS. Review follow-up also requires `WorldMap` to report longitude with latitude/zoom and prevents Ctrl/Cmd+S from triggering the existing unmodified `s` search shortcut. Re-run protected CI/Vercel on the final PR head before merge.

**BLOCKERS:** None in the persistence implementation itself. Protected merge still requires all review threads resolved and final required checks green; production smoke must confirm the deployed `main` SHA after merge.

**NEXT:** Resolve PR #82 review threads, merge only on green checks, then verify live restore/save behavior on desktop/mobile and confirm standalone saved state is not altered by APP embed usage.

## Commands & actual baseline
- WORLD `TU4714315/m3tm-world` → `https://m3tm-world.vercel.app`. Protected `main` baseline `1b1e0cd18a801e260930d8f8e36b05ac9bd8c44f` from merged PR #58. The baseline production passed Vercel deploy, reported `health=operational`, conflicts/GDELT `live`, ACLED OAuth `ok` with **0 ACLED event rows**. Sample counts (2026-10-04): 45 conflict items, 83 GDELT, 82 single-publisher and 1 multiple-publisher report. Counts change.
- APP `TU4714315/m3tm-app`, `https://m3tm.app`. Protected `main` at inspection `3124d9a3470c64760964798276d48b2427b46c48`. First read `AGENTS.md`, `docs/M3TM_EXECUTION_CONTRACT.md`, and `docs/AI_HANDOFF.md`; APP contract scopes current work to P0 Reliability/Auth and P1 Consolidation. Do not introduce a new public operational shell.
- Local WORLD worktree has historically been dirty; **never** reset, clean, stash, checkout over or publish its changes without `git status --short --branch`. The latest direct workspace command returned `Tool exec_command not found`; use isolated GitHub branches if local status cannot be established.
- Tests: `npx tsc --noEmit --incremental false`, `npm test`, `npm run build`; Vercel Preview and protected merge gate; production `/api/health?deep=1`, `/api/conflicts`, `/api/gdelt-events`, plus WebGL desktop/mobile view.

## CHECKPOINT — Arabic labels + news freshness + durable MENA history (2026-10-08)
- Arabic labels: PR #89 replaced the legacy RTL plugin path with MapLibre 6.9 native Arabic/bidi shaping and corrected ISO-name fallback to `name:ar`/`name` when ISO is absent. Production verification must use the deployed SHA, not merely CI.
- News freshness: WORLD `/api/news` combines the APP published feed with independent RSS; measured live on 2026-10-08 with the newest MENA item about seven minutes old. APP's scheduled static publisher can incur GitHub cron jitter, so the fast bridge is intentionally independent rather than claiming zero delay.
- Durable GDELT history: the already-deployed Supabase `world_gdelt_*` archive/cron is now reconciled into current WORLD through `/api/gdelt-history` and the MENA Observatory. This preserves live feeds independently if history is temporarily unavailable.
- Correctness follow-up: Arabic-only tabs now reject common Persian-specific characters instead of treating the entire Arabic Unicode block as Arabic; malformed GDELT dates stay unknown instead of being synthesized as the current time.

## Product specification
- Maximize source-backed **fresh reporting of the Middle East/Red Sea**, global coverage preserved; aim to match/exceed WorldMonitor's information organization and measured alert latency, not copy its branding or unlicensed code. Assess feed freshness by original publication time, deduplication, geographic certainty and publisher independence.
- All public layers, notably `military_activity`, `naval_activity`, `maritime`, `conflict_zones`, `conflict_density`, `frontlines`, `reported_routes`, `gdelt_events`, `civil_unrest`, `global_incidents`, `app_news`, `alert_pins`, flights/satellites/cameras and borders, stay enabled as user choices permit. Fix weak layers rather than delete them.
- Public reporting has clear Arabic evidence levels: `أولي` = 1 publisher, `عدة ناشرين` = >=2 publishers (not independent confirmation), `مرجعي` = curated published record, `موضع تقريبي` = generalized location. Use concise, confident language without inventing certainty or assuming user intent. Military unit-level live paths/identifiers and local private OSINT remain outside public WORLD.
- Existing PR #58 supports 3 raster grades `أصلي/رصد/مضاء`, MENA focus button, evidence desk, GDELT/unrest clustering, duplicate-symbol suppression, mobile intel panel and NOAA layering. Do not regress. APP↔WORLD origin-validated `hello/ready/sync/select` 35s contract stays intact.

## Merged/release lineage (do not redo)
- #41 CCTV/security, main merge `637222286fe1eb5c5f3524fe18c7000d595972ad`.
- #55 Vercel policy: only `qa/**` auto-deploy disabled, `feat/**`, `fix/**`, `main` still deploy; `docs/M3TM_VERCEL_RELEASE_POLICY_2026.md`.
- #57 source-coded published actor labels, ACLED derived 7-day regional output, source transparency, merge `98cb401cbe895af213ab01d3b25b167f528f43d4`.
- #58 satellite imagery presets, MENA observatory, one/multiple-publisher treatment, client dedup, mobile and NOAA fixes, merge `1b1e0cd18a801e260930d8f8e36b05ac9bd8c44f`; all CI gates green.
- #59 repaired ACLED same-column filter and aggregate diagnostics, introduced WORLD `AGENTS.md` and this continuation entry, and aligned active WORLD favicon/PWA/browser imagery with canonical APP M3TM mark; merged `c72839eff4ac5f9ca91ebae8a42ae9c1e94d1d9b`.
- #60 uses official ACLED `timestamp` for weekly releases (last 10 days) separated from `event_date` (last 35 days), preserving 7-day occurrence counts; merged `ac718030ea4e79aeacc8a22b0292811d79527b18`. **Crucial confirmed blocker**: the account's own myACLED `data_query_restrictions.date_recency` reports last permitted occurrence `2025-10-05`, `12 Months old`. An unrestricted tiny query returns data but Sept–Oct 2026 occurrence returns zero: this is an upstream **account entitlement**, not an auth or frontend error. Current patch marks this historical-only state explicitly; never bypass licensing. For recent ACLED disaggregated events owner must request Access Team upgrade; GDELT continues live. Read `docs/ACLED_PUBLIC_SOURCE_CONTRACT_2026-10-04.md` for source semantics and limitations. The source may remain empty owing to upstream recency/license; do not fake records.

## 2026-10-05 — GDELT archive coverage measurement
- WorldMonitor is a measured functional target, not a licensed code import; the baseline Fusion Radar samples only the latest GDELT export. New original `src/lib/gdeltCoverageLedger.ts` records genuine first observations of 15-minute archive timestamps without storing raw GDELT or military data. Atomic Redis ZADD NX + bounded expiry when KV/Upstash is configured, process-memory fallback otherwise. `/api/source-coverage` and the Arabic MENA panel explicitly show seven-day sampled-window coverage and gaps.
- This does **not** yet build seven-day event history or establish parity/superiority. Enabling independent durable ingestion, maintaining valid 7-day source archive batches and verifying latency P50/P95 from source-to-user-view remain open work. Do not invent missing windows or interpret silent sources as inactive conflicts.
- For release check current main/CI/Vercel and module tests; preserve WORLD layer inventory and APP integration, prevent exact military tracks.

## 2026-10-05 — M3TM Fusion Radar benchmark and deliverable
- **New original M3TM-owned code**, not WorldMonitor AGPL sources, adds source-publication freshness thresholds, 1h/6h/24h/7d source-coded report windows, preceding-6h comparison, coverage gaps and coarse regional aviation status. See `docs/M3TM_FUSION_RADAR_2026.md`. All military identities and per-cell details stay excluded from the summary.
- Baseline WORLD main verified before this new work: `325a626e2f5b9c8801580c2240890505e50e8b91`; benchmark against the current source rather than previous handoff counts. **Do not claim superiority** absent same-region/same-period timed samples and provider reachability evidence.

## CHECKPOINT — M3TM Fusion Radar v1 (2026-10-05)

**TASK:** Independent M3TM-branded event evidence/time-quality radar benchmarked against WorldMonitor public claims, with regional rather than operational military aviation.

**DONE:**
- Branch `feat/m3tm-fusion-radar-evidence-20261005`, PR #62. Added `buildMenaFusionRadar` in `src/lib/menaSignals.ts`, deterministic tests, refreshed Arabic `MenaPulse`, original `docs/M3TM_FUSION_RADAR_2026.md`, and CI watched paths.
- Cohorts filter **only loaded GDELT reports**; real historical coverage requires archival ingestion. Displays source archive age, gaps and aggregate military-provider health without exact tracks.
- Reviewer follow-up implemented explicit ACLED `cached-stale` status, unknown provider vs failure, UI 60s/visibility freshness clock, and this strict handoff.

**VERIFY:**
- Initial clean patch SHA `8e9ebd2fcd0e3aaee0b7cf13531f785c92de8c8e` passed TypeScript, Vitest, Next build and Vercel Preview on GitHub; subsequent sample-coverage documentation SHA `6273c1580b3100311881808aae07344429e73476` also passed all checks.
- The follow-up reviewer patch must **re-run all required checks** against its own final PR HEAD; latest test/build status and actual production `/api/health` SHA are source of truth. No benchmark superiority assertion is verified yet.

**BLOCKERS:**
- A fresh PR head's green required checks, resolved PR #62 review threads, and protected merge/production smoke are release gates—not implied by previous green commits.
- Current WORLD `fetchGdeltEvents()` reads only the latest 15-minute archive; durable historical backfill/coverage-watermark is not implemented; source coverage is incomplete for a full 6h/24h/7d benchmark.
- myACLED recent event entitlement is historical-only (2025-10-05); no unauthorized bypass. Exact public military tracks are not permitted.

**NEXT:** PR #62 was merged on protected main as `cd543f7d17568ef451e843dab1da285a33b87814` with TypeScript/Vitest/Next/Vercel Preview PASS and all six review threads resolved; the Vercel deployment commit status later reported success. Direct production HTTP smoke was **not independently confirmed** because the connected browser was unavailable and the public URL was inaccessible to the web inspection tool. Continue direct HTTP/browser health and visual checks when available, plus seven-day benchmarks; don't equate Vercel READY with runtime proof.
- New independent APP-news evidence integration continues the radar through the next isolated PR. Read GitHub state before assuming its merge or deployment.

## Checkpoint 2026-10-05 — Post-merge stale military aggregation fix
**DONE:** GitHub confirmed #62 merged to protected main `cd543f7d17568ef451e843dab1da285a33b87814` with CI/Vercel success. Parallel #63 merged later to `fb757d4aa1ed7b56eab41582c86a07d529410ae5`, integrating independently sourced APP news. A late Codex review exposed a stale process-cache correctness bug: `/api/flights` kept `data_state=live` for the last military aggregate on failed refresh.
**REPAIR:** On failed source refresh, `markCachedFlightDataStale` labels **all** coarse flight cells cached-stale, drops prior up/new change indicators, recomputes elapsed age from actual observation without advancing original source timestamp, and propagates degraded source status. The client also invalidates stale trends after five minutes without a successful response. Map popup labels historical aggregates.
**VERIFY:** New tests cover failed refresh, cache immutability, previous timestamps, stale display and client-timeout transitions. Verify final independent PR CI/Vercel, production SHA, API health and map UI before claiming completed release.
**BLOCKERS/NEXT:** ACLED 2026 dates outside licensed access; WorldMonitor benchmark superiority not yet measured; sample-only GDELT windows cannot prove historical regional reporting throughput. All existing layers and exact-military-track protections remain.

## 2026-10-05 follow-up — map markers must age with M3TM Fusion Radar
**DONE:** protected PR #64 merged at `78d2a58465bd7a4f593ce79f948a79ddb2de8d4a` and production health SHA/flight/conflict/GDELT smoke passed. A late review correctly found UI disagreement: when the browser receives no new `/api/flights` response, Fusion Radar's 5-minute age-based status becomes stale, yet MapLibre retains full-opacity "live" military coarse cells.
**REPAIR:** Shared `coarseFlightSourceStale()` exactly matches both panel and map. `coarseFlightMapFeatures()` explicitly whitelists aggregated, public properties and strips military identifiers. A separate 60-second timer updates only the coarse map source on expiry, not all civilian flights or the whole globe. Map popup shows cached state. Tests cover exact boundary, status and nonleakage.
**VERIFY:** Require checks and new protected merge, then verify deployed SHA, /api/health, /api/conflicts, /api/gdelt-events, /api/flights?summary=1, screenshot of map at >5m after a failed refresh when practical. Vercel quota remains controlled.
**BLOCKERS/NEXT:** 7-day continuous history and quantified WorldMonitor superiority still unverified; ACLED remains limited by the source-account 12-month delay.

## Open ordered work and objective acceptance
1. **P0 ACLED access:** confirmed entitlement is historical-only (`date_recency.date=2025-10-05` as of 2026-10-04); the source adapter should report `restricted_recency` instead of `ok` and skip futile recent-content retries. The missing current disaggregated data requires ACLED authorization; never simulate or bypass current data. Preserve full GDELT/news independent pipeline and keep historical ACLED out of live tactical event pins. ACLED is not a live flight feed and must comply with its EULA; GDELT independently remains operational.
2. **P0 reporting relevance/freshness:** compare GDELT batch timestamp to displayed item dates, country-specific false positives, CAMEO ActorGeo/ActionGeo, duplicates and independent corroboration. Add tests for known Makkah CAMEO-195 ambiguity. No invented event coordinates.
3. **P1 visual intelligence:** improve MENA responsive timelines, country/zone priority, route density, high-contrast map labels and intuitive badges; compare objective latency/coverage with WorldMonitor via the same window and geography. Keep all source APIs and all map layers.
4. **P1 cross-site identity:** WORLD historically exposes an upstream Horus eye favicon while APP uses its own `public/favicon-m3.svg`/M3TM-branded mark. Align **browser/search icon** to APP's canonical brand without mistaking screenshot mockups for the owner's personal photograph. If a particular personal photo is intended, request its exact source after scanning assets; do not invent one.
5. **APP scope:** respect APP's separate stabilisation contract, private/public separation, Host-Agent permissions and `docs/AI_HANDOFF.md` auto-generator. Do not write handoff by hand in APP or enable OSINT tools publicly.
6. **Release:** isolate branch, tests, Vercel Preview, resolve review findings, squash merge only once on all green checks, verify deployed `main` SHA, GDELT & conflicts & ACLED diagnostics, 2D/3D and mobile, source attribution, no secret leakage. Document any still-blocked item truthfully.

## Safety & quota
- No cloud/browser to localhost; no credential printing, fake targets or made-up live telemetry. Never expose ACLED credentials, OAuth tokens, raw licensed event rows or exact operational military tracks.
- Do not force push, remove features, bypass required reviewers or create Vercel no-op preview/deploy loops. `qa/**` remains quota-friendly.


## Coverage ledger follow-up (2026-10-05)
Verified after PR #66 that /api/gdelt-events returned 235 valid current archive events but /api/source-coverage, in a separate Vercel function and with no configured Redis, could only return an unrelated memory counter. A follow-up ensures cross-function absence of durable storage yields *unverifiable* rather than zero completeness. Backend persistence and seven-day event history remain separate uncompleted milestones.

## 2026-10-05 — PR #69 visual clarity and camera click expansion (review checkpoint)
- Source: PR #69 `feat` from the protected WORLD main baseline `e0681b304ae01075c0937af1c5d984e70b4817a5`. No original imagery, cameras, layer APIs or event records removed.
- **DONE in PR:** Raster-only satellite `clarity` grade/shadow brightening and reduced terrain vignette; countable country-level CCTV clusters with all individual cameras retained at city zoom; larger GDELT/civil report icons and late cluster expansion; related regression tests. Source aggregation does not alter civilian flight or public military aggregates.
- **Review fix:** CCTV cluster click now uses MapLibre `GeoJSONSource.getClusterExpansionZoom(cluster_id)`, not constant `zoom+2.1`; one click opens the expected individual camera level. An async callback ignores a replaced/unmounted map and falls back to zoom 9 if the cluster API fails. Other event clusters retain previous handler.
- **VERIFY before claiming complete:** Required TypeScript/Vitest/Next, Vercel Preview, resolved reviewer threads, desktop & 390x844 image comparison, test camera viewer on city zoom, all existing military/data/satellite/camera layers present, APP `hello/ready/sync/select` preserved. Production main/deployed SHA must match the resulting merge commit.
- **Separate blocker:** PR #68 durable GDELT history is a different concurrent feature; APP-owned Supabase persistence and CI/Deno review issues must be closed independently. Do not merge unresolved upstream governance or bypass deployment quotas.
