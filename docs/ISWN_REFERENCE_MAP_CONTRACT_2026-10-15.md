# Published map and editorial presentation — 2026-10-15

The existing WORLD map powers standalone WORLD and the APP public iframe. This change adds the owner's ISWN map as a separate public reference layer; it never imports account credentials, private investigation data, precise tracks or remote source HTML/icons.

## Source and meaning

- Publisher: https://english.iswnews.com/
- Owner-provided map: https://www.google.com/maps/d/edit?mid=1M-_ymjR9xwOK7KMikOcUFSAE1ac
- Fixed public KML export and publisher RSS are fetched on the server only.
- Source Regions folder explicitly says 2024-06-02 at inspection; most other annotations have no publication date. Retrieval time is never substituted for publication time. A successful refresh does not verify territorial control or make old annotations current.
- Named AnsarAllah/Houthi areas receive subdued red waves; named Hadi/Yemeni government areas green. STC and other actors remain neutral. The source's original red/green style values are not used to infer affiliation.
- Facility/equipment glyphs follow explicit names. Airports are airports, army bases are bases, and a base never proves that tanks, artillery or aircraft are currently present. Unclassified town annotations are retained in the dataset but not drawn as thousands of generic badges.
- All point locations are generalized to 0.25 degrees. Saudi-named layers, original Saudi points, crossing/enclosing polygons and final public responses are suppressed before cache/counts and after browser projection. Yemen remains visible. Geographic borders are approximate Natural Earth admin-0 boundaries.

## Cadence and failure

- Full KML refresh: due after 12 hours.
- RSS check: at most every 15 minutes. An unseen concrete major-report headline published in the last six hours may trigger an earlier KML fetch. This is a collection trigger, not confirmation of the report.
- The scheduled GitHub workflow checks the fixed deployment endpoint every 15 minutes. It must be present on the repository default branch and the API must be deployed before unattended collection is active. GitHub scheduling can be delayed.
- Existing Redis/KV credentials provide shared retention. Memory fallback is explicitly reported and is not durable across process restarts.
- Singleflight, bounded XML/bytes/coordinates/timeouts, no redirects/entities/network links, durable last-good snapshots and a 15-minute failure cooldown. Failed major refreshes retry even if the next RSS request fails.
- Reference annotations are never merged into the current frontline/event collections. Public difference counts are computed after masking; repeated names retain distinct area parts.

## Final user interface

- No atlas/provenance dashboard or numbered map clusters. The concise symbol legend holds the area publication date; provenance remains in metadata and ordinary map attribution.
- Quiet geometric news symbols, explicit facility/equipment silhouettes, low-opacity red/green wave patterns clipped to the named source areas. Animation pauses when hidden and respects reduced motion.
- Important publisher news appears once in glass cards inside Alerts, with title, publication time, publisher and safe link. Breaking labels require explicit publisher marking/headline; a machine risk score alone never creates a breaking label.
- The former library entry is replaced with Maps: 2D/3D presentation controls. Existing layer/data adapters remain in code; this does not expose a source-bank workflow to the map user.

## Release boundary

This is a review candidate stacked on the public Saudi boundary fix (PR132), not a production release. No secrets, account roles, billing or live deployment settings were changed. The existing Vercel account/deployment gate and production SHA limitation remain separate release constraints. Enable the scheduled job only through the reviewed default-branch release.
