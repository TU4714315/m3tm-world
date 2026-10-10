# WORLD: Source refresh policy / سياسة تردد المصادر
**Date:** 2026-10-10  
**Owner direction:** Minimize recurring public resource use without reducing MENA-relevant published news and security incident awareness; eliminate expensive per-viewer polling where source publication is slower.

## Owner-approved tiers and implementation evidence
| Feed / view | Requested tier | Implementation on this PR | Still required |
| --- | --- | --- | --- |
| Submarine cable reference | Once/day or on layer enable | Inherits PR #105: stable `/data/submarine-cables.json` URL without `Date.now()` cache bust; static CDN/client reuse; fetched on initial layer enable only | Verify deployment caching headers, if source data actually updates daily; layer toggle reset enables on-demand again |
| MENA / Iran reported air/security/strike/conflict news | Continuously / near real-time | Existing `/api/news` 60-second UI and published GDELT/conflict 60s when pulse visible stay FAST. Open source GDELT produces *15-minute exports*, hence not 1-second operational proof | Geo-partition snapshot pipeline and clear published/collected timestamps; no precise military planes/strikes/geo tracks |
| External countries (China/Russia/US) involvement in MENA | Fast only for *incident reported as taking place within MENA* | Already MENA-priority GDELT parse; raw CAMEO actor country/source must not be mistaken for attack location | Implement explicit event ActionGeo regional routing while preserving published actor names with provenance |
| Russian–Ukrainian war | Daily | Published frontlines `/api/frontlines` client refresh now once/day | Other current `/api/conflicts` and GDELT global feed still refresh more frequently; splitting archived Ukraine snapshots requires a separate backend collector |
| African countries neighboring MENA | Every 12h | Declarative tier in `PUBLIC_REFRESH_MS.africanNeighboringConflictArchive` | **Not yet wired**; geography/country-set and separate Africa snapshot must be confirmed/tested |
| Commercial maritime / shipping lanes | Daily, load on demand | `/api/maritime` client background refresh once/day, initial load on enabling layer, no repeating 10s to 5m requests. Naval outputs remain coarse aggregate only | AIS WebSocket connection in server is still on by default; stop or schedule ingestion separately only after last-known-good commercial vessel snapshot exists; avoid claiming entire source cost eliminated |
| Public civilian satellite catalogue | Daily | Frontend already fetches once on layer enable, no time-based polling; no additional frequent polling added | Server `/api/satellites` still re-fetches many CelesTrak groups after 1h and serves short TTL. Split ordinary daily catalogue from optional coarse governmental/military satellite overview to save backend CPU |
| Government/military satellite coarse activity | Exception to daily | Existing public only regional aggregate, no NORAD IDs or individual military tracks | Decide permissible source-backed aggregation cadence **after** separate snapshot path; never enable exact orbital military tracking |
| Cyber indicators | Daily, most significant only | `/api/cyber-attacks` client polling once/day; server CDN and in-memory positive cache 24h; display top 10 entries with existing family-based `severity>=8` heuristic | Upstream feed shows malware C2 infrastructure, **not actual observed attack origins or reliable attack attribution**. Current animation is illustrative/inferred: must label accordingly or redesign to discrete regional indicators |
| News APP/WORLD | Owner did not request daily slowdown | Remains 60s on WORLD, APP news workflows untouched | Verify actual MENA priority, freshness, shared cache, APP bridge and reliability |
| Aircraft civil/trade | Not a fast-monitoring priority | Civilian flights/private/jets/sdk_air are **default-OFF** in new WORLD and APP embed sessions but remain available when the viewer opts in; with regional military awareness enabled the shared legacy flight API remains 5-minute polling; civilian-only mode becomes daily | Still relies on one mixed `/api/flights` performing potentially slow global provider sweeps. Split reported MENA events from civil aircraft scans for real CPU reduction |
| Natural hazards/seismic/market/CCTV/space-weather/cloudflare outages/malware push | Not specified yet | Their established cadences are unchanged | Owner needs to decide priorities; potential high cost of Cloudflare radar fallback and malware SSE while enabled |

### Critical distinction
**Browser refresh cadence is not upstream polling frequency.** Changes on this PR reduce browser-induced API invocation volume for enabled layers and may help CDN caching, but `/api/flights`, `/api/satellites` and any always-on AIS/WebSocket feed still consume compute independently. Do not extrapolate percentage CPU savings until logging `CPU-ms/route`, `upstream calls/source`, `CDN hit ratio`, `freshness` over a representative measurement interval. Vercel Hobby exhausted 4h24m Fluid Active CPU before these changes; not a per-route attribution.

### Release gates / no silent loss
1. PR #105 (`fix/world-hidden-poll-cost-20261010`) is base: merge and verify first; then retarget this stacked PR onto main, preserving scoped diffs.
2. Targeted Vitest tests in `publicRefreshPolicy.test.ts`, TypeScript, full tests, build, privacy checks.
3. Browser smoke: first MAPLIBRE paint, Saudi/Iran/Yemen/Germany Arabic labels; MENA published incidents still surface, APP iframe readiness and no auto redirect; maritime and cyber enabled layers still load once and refresh on on-demand toggle; confirm no military exact data.
4. Instrument log counts per endpoint and compare before/after. Verify source provenance, staleness age labels, ingestion schedule, and whether WebSocket remains connected.
5. No automatic merge/deploy/DNS/auth/billing changes in this stacked PR.

### Next owner decisions to solicit
- Which *African neighboring countries* exactly: e.g. Egypt, Sudan, Ethiopia, Eritrea, Djibouti, Somalia, Libya, Chad? Consider proximity to Red Sea, Sahel and MENA, not entire Africa.
- Should civilian flight positions remain available **only when the viewer enables the layer**, instead of default-on in standalone and APP?
- For military/government satellites, only daily public regional activity summary, or periodic (hourly) coarse summary? Never exact military satellite tracks.
- Weather/earthquakes/fires, protest/civil unrest, energy/market indicators, cyber outages/Radar, CCTV, livestreams and malware SSE: set daily/12h/on-demand or current cadence.
