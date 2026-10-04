# ACLED / GDELT — production data contract (verified 2026-10-04)

## Verified status
- The owner activated `ACLED_USERNAME` and `ACLED_PASSWORD` as Vercel **Production Secret** environment variables; never copy these values to GitHub, logs, browser bundles, or this file.
- The deployed `/api/health?deep=1` reported ACLED configured and authenticated, and `/api/conflicts` returned `sourceStatus.acled.status=ok`, **events=0** at SHA `1b1e0cd18a801e260930d8f8e36b05ac9bd8c44f`.
- OAuth success is **not** evidence of available event rows. ACLED is curated and not equivalent to a live military telemetry feed.
- The remaining external diagnosis is provider **date coverage/account entitlement** versus a query filter returning no records. The adapter now exposes bounded numeric `sourceStatus.acled.diagnostics` (`sourceRows`, `acceptedRows`, `providerTotal`, `pages`, `broadProbeRows`). The optional date-only probe never publishes ACLED raw rows or sensitive response metadata.
- Source 7-day conflict types: Battles, Explosions/Remote violence, Violence against civilians, and Riots (only Mob violence retained locally); do not combine unrelated `sub_event_type` OR terms inside the `event_type` query field. Cursor pagination stays bounded.
- If the upstream 7-day window is empty, keep **0** with an explicit reason; do not fabricate a prior event, silently stretch the date window, or call an empty feed live.

## Public output and license
ACLED use is subject to <https://acleddata.com/eula> and <https://acleddata.com/attributionpolicy>. The public route uses seven-day **derived regional counts** with the source attribution; raw reconstructable licensed records, exact unit tracks, and provider credentials must not enter public API responses.
GDELT publishes independent coded news reports; names of CAMEO actors are reported mentions, not automatically proven responsibility. Public positions are generalized; independent evidence thresholds should be explicit.

## Verification
Check `/api/health?deep=1`, `/api/conflicts`, and `/api/gdelt-events` against deployed SHA. When `sourceRows=0,broadProbeRows>0`, investigate the event filter; when both are zero, check last ACLED publication, permitted account recency/countries and API service without exposing a secret. Validate tests with `npm test`, `npx tsc --noEmit --incremental false`, and `npm run build`. Keep both layers even if ACLED temporarily returns no matches.
