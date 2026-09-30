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
The upstream project can render exact ADS-B military flight rows and military/intelligence satellite categories. M3TM.WORLD still contains renderer support, but the **public contract** currently omits exact military flight rows and filters military satellite categories. The public surface exposes a source-backed coarse military-air activity aggregate instead.

This is a data-precision boundary applied independent of actor/country; it is not a political classification. The public map continues to display source-reported conflict events, generalized air activity, frontlines/context, and published field alerts. Exact operational tracks, if ever used, belong behind an authenticated internal surface with separate access controls, not by silently changing the public contract.

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

## Current public conflict evidence contract

The panel must say explicitly whether a layer is **نشط** or **متوقف**. Count alone is not a state indicator. Conflict evidence is split by source:
- GDELT material-conflict reports and categories;
- optional ACLED when server credentials are configured;
- published frontlines/context;
- M3TM.APP published field-alert categories;
- generalized military-air activity.

A toggle may be active while its provider returns zero rows. Conversely, a provider can have data while a toggle is off. UI state and source readiness must remain separate.

## Acceptance for this branch
- active/off toggle states are visually unambiguous and accessible through `aria-pressed`;
- `alert_pins` is on by default in public standalone and APP-embedded profiles;
- field alerts use only publisher coordinates and stay generalized to 0.5°;
- the map renders distinct source-backed categories and source popups without synthetic unit/equipment positions;
- TypeScript, Vitest and Next production build pass;
- browser preview shows nonzero alert-pin counts when matching M3TM.APP items exist and toggling the layer changes the map source;
- no exact military-flight or military-satellite public contract is introduced by this PR.
