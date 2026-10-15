# Published map viewing access

Owner decision: anonymous news/event view is delayed **12 hours**. The latest published map is for approved APP members and temporary invitation-code guests. Internal investigations/tools and precise operational tracks remain outside this grant.

| Surface | Anonymous | Valid map grant |
| --- | --- | --- |
| Published news, including Yemen events | Source publication at least 12h old; undated/future excluded | Current provider-available published news |
| Yemen influence/frontlines and conflict layers | Locked | Dated, attributed published annotations; no inferred advances |
| Military air/naval/satellite activity | Removed from mixed API responses | Existing coarse, identifier-free projections |
| Camera previews, live feeds, media proxies | Locked at API and UI | Existing published feeds |
| News cards | Allowed delayed cards plus a synthetic blurred lock card | Headline, publisher, explicit urgency |
| Bottom strip | News only | News only |

`viewer-access` issues HMAC grants with `published-map` scope after the same active approved role/code checks. Guests expire at the current 15-day rotation boundary. Member grants last at most60s and renew from the existing APP session every40s. APP sends only the scoped grant to the fixed WORLD frame/origin, never its account JWT. No new migration or public role is introduced.

WORLD exchanges a grant/code through bounded JSON POST, stores a scoped HttpOnly Secure Partitioned cookie for embedded Chrome, and keeps an optional bearer in memory. No code/token is put in URLs or browser storage. Introspection is cached at most15s and never past expiry; revocation reaches data APIs within15s, polling UI within25s, member approval changes within60s. Cookie writes are serialized so a logout DELETE follows an older pending POST. A parent logout blocks member-cookie restoration and preserves an established guest session. Access loss clears loaded map/dossier/player data and ignores late responses.

All API paths enter middleware. Mixed news/flights/satellites/maritime outputs filter after provider caches; protected routes/media have no-store responses. Raw SDK/enrichment/analysis remain internal; SDK ingestion retains its dedicated API key. Grants never open `/api/osint/*`, tools, or scanner. A collector token opens only `/api/reference-atlas`, not viewing/media/tools.

The seven-day delayed-news buffer uses the existing durable cache. Configure shared Redis for reliable history across instances/restarts; memory fallback cannot establish historical completeness. The initial public view can be empty until real stories age12h; no old copy is fabricated.

## Release dependencies

- APP draft PR426 plus WORLD stacked map/access candidate require coordinated review/release.
- Deploy the reviewed `viewer-access` Edge action changes and existing invitation migrations after reconciling remote migration history. Guest configuration remains disabled until owner enables it.
- WORLD server needs `M3TM_APP_SUPABASE_ANON_KEY` (public/publishable APP project key, never service role). Its authority URL is fixed in code.
- Configure the same new `WORLD_MAP_REFRESH_TOKEN` (minimum32characters) on WORLD and as the GitHub Actions secret for the central collector. No value is committed/logged; missing configuration fails closed.
- Saudi country masking remains enforced in the existing source projections. This change does **not** claim Saudi indicator unlock; that needs its separately reviewed authenticated geographic projection/cache contract. Country outlines stay visible.
- Current field progress depends on current source-dated evidence; historical ISWN annotations are not live control claims. No production access or mail was activated by this change.
- Verify real guest/member iframe/camera flows, signout/expiry/revocation, shared cache and deployed SHAs after release. Chrome control during this run timed out, so no new visual/E2E success is claimed.
