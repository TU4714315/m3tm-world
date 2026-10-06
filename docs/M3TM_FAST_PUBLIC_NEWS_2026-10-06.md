# M3TM.WORLD FAST-PULSE news bridge — 2026-10-06

## Why
APP publishes a verified public news.json from GitHub Pages every fifteen minutes. WORLD checks /api/news once a minute but previously short-circuited on the APP snapshot and never tried independent public Telegram/RSS if APP succeeded. Consequently, published articles could lag source updates despite the fast client poll. Preserve APP, GDELT, and global layers, no false incident coordinates.

## New contract
- Independently fetch six bounded publicly published RSS/Atom feeds *in parallel with APP*: BBC Middle East, UN News Arabic Middle East, Al Jazeera, Guardian Middle East, Naharnet Lebanon and Maritime Executive. Each request max 4.5 sec, shared Next fetch cache 45 sec; RSS parse capped to 500 KB and 8 reports/source.
- Merge by canonical original article URL with original APP geo-provenance preferred. News metadata reports actual source publication, separate from response time and APP publishing time. Never infer geolocation or independent corroboration from a headline.
- WORLD /api/news delivers `source_status` and a public CORS GET contract for `https://m3tm.app`. Unlocated independent RSS can appear in the public news list but cannot become map pins; GDELT remains the source-backed geocoded event layer. Old Telegram/RSS fallback remains available if both main streams fail.
- No global or OSINT layer removed, military unit tracks not enriched. This feature uses source patterns documented by World Monitor and OSIRIS as **independently authored** code, not copied AGPL implementation.
- APP will consume only `feed_origin: independent-rss` from WORLD and never call privileged endpoints, only the public bridge.
- Verification: URL/clock/geo/dedupe tests, TypeScript, full Vitest, Next build, required Vercel deployment, smoke provider response and no identifier leaks.
