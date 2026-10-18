# M3TM — MASTER CONTINUATION / خريطة الاستكمال (2026-10-04)

> **Entry:** Start with this file; do not regenerate project discovery. Runtime Git/CI and production health always outrank an older handoff. WORLD remains public; APP owns shell, news, auth and private tools.

## CHECKPOINT — Saudi public fallback and release evidence (2026-10-15 UTC)

**DONE:** Continued merged WORLD #129/#130 and APP #410/#412 from clean main `3269189`. Civilian density now excludes Saudi source coordinates before binning: a Saudi border observation previously moved to an unmasked cell center. Durable cache namespace advances to v2 to avoid reusing old mixed cells. Flight totals/fallback counters and satellite public category/object/cell counters now match the returned masked lists. Health reports `RENDER_GIT_COMMIT` on Render, retaining Vercel fallback. All historical dirty checkouts remain untouched.

**VERIFY:** Local 910 tests PASS / 18 skipped, TypeScript PASS, Next production build PASS. New regressions cover mixed Saudi/Yemen border cells, Saudi-only empty fallback, satellite response counts, masked flight counts, and lightweight host deployment identity. Focused lint PASS after removing the aggregate helper's old `any` types; legacy flight/satellite route-wide lint is not claimed. Live public snapshot at 2026-10-15T06:03Z: APP 160 news items, zero Saudi geotag violations, 25 Saudi articles retained, 15 Yemen articles with published geotags; WORLD news 96 rows and internal-query GDELT 578 rows with zero Saudi rows. `/world/` loads and visibly paints the WORLD iframe.

**BLOCKERS:** New patch is not yet deployed. Existing Render health returns `deployment.sha=null`; no exact deployed commit claimed. Live flight summary timed out at 40 seconds. APP feed remains fresh but degraded (43/102 sources succeeded, target 45). Subscriber-only Saudi indicators are not implemented: APP must enforce a specific authorized entitlement server-side; login or iframe query parameters are insufficient. Vercel's old PR #129 status reports account deployment blocked; no account/billing changes made.

**NEXT:** Review this branch and required CI; verify actual Render deployed SHA after an authorized release. Keep provider reachability, Arabic translation SLA, and subscriber authorization as distinct follow-up work; do not lower health thresholds or expose private indicators to make a check pass.

## CHECKPOINT — CCTV delayed cache recovery (2026-10-13)
**TASK:** Render logged a West Asia CCTV 12-second region timeout followed by a successfully completed OpenCCTV catalogue fetch about ten seconds later. The timed-out request placed the region in a 300-second cooldown that hid the newly cached cameras from subsequent requests.
**DONE (PR #121, pending merge):** Clear the regional cooldown as soon as a late provider result returns non-empty data already retained by `sourceCache`. Keep the cooldown when a late result is empty, including the concurrent-request case where another request has not reached its own timeout yet. Added tests for both late success and overlapping late empty results. Scope is `src/app/api/cctv/route.ts` and its route tests; no map, camera-stream, or Shodan changes.
**VERIFY:** GitHub Actions TypeScript, Vitest, production build, Deno/archive and privacy checks must pass on the final reviewed head; then confirm the merged SHA and manually coordinated Render deployment after PR #120. Re-check `/api/cctv?region=westasia` response `pendingRegions`, safe aggregate totals, server errors, and APP map first paint. Provider catalogue counts are not proof that individual videos play.
**BLOCKERS:** Live successful playback and per-country camera availability remain unverified. Deployment is coordinated with PR #120 to avoid duplicate Render rebuilds; Vercel account-level deployment is blocked.
**NEXT:** Resolve all review threads, merge with GitHub expected-head guard when protected checks pass, and coordinate one Render release with the release owner. Preserve public source attribution and restrictions on sensitive camera locations.

## CHECKPOINT — bounded process cache memory after Render V8 OOM (2026-10-11)
**TASK:** Prevent repeat of proven Node V8 heap out-of-memory (Render exit 139) while retaining valid public cached event layers.
**DONE (pending review):** A 16 MiB total limit and 8 MiB per JSON entry for fallback process memory; evict oldest keys by retained byte count; refreshed keys move to newest position; reject oversized memory entry while Redis path remains usable. Adapt public API cache-backend types and add regression tests. No paid backend, DNS or private OSINT changes.
**VERIFY:** typecheck, Vitest including refreshed-key eviction, WORLD build and privacy checks, then active Render memory trend after production rollout. Distinguish runtime V8 heap from RSS limit and from platform CPU charges.
**BLOCKER:** No live post-patch production memory data until merged and deployed. External Redis durability remains optional.
**NEXT:** Review/merge this focused new PR after CCTV first-paint PR #110 and rebase if main changes; publish manually to Render and check memory/first-paint/APP iframe.

## CHECKPOINT — Progressive CCTV load / Render first paint (2026-10-11)
**TASK:** Reduce the observed 40+ concurrent global CCTV fetches that cause 12-second timeouts during Render's cold map start.
**DONE (review PR):** Load MENA camera catalog first, discover the region names through a zero-upstream catalog endpoint, then fetch remaining public CCTV regions in batches of four, with cancellation and bounded retry. Reused the reviewed PR #104 implementation on latest WORLD main without overlaying unrelated changes.
**VERIFY:** WORLD targeted CCTV tests, complete verify-world and public-email-privacy CI, then Render + APP embed first-paint smoke.
**BLOCKER:** DOM loaded WORLD but WebGL canvas first-paint on iPhone is not independently verified. Old Render still uses main SHA 565954 until this new PR merges and is deployed.
**NEXT:** When checks/review pass, merge the new PR, manually deploy to Render, verify data freshness and published incidents. PR #101 CARTO direct-asset approach remains separate pending browser testing.

## CHECKPOINT — Oregon TripCheck DNS degradation and resilient fallback (2026-10-11)
**TASK:** Render confirmed `EAI_AGAIN www.tripcheck.com` and a missing stale fallback while other CCTV sources succeeded. Preserve WORLD map/news availability without wasting retries.
**DONE (PR #109):** Two bounded upstream attempts (4.5s each, 250ms delay), transient DNS/socket/HTTP-5xx classification; validated same-source local 7-day last-good camera index; atomic file replacement, partial-inventory protection, five-minute in-process cooldown without repeated empty fetches; strict source age, no fabricated cameras. Added targeted retry, backup, cooldown and partial-inventory tests. Production remains unchanged until merged and manually deployed.
**LIMITS:** Render Free local disk is ephemeral and lost on new containers. Durable cross-deploy historical fallback is not implemented. Zero prior successful inventory on a new container means no fallback. No proof of camera availability from external HTTP probes when DNS tester fails.
**VERIFY:** Required WORLD typecheck/Vitest/build/privacy CI, PR review resolution, Render deploy SHA and live health/camera smoke. The old Render deployment is still on `1e4c6983` until explicitly updated.
**NEXT:** After #108 and #109 checks/merge, trigger Render manual deploy and verify `/api/health`, `/api/news`, APP iframe canvas and `/api/cctv` regional summary. External unresolved provider incidents remain low priority if main services work.

## CHECKPOINT — Daily maritime references, count-only panels and regional fires (2026-10-10)
**DONE (draft branch):** Changed `LayerPanel` to names/toggles/counts only; simplified `MenaPulse` to time-filtered counts and removed its needless source-coverage and history refresh calls. Shut off USGS earthquake polling and volcanism feed, prevent restored earthquake toggle and GDACS EQ/VO events, enable NASA FIRMS fire layer in WORLD/APP embed only within MENA/Africa and existing conflict theaters. Cable and maritime layer reopens reuse downloaded snapshot. `/api/maritime` server/CDN response has 24h TTL. Verified independent external Gulf monitoring projects, recorded constraints/license and NASA FIRMS MAP_KEY/NPP retirement. See [WORLD_DAILY_DISPLAY_AND_REGIONAL_FIRE_POLICY_2026-10-10.md](WORLD_DAILY_DISPLAY_AND_REGIONAL_FIRE_POLICY_2026-10-10.md).
**VERIFY:** No production delivery yet; required GitHub typecheck/Vitest/build/privacy and desktop/mobile APP/WORLD visual smoke, no empty fire claims without provider response.
**BLOCKERS:** Stacked dependencies #105→#107→this PR. #107 failed one stale public-defaults snapshot assertion; fixed test in #107 and this branch. Existing AIS WebSocket collector runs independently of daily client/server cached output; no durable single-scheduler proof. Candidate feed endpoints not yet live-tested, so **no new external project integrated**.
**NEXT:** Confirm CI and end-to-end smoke; evidence before merging; after strict source/license verification consider adding independent Gulf official RSS to existing MENA ingestion pipeline, with dedupe and no operational tracking.

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

## 2026-10-15 — Published map integration and owner-directed presentation

DONE: Added bounded server ISWN KML/RSS collector and a separate public reference layer in the existing WORLD/APP map. Full refresh12h or recent major publisher report; scheduled check15min. Added pre-cache/final Saudi geometry masking and count repair, distinct IDs for repeated area labels, honest source dates/stale fallback and retry. Owner-directed UI removes atlas/source dashboard and map numbers; named Yemen Houthi/government areas receive red/green waves, explicit facility/equipment names receive glyphs, news goes into glass Alerts cards, former library becomes Maps2D/3D. Ordinary attribution remains; source/date metadata is retained. See docs/ISWN_REFERENCE_MAP_CONTRACT_2026-10-15.md.

VERIFY: Current candidate local tests/build and Chrome verification are recorded in the change review. Real local API returned200 with7,508 public reference features across9layers;174 dated annotations (Regions2024-06-02), overall map publication dateunknown. Chrome showed no atlas/library dashboard, no reference counts, red/green Yemen areas and glyphs, glass news cards, and working2D/3D selection. No live production claim.

BLOCKERS: Candidate not merged/deployed; central workflow inactive until reviewed default-branch release. Local preview uses memory cache; production shared persistence must be confirmed. Existing WORLD PR132/Vercel deployment and SHA gates still apply.

NEXT: Review the final stacked PR after PR132, complete CI and release gates, verify shared cache and deployed/API scheduler, then verify APP iframe and production SHA. Do not treat repeated source retrieval as new field evidence.

FINAL VERIFY: 948 tests PASS,18 explicitly skipped; Next production build and TypeScript PASS; targeted new-helper/parser/API/presentation ESLint PASS. Chrome DOM: no atlas dashboard,0 library buttons,8 glass news cards, no horizontal overflow.2D/3D selection exercised, final Yemen red/green areas and facility glyphs shown. No production deployment or automatic schedule activation performed.

REVIEW: https://github.com/TU4714315/m3tm-world/pull/133 (draft, basePR132 branch). Local feature commit745683b; final follow-up ensures idle-map wave repaint. GitHub verify-world/public-email-privacy began; Vercel check returned Account-is-blocked link https://vercel.com/knowledge/why-is-my-account-deployment-blocked. No billing/provider settings changed. Always pass --repo TU4714315/m3tm-world to gh: the inherited gh default points at upstream simplifaisoul/osiris.

CI DELTA: public-email-privacy flagged a synthetic URL userinfo fixture as an email-like value. The test now builds URL credentials through URL.username/password instead of an email-like literal; no guard exemptions were added.9 parser tests and full-diff privacy scanPASS locally. No actual personal email was added.

## 2026-10-15 — Owner-authorized viewing tiers (12h public delay)

DONE: Implemented server-validated published-map grants paired with APP viewer-access. Anonymous receives source-dated news after12h from retained7daybuffer; no undated/future/fresh headline leakage. Yemen territories/frontlines/conflicts, military aggregates, cameras and live media are locked. Restriction covers direct API/media routes and persisted URL selections. Glass lock cards contain synthetic placeholders; lower strip is news only. Approved APP sessions exchange a scoped60s grant automatically; temporary guests use the existing15daycode. Exact military-track and Saudi masking stay enforced. Scope excludes raw SDK, private enrichment/analysis and tools; ingestion retains its own API key.

REVIEW FIXES: Serial cookie writes place logout DELETE after an old POST; explicit parent logout blocks member cookie resume. Late map/dossier responses are generation-guarded and demotion clears dossier/player state. All protected final responses have no-store regardless of dynamic provider cache policy. See docs/PUBLISHED_MAP_ACCESS_2026-10-15.md for rollout and limits.

VERIFY: Final full WORLD suite976passed/18explicitlyskipped; TypeScript/Next production build and targeted security-helper lint passed. APP555frontendtests, full lint/typecheck, Vite build/isolation and37Deno tests passed. Real local HTTP map200, anonymous atlas403 and camera403. Chrome session changed from3to4 but CDP focus command timed out twice; new visual/real-approved-session E2E remains unverified.

BLOCKERS/NEXT: Local candidate only until draft PR/release. Coordinate APP PR426 and WORLD access PR stacked on133; deploy Edge action code and reconcile existing invitation migration history first. Configure server publishable key, shared Redis and collector-only WORLD_MAP_REFRESH_TOKEN; do not reuse invitation code as collector secret. Current Saudi masks were not lifted: implement separately reviewed restricted geographic projection before claiming Saudi unlock. Historical influence areas do not establish current advances. No production permissions, secrets, data, guest activation, email or deployment changed.

## 2026-10-15 — Owner-facing labels omit implementation/provider names
DONE: Generic Arabic layer/view labels replace provider/tool names; removed provider/source-diagnostic rows from map popups, camera headings and terrain settings. News publisher remains once with its story; event dates/uncertainty and required live map attribution remain. Backend provider IDs, adapters, metadata and data access are unchanged.
VERIFY: TypeScript and11targeted layer/popup tests passed; final related terrain/camera checks recorded in follow-up. Existing CameraViewer/LayerPanel lint errors (any/state-in-effect) remain outside these text-only edits; no blanket lint pass claimed. No deployment or new visual browser verification.
NEXT: Follow existing draftPR134 and paired APP426 release dependencies. Owner wants a clean product UI, no atlas/library/tool/provider explanations; keep news source once and required copyright credits.

## 2026-10-15 — Clear map and separated news/earthquake feeds
DONE: Public/embedded map defaults to bright natural imagery; Yemen/MENA focus buttons preserve the chosen basemap instead of forcing dark. Legacy display settings migrate once without losing location or data-layer choices; legacy night shadow/relief stop auto-covering the image. Subsequent explicit night selections remain supported. LiveAlerts now opens on news and has distinct news/earthquake/live tabs, no mixed All tab or mixed counter. News ticker remains news only. Invitation code location verified in APP owner Permissions controls; production code remains disabled/unreleased.
VERIFY:978tests PASS/18explicit skips, Next production build/TypeScript PASS; targeted workspace/presentation lint PASS. Chrome5 local tab2019561720 visibly showed natural bright Yemen image, Arabic labels, readable news cards, image choice retained after focus and2D switch. News/quake tabs were clicked separately; no earthquake telemetry in news and no horizontal overflow. An old imagery-tile gap resolved after load. Screenshot shown in browser tool; no local screenshot file claimed.
BLOCKERS/NEXT: DraftPR134/APP426 remain unreleased; invitation enablement/real guest-member flow/shared cache and existing production release dependencies remain. This visual fix does not change access permissions or activate codes. Latest one-line embed default matches the verified standalone imagery; real production iframe still needs release smoke.


## 2026-10-16 — Unified news, retained layers and selective upstream upgrades
DONE: News cards and news-only ticker share transparent glass/Newspaper icon, readable plain headlines and one safe publisher link. Red breaking badge requires explicit publisher flags/prefix; risk score only ranks. Preserved explicit flags in APP feed adapter. Layer rail is six groups plus All; all40 existing controls retained, four weather controls added. Civil aviation starts enabled; sdk_air now draws commercial aircraft and fallback, and public flight retries recognize actual civilian lists without restricted status metadata. Published static lines now survive safe parser/browser projection, coarse quantization and Saudi-intersection rejection; atlas cache v3 refreshes prior line-free snapshots. Owner red-Houthi/green-government semantics retained; undated historical areas are not represented as live advances.
UPSTREAM: Selectively ported master13e5401 Wind/Rain with time controls, forecasts/interpolation, radar animation, limits and Arabic UI; source credits remain in attribution, not panel headings. Added strict rain tile-host/body/time limits and bounded wind GRIB decoding/downloads. Ported Style Studio control previews/fullscreen while retaining all35 local controls/custom mobile opacity. Restored public Ontario/Alberta camera adapters without changing camera access/proxy guards or dropping unrelated Canadian feeds. Reused APP canonical vector emblem in WORLD, APP WORLD portal and dashboard sidebar; no second identity or product-scope change.
VERIFY: WORLD1016tests PASS/20explicit skips, full TypeScript/Next production build PASS; focused new/changed-helper/UI lint PASS. Existing broad page/map/LayerPanel lint debt was not represented as a full lint pass. APP556tests/full lint/typecheck plus Vite build/public bundle-isolation PASS. Live local weather200:13rainframes/65windtimes; live camera indexes Ontario925 and Alberta337. All40previous layer keys retained, fouradded. APP/WORLD canonical component contents match. Changed imagery tooltip wording after build passed its two affected tests. No private credentials or deployment changes.
BLOCKERS: Chrome local tabs return initial server-rendered screen but document-response inspection stalls; DOM/CDP/screenshot attempts did not prove hydrated glass/map interactions. Both dev5194 and build5195 served200, build succeeded; no new final visual/mobile acceptance claim. Existing PR134 Vercel check reports Account is blocked. Real approved-member/guest/media/email flow and Saudi authenticated unlock remain pending coordinated release; invitation remains disabled/unreleased. No production role/secret/mail changes.
NEXT: Review paired draftPR134/APP426 and existing parentPR133, resolve preview/account and previous release dependencies, then perform real Chrome desktop/mobile, guest/member and deployedSHA acceptance. Broader upstream OI/ONNX capabilities remain separately scoped; no wholesale merge or capability removal.

FOLLOW-UP: CI email-privacy guard flagged two synthetic credential-bearing URL fixtures. Replaced the news fixture with example.org and constructed the radar URL via URL username/password setters, preserving both credential-rejection tests without public email-shaped literals.13affected tests PASS and unchanged privacy guard reports zero findings across the entire PR diff. No guard allowlist or security behavior changed.

## 2026-10-16 — Executive audit repairs
DONE: Bulk All/clear acts on eligible data layers only; display/night/terrain and child preferences stay independent. All44 controls remain available. Reference popups always show dated-reference or undated-reference context. Collector-only major-event dispatch carries a bounded stable id, survives cooldown/failed collection and cannot be forced by viewing grants or query strings. Published evidence dates/state are derived from retained annotations, independent of retrieval success; no current-control assertion is made.
VERIFY: WORLD1028tests PASS/20explicit skips; full TypeScript and focused changed-helper lint PASS. Final production build and current-head CI are recorded in the paired review. No production access, provider, secret, role or deployment changes.
OWNER DECISION: Temporarily remove invitation requirements from published map layers and news including Yemen; no intentional12h news delay. `PUBLISHED_MAP_INVITATION_REQUIRED=false` in mapAccessPolicy is the shared server/client rollback setting. Actual grants stay genuine; reviewed read-only published routes open, internal tools/enrichment/raw SDK and unreviewed routes stay protected. Published aggregates retain coarse precision and Saudi suppression. Client member-only dossier state still clears on demotion.
VERIFY FINAL:1031WORLD tests PASS/20explicit skips and TypeScript PASS. APP568tests/full lint/typecheck, Vite build/isolation PASS; fresh Yemen RSS regression admits a one-second-old story. Current-head build/CI/visual results are recorded in the paired review.
BLOCKERS: Drafts remain unreleased. Existing preview-account and release prerequisites, real media/remote iframe acceptance remain. Invitation backend/mail stay deferred and are not needed for temporarily open published layers. Saudi authorized geographic unlock is not implied by this repair.
NEXT: Review draftPR134 with APP426 and parentPR133. Preserve all upstream additions; finish current-head CI/visual evidence and coordinated release checks before any merge/deployment.

## 2026-10-16 — Missing Yemen monitoring investigation
DONE: User's Chrome preview5194 was connection-refused; restored the existing local preview. Both Yemen focus buttons now share a preset restoring published areas/fronts/events/news/borders and clearing quiet/hidden-marker presentation, instead of enabling only reference_atlas. Mobile focus closes the overlay rather than hiding the map. Existing aviation/weather and other controls remain independently selected.
EVIDENCE: Local published snapshot includes29 named Yemen government/Houthi polygons across the shared Regions folder; the separate Yemen folder contains point/line annotations. Sampled current APIs also contained4 Yemen GDELT reports and35 Yemen-related news headlines. These are published observations, not verified territorial advances. CORRECTED:2024-06-02 belongs to a mixed-country Regions folder label, not an independently verified Yemen geometry modification date. Never infer item freshness from folder naming or collection success.
VERIFY:1034tests PASS/20explicit skips, TypeScript/Next build PASS,22targeted regressions PASS. Added a production-build Yemen browser scenario to CI: actual published snapshot/camera/readiness and screenshot artifacts, no user browser profile uploaded. Chrome UI automation still stalls after initial page state; no final hydrated Chrome screenshot claimed before CI proof.
BLOCKERS/NEXT: DraftPR134 not released; production APP still references its separately deployed WORLD origin. Inspect new browser capture/current-head checks, preserve all existing layers and protect real source dates. Current territorial change needs a newly dated published comparison; no fabricated advance polygons.

YEMEN BROWSER PROOF:83172d2 CI passed7/7browser checks using current camera/canvas attributes; actual snapshot18Houthi/11government regions, correct Yemen camera/2D and no JS/render errors. Initial smoke's obsolete map-status selector was repaired rather than bypassing readiness. Published recovery `/api/reference-atlas` returns404HTML: current production cannot show the new atlas until coordinated release. Event timestamp now comes from the click event to avoid a new render-purity lint error; broad pre-existing page lint debt remains.


## 2026-10-16 — Public copy and original-map synchronization
TASK: Hide system/provider explanations from public readers and follow edits to the owner's original map without a12h collection lag.
DONE: Removed folder/evidence-date copy, parsing/precision disclaimers, source dashboards, startup diagnostics and provider-name flight-link labels from the public map; retained all44layer keys, actual event/type/affiliation data, one news publisher link and required attribution. APP removes precision explanations, route-proof link duplication and source/quality diagnostics. Source and evidence metadata remain in backend records; no access/precision/Saudi masking rule changed.
SOURCE CORRECTION: Direct owner viewer and KML both returned200. Export has7726placemarks, no per-feature TimeStamp/TimeSpan, only gx_media_links ExtendedData. Mixed folder2024label must not date Yemen geometries. Removed folder-date inheritance; raw folder names retained. No shape changes between the two sampled exports, which does not prove any publisher cadence.
REFRESH: Visible map tabs check the shared snapshot every minute; full source fetch due after5minutes independent of RSS, with2minute report/retry cooldown, existing major-event dispatch/singleflight/bounded parsing retained. Idle scheduled workflow still checks every15minutes. V4cache migration preserves old last-good geometry and removes inherited dates even when upstream fails.
VERIFY:1036WORLDtests PASS/20explicit skips; full TypeScript/production build PASS. Static audit versus pre-change HEAD found no added lint diagnostics; existing page121errors/map179errors/LayerPanel5errors remain baseline debt (map candidate178). APP final validation is recorded with paired PR426. CI Yemen scenario now opens the actual legend and checks affiliations without2024/source explanations. Current-head browser CI is pending at this handoff; no local hydrated Chrome screenshot claimed.
BLOCKERS: Draft134 remains stacked on133; Vercel account blocked. Production recovery /api/reference-atlas is404HTML, so production cannot show this integration yet. No production deploy, permissions, secrets, migration or mail changes.
NEXT: Verify new-head CI/artifacts for134/426, preserve source uncertainty and44controls, then coordinated reviewed release and real production iframe/media acceptance.


## 2026-10-17 - Authorized production release and scheduler follow-up
DONE: Owner authorized merge/deploy. WORLD134 merged as e4d7092 (exact reviewed runtime tree), APP426 as c115786. Existing Render service deployed e4d7092 in dep-db9kpobncjis739naf10 and reports live; APPPages push39024742349 succeeded. Published atlas200/7544features/29namedYemenareas/sourceDateNull; embed200/CSPallowsAPP; privateSDK403. News fresh160/160validtimestamps/45successfulsources. No DNS, secrets, roles, migration or mail activation.
FOLLOW-UP: Scheduled checks lacked the optional collector secret. Ordinary polling now uses the existing published-read API and still honors server403; explicit major-event dispatch requires a valid collector credential and stable id. Added7offline subprocess regressions. Added an isolated CI check of the deployed APPiframe handshake/news because BrowserUse pauses the document response in the user Chrome session.
VERIFY:1043WORLDtests passed/20skips;7collector regressions and focused lint pass. Final TypeScript/build and new-head CI are pending at commit. Runtime files are unchanged by this follow-up; it updates the GitHub poller and observational browser harness only.
NEXT: Merge follow-up after required checks; manually run scheduled poller and inspect deployed-frame screenshot/report. Record final release proof in task outputs.


## 2026-10-17 - Live refresh timeout repair
EVIDENCE: Main135 scheduled check39026356447 reached the deployed atlas endpoint but exceeded55s. Independent production browser39026038195 passed4/4iframe/news checks; other published APIs remain200. The atlas singleflight can remain pinned when an upstream fetch, stream read or body cancellation ignores abort.
DONE: Add an explicit wall-clock race around the entire XML operation, abort its transport, release the collector singleflight and cancel rejected/oversized bodies without awaiting an uncooperative upstream. Last-good regions and fetchedAt remain intact on a failed refresh; subsequent checks can retry. No layer/access/provider removal.
VERIFY:1047tests pass/20skips;18collector tests cover stalled fetch/read/cancel and preserved last-good data. TypeScript/build and current-head CI are pending at commit. NEXT: merge reviewed fix, deploy exact commit on existing service and rerun the real scheduled poller before declaring synchronization verified.


## 2026-10-17 — Coordinated WORLD #137 / APP #443 public news and regional layer integrity

**TASK:** Raise the visibility of the WORLD ticker; use only approved APP-origin headlines and open matching APP public story cards; prevent publisher URLs and names in ticker display while preserving original API/APP evidence, and repair honest field-alert and map-state behavior.

**DONE:** Branch #137 updates `GlobalStatusBar.tsx` to filter `feed_origin=m3tm-app`, use larger M3TM ticker branding, and navigate to `https://m3tm.app/news?story=<encoded-id>#news`. Publisher evidence remains available outside the ticker. Public alert conversion requires APP-published coordinates, a recent timestamp and a safe canonical original URL; coordinates remain regional 0.5° grid. WORLD map toggling hides alert icons, labels and GeoJSON on off, rather than leaving a stale symbol. The panel reports off, pending, failed, empty-after-success and published-data states based on endpoint outcomes. Public news metadata distinguishes a publisher report from multiple publication venues without labeling either independently verified or confirmed. Desktop HUD clearance for taller ticker is retained. NIGHT/SATELLITE selector, APP public iframe controls and public regional conflict/military aggregate renderer already exist on pre-change main; no fine-grained military trajectory or guessed geolocation added.

**VERIFY:** Current branch #137 needs full `npm test`, `npx tsc --noEmit --incremental false`, `npm run build`, responsive and published iframe checks. Older scheduled atlas run 39048865610 returned status ok, fetchedAt 2026-10-17T16:19:20.574Z, featureCount 7544 with sourcePublishedAt null; this is *fetch* evidence only, not event verification, Yemen recency or operational positions. Render live main before this PR is 6e376c2b, autoDeploy off; do not assume the branch was deployed.

**BLOCKERS:** Final CI/required comments and release checks must pass before merge. Cross-project APP #443 must be live before WORLD links to it. Workspace Core old checkout contains many mixed/unstaged changes and must not be reset or overwritten. Exact isolated CONTINUE_HERE.md was not present in the mounted project root; verify its detached worktree separately if available.

**NEXT:** Resolve current reviews, merge APP #443 first, then WORLD #137 using exact-head guard; trigger one coordinated Render deploy (autoDeploy off) and verify actual deployed commit plus API/iframe/map controls and Saudi public geographic masking. Report empty versus technically failed layers from observed runtime signals, never fabricate an event.


## 2026-10-17 — Post-deploy provider state follow-up

**EVIDENCE:** WORLD #137 was merged at f57a581868cebb170af3d8b92509cb2513a45192 and Render deploy dep-db9qp1gm7kps73ed8n10 became live at 17:14:04 UTC. The main-commit scheduled atlas run 39052951120 passed with fetchedAt 2026-10-17T17:14:50.566Z, featureCount 7544, sourcePublishedAt null. This is successful retrieval of reported cartographic features, not independent confirmation of military events. Runtime logs after deployment include OpenSky 429 and a flight-fetch timeout; the public military regional layer must not display a successful-empty message merely because /api/flights returned HTTP200 with provider_healthy=false.

**DONE:** Follow-up branch fixes the regional military layer status to consult the published aggregate's provider_healthy flag after successful transport. Shows unavailable-provider wording for zero observations and identifies existing observations as potentially previous data. The display never reveals aircraft identifiers, exact movement tracks or unpublished positions. Regression test covers unhealthy/healthy and last-good states.

**VERIFY:** CI must run unit, TypeScript, build and privacy on this follow-up; only merge and deploy after all required checks and reviews. Previously validated APP #443 Pages SHA f4d4923bad682f1f215594653d0e8f86e4744255 remains unchanged.

**NEXT/BLOCKER:** Ads-B upstream availability is external; OpenSky 429 cannot be fabricated away. Keep clear age/availability semantics and observe real aggregate availability after provider recovery. This is a display/provenance correction only, not proof that public military data is presently flowing.


## 2026-10-17 — Narrow public map projection performance patch

**EVIDENCE:** Live WORLD main e1138adc remains Render Live; Chromium acceptance WORLD #139 intermittently had slow initial MapLibre canvas, while direct WORLD/APP embed succeeded in other runs. The page has 24 initially enabled layers (of 49), starting as globe + satellite, while published atlas fetch can return 7544 reference features. Render app logs also showed source errors including OpenSky HTTP429, transport ECONNRESET and bounded frontlines retry. None individually proves an exclusive slowdown root cause.

**CODE-LEVEL FINDING:** In `src/app/page.tsx`, `publicMapClientProjection(dataRef.current)` was invoked during *every* React rerender even when no source payload had changed; it allocates new regional aggregate arrays and a new masked object. `sdkDisplayData = useMemo(...,[data,embeddedLiveFeeds])` therefore always invalidated, needlessly processing map data when toggling panels, map view, backend status, or hover state.

**NARROW FIX:** Memoize the public projection using `[hasMapAccess, dataVersion]`. Every dataRef write already advances dataVersion; permission changes always invalidate immediately. No changes to sources, precision, masking, access policy, 24 default layers, selected satellite/geographic mode, or polling cadence. Add test to prevent accidental regression.

**GATE:** Run all required WORLD CI, security and runtime checks. Benchmark actual browser frame load/paint separately; a projection memoization does not prove tile latency, cold Render startup, GPU overload or provider errors disappeared. Do not touch mixed local workspace changes; use remote branch and exact-head PR.


## 2026-10-17 — Lightweight progressive WORLD map startup (#141)

**EVIDENCE BEFORE:** Chromium production baseline on Render main 35d4645, workflow 39069523295: WORLD desktop responseStart 0.914s / first canvas 27.263s / first usable map 35.069s; mobile 0.922s / 30.796s / 45.353s; direct embed 0.816s / 70.592s / 73.473s. ArcGIS imagery counts: 67 desktop and 151 mobile requests. Headless SwiftShader rAF scheduling 2–11 Hz is not actual MapLibre WebGL FPS. These samples prove significant startup/render cost, not one exclusive bottleneck.

**DONE:** First-visit defaults change from Globe/ArcGIS satellite to Mercator/dark (explicit 3D and satellite choices remain). The selected user layer preferences and server ingestion are unchanged. Before the first ready callback, only costly visual sets are staged: reference atlas/frontlines/density/routes, SDK sea cables, full/comms satellite catalogue and decorative overlays. After 1600ms, the exact requested flags are restored. MENA conflict events, APP news, field alerts, country borders and public military/naval regional aggregates stay available immediately. Visible map layer props now use stable memo identity instead of new objects on every HUD redraw. Permission/access boundary remains reactive, Saudi public masking and private OSINT unchanged.

**VERIFY:** Full current-head WORLD CI, TypeScript, unit/build/privacy and APP frame gate first. After deployment, rerun the identical PR #139 read-only live browser benchmark on desktop/mobile/embedded, collect first usable map, TTFB, resources, JS heap and rAF proxy. Do not claim a gain or WebGL FPS before measurement. Validate style/3D switching, RTL, alerts and correct APP headline deep links.

**BLOCKERS:** External ArcGIS/Carto tile latency, OpenSky 429, GDELT timeouts and separate viewer snapshot HTTP404 may persist. Do not display stale source data as live or invent missing regional events. Mixed local workspace must not be reset; untracked backup requires independent verification.


## 2026-10-17 — Approved APP news ticker bounded recovery (#142)

**Evidence:** Chromium live WORLD desktop after #141 (run 39070866442) had a working map but a truthful empty approved-news ticker; an independently queried live /api/news subsequently contained 94 items, including 42 feed_origin=m3tm-app and 52 independent-rss. This is an intermittent source timing/fetch condition, not evidence that external RSS should be rebranded as APP news.

**DONE:** The WORLD public news loader now retries twice at 12 and 32 seconds after cold start only if no valid M3TM.APP-origin item is present, then returns to its existing 60-second refresh cycle. Retry windows are cancelled on unmount; hidden pages do not issue the extra requests. Original publisher provenance remains unchanged; neither empty nor failed cycles create synthetic articles. Unit tests guard valid approved input, external-only response, missing timestamps and bounded retry. In addition, the public APP iframe no longer resets its initial basemap to the costly ArcGIS satellite imagery after #141 selected lightweight 2D/dark defaults. Both 3D and satellite remain manually selectable, and no public event source or layer grant is modified.

**VERIFY:** Full current-head unit/build/privacy CI and read-only browser acceptance; if the approved feed remains empty because the original APP endpoint itself is empty or unreachable, the UI must continue to show honest no-news state. #139 still tracks live desktop alert-panel access and variable third-party map load.

**BLOCKER:** No guarantee that every cold Render request receives fresh APP feed content; CDN/provider conditions may vary. This patch cannot convert unverified/older independent RSS items into approved M3TM.APP titles.


## 2026-10-17 — MapLibre asynchronous chunk hydration watchdog (#143)

**Evidence:** Production APP iframe Chromium run 39075201684 had a loaded WORLD child document, 374×398 viewport, 20 Next page scripts and WebGL2 supported, but zero map containers or canvas after prolonged waiting. Therefore absent `m3tm:ready` can occur *before* `WorldMap` mounts; its internal 14+15 second style fallback cannot catch this case. Direct WORLD embed can pass in separate runs, so this is intermittent, not evidence of universal failure.

**Change:** Add a client-side pre-MapLibre watchdog starting on visible frames. After 45s without true map ready, display a truthful, dismissible-on-late-success delay overlay and explicit manual whole-frame reload button. This explicitly resets failed lazy-import promises and a latched ErrorBoundary; it does not start a recurring retry, fabricate a map, enable hidden layers or change APP authentication. Hidden tabs do not count down, and elapsed visible time is preserved across tab switches. On explicit restart, reset map instance key and staged heavy visuals, preserve user choices and all original source attribution. Unit fake timer checks cover visibility, manual retry and late success.

**Gate:** CI/unit/typecheck/privacy; real Chromium before/after in standalone desktop/mobile and APP embedded. A watchdog proves no indefinite silent spinner, not that the lazy chunk has loaded or that FPS improved. Track missing initial canvas as outstanding until repeated runs show no evidence of stall.

## 2026-10-17 — Second-pass MapLibre source-write and bundle optimization

MEASURED BASELINE: APP main 5641010c, WORLD Render main cc8f2582. PR #139 merged; real Chromium production run 39076719234 recorded WORLD first usable 20.674s desktop, 34.395s mobile, 34.636s standalone embed; responseStart 0.327s, 7.664s, 8.053s. Each is one run, not median/P95. SwiftShader rAF scheduling is not WebGL FPS.

DONE ON BRANCH: Optional satellite cards, weather bars, CCTV/news previews are code-split instead of static map-bundle prerequisites. Dormant inactive preview components no longer mount. GeoJSON writes for identical small/medium values are skipped with exact full-payload comparisons stored in a WeakMap keyed to the actual MapLibre source; large payloads always update, and style replacement gets new source identity. Redundant layout visibility writes are skipped. Tests verify changed events and new sources.

GATE: CI unit/build/privacy first, then deploy only under release policy and remeasure real Chromium desktop/mobile/APP iframe repeatedly (TTFB, first canvas, map-ready, network bytes, JS heap and rAF proxy). No speed or GPU FPS improvement is claimed until measured. Do not remove public events or bypass internal OSINT separation.

EXTERNAL LIMITS: OpenSky 429 and GDELT timeouts need backoff and explicitly stale last-good data; memory-only atlas cache does not survive instance restart without configured Redis. Null atlas sourcePublishedAt must remain unknown rather than invented. Viewer snapshot HTTP404 needs backend-function/schema review before safe publish.


## 2026-10-17 — Scheduled reference atlas local-backoff recovery (replacement for outdated PR #145)

**EVIDENCE:** GitHub Actions run 39078969029 checked out workflow SHA cc8f258247722f02cd23b491482eb7b62a5c20ef. It queried the independently deployed WORLD Render endpoint and received a stale reference snapshot with 7544 retained features, fetchedAt=2026-10-17T23:20:08.986Z, nextRefreshAt=2026-10-17T23:27:18.386Z, cacheBackend=memory, sourcePublishedAt=null. The GitHub SHA alone does not prove the separate Render deploy SHA. The two-minute retry interval is WORLD's own ISWN_CHECK_MS after an upstream fetch failed, NOT a policy imposed by the publisher.

**DONE ON BRANCH:** A scheduled source-check retries just once no earlier than the locally advertised cooldown and at most 150 seconds out, preserving source-contract verification and nonzero exit if the second attempt remains stale/unavailable. Major-event dispatch never silently retries. Runner timeout is six minutes. The new helper and tests are added to required WORLD CI path filters, alongside four-case bounded retry policy coverage. No fabricated event dates, new endpoints, redis secrets or automatic external URLs.

**BLOCKERS:** cacheBackend=memory is process-local and cannot survive Render restart; Redis/Upstash-compatible REST credentials are not configured. sourcePublishedAt stays unknown because per-feature publisher dates are unavailable. Do not label the 7544 reference features as independently verified events/current control. Subsequent failed source reads are an external provider issue rather than false evidence of a successful refresh.

**NEXT/VERIFY:** After protected CI and release merge, inspect a newly scheduled workflow run with status and retryAttempted. Verify main SHA and Render live SHA independently. A stale final state remains a failure and should be surfaced, not concealed; do not redeploy Render solely for a GitHub scheduler change.


## 2026-10-18 — CARTO vector basemap critical-path warming (#149)

**Evidence:** Read-only production Chromium WORLD #148 against Render 3851f60a: desktop/mobile direct and direct embed browser cases passed, but MapLibre was not mounted inside APP's desktop and mobile WORLD iframes at the observation deadline (jobs 117538296334 / 117538296318). A direct embed run needed 90.675 seconds to reach a map usable frame, and another mobile run 103.631 seconds. The two APP frames had complete HTML, correct fixed Render origin, WebGL2 availability, and no logged top-level JavaScript exception. This is **not** evidence that the news or reporter data are false. The n=3 release Playwright comparison #147: before #144 desktop mean 67.093s / after 34.562s; mobile 35.879s / after 27.785s; APP iframe 44.804s / after 39.799s. Much of the desktop variation is TTFB; no WebGL FPS claim.

**Change:** Preconnect to the actual CARTO basemap style and vector tile hosts and preload exactly `https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json` with matching CORS mode directly in the server-rendered HTML layout. This overlaps TLS/DNS/style download with lazy MapLibre JS hydration and avoids server-side tile proxying; it does not alter the source/style, Arabic labels, default 2D/night, alert or military privacy. Regression test guards exact style URL alignment and only one preload. It cannot alone resolve an unavailable WebGL context or failed client chunk.

**Release gate:** full current-head WORLD CI and privacy; merge/deploy only if protected checks pass. Repeat five production browser scenarios and 3x cold-start Playwright comparison on the exact deployed commit. Treat lower/higher numbers as observed rather than guaranteed gains, report n/median/mean/sample maximum (P95 proxy) and TTFB separately. If APP never receives m3tm:ready the browser acceptance is still failed even if direct WORLD passes. APP companion #449 handles a narrow fixed-origin HELLO race, not map rendering.
