# M3TM.WORLD STATE

## MASTER CROSS-PROJECT CHECKPOINT — 2026
- Primary continuity file: docs/M3TM_PROJECTS_INTEGRATION_2026.md
- Hermes handoff: outputs/HERMES_PROJECTS_INTEGRATION_2026_HANDOFF.txt
- Desktop shortcut installer: tools/Install-ProjectsIntegration2026Shortcut.ps1
- Cross-project work involving M3TM.APP and M3TM.WORLD must read the master continuity file first, then verify current Git/CI/production before execution.

## CURRENT EXECUTION — 2026-09-22
- Branch: `m3tm/world-arabic-neutral-20260920` at HEAD `61826987c31efcca8481f3b52934bb8f1968302a` with substantial local uncommitted work preserved.
- Hermes is now actively linked to the master checkpoint. Read-only handshake succeeded and a bounded first-gate review of `WorldFeed.tsx` + `WorldMap.tsx` found no confirmed text/JSX corruption and made no changes.
- `git -c core.whitespace=cr-at-eol diff --check`: PASS after removing four real trailing-whitespace findings; CRLF conversion warnings remain informational.
- `npx tsc --noEmit --incremental false`: PASS.
- `npm test`: PASS — 49 files passed, 2 skipped; 625 tests passed, 16 skipped.
- `npm run build`: PASS — Next.js 16.3.4 production build and TypeScript phase completed successfully.
- Full `npm run lint` with 8 GB heap: NOT PASS because Node hit the 8 GB heap limit (OOM); this confirms source-wide lint is an infrastructure/debt gate, not a completed quality pass.
- Targeted lint on `page.tsx`, `WorldMap.tsx`, `WorldFeed.tsx`, `OsintPanel.tsx`, health route, and `next.config.ts`: completed with 309 findings (267 errors / 42 warnings), dominated by legacy `no-explicit-any`, React refs/purity, and set-state-in-effect rules. Do not bulk-fix without HEAD/baseline comparison.
- Baseline comparison completed for the four core files and is exact: current `page.tsx` 100 errors/19 warnings = HEAD 100/19; current `OsintPanel.tsx` 44/5 = HEAD 44/5; current `WorldMap.tsx` 120/18 = HEAD `OsirisMap.tsx` 120/18; current `WorldFeed.tsx` 3/0 = HEAD `IntelFeed.tsx` 3/0. No lint regression detected in these core files.
- Local built runtime verification: `/` HTTP 200 and `/api/health` HTTP 200 with `{status:"operational", platform:"M3TM.WORLD", version:"0.1.0"}` on port 3199; the temporary server started for this verification was stopped afterwards.
- Docker verification: `m3tm-osint-agent-v2`, GHunt, SpiderFoot, TruecallerJS, PhoneInfoga, n8n, and local Supabase stack were running; core services shown by Docker were healthy except services without a declared healthcheck.
- Desktop shortcut `المشاريع + الدمج 2026.lnk` exists and opens the master checkpoint.
- Browser/Responsive Gate: PASS on 390x844, 430x932, 768x1024, 1440x900, and 1920x1080. All five runs kept RTL/Arabic, had no horizontal overflow, rendered the map at the full viewport, exposed no forbidden legacy UI label, and emitted no browser console errors.
- Runtime observation during the visual gate: some MapLibre tile requests were aborted during viewport/tile changes; selected CCTV providers timed out or returned 403 and were honestly omitted; Next.js declined to data-cache oversized /api/flights and /api/cctv responses above 2 MB. The app and /api/health remained HTTP 200/operational; record these as runtime/performance debt, not a hidden PASS.
- Next safe action: commit the staged release surface, push the branch, open PR, run CI, merge only on green checks, deploy to Vercel, then verify the live site and /api/health.


## CURRENT OWNER HANDOFF — 2026-09-15 23:16 UTC
- Owner requests removal of the logo's white background and working live-data packages, with Hermes doing implementation to conserve Codex usage. Hermes is the intended sole writer; Codex only coordinates/verifies. Original logo source must be preserved; an exact derived transparent asset is authorized, no redesign.
- Compact packet: `outputs/hermes-visual-live-task.txt`; named session `M3TM-WORLD-LogoLive-20260915`, actual session `20260915_161618_263092`, active profile `hermescommander`, configured provider/model `opencode-free / deepseek-v4-flash`, no configured fallback. Finite budget 900s/30 turns. No settings/provider/secret/billing changes.
- **BLOCKED BEFORE IMPLEMENTATION**: first model request failed at 2026-09-15 16:16:28 local with HTTP 401 `Missing API key.` from the configured OpenCode endpoint. Session cleanup records only 1 message; no accepted model response or tool execution. Starting the process did not deliver completed work. Do not retry unchanged requests or silently switch to Codex/paid providers.
- Private diagnostic log: `C:\H\ops\codex-control\d60bbcbdfc684986a790458a83e052ec\`; safe error confirmed in active profile agent.log. Next action: restore authentication for the existing Hermes provider locally, then resume this exact bounded packet. Logo and live-package fixes remain unimplemented in this handoff.

## CURRENT RESUME — 2026-09-15 (Codex, local only)
- Current owner instruction supersedes the historical Hermes-only rule: Codex is the single implementation writer in this checkout. Controller Status verified `workerRunning:false`, session `M3TM-WORLD-Finish-20260913`; no Hermes worker started, provider/billing changes, secrets, commits, pushes, or deployment.
- Branch/HEAD unchanged: `m3tm/world-bootstrap` / `8781ae3364f09dc74c37689461a77fb701f362f1`. Existing uncommitted work preserved; m3tm-app untouched.
- Arabic readability fixed: the HUD font now falls back to Segoe UI/Tahoma before Courier for Arabic; recon tool labels are 12px with more line spacing and secondary-text contrast. Real before/after captures confirm joined, clearer Arabic. OSIRIS structure/licensing preserved.
- Media truthfulness fixed: JPG = periodically refreshed image, MP4 = video file, HLS/MJPEG/iframe = medium/player description. Loaded media no longer receives a blanket live-video badge, animated red live dot, or an unsupported recording status. Shodan notice no longer promises screenshots and explicitly distinguishes indexed host records from images/live video.
- Fresh tests: **47/47 PASS** (`camera-feed.test.ts`: 33, including 6 media-label cases; Shodan route: 14). These supersede no unrelated historical test results.
- Fresh production build: **PASS**, including Next TypeScript phase. Separate `tsc --noEmit --incremental false`: **PASS**. No `typecheck` npm script exists. `git -c core.whitespace=cr-at-eol diff --check`: **PASS** (Windows CRLF handling).
- Lint: **NOT PASS**. Full lint stopped after excessive memory growth; source-wide retry exited 134 at the default ~4GB heap limit. Targeted lint completed: CameraViewer 2 errors/2 warnings; OsintPanel 44 errors/5 warnings; camera-feed helper/tests 0 errors/0 warnings. Upstream HEAD comparison: CameraViewer has identical counts/rules, OsintPanel has 43 `no-explicit-any` vs current 44 (the additional `any` is from the earlier Shodan changes, not this resume). No lint-rule suppression or unrelated refactor. Evidence: `outputs/resume-20260915/lint-targeted.json`, `lint-baseline.json`.
- Fresh browser/visual gate: **PASS for 768x1024 and 1920x1080** after production build. Default dark map visibly paints geography; recon panel stays within viewport; no document horizontal overflow. Local view_image reviewed `after-panel-768.png`, `after-panel-1920.png`, and `after-shodan-disclosure-1920.png`. Tiles settled for ~18s; browser errors captured: 0. Earlier mobile captures remain historical, not new verification.
- Shodan current configuration: `/api/osint/shodan?check=1` => HTTP 200, `configured:false`, `source:internetdb`. UI lookup for public DNS IP `8.8.8.8` => HTTP 200, InternetDB ports 53/443, limited-data notice visibly displayed. No paid Shodan request or device probing. Full Shodan API search/host integration still **REQUIRES_KEY**; real live video remains **NOT VERIFIED**.
- Logo transparency DONE: `public/branding/m3tm-world-logo-transparent.png` (genuine alpha, 1024x438, sharp extraction) wired in splash + header; original `m3tm-world-logo.png` unchanged (SHA256 215FD4F4BF8232F4192E3DBE575347952C73A8C68338DD7AF75EAB71AF7280A7); dark-bg verification confirmed ~92 residual white px; no redesign.
- SDK sea data fix: submarine-cables now auto-loaded when `activeLayers.sdk_sea` is on (page.tsx line 713). Independent `sdk_sea_cables` fetch at line 768. Bridge to `data.submarine_cables` at line 947. Verified 717 features. Build PASS, server restarted on 3102.
- Local preview restarted from new standalone build at `http://127.0.0.1:3102`. Initial build hit Windows EBUSY because the preview held `.next/standalone`; stopped only the verified preview process created in this turn, rebuilt successfully, restarted via RUN.ps1.
- Evidence and reproducible QA script: `outputs/resume-20260915/` (`before/after-evidence.json`, `verify.cjs`, `build.log`, `typecheck.log`, screenshots). All changes remain local/uncommitted.

### Remaining work
1. Full Shodan validation requires an available key and authorized live requests; no key was requested, exposed, or changed here.
2. Live camera video requires source/playback verification; media labels alone do not establish live service.
3. Lint debt and source-wide lint memory exhaustion remain unresolved. Overall release gate is not fully green; no deployment/commit approval inferred.

## HISTORICAL RECORD BELOW — 2026-09-13
The following prior verification and ownership notes are retained for provenance. The current resume above takes precedence.

## PROJECT
- M3TM.WORLD v0.1 + Arabic/reference milestone (authorized 2026-09-12); final capture milestone complete.
- Sole writer: Hermes session (M3TM-WORLD-EXECUTOR); Codex read-only supervision (VISUAL review pending on latest captures).
- Local independent clone of https://github.com/simplifaisoul/osiris; upstream remote retained, no pushes.

## BRANCH / HEAD
- m3tm/world-bootstrap @ 8781ae3364f09dc74c37689461a77fb701f362f1 (pinned upstream baseline).
- All work local and uncommitted. LICENSE/upstream notices unchanged. No DNS/deploy/billing/credentials/model-provider changes. No npm dependency changes.

## ENVIRONMENT
- Next 16.3.4 / React 19.2.4 / MapLibre 6.7.0 / hls.js 1.6.16 / Vitest 2.1.9 / TS 5.9.3.
- Bundled Node 24.19.0; Playwright 1.62.1 + Chromium 151 (headed). Server: RUN.ps1 standalone http://127.0.0.1:3102.
- Design tooling: C:\H\ops\design-quality-tools (axe-core 4.13.0 pinned, audit.cjs), visual-quality-gate skill.

## MAP RENDER STATE (2026-09-12 proxy fix + 2026-09-13 correction)
- ROOT CAUSE FIXED: /api/proxy-tiles stored EMPTY 200 bodies in Next fetch-cache during an upstream stall -> basemap black. Route now uses cache:'no-store', guards empty bodies (502), browser Cache-Control 86400; stale .next/cache/fetch-cache cleared. Verified: style 70431B, glyphs 74938B, MVT 217430B via proxy; server no longer wedges on first load.
- SATELLITE BASEMAP (ArcGIS raster, direct): PAINTS. Verified captures show real geography; tile counts per viewport recorded below.
- DARK-MATTER VECTOR BASEMAP: PAINTS (2026-09-13 corrected). The earlier "constant 38290-byte dataURL = never paints" conclusion was WRONG — canvas.toDataURL readback is not paint evidence. Composed screenshots now verify painting: app-default-dark-1440.png, app-default-dark-390x844.png, app-default-dark-430x932.png (stable ~10-18s settle, 13-14 tiles, 51-59% non-black, 170-293 distinct colors, 0 console errors). Codex view_image confirmed the isolated minimal MapLibre map (diag-minimal-maplibre-1440.png) visibly paints full dark geography + magenta GeoJSON polygon. Earlier "black" captures were async/timing artifacts (screenshots taken before tiles finished settling). Default behavior unchanged; satellite works as an additional basemap.

## DELIVERABLES (all implemented and built)
1. EXACT LOGO: supplied public/branding/m3tm-world-logo.png used as-is in header chip + splash; Arabic alt; old eye SVG removed from header (favicon retained).
2. ARABIC UI: html lang=ar dir=rtl; Arabic font stack; translated primary chrome, LayerPanel (tabs + 33 layers), CameraViewer, OsintPanel, GlobalStatusBar, AiOverview, SharePanel; map canvas kept LTR; coordinates/camera IDs/$OSIRIS LTR; M3TM.WORLD name preserved.
3. COLOR/READABILITY: surface luminance separated from map (bg-panel rgba(22,26,44,.94), bg-secondary #11141F, bg-panel-solid #161A2C), lighter vignette (0.45/0.75), glass top-light edge, contrast tokens raised (text-primary #F2F0EA, secondary #B4B0A6, muted #8A867C, border 0.25), Arabic sizes raised (tool rail 9->11px, drawer 10->12px, status bar 10->11px, mobile-nav 6->10px, splash status 10->11px), shortcut hint opacity 50->80.
4. SHODAN: server-side adapter (host/search/check), safe errors (no key leak), local bounds 10, banner-shaped search matches, vulns dict+list, coords top-level+location; InternetDB fallback marked configured:false (REQUIRES_KEY); snapshots removed (invented http.snapshot dropped). Frontend OsintPanel wired to server route with Arabic labels + REQUIRES_KEY notice.
5. VIDEO: existing HLS/MJPEG/iframe/JPG plumbing kept with honest Arabic media labels; stills never labeled live video; no private-device probing; proxy-tiles domain-restricted to cartocdn.

## VERIFICATION
- PRODUCTION BUILD: PASS (after round-2 edits; standalone restarted on 3102; server currently serving latest build).
- TESTS (last run on final code of affected files): Shodan route 14/14 PASS; components 60/60 PASS (FlightWatchPanel, DirectionsBar, ScaleBar, LiveNewsPreviews + shodan). No files with tests changed since; full suite/full lint NOT re-run (documented upstream debt + cost).
- AXE AUDIT (C:\H\ops\design-quality-tools\evidence\m3tm-world\accessibility-audit.json, pre-round-2): serious link-name on icon-only Discord/X links — FIXED (aria-labels added); incomplete color-contrast on splash badge/status + shortcut hint — addressed by opacity/size/color raises; static-paragraph contrast coverage documented limitation. No auto visual PASS.
- BROWSER CAPTURES (outputs/final-captures/, headed Chromium, satellite basemap, after fixes):
  - final-mobile-390x844.png (390x844, satTiles=2)
  - final-mobile-430x932.png (430x932, satTiles=15)
  - final-tablet-768x1024.png (768x1024, satTiles=5)
  - final-desktop-1440x900.png (1440x900, satTiles=57)
  - final-desktop-1920x1080.png (1920x1080, satTiles=43)
  - final-dark-default-1440.png (dark-matter default — documents the vector blocker)
  - final-open-recon-panel-1440.png (satellite + RECON panel button opened; DOM text check inconclusive pre-query)
  - final-evidence.json (state + tile counts + zero console errors)
- VISUAL STATUS: PENDING — awaiting Codex local image review of outputs/final-captures/. Pixel stats/build success are not visual pass.

## SCREENSHOT PATHS
- outputs/final-captures/*.png + final-evidence.json (current)
- outputs/improvements/* (previous rounds; qa-arabic-evidence.json, probe/diag scripts)
- outputs/reference/x-2097021626210476365-{2,9,17}.png (user reference frames)

## FILES TOUCHED (cumulative milestone)
- public/branding/m3tm-world-logo.png (supplied)
- src/app/layout.tsx, src/app/page.tsx, src/app/globals.css
- src/app/api/proxy-tiles/route.ts (black-map fix), src/app/api/osint/shodan/route.ts + route.test.ts (14 tests)
- src/components/OsintPanel.tsx, LayerPanel.tsx, CameraViewer.tsx, GlobalStatusBar.tsx, AiOverview.tsx, SharePanel.tsx
- outputs/final-captures/, outputs/improvements/ (QA scripts, screenshots, evidence)

## LIMITATIONS / BLOCKERS
- DEFAULT MAP (dark-matter vector): VERIFIED PAINTING in app via composed screenshots (2026-09-13). app-default-dark-1440.png: canvas 1440x900, 14 tiles stable, 51.03% non-black/293 colors, 0 errors. app-default-dark-390x844.png: 13 tiles stable, 53.99%/173 colors. app-default-dark-430x932.png: 14 tiles stable, 59.17%/170 colors. App defaults to projection='globe' (page.tsx line 263/1140) vs minimal diag's mercator — both render; this is a difference to note, not a failure. EARLIER "black" captures were async/timing artifacts (screenshot before ~10-18s tile settle; waitCartoStable now gates captures). No source fix made; no style fallback; original style/behavior preserved. RETRACTED (supervisor correction): the "software-WebGL vector render fails" claim was FALSE — Codex view_image confirmed minimal MapLibre map (diag-minimal-maplibre-1440.png) visibly paints full dark geography + magenta GeoJSON polygon. canvas.toDataURL length is NOT paint evidence (drawing-buffer readback preservation differs from composed screenshots). Evidence: outputs/final-captures/app-default-compare-evidence.json, app-default-dark-*.png, app-default-mobile-evidence.json, app-default-compare.cjs, app-default-mobile.cjs.
- SHODAN_API_KEY absent -> Shodan API REQUIRES_KEY; InternetDB fallback live-verified (8.8.8.8 -> dns.google, ports 53/443). No live Shodan-video claim.
- CCTV streams time/source dependent; stills not live video; no AIS key; CoinGecko CORS console error pre-existing.
- Server can wedge under heavy repeated loads (upstream socket starvation, documented in middleware comments); recovered by restart; captures done with one browser context to limit load. Previous 420s tool timeout left server down; restarted (PID rotation normal).
- Logo ASSET: original preserved (sha256 215fd4f4...); derived `public/branding/m3tm-world-logo-transparent.png` (1024x438, genuine alpha) wired in splash + header; verified on dark bg; white bg removed.

## NEXT ACTIONS
1. [DONE 2026-09-15] LOGO TRANSPARENCY: generated `public/branding/m3tm-world-logo-transparent.png` (sharp channel extraction, genuine alpha) — wired in splash + header; verified on dark bg (92 white px); SHA256 original preserved. Build PASS.
2. [DONE 2026-09-15] SDK SEA LAYER: fixed submarine-cables auto-load — now triggers on `activeLayers.sdk_sea` (line 713), independent fetch (line 768), bridge to `data.submarine_cables` (line 947). Verified 717 cable features loaded. Production build PASS.
2. [RETRACTED 2026-09-13] Prior claim "default app map fails / software-WebGL vector render fails" is FALSE — Codex view_image confirmed the isolated minimal MapLibre map paints geography + GeoJSON fill; composed app captures also paint. Earlier black captures were timing artifacts; waitCartoStable gates captures now. Evidence: outputs/final-captures/app-default-compare-evidence.json, app-default-dark-*.png, diag-minimal-maplibre-evidence.json (note: diag's toDataURL readback is not paint evidence).
3. [OPEN] App runs projection='globe' by default vs minimal diag mercator — renders fine either way; no change made. Optional owner decision: default dark style vs satellite-on-click remains user preference.
4. NEXT: Codex local view_image review of app-default-dark-1440.png, app-default-panel-1440.png, app-default-dark-390x844.png, app-default-dark-430x932.png, m2-* to set VISUAL. Commit/push only on explicit owner instruction. Supply SHODAN_API_KEY/AIS when available.

## LAST UPDATE
2026-09-15 23:40 UTC (Hermmes executor) — LOGO TRANSPARENCY DONE: `m3tm-world-logo-transparent.png` (genuine alpha) wired in splash + header; dark-bg verified (~92 white px). SDK SEA LAYER DONE: submarine-cables auto-load on `sdk_sea` (line 713), independent fetch (768), bridge (947); 717 features verified. Production build PASS; server 3102 running. All uncommitted changes preserved.

- CODEX VISUAL REVIEW 2026-09-13 20:44 UTC: view_image confirms geographic default-map paint in app-default-panel-1440.png and app-default-dark-390x844.png / app-default-dark-430x932.png. Arabic recon panel visible, header logo bounded, no giant-logo regression in these captures. MAP PAINT gate PASS for these three dimensions; no claim about unreviewed sizes or live feeds. Overall design acceptance remains PARTIAL: original logo white background still present; full Shodan/live-video requires configuration and real verification. Earlier runtime-vector-failure claim withdrawn.

- LOGO REVIEW 2026-09-13 21:00 UTC: built-in image edit requested only white-background removal preserving original composition/colors/text to true alpha. Output rejected: RGB1918x820 NO_ALPHA with painted checkerboard and altered details. Saved outputs/logo-review/rejected-no-alpha.png for evidence; not referenced by app; original bitmap unchanged. Exact transparent source asset remains required to satisfy removal without altering original artwork. Map/panel prior visual evidence reused; no repeated builds/tests. Shodan key/live video remain unverified. No complete-project claim.

- BLOCKER 2026-09-13 23:04 UTC: resumed task accepted but provider rejected model access due insufficient Nous credits; no new implementation/tool execution in this resume. Evidence: controller run fbc5a11396154ac3b02a2b2ca036302b/stdout.log. Worker inactive. Preserve configured model/provider; no billing changes. Remaining Arabic readability,768/1920 verification and Shodan configuration checks pending. Await restored provider access or explicit user model-change direction; do not retry unchanged requests.

## CURRENT EXECUTIVE RECOVERY — 2026-09-18
- Scope locked to M3TM-WORLD only; legacy m3tm-app untouched.
- Recovery snapshot: outputs/recovery/20260917-182538-executive.
- SDK render gap fixed and verified: sdk_entities feeds OsirisMap; AIR/SEA/INTEL node layers exist; Sea/Air/Naval toggles work and return to 3 active; cable fallback retained.
- TypeScript PASS; tests PASS (625 passed / 16 skipped); production build PASS.
- Full lint remains infrastructure/debt blocker: Node heap OOM around 5.1 GB. Snapshot comparison proves no lint regression from this recovery patch.
- Runtime PASS on 127.0.0.1:3102; root and /api/health HTTP 200; browser app-console errors after QA: 0; observed app requests 200.
- Responsive fresh verification PARTIAL: current viewport only; Playwright is not locally installed and dependencies were not changed.
- Stability PASS: one server, no eslint orphan, QA tab closed; ProtonVPN Service/WireGuard Running and untouched.
- Logical checkpoint: outputs/recovery/20260917-182538-executive/CHECKPOINT.md.
- No commit, push, merge, deploy, reset, clean, stash, secret/provider/billing change.
