# M3TM Architecture Council — Session 01 / اللجنة المعمارية العليا
**Date:** 2026-10-10 (Asia/Riyadh)  
**Status:** PROPOSAL / REVIEW ONLY; no production, DNS, auth, billing, or service migration authorized by this document.  
**Scope:** public M3TM.WORLD reliability, cost and APP ↔ WORLD continuity. Do not open internal OSINT endpoints.

## Evidence and participant integrity
This is an evidence-based engineering review conducted by one assistant across **four specialist research tracks**. No independent human experts of any nationality were contacted, and no claim is made that four autonomous runtime agents were successfully spawned. "US/China/Russia/Europe" below describes comparative technology ecosystems, **not** fictitious nationality or identity. Locally installed OpenClaw was observed on 2026-10-10 with UI status "Degraded"; do not depend on it without a successful local-only handshake and zero-cost model verification.

### Live baseline / مراجع الحالة
- WORLD GitHub `main`: `1e4c6983f2a3ac02a73dc66c84db6254d5ecb735`, read 2026-10-10. `next@16.3.4`, `maplibre-gl@6.9.0`.
- Render service `m3tm-world-recovery` on Free in Frankfurt, `autoDeploy=no`; APP embeds recovery origin per previous APP PR #370. Not an SLA or failover guarantee. Do not claim embed/browser paint verified in this session.
- Vercel m3-tm Usage dashboard 2026-09-10 through 2026-10-10: **WORLD** took **4 h 24 m Fluid Active CPU** (110% of 4h hobby allowance), 107K function invocations team total, 259.7 GB-h provisioned memory, 177K CDN requests. The paused team does not prove the top individual endpoint. Older 12h Observability window has no data; expanded retention was paywalled.
- Safety/performance patch **PR #105** (`fix/world-hidden-poll-cost-20261010`, SHA `3d6b53e5c9310f164d6a363956ae7df83c33808e`) is **draft / unmerged**; `verify-world` and `public-email-privacy` checks succeeded. Skip hidden-tab polling and remove static GeoJSON cache busting only; no measured production savings yet.
- GHCR/Azure recovery **PR #100** is **draft / unmerged**; Docker PR build check succeeded but push/pull of a published SHA image is **not proven**. No Azure deployment or DNS switch.
- These values are snapshot observations, not promises about later service availability.

## Four independent technical desks and adversarial review

| Desk / ecosystem lens | Domain expertise | Proposal | Objection / risk | Resolution |
| --- | --- | --- | --- | --- |
| A — North America, edge/platform | Cloudflare CDN, Functions economics, GitHub CI | Public static frontend + edge cached aggregate snapshots; no per-user heavy upstream parsing | Workers Free 100K requests/day, 10 ms CPU/request; not an unlimited API host | Use edge for lightweight reads and transforms only, enforce budgets and snapshot fallback |
| B — China, high-throughput data architecture | Event-stream aggregation, batched writes, mobile latency | One scheduled upstream fetch per source, canonical dedupe/normalize and fan-out; optimize data volume at ingestion | Alibaba ECS free offers are new-user trials, not indefinite infrastructure; unknown restrictions on international providers | Reuse vendor-neutral concepts, not short-lived promotional compute as dependency |
| C — Russia, resilient distributed systems | Degradation, failure isolation, durable replay, cold-start tolerance | Append provenance and persisted last-known-good snapshots with published_at/fetched_at; separate control/data plane | Yandex free tier is metered and charges after allowances; region and operational constraints | Multi-origin portable Docker worker as OPTIONAL backup, not a required dependency |
| D — Europe, geospatial/open standards | MapLibre, OSM, PMTiles, standards/data provenance and accessibility | Retain native MapLibre Arabic RTL; decouple basemap/tiles and layers from Next server; instrument first canvas paint | OSMF public tile infrastructure has restrictions and no availability SLA; self-hosted world tiles might exceed free storage | Vendor-licensed tile source and attribution; benchmark PMTiles/R2 before adoption, do not scrape OSMF |

**Chair decision:** `APP static shell` + `WORLD independently portable public 3D frontend` + `shared bounded data acquisition` + `durable snapshots` + `an optional dynamic compute slot`. No single free provider can guarantee unrestricted 24/7 compute and zero financial liability. Optimize portability and recoverability, not the lowest nominal instance price.

## Decision: Azure for Students is not a permanent origin
Official Microsoft terms: after 12 months student renewal requires signing up again for the offer and verifying ongoing eligibility; credit exhaustion or expiration can disable the subscription absent renewal/paid upgrade. **Therefore never make APP auth, WORLD map boot, canonical public archive or DNS depend on student sponsorship.** Existing Azure may be used only for nonproduction tests within remaining eligibility/budget, then retired. Never enable pay-as-you-go without explicit budget and approval.
Official: https://learn.microsoft.com/en-us/azure/education-hub/faq

## Provider screening (official public terms, checked 2026-10-10)
1. **Cloudflare Pages:** static asset requests free and unlimited provided they do not invoke Functions; free build quota 500/month and 25 MiB file cap. Next 16 WORLD cannot simply be moved unchanged: extract/staticize viewer and keep dynamic APIs separate. Source: https://developers.cloudflare.com/pages/functions/pricing/ and https://developers.cloudflare.com/pages/platform/limits/
2. **Cloudflare Workers Free:** 100,000 requests/day (UTC reset), 10 ms CPU/request, 50 external subrequests/request; overflow means error 1027 unless designed fail-open appropriately. It is not suitable for heavy GDELT zip parsing or flight sweeps. Source: https://developers.cloudflare.com/workers/platform/limits/
3. **Workers KV Free:** 100K key reads/day, **1K writes/day**, 1 GB storage. Rapid independent per-layer writes can exhaust it; do not treat it as a high-frequency event log. Source: https://developers.cloudflare.com/kv/platform/pricing/
4. **Cloudflare R2 Standard:** 10 GB-month, 1M Class A, 10M Class B operations/month, no internet egress fees. Checkout/payment setup may be required, and overages are billable. Use only after explicit spend guard/owner consent; prototype off-production. Source: https://developers.cloudflare.com/r2/pricing/ and https://developers.cloudflare.com/r2/get-started/
5. **GitHub Actions:** standard hosted runners free in public repositories; private-repo included minutes are finite. Scheduled workflows can be delayed or dropped and are NOT a hard-real-time ingestion guarantee. Use for low-cost batches and noncritical periodic enrichment, not sole high-availability live pipeline. Source: https://docs.github.com/en/billing/concepts/product-billing/github-actions and https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows
6. **Render Free:** 15-minute idle sleep and cold-start ~1 minute; ephemeral local filesystem; current WORLD fallback exists, not a permanent hot origin. Source: https://render.com/docs/free
7. **Supabase Free:** project can pause with low activity after seven days; database backup downloads not included. Keep current authenticated private APP services separated, add safe backups/alerts, do not relocate secrets to public WORLD. Source: https://supabase.com/docs/guides/platform/free-project-pausing
8. **Oracle OCI Always Free:** potentially reusable free VM at home region; idle VMs may be reclaimed, capacity availability varies. Not a guaranteed singleton. Source: https://docs.oracle.com/en-us/iaas/Content/FreeTier/freetier_topic-Always_Free_Resources.htm
9. **Alibaba Cloud (China ecosystem):** ECS new-user free trial conditional, payment/phone required, instances stopped/locked if trial eligibility fails; rejected as durable free foundation. Source: https://www.alibabacloud.com/help/en/user-center/product-overview/learn-about-free-trials
10. **Yandex Cloud (Russia ecosystem):** some serverless monthly free usage, then charges; does not meet absolute-zero-overage requirement without billing safeguards. Source: https://yandex.cloud/en/docs/billing/concepts/serverless-free-tier
11. **OpenStreetMap Foundation tiles:** OSM data freely licensed but OSMF-operated tile endpoints are not bulk-download or unrestricted production infrastructure; maintain visible attribution and HTTP caching, do not scrape/prefetch. Source: https://operations.osmfoundation.org/policies/tiles/

## Proposed public data architecture
```text
Source feeds [RSS/GDELT/open published events; provenance]
    -> bounded collector (single-flight, per-feed rate caps, retry with jitter)
    -> validate (source URL, timestamps, schema, dedupe, source confidence)
    -> canonical per-layer snapshots, immutable version + latest pointer
       /public/v1/news.json, /public/v1/gdelt.json, /public/v1/flights-aggregate.json
    -> CDN cache (ETag, Cache-Control, stale-while-revalidate where supported)
    -> MapLibre browser UI + APP iframe/readiness bridge
Failover: durable last-known-good snapshot with freshness/status badge
         and manual retry; NEVER hide stale status or fabricate missing events.
```
Preserve all working public layers. Source freshness is defined by provider cadence; a 10-second display poll cannot make a 15-minute provider feed live at 10 seconds. Keep `source_published_at`, `collected_at`, `generated_at`, `expires_at`, `source_id`, provenance URLs and failure class.

**Not allowed:** exact military aircraft/vessel identities, tracks, MMSI/heading or internal OSINT routes leaking into public snapshots. Maintain coarse/regional aggregation. No inferred geolocations from headlines. Keep ARC/CORS/origin and APP public-vs-internal boundaries.

## Failure modes and controls
- **CPU exceeded / suspended:** bounded upstream work, shared cache, request metrics, quotas alarms at 50/75/90%; no uncontrolled per-tab external reads.
- **Public map origin dead:** independently hosted bootable viewer plus recoverable static fallback; APP MUST NOT auto-redirect to dead WORLD.
- **Slow Render cold-start:** map frame shows last data without blocking; server warmup can be asynchronous, but do not promise realtime on Free.
- **Cloudflare Workers 1027 / KV overrun:** serve static snapshots without Worker if possible; limit dynamic API request fan-out; explicit hard failover path.
- **Upstream fetch error/timeouts:** last verified snapshot + source/age marker; no false '0 events' or empty-country layer.
- **Auth/email:** independently validate Supabase SMTP and login links, owner-only counters. Public content migration never changes auth/OSINT permissions.
- **GHCR:** verify immutable SHA digest image build, GHCR image visibility and anonymous pull, Docker health, then temporary origin smoke BEFORE touching APP/DNS.
- **Cost:** preserve free baseline; stop before provider purchase, card-required action, domain changes or overruns. No assumptions of free R2 setup without verifying account.

## Four-phase authorized execution plan and gates
### Phase 0 — Measure / baseline (read-only)
Record WORLD APP SHAs and URLs, Render live deploy SHA + autoDeploy state, `/api/health`, browser 3D painted (desktop+mobile, Arabic names), embed message + no auto redirect; endpoint sample window `/api/news`, `/api/gdelt-events`, `/api/flights?summary=1` (avoid expensive deep probes). Record CPU per route, requests, CDN hits, latency p50/p95, oldest event age, stale percentages.

### Phase 1 — Stop waste without dropping features
Review PR #105, verify passing CI and map smoke; merge under repository gate. Prefer client visibility controls, stable static asset URLs, effective server cache/single-flight, provider timeout and bounded retry. Log `cache-hit`, `requests`, `upstream-fetches`, `cpu-ms` by endpoint.

### Phase 2 — Durable replay with portability
Separate canonical public data pipeline from Next API handlers; define versioned JSON schemas + validation tests and public-only provenance; store last-good snapshots off ephemeral disks using already-available safe durable store or optional bounded R2. APP shell, Supabase private systems and production domains remain unchanged.

### Phase 3 — Compare at least two NONproduction candidates
A: Cloudflare Pages static WORLD viewer + Workers Free light proxy and permitted bounded snapshot storage. B: current Render recovery + cached static mirror. Azure Student only as OPTIONAL ephemeral experiment, never sole dependency. GHCR digest pull must pass before additional Azure tests. Verify app iframe, world map painted, source freshness, Arabic, mobile, 24h quota budget, failover after origin unreachable. Do not switch DNS or APP until direct user-visible E2E evidence.

## Acceptance criteria (targets, not current measurements)
- Production APP remains available and separate from WORLD deployment changes.
- WORLD 3D map canvas actually painted; Arabic country labels shape correctly; all working public layer toggles still function.
- Public snapshot schemas include provenance and freshness; data events never silently invented or mislocated.
- Origin unavailable: static UI and last-good snapshot visible with clear stale marker, no automatic route redirect.
- Target warm first map paint p95 < 3 seconds on defined test device/network; target route cache hit >= 90% for shared source responses; zero new chargeable services. Measure before claiming.
- SLOs are best effort on free providers; no unsupported promise of 100% uptime / limitless real-time updates.

## Immediate blockers
- No independently verified four-agent runtime; OpenClaw app status Degraded and no zero-billing handshake.
- PR #100: GHCR SHA published/anonymous pulled still unproven.
- Current Render Free cold-start and no autodeploy; lack of observed APP embed E2E mobile/browser paint in this review.
- No Cloudflare account/Pages/Workers/R2 eligibility or spend controls confirmed; no service provisioned.
- No Vercel historical per-endpoint CPU breakdown; only WORLD project aggregate verified.
- Free provider terms can change. Review all pricing at execution.

## Chair resolution
**APP stays on existing GitHub Pages, WORLD stays on existing Render recovery pending evidence.** Reject Azure Student, new-user free trials, unrestricted free VMs, speculative foreign cloud regions, and automatic upgrades as a single production dependency. Approve incremental evidence-first cost reduction, portable map/viewer + cached public data, and explicit manual deploy gates. **No production changes from this council session.**
