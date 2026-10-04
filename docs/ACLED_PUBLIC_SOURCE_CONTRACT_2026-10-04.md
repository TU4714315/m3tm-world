# ACLED / GDELT — production data contract (verified 2026-10-04)

## Verified status
- The owner activated `ACLED_USERNAME` and `ACLED_PASSWORD` as Vercel **Production Secret** environment variables; never copy these values to GitHub, logs, browser bundles, or this file.
- The deployed `/api/health?deep=1` reported ACLED configured and authenticated, and `/api/conflicts` returned `sourceStatus.acled.status=ok`, **events=0** at SHA `1b1e0cd18a801e260930d8f8e36b05ac9bd8c44f`.
- OAuth success is **not** evidence of available event rows. ACLED is curated and not equivalent to a live military telemetry feed.
- The remaining external diagnosis is provider **date coverage/account entitlement** versus a query filter returning no records. The adapter now exposes bounded numeric `sourceStatus.acled.diagnostics` (`sourceRows`, `acceptedRows`, `providerTotal`, `pages`, `broadProbeRows`). The optional date-only probe never publishes ACLED raw rows or sensitive response metadata.
- ACLED **publishes curated event data weekly**, with updates generally on Monday/Tuesday (regional availability varies), so a trailing seven-day `event_date` query on Sunday can be empty despite a recent release. ACLED explains that the Unix `timestamp` indicates when a record was uploaded or last edited, distinct from its `event_date`.
- The source request now explicitly uses **publication timestamp last 10 days** AND **event occurrence last 35 days**, matching recent weekly uploads without claiming every event occurred in the past 10 days. Accepted types: Battles, Explosions/Remote violence, Violence against civilians, and Riots (only Mob violence retained locally). No cross-column OR.
- Public zone output preserves `acledReports7d` strictly for event occurrence in the past 7 days, adds `acledPublishedUpdates10d` for source uploads/edits in the past 10 days with event dates up to 35 days old. These are separate **derived** regional counts, not live exact event points; records may overlap GDELT.
- A zero-result occurrence-only probe diagnoses whether older event records exist; no raw rows are made publicly reconstructable. Do not fabricate events or silently call older occurrences new. GDELT continues to update from independent 15-minute published exports.

## Public output and license
ACLED use is subject to <https://acleddata.com/eula> and <https://acleddata.com/attributionpolicy>. The public route uses **derived regional publication-update counts and distinct seven-day occurrence counts** with source attribution; raw reconstructable licensed records, exact unit tracks, and provider credentials must not enter public API responses.
GDELT publishes independent coded news reports; names of CAMEO actors are reported mentions, not automatically proven responsibility. Public positions are generalized; independent evidence thresholds should be explicit.

## Verification
Check `/api/health?deep=1`, `/api/conflicts`, and `/api/gdelt-events` against deployed SHA. When `sourceRows=0,broadProbeRows>0`, investigate the event filter; when both are zero, check last ACLED publication, permitted account recency/countries and API service without exposing a secret. Validate tests with `npm test`, `npx tsc --noEmit --incremental false`, and `npm run build`. Keep both layers even if ACLED temporarily returns no matches.
