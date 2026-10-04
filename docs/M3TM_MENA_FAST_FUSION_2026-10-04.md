# M3TM.WORLD — Middle East rapid public evidence (2026-10-04)

Implementation informed by World Monitor's published design for source-freshness and multi-tier caching, built independently on existing M3TM/OSIRIS code. No World Monitor AGPL code or branding was copied.

Every worldwide map layer and source is preserved. Published Middle East/Red Sea reports get bounded sampling priority, not exact military tracking. GDELT exports arrive each 15 minutes; per warm serverless instance the manifest is checked once/minute and unchanged ZIP archives are reused. This is not true per-second source publication. Existing durable last-good and CDN caching remain.

When the regional desk is open, conflict and GDELT layers update once/minute in visible tabs; otherwise worldwide 5-minute polling is preserved. Source-published time comes from the actual GDELT export filename; HTTP fetch time is distinct. The desk shows only counts of server-provided generalized military-air and naval cells.

Test TypeScript, full Vitest, Next production build, required Vercel Preview, then merge with protected branch settings and verify deployed SHA + live conflict/event layers and provenance. No internal OSINT exposure or military identifiers.
