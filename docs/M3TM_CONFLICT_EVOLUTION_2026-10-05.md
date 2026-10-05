# M3TM Conflict Evolution — factual historical news atlas
Date: 2026-10-05. Status: **stacked QA draft**, depends on WORLD PR #68 and APP governance issue #360.

## Goal and critical critique
Existing many-layer M3TM map shows points, not auditable regional chronology. A visual history must distinguish (1) machine-coded reports, (2) verified incidents, (3) humanitarian impacts, and (4) territorial control — these are independent products. OSIRIS / WorldMonitor are product benchmarks; no superiority claim without same-period measurements, and no code or branding imported without license audit.

## Implemented on this branch (NOT production)
- Arabic right-to-left /conflict-evolution interactive MapLibre page linked from M3TM Fusion Radar.
- Geographic viewing frames for MENA, Yemen/Red Sea, Saudi/Gulf, Iraq/Iran, Levant (bounding boxes are not territorial claims).
- Histories 1h/6h/24h/7d, replay slider/play/pause, classification of published violent news reports, unrest, and statements/diplomacy.
- Two explicit animation interpretations: per-source-bin snapshot versus *cumulative available NEWS-sample footprint*; the latter is NEVER territorial advances or expanding control. UI legend explains the cumulative sample bias.
- Real archived SOURCE publication timeline with 3° grouped report-map cells and original article URLs. Region-wide report totals and selected bounded sample counts are explicitly distinguished.
- Pure deterministic tests for zero stored-report slots, geo grouping, news type separation, duplicate IDs, invalid geodata and no identifiers/URLs in map GeoJSON; required workflow watches new source paths.
- No migration, cron, third-party key, new source scraping, private-OSINT/public bridge change or individual military units/tracks.

## Data quality and limits
- News coding is NOT incident confirmation, actor culpability, expanded military control or battlefield observation.
- Row samples are newest-first with a 200 cap. The published source archive may have many more rows. Current map therefore shows SAMPLE distribution only, not entire period's spatial intensity. 7-day coverage needs 672 eligible source export windows across a real continuous week.
- Full source time-bin totals are for ALL MENA countries/types and do not become narrower country/category totals when a filter is applied. This limitation is displayed explicitly.
- Empty archive slots mean no STORED report observed; never infer an absence of fighting or population impact. Time of a report's source file is not actual incident date.
- GDELT 2.0 machine events, independent news links, ACLED licensed constraints, future OCHA/UCDP sources must remain distinct.

## Next product milestones (not claimed complete)
1. APP owner to resolve #360: shared Supabase quota/cron ownership and safe rollback, or use an isolated WORLD project. Parent #68 must not merge while P1 review open.
2. Independently vetted full coarse regional space-time statistics (not newest-200 sample): bounded geospatial materialized aggregate with actual coverage and source clock metadata. Requires separate reviewed DB/Edge change.
3. Validated historical territorial control and humanitarian impact source, explicitly separated from coded events; licensing and false-positive reviews before use.
4. Seven full days of source-to-display latency P50/P95, quality/coverage/dedup metrics and accessibility/WebGL-mobile QA under comparable OSIRIS and WorldMonitor conditions.
5. Any forecast/scenario should be a labelled hypothetical model with uncertainty and separate from the real event archive, without sensitive live military targets.

## Required release gates
- Tests: TypeScript, Vitest, Next build, Deno worker, migration/offline schema audit at final SHA.
- Manual: desktop and 390x844/430x932/WebKit visual, map camera/focus, time playback, empty source, source outage, mobile overflow, original links, accessible labels.
- Protected PR review, owner resource decision, Vercel preview quota, production health SHA, APP origin-validated hello/ready/sync/select with 35s fallback.
- No production deploy, force push, quota bypass or unverified READY. Capture exact DONE/BLOCKERS/NEXT/VERIFY in the canonical master checkpoint.

**This is reporting evolution, not a military advance animation.**
