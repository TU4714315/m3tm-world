# M3TM.WORLD — verified upstream/public-layer parity (2026-09-30)

This is an implementation checkpoint, not a marketing feature list.

## Inputs reviewed
- M3TM.WORLD: `TU4714315/m3tm-world`.
- Original/upstream: `simplifaisoul/osiris`, reviewed at `d972d9af5c6f45aebf6d60b8a60f229a8abbe2f1`.
- M3TM.APP remains the source of the published Arabic news contract and the authenticated internal portal.

## Public map state

| Area | Current M3TM.WORLD contract |
|---|---|
| Cameras | All 56 region-category registrations present from reviewed upstream after PRs #25/#27/#28. This is **source-code parity**, not a claim every provider is currently online. TxDOT, Edmonton and Lithuania include source-specific validation/tests. Upstream's 300 voluntary/public operator webcam catalog is present: 289 external-link-only, 11 entries declare playable streams. |
| APP news | Existing strict `postMessage` bridge remains. Standalone WORLD additionally plots only M3TM.APP-published records with published coordinates, generalized to 0.5°. Keyword-guessed fallback locations are never incident pins. |
| Conflict reports | GDELT 2.0 source-backed material-conflict events, generalized to 0.25°. Optional ACLED fusion requires server credentials. Source-category counts are reports, not independent truth probabilities. |
| Conflict zones | Context anchors enriched from report data; no fabricated current events when providers fail. |
| Frontlines | DeepStateMap published polygon snapshot, contextual only. Its route reports status and exposes no raw point features. It is not a friendly/enemy unit-position feed. |
| Borders | Vendored Natural Earth 1:110m land-boundary reference, 331 generalized line features. Contested/indeterminate classes are visually distinct. It is not a sovereignty ruling or real-time conflict boundary. |
| Public military aviation | Coarse regional observation cells only (existing server contract: 6° cells, 30-minute buckets, minimum-group threshold). Absence of a cell does not mean absence of an aircraft. Exact tracks and unobserved-aircraft inference are not public. |
| Military equipment | No reviewed upstream provider supplies independently verified live ground-equipment telemetry. Do not synthesize tank/vehicle/launcher positions from news text. GDELT/ACLED report categories can identify **reported** heavy-weapons/aerial/bombing events at generalized locations. |
| Maritime | Public ports/chokepoints plus AIS when the server provider is configured. Do not treat a missing AIS return as proof of absence. |
| Cyber | Feodo indicators are real indicators; animated origin→target arcs can be inferential visualization and must not be represented as verified attack attribution. |
| Internal OSINT | Stays in authenticated M3TM.APP. No host endpoint/token/internal SDK entity moves onto public WORLD. |

## Source-state labels
The public layer UI shows provider state and aggregate evidence instead of equating an enabled toggle with a healthy provider:
- GDELT: source status.
- ACLED: active/configured/not configured/unavailable.
- Frontlines: published snapshot status.
- Conflict event-category counts: aerial-attack, heavy-weapons, bombing, clash, mass-violence, assault, other.
- Military-air evidence: number of coarse public activity cells and an explicit non-observation caveat.

## Hard dependencies that cannot be fabricated
1. ACLED enrichment stays disabled until valid server-side credentials are actually configured.
2. AIS data depends on the configured maritime provider key/service.
3. Public webcams and government cameras depend on external providers and may disappear temporarily.
4. A toggle is not proof of data. Production acceptance checks both rendering **and** provider-returned counts/status.
5. Browser/iPhone functional QA must be recorded separately from build success when a browser session is unavailable.

## Upstream-update rule
New upstream code is not blindly merged. A scheduled source-parity watcher reports relevant changes from the reviewed upstream baseline into issue #24. Each candidate change needs provenance, public/internal placement, tests, performance/rate-limit review, and production QA before merge.
