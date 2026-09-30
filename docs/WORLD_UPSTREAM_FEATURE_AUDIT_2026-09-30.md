# M3TM.WORLD — upstream feature audit after public conflict review
Date: 2026-09-30

This audit compares the current M3TM.WORLD public layer surface with `simplifaisoul/osiris` and distinguishes **working source-backed features** from names/toggles that do not have an implemented renderer or source.

## Layer-key comparison

At audit time, the upstream `LayerPanel.tsx` had three layer keys not present in M3TM.WORLD's panel:

1. `alert_pins`
2. `military`
3. `sat_military`

M3TM.WORLD had additional public layers not in upstream: `app_news`, `conflict_density`, `conflict_zones`, `country_borders`, `frontlines`, `military_activity`, `reported_routes`, `sdk_air`, `sdk_naval`, and `terrain_etopo_2022`.

### alert_pins
Upstream has a working `alert_pins` concept tied to Live Alerts and location parsing. This branch restores that **capability**, but adapts it to M3TM's stronger existing contract:
- only M3TM.APP-published records with publisher-supplied coordinates are eligible;
- coordinates are generalized to a 0.5° regional grid;
- headlines/descriptions are text-classified into strike, drone, missile, air-defence, ground, maritime, or military-equipment report categories;
- each popup labels the item as source-reported and links back to the publisher;
- keyword-guessed country centroids are not promoted to incident locations.

This is intentionally not a unit/equipment tracker. A headline saying a tank or artillery was reported can be categorized as an equipment report at the publisher's generalized location, but the map does not infer the exact equipment position.

### military / sat_military
The upstream project can render exact ADS-B military flight rows and individual military/intelligence satellite objects. M3TM.WORLD now carries the useful source-backed awareness from both domains without turning the public map into an exact operational tracker:

- `military`: the server still classifies public ADS-B observations, but `military_flights` remains empty in the public API. `military_activity` renders 6° regional cells, requires at least two observations per cell, uses a 30-minute time bucket, exposes no aircraft identifiers or exact tracks, and now publishes provider/readiness metadata for adsb.fi/OpenSky.
- `sat_military`: now a real public layer rather than a dead toggle. CelesTrak/SatNOGS TLE rows are propagated with SGP4 server-side, military/government rows are grouped into 20° regional cells with a minimum group of three, and the public response exposes only cells, aggregate mission/altitude counts, source state and freshness. Names, NORAD IDs and individual orbit tracks are not included in this layer.
- Individual non-military satellite categories continue to use the existing 3D renderer. Turning on `sat_military` does **not** insert military rows into that exact-object renderer.

This data-precision boundary is applied independent of actor/country. The repository currently has no authenticated API contract that safely separates an exact military feed from the public deployment, so this branch does not invent a URL flag or weaken access controls to expose exact rows.

## Other upstream features checked

| Feature | Upstream | M3TM.WORLD | Audit result |
|---|---|---|---|
| `alert-digest` topic grouping | Yes | No dedicated module before this branch | This branch ports the useful public military/conflict topic subset into generalized alert pins. A full narrative digest is separate UI work. |
| `alert-places` Nominatim place resolution | Yes | No | Not blindly copied. M3TM already has published coordinates from M3TM.APP; guessed/geocoded incident placement would weaken provenance. |
| AOI / watch / drawing | Yes | Yes | Existing M3TM files and tests found. |
| `gps_jamming` | Upstream flight API exposes derived data | M3TM public API returns empty | Not presented as operational in public WORLD. |
| `war_alerts` | Key appears in upstream page state | No working layer in M3TM | Upstream search found no corresponding LayerPanel/render/source implementation. It is not a functioning upstream feature to copy as-is. |
| camera-source expansion | Yes | Yes | Prior parity work registered the reviewed upstream public camera categories; runtime availability remains source-specific. |
| camera timeout backoff (#403) | Yes | Added in follow-up | Timed-out regions enter a 5-minute cooldown instead of spending the full 12-second regional budget on every catalogue refresh; successful regions and cached camera indexes are unchanged. |
| satellite zoom recovery (#390 / `ed3c8cc5...`) | Yes | Already present | Re-audited: M3TM's current custom satellite layer already keeps the GPU buffer count while zoom-hidden and clears only the projection, so zooming back out does not require a toggle reset. No duplicate port was needed. |
| Sweden CCTV expansion (#404 / `d972d9af...`) | Yes | Not in this branch | Newly identified upstream source expansion (Trafikverket/CamStreamer). It is a separate camera-source parity item and was not mixed into this military/satellite PR. |

## Current public conflict evidence contract

The panel must say explicitly whether a layer is **نشط** or **متوقف**. Count alone is not a state indicator. Conflict evidence is split by source:
- GDELT material-conflict reports and categories;
- optional ACLED when server credentials are configured;
- published frontlines/context;
- M3TM.APP published field-alert categories;
- generalized military-air activity;
- generalized military/government satellite activity from public TLE propagation.

A toggle may be active while its provider returns zero rows. Conversely, a provider can have data while a toggle is off. UI state and source readiness must remain separate.

## Acceptance for this branch
- active/off toggle states are visually unambiguous and accessible through `aria-pressed`;
- `alert_pins` is on by default in public standalone and APP-embedded profiles;
- field alerts use only publisher coordinates and stay generalized to 0.5°;
- the map renders distinct source-backed categories and source popups without synthetic unit/equipment positions;
- TypeScript, Vitest and Next production build pass;
- browser preview shows nonzero alert-pin counts when matching M3TM.APP items exist and toggling the layer changes the map source;
- no exact military-flight or exact individual military-satellite public contract is introduced by this PR;
- `sat_military` is source-backed and functional through a coarse 20° / minimum-3 / 1-hour aggregate, with source readiness visible in the UI.
