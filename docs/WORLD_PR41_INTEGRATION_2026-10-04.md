# PR #41: M3TM.WORLD integration and safe deployment (2026-10-04)

- All public feeds, military regional aggregation, civil unrest, conflict reporting, source provenance, OSINT access controls and new identity/UX changes already on `main` are retained. No source-layer removals or feature rollback.
- Search bias, stale-request cancellation and Region Dossier were implemented through merged PR #43. Keeping the newer current main behavior also keeps parallel Photon + Nominatim results, avoiding a search-coverage regression.
- OpenCCTV now maps Selangor stills through the HTTPS origin proxy, filters known offline placeholders and duplicate Via Lietuva catalogue records, and retains other operating camera feeds.
- Proxy is restricted to listed providers, revalidates redirects, checks all DNS answers, connects only to a pinned public IP, enforces TLS certificate verification, limits redirects/bytes/time and requires a raster image signature.
- GitHub CI adds watched paths and cancels only superseded validation runs. Each reviewed set of changes must be batched into one branch push instead of repeated empty triggers. Vercel deployment API quota is not bypassed; preview success remains mandatory before merge.
- A green PR workflow and required Vercel status, followed by `main` production SHA and safe public conflict/event smoke, are required before closure.
