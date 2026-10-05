# M3TM WORLD — durable public GDELT archive (2026-10-05)

## Ownership and safety
M3TM.WORLD owns a **separate and prefixed** source-history integration within the existing APP Supabase project `heibzaolhwlzqaweludm`. No changes to private APP tables, auth, Host-Agent or OSINT permissions. Source is **GDELT 2.0 Events**, not ACLED or live military telemetry. Database-authored short-lived one-use random tickets authorize the POST ingest; unauthorized or reused tickets fail. The Edge Function's GET is public sanitized metadata/sample. Service role key remains inside Edge; direct table SELECT/write and RPC ingest are revoked from `anon` and `authenticated`, with RLS enabled.

## Deployment
- Supabase migrations **already applied**: `20261005123648_world_gdelt_bounded_public_archive_and_cron` and `20261005124720_world_gdelt_analytics_public_source_time_bins`. Their exact applied SQL is copied in `infra/supabase_applied/` **for audit/recovery only**. Do not automatically rerun it or generate duplicate cron jobs.
- Edge Function `world-gdelt-archive` (source mirrored in `supabase/functions/world-gdelt-archive/index.ts`) runs in the same Supabase project.
- pg_cron `world-gdelt-public-15min` 05/20/35/50 minutes UTC; nightly `world-gdelt-public-prune` 01:20 UTC. Source archive receipts, generalized news-code evidence and one-time tickets are stored under `world_gdelt_*` with **8-day** retention.
- API public GET endpoints: `https://heibzaolhwlzqaweludm.supabase.co/functions/v1/world-gdelt-archive?mode=coverage` (actual observed exports, missing 15m source windows, first-store lag p50/p95) and `?mode=events&hours=24&limit=80` (hours 1/6/24/168, sample+full category/country/time statistics). No credentials needed for these **public sanitized** GET endpoints. Direct POST requires unguessable DB-issued one-time ticket.

## Source semantics
Only GDELT CAMEO news codes with ActionGeo in Middle East/Red Sea 8–43 N, 20–65 E are stored, quarter-degree generalized. Automated CAMEO event categories, actors and news URLs may be wrong or historical — **NOT independently verified incidents, current battlefield units or exact routes**. The reporting event date, publication timestamp and first database receipt are kept distinct; several publishers do not prove independence. No sensitive military tracks/ACLED data are ingested.
GDELT may advertise a future archive (observed: 12:45 advertised at 12:40 UTC), and ZIP 12:30 still returned 404 even though older ZIP files were available. Collector clips future windows, retries recent missing windows rather than inventing them, and coverage delay-grades to allow normal publication latency.

## Verification 2026-10-05
Direct production Supabase check showed 3 legitimate GDELT export archives at 11:45,12:00,12:15 UTC with 1297/1177/1312 source rows and **29/25/49** MENA reports (total **103** persisted). One early 12:30 source ZIP returned 404 and was NOT treated as collected. Analytics returned 103 coded reports with 102 single-publisher, 1 multiple-publisher. GET coverage/events HTTP 200, direct table SELECT `anon=false`, `authenticated=false`, ingest RPC `anon=false`. Scheduled jobs exist and are active; verify ongoing executions and later windows to prove autonomous collection.
WORLD changes: Next `/api/source-coverage` now prefers Supabase shared storage with fail-soft Redis/unknown fallback; `/api/gdelt-history` validates the public report payload; Fusion Radar presents timeline/country/source counts **separately** from latest live GDELT. Do not claim full 7-day coverage until **672** 15-minute windows have had a genuine chance to be observed. Cross-site iPhone/WebGL validation and equal-region WorldMonitor latency P50/P95 comparison remain open.
Production caution: main `e0681b304ae01075c0937af1c5d984e70b4817a5` was not confirmed deployed before this integration began; last verified production `35121fd43b25c74f2637917a0378b1b81498f7dd`. No forced Vercel quota bypass.


## PR #68 repair gate — 2026-10-05
- Tests bypass the live history endpoint using `getGdeltCoverage(now, { allowRemote: false })`; production still uses the shared public archive before Redis/memory fail-soft.
- 7-day completeness is calculated across **672 eligible 15-minute slots** anchored to the provider's 30-minute lag; don't label missing receipts as quiet events or historic replay as low-latency original observation.
- Each scheduled ingest tries two newest missing exports and two rotating historical gaps from the retained seven-day window. 404s remain missing, and per-invocation source traffic is bounded.
- The WORLD history/Edge function and migration files are included in the required CI watched paths.
- **Unresolved ownership gate:** WORLD currently persists under APP-owned Supabase `heibzaolhwlzqaweludm`; its prefixed RLS data separation is not separate project ownership. Do not merge or run any replacement migrations until APP/WORLD governance is coordinated or the archive has a dedicated WORLD storage project; existing active jobs were left untouched.
