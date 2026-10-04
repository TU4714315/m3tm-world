# M3TM.WORLD – Vercel deployment budget policy (2026-10-04)

## Why
The Hobby limit is **100 created deployments / 86,400 seconds across the owner**. A Vercel `ignoreCommand` or dashboard "Ignored Build Step" still **creates a counted deployment**, even when canceled, so do not use it as a quota-saving solution.

## Implemented (without disabling production/feature previews)
- `git.deploymentEnabled["qa/**"]=false`: source-only `qa/*` checkpoint/smoke branches no longer create automatic deployments. Their GitHub tests and local/production smoke can still run, and no public source or layer is disabled.
- All unspecified branches retain Vercel's default `deploymentEnabled=true`, especially `main`, `feat/**` and `fix/**`. The required Vercel PR status and protected-main squash workflow remain intact.
- If a QA scenario specifically needs a new Vercel Preview, validate it on its feature/fix PR branch or explicitly select the provider's authorized deployment workflow; do **not** use no-op commits to force preview.
- GitHub Actions now uses `cancel-in-progress` for superseded PR checks; that saves CI compute but **by itself does not save Vercel deployment quota**.
- Batch meaningful edits and tests locally, then push **one reviewed candidate**. Never drive previews through repeated empty commits.
- Check budget on **both M3TM.WORLD and M3TM.APP**, since the Vercel quota is owner-wide.

## Acceptance
No code, public feeds, cameras, conflict layers, map tools, credentials or OSINT gates change in this policy patch. New feature/production branches must still receive required Vercel status before protected merges. If a future QA-only PR requires Vercel, use a standard feature/fix release branch for its checked preview.
