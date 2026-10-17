# Reference atlas scheduled recovery — 17 October 2026

## Live evidence

GitHub Actions scheduled refresh run [39078969029](https://github.com/TU4714315/m3tm-world/actions/runs/39078969029) on GitHub workflow head `cc8f2582` returned `status=stale`, `fetchedAt=2026-10-17T23:20:08.986Z`, `checkedAt=2026-10-17T23:25:18.386Z`, `nextRefreshAt=2026-10-17T23:27:18.386Z`, `featureCount=7544`, `cacheBackend=memory`, `sourcePublishedAt=null`. The step exited nonzero correctly: historical reference geometry was available but the refresh was not. The WORLD application enforced a two-minute cooldown after its upstream fetch failed; this timing does not originate from the publisher.

## Code changes

The scheduled GitHub checker makes **one** extra, bounded public read no sooner than the next refresh allowed by the existing server, and only when the first result is stale with a parseable saved snapshot and nextRefreshAt within 150 seconds. Workflow timeout changes from three to six minutes to accommodate that rare recovery. No forced reload, credentials, untrusted URL input, fabricated data, or additional event IDs are introduced. Non-schedule major-event dispatches never retry automatically. The final returned state still fails the step if stale/unavailable.

The snapshot remains a publisher-derived *historical reference annotation*: `featureCount` and a successful fetch do **not** verify its correctness or prove current control, and `sourcePublishedAt=null` must stay unknown. `cacheBackend=memory` means durability across a Render process restart is unavailable; deploy a supported Upstash-compatible REST store with `UPSTASH_REDIS_REST_URL`/`UPSTASH_REDIS_REST_TOKEN` or `KV_REST_API_URL`/`KV_REST_API_TOKEN` only after owner-controlled credentials are configured. This PR does not claim that cache has become persistent.

## Acceptance

Unit regression tests cover due/backoff/no-date/far-future behavior. CI and privacy must pass before merge. After deploy, observe at least one real scheduled run, read `retryAttempted` and final `status`, and only report actual restored source health if final `status=ok`. A failed source remains an externally constrained blocker and never causes the map to invent events.

**Deployment attribution:** the GitHub workflow SHA is not by itself a verified Render deployment SHA. Query Render deployment metadata separately before attributing a runtime response to any commit.
