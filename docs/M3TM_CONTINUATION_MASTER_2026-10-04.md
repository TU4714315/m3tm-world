# M3TM — MASTER CONTINUATION / خريطة الاستكمال (2026-10-04)

> **Entry:** Start with this file; do not regenerate project discovery. Runtime Git/CI and production health always outrank an older handoff. WORLD remains public; APP owns shell, news, auth and private tools.

## Commands & actual baseline
- WORLD `TU4714315/m3tm-world` → `https://m3tm-world.vercel.app`. Protected `main` baseline `1b1e0cd18a801e260930d8f8e36b05ac9bd8c44f` from merged PR #58. The baseline production passed Vercel deploy, reported `health=operational`, conflicts/GDELT `live`, ACLED OAuth `ok` with **0 ACLED event rows**. Sample counts (2026-10-04): 45 conflict items, 83 GDELT, 82 single-publisher and 1 multiple-publisher report. Counts change.
- APP `TU4714315/m3tm-app`, `https://m3tm.app`. Protected `main` at inspection `3124d9a3470c64760964798276d48b2427b46c48`. First read `AGENTS.md`, `docs/M3TM_EXECUTION_CONTRACT.md`, and `docs/AI_HANDOFF.md`; APP contract scopes current work to P0 Reliability/Auth and P1 Consolidation. Do not introduce a new public operational shell.
- Local WORLD worktree has historically been dirty; **never** reset, clean, stash, checkout over or publish its changes without `git status --short --branch`. The latest direct workspace command returned `Tool exec_command not found`; use isolated GitHub branches if local status cannot be established.
- Tests: `npx tsc --noEmit --incremental false`, `npm test`, `npm run build`; Vercel Preview and protected merge gate; production `/api/health?deep=1`, `/api/conflicts`, `/api/gdelt-events`, plus WebGL desktop/mobile view.

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
