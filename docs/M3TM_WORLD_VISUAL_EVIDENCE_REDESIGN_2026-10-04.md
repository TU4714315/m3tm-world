# M3TM.WORLD — Public regional observation redesign · 2026-10-04

Compared visually against the public WorldMonitor dashboard at Middle East scale; this is an independent M3TM implementation, not imported upstream AGPL code/assets.

1. MENA-first initial globe center and region-appropriate zoom without deleting global coverage. A one-tap **مرصد الشرق الأوسط** switches to accessible flat dark map and opens the source-backed Arabic desk; the 3D imagery/globe remains available.
2. **Esri raster visual grading:** original/clari­ty/bright modes adjust only MapLibre's raster imagery paint. Default clarity reduces washed desert highlights and enhances terrain contrast. Labels, badges, 3D overlays, attribution, provider tiles and dark basemap remain intact.
3. **Source provenance:** articles from one publisher must not be called multiple-source. An automated single-publisher report is a blue-grey incident badge, distinct from a color-coded multi-publisher report, while keeping its event silhouette/category. Neither means independent verification of an attack.
4. **Clustering:** zoom-aware GDELT and unrest bubbles count real published reports, auto-expand into event markers on zoom. Dense civil flight icons use collision layout at regional zoom; the API and all source records remain unchanged and fully selectable at higher zoom.
5. **No visual double counting:** a report included in both /api/conflicts and /api/gdelt-events renders as one pin. Heatmap and both source layers remain present.
6. Arabic MENA desk shows original source-batch age, category breakdown, single/multiple publisher labels and clear ACLED empty-vs-active state; do not equate ACLED OAuth success with data availability.
7. Full regression gates: TypeScript, Vitest, Next production build, Preview, map/desktop/mobile smoke, no military unit identifiers or tracks exposed, protected main merge and provider freshness checks.

ACLED upstream is curated and should not be described as real-time when its own last published records are older. Research license does not authorize redistributing raw licensed data on the public map. Exact live military flight/naval telemetry is still not part of the public surface.
