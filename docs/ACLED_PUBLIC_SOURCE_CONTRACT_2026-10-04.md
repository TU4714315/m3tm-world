# ACLED, GDELT and event attribution in M3TM.WORLD

ACLED is currently not configured in production: `/api/conflicts` reports `sourceStatus.acled.status=not_configured`; the health endpoint confirms missing server credentials. It is an independent third-party service and requires a myACLED account with OAuth access. Use authorized server-only `ACLED_USERNAME` and `ACLED_PASSWORD` in Vercel Production; an access token is valid around 24 hours and is not an enduring substitute for OAuth. No credentials may be stored in GitHub, map HTML, client environment, logs or URL parameters.

Licensing: https://acleddata.com/eula and https://acleddata.com/attributionpolicy restrict re-publication of reconstructable raw ACLED rows. The world-public conflict route uses derived aggregate counts by published region over a seven-day period, with ACLED attribution. Any raw ACLED research requires proper license and restricted server-side workflow.

GDELT 2.0 CAMEO names (Actor1Name and Actor2Name) refer to *parties mentioned in published news coding*, not a verified determination of attack responsibility, nor locations of any currently active unit. The map shows these actor labels when actually present, together with a source link, event date, CAMEO class and public generalized location. Raw ActorGeo and precise military tracks remain excluded from the public feed.

Latency and fallback: ACLED responses have a bounded optional wait in the conflicts route. Warm-instance caching for 15 minutes coalesces concurrent requests and a provider error may return the last successful snapshot with an explicit `cached-stale` label. GDELT and the worldwide conflict/report layers remain independent of the ACLED account.
