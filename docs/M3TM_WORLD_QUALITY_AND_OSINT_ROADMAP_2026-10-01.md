# M3TM.WORLD — Quality / Map / Entity / OSINT Roadmap
Date: 2026-10-01
Status: execution reference for future conversations
Branch in progress: `feat/world-phase1-map-clarity-20261001`

## Rule for future work
1. Read this file, `docs/M3TM_PROJECTS_INTEGRATION_2026.md`, `M3TM_WORLD_STATE.md`, and the latest upstream audit before editing.
2. Inspect the actual current branch / HEAD / PR / CI / production state.
3. Do not repeat a gate already proven closed.
4. Execute only the first incomplete gate, verify it, then update this file before moving on.
5. Public WORLD remains an information/map surface. Operational OSINT tools belong to the authenticated internal portal.
6. Preserve M3TM identity: Arabic-first RTL UI, M3TM.WORLD branding, existing APP↔WORLD bridge, public-source provenance, and the current precision boundaries.

---

## PHASE 1 — Public map clarity and activation
Goal: make live layers readable, distinct and useful on mobile before deeper platform work.

### 1A. Public controls
- [x] Remove the public Markets entry from the WORLD mobile bottom navigation and desktop tool strip.
- [x] Remove the public Bluetooth/Remote control entry from the WORLD mobile bottom navigation and desktop tool strip.
- [x] Keep the underlying code/APIs available for future authenticated/internal use rather than deleting unrelated backend capability.
- [x] Increase mobile navigation touch targets and icon/label readability.

### 1B. Event / conflict symbology
- [x] Replace tiny generic red event dots with compact semantic badges.
- [x] Give GDELT conflict categories distinct symbols for aerial attack, heavy weapons, bombing, armed clash, mass violence, assault and generic/material conflict.
- [x] Give M3TM.APP field alerts distinct symbols for air defence, drone, missile, strike, ground, maritime and equipment reports.
- [x] Give GDACS/global incidents distinct symbols for earthquake, flood, cyclone, volcano, wildfire and drought when the source exposes the type.
- [x] Keep low-opacity halos for context without hiding the satellite basemap.
- [x] Preserve the existing source-backed/generalized coordinate rules; visual clarity must not imply higher location precision.

### 1C. Satellite basemap
- [x] Preserve ArcGIS World Imagery and attribution.
- [x] Raise usable map/source zoom ceiling to 20 where imagery exists.
- [x] Improve raster presentation with higher opacity, small contrast/saturation tuning and linear resampling.
- [x] Browser QA on 390x844 and desktop: verify no blur regression, black tiles, horizontal overflow or marker illegibility.
- [x] Network/console QA: verify imagery and marker layers load without material errors.

### 1D. OSIRIS upstream parity
- [x] Recheck `simplifaisoul/osiris` live.
- [x] Latest merged commit observed at review time: `d972d9af5c6f45aebf6d60b8a60f229a8abbe2f1` (Sweden CCTV #404).
- [x] Confirm M3TM already contains the exact Sweden adapter blob (`a630aacc5f07060cd24dfce14b95a0abaa2b9625`); no duplicate port.
- [x] Prior timeout backoff (#403) and satellite zoom recovery (#390) already accounted for.
- [ ] Before each later WORLD release, re-run a latest-commit/upstream feature audit and port only source-backed changes that improve M3TM without weakening its public/internal boundary.

### 1E. Release acceptance
- [x] TypeScript passes.
- [x] Relevant Vitest suite passes.
- [x] Production build passes.
- [x] Mobile 390x844 visual acceptance passes.
- [x] Desktop visual acceptance passes.
- [x] Public layer toggles actually show/hide their corresponding source-backed data.
- [ ] APP↔WORLD hello/ready/sync/select contract remains unchanged.
- [x] No secret, internal endpoint, local container address or token enters the public bundle/API.
- [x] PR/CI review complete before merge/deploy.


### Phase 1 verification evidence — 2026-10-01
- PR #44 current head during QA: `dc10808149393c386eea5af6e6c85abd358b88e0`; base: `91b9cc0131c7511ea8211867d6cfdc6173b8a833`.
- GitHub Actions run `36827709466` succeeded. Its `verify-world` job explicitly passed `npx tsc --noEmit --incremental false`, `npm test`, and `npm run build`.
- Vercel Preview status for the same head was `success`.
- Desktop Preview DOM QA: WORLD map canvas filled the viewport, ArcGIS/CARTO attribution remained present, return-to-M3TM.APP link remained present, and the public bottom bar contained only Layers / News / Search / Route.
- Exact same-origin 390x844 runtime QA: `inner=390x844`, `document/body scroll=390x844`, MapLibre canvas `390x844`, RTL Arabic active, no horizontal overflow, mobile nav button height ~51.8px, font 11px, icons 19px, and neither Markets nor Bluetooth/Remote appeared.
- Mobile Preview loaded 46 ArcGIS World Imagery resources during the measured session.
- Runtime console error buffer after reload: zero errors. Network capture contained successful ArcGIS tiles and API/font/style requests; a few ArcGIS tile requests were cancelled without an HTTP error during camera/tile churn and did not prevent map rendering.
- Layer state wiring check: the GDELT conflict-event toggle changed from `aria-pressed=true` to `false` and removed `gdelt_events` from the serialized `layers` URL state after the normal debounce.
- PR diff scan found no added secret literal, bearer token, API key, loopback address, or internal service endpoint. Mentions of `localhost/internal endpoint` occur only in roadmap policy text.
- Preview `/api/stats` now returns HTTP success/degraded JSON instead of a 500; on Vercel Preview its same-origin fan-out can be unreadable because Preview protection returns authenticated HTML to server self-fetches, so production provider truth must be checked after merge.

---

## PHASE 2 — Unified Entity Graph
Goal: one canonical entity instead of disconnected copies of the same person/place/org/event/asset.

- [ ] Define canonical entity schema: Person, Organization, Place, Event, Domain, IP, Asset, Source.
- [ ] Stable `entity_id` and alias/transliteration model for Arabic/English names.
- [ ] Entity resolution + deduplication.
- [ ] Bidirectional Map ↔ Entity linking.
- [ ] Entity timeline.
- [ ] Relationship graph.
- [ ] Source provenance on every fact.
- [ ] Contradiction / duplicate detection.
- [ ] Region dossier feeds the same entity graph rather than a separate silo.

Acceptance:
- selecting a map event opens the canonical entity;
- the same entity reached from news/OSINT/map resolves to one record;
- every fact can be traced to source + collection time.

---

## PHASE 3 — Internal OSINT Orchestrator
Goal: all installed/approved OSINT tools become one controlled internal workflow.

### Required operating modes
1. **Single Tool** — choose one tool and run it directly.
2. **Playbook** — choose a predefined investigation bundle.
3. **Specialist Agent** — agent selects the minimum relevant tools, executes them and correlates results.

### Core components
- [ ] Capability Registry for every installed container/tool.
- [ ] Tool adapter contract: inputs, auth requirement, target policy, timeout, exit code, stdout, stderr, artifacts.
- [ ] Queue / claim / running / completed / cancelled lifecycle.
- [ ] Per-tool and per-playbook authorization checks.
- [ ] Tool health / version inventory.
- [ ] Parallel execution where safe.
- [ ] No localhost/internal endpoint/token exposure to public browser clients.
- [ ] FINGERPRINT-style public-profile search from current OSIRIS upstream is evaluated here, not on public WORLD.

---

## PHASE 4 — Evidence and RAW pipeline
Goal: preserve original output and make derived analysis auditable.

Required case structure:
```
case-<id>/
  manifest.json
  01_raw/
  02_normalized/
  03_entities/
  04_report/
```

- [ ] RAW stdout/stderr/artifacts immutable after collection.
- [ ] SHA-256 per raw artifact.
- [ ] tool/version/start/end/exit-code metadata.
- [ ] normalized findings stored separately from RAW.
- [ ] entity resolution stored separately from normalized findings.
- [ ] deduplication never deletes RAW evidence.
- [ ] source confidence is evidence-derived metadata, not agent opinion.

---

## PHASE 5 — Neutral specialist agent and TXT report
Goal: agent correlates information but does not inject personal opinion.

Required report sections:
1. Case ID / target / collection mode
2. Tools used
3. Identifiers
4. Entity information
5. Accounts / domains / assets
6. Locations
7. Events
8. Timeline
9. Relationships
10. Source findings
11. Conflicting information
12. Unverified information
13. Collection gaps
14. Sources
15. Tool execution summary
16. RAW evidence paths + hashes

Language rules:
- factual, attributed, source-aware;
- distinguish observed / source-reported / derived / unverified;
- no "I think", recommendations, motive claims or unsupported conclusions;
- no deletion or rewriting of RAW output.

---

## PHASE 6 — Continuous quality gate
- [ ] Upstream OSIRIS audit before releases.
- [ ] Provider health/freshness dashboard.
- [ ] Mobile WebKit + Chromium regression tests.
- [ ] entity-resolution regression tests.
- [ ] OSINT broker authorization tests.
- [ ] public-bundle secret/internal-endpoint audit.
- [ ] update this roadmap after every closed gate.

## Current next action
Finish **PHASE 1E** on the active branch: run code/build/tests and visual/browser QA. Only after Phase 1 is proven and merged should implementation move to **PHASE 2 — Unified Entity Graph**.
