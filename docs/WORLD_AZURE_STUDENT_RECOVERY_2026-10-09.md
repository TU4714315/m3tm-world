# M3TM.WORLD — Vercel pause: student Azure recovery (2026-10-09)

## Current state and scope

- Vercel **team** `m3-tm` reported a pause after 110% of the Hobby Fluid Active CPU included usage. Restore on Vercel requires its own support/upgrade/reset, not a GitHub or Azure student badge.
- `m3tm-app` is a separate **Vite SPA** and already has GitHub Pages workflow `pages.yml`, SPA route fallbacks, and `public/CNAME=m3tm.app`. Do **not** move the APP or rewrite Supabase just to resolve the WORLD outage.
- `m3tm-world` is dynamic **Next.js**; the existing Dockerfile builds and serves `.next/standalone` on port **3000**. Static export of WORLD would break route handlers and live APIs.
- The former Docker publishing workflow watched `master`; protected production uses `main`. The companion PR fixes this and adds an AMD64 PR build-only gate and full-length `sha-<commit>` image tags.
- **Nothing in this change deploys to Azure, changes DNS, authorizes billing or rewrites a production origin.** It prepares a verifiable container artifact for recovery.

## Eligibility / budget gate

Azure for Students has a credit balance (up to USD 100 on original enrollment, not necessarily remaining) and is intended for education, noncommercial research and design/test/demonstration within the offer terms. Check the subscription type, remaining credit, expiry, and whether this WORLD deployment actually qualifies **before provisioning**. Do not represent it as a free production hosting entitlement for unrelated commercial operations.

Azure Container Apps Consumption monthly free allocation is 180,000 vCPU-seconds, 360,000 GiB-seconds and 2M requests per eligible subscription. Other charges (managed environment, logging, egress, other resources) may apply. The credit is finite; set **Azure Cost Management budget alerts** and keep `minReplicas=0, maxReplicas=1` at initial preview. Cold starts are expected.

GitHub Container Registry can provide an image without Azure Container Registry. The resulting GHCR *package must be made public* in GitHub package settings (or an authenticated pull configured), and the registry setting must be compatible with Azure Container Apps. Never add a package PAT to public client code.

## Verification gates (strict sequence)

1. Verify Vercel pause and which projects share its team CPU quota. Check APP GitHub Pages deployment, login, auth callback and static `/data/news.json` independently. `m3tm.app` responding is not sufficient evidence that auth works.
2. Merge **only when PR validation and review are green**. On `main`, run the Docker image workflow, confirm image `ghcr.io/tu4714315/m3tm-world:sha-<FULL_40_HEX_SHA>` exists and anonymous pull works; do not assume GHCR published on the old `master`.
3. With an eligible Azure subscription, prototype WORLD on its generated `*.azurecontainerapps.io` hostname, with external ingress port 3000 and scale 0..1. Keep a manual deployment gate. Use a **SHA-pinned** image; never rely on `:latest` for cutover.
4. Set only approved **server-side** environment variables in Azure Container Apps secrets/config (if needed for public providers); no tokens in `NEXT_PUBLIC_*`, GitHub files, logs, or URLs. Keep OSINT/scanner internal and disabled for public use.
5. Preview-gate: `/`, `/api/health`, `/api/news`, `/api/gdelt-history?hours=24`, /api/conflicts, /api/flights?summary=1 with bounded traffic. Distinguish success, stale, provider-degraded and unavailable; do not fabricate event locations or readiness. Test Chromium and iOS Safari for WebGL, labels, Arabic/mixed RTL/LTR, news cards, and 390px mobile layout.
6. **APP integration is a separate explicit change** after WORLD is live. Existing hardcoded old production origin appears in `m3tm-app/src/pages/preview/M3tmWorldMap.tsx`, `src/components/public/publicNews.ts`, `src/pages/preview/Gate1InternalShell.tsx`; tests and public links must be updated together. Preserve the APP↔WORLD origin/version/source/35s handshake and iframe CSP rules.
7. Analytics needs coordinated change: `m3tm-world/src/lib/publicVisitCounter.ts` allowlist and APP's Supabase `record-site-visit` permitted origins. Do not broaden to arbitrary origins or inadvertently double count visits.
8. Use a stable new domain under the owner-controlled DNS, e.g. `world.m3tm.app` **only after ownership/availability and HTTPS verification**. Confirm cross-origin news CORS, CSP `frame-ancestors`, Supabase site URL and auth redirect allowlist where applicable, and rollback controls. Do not change `m3tm.app` DNS when APP already works.
9. Canary traffic + logs/budget for 48 hours; baseline provider performance/CPU; only then update APP's primary WORLD URL and promote the new backend. Retain a rollback image tag and previous APP deploy.

## Developer execution scaffold — only after owner verifies Azure student terms and budget

Azure CLI on Windows PowerShell, with an eligible subscription and an existing **public and tested** GHCR image:

```powershell
az login --use-device-code
az account list --output table
az account set --subscription '<ELIGIBLE_SUBSCRIPTION_ID>'
az account show --output table
az extension add --name containerapp --upgrade

$RG = 'rg-m3tm-world-demo'
$ENV = 'env-m3tm-world-demo'
$REGION = 'westeurope'
$IMAGE = 'ghcr.io/tu4714315/m3tm-world:sha-<FULL_40_HEX_SHA>'

az group create --name $RG --location $REGION
az containerapp env create --name $ENV --resource-group $RG --location $REGION
az containerapp create --name m3tm-world-demo --resource-group $RG --environment $ENV --image $IMAGE --ingress external --target-port 3000 --cpu 0.5 --memory 1.0Gi --min-replicas 0 --max-replicas 1
az containerapp show --name m3tm-world-demo --resource-group $RG --query properties.configuration.ingress.fqdn --output tsv
```

Notes: availability/quotas and permissible resource types vary by Azure Students subscription and region. The environment may provision monitoring resources; review their estimated cost before confirmation. If GHCR package visibility or registry auth blocks deployment, configure that in Azure securely and retry; never expose credentials in CI source.

## Cost reduction follow-up (not bundled into emergency branch)

Prioritize `src/app/page.tsx` layer poll intervals, `src/app/api/stats/route.ts` internal fanout, `src/app/api/flights/route.ts` refresh/fallback, and `/api/conflicts` / `/api/gdelt-events` refresh. Evidence: code inspection identified intervals and fanout; **it has not yet identified which route caused the Vercel team-wide CPU overage**. Optimize behind tests and a verified measurement baseline, preserving public maps and existing passive-provider safety.

## Non-goals

No WORLD static export, no replacement of APP GitHub Pages, no forced Supabase DB migrations, no DNS changes, no unapproved cloud costs, no precise public military tracks, and no public internal OSINT tools.
