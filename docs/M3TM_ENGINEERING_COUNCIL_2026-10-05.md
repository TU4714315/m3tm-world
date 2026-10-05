# M3TM — مجلس التحسينات والتطوير الهندسي | Decision record 2026-10-05

> Status: REVIEW PROPOSAL, not production release evidence. GitHub/CI/health/DB live results outrank this snapshot. This record complements (does not replace) `AGENTS.md`, `docs/M3TM_CONTINUATION_MASTER_2026-10-04.md`, and the APP `docs/M3TM_EXECUTION_CONTRACT.md`. Do not paste secrets, private cases or raw licensed records here.

## 1. قرار المجلس التنفيذي
الهدف ليس جمع أكبر عدد من الأيقونات أو نسخ WorldMonitor. الهدف **M3TM Fusion Observatory** بواجهة عامة عربية واضحة ومصادر قابلة للتحقق، وبوابة خاصة موحّدة للتحقيق والعلاقات والوكيل، مع قياس موثق لتكافؤ أو تفوق وظائف الرصد العامة. WorldMonitor **benchmark وظيفي خارجي** فقط، ولا تُنسخ شفرته AGPL أو هويته بلا مراجعة ترخيص مستقلة.

**الفصل الملزم:** `M3TM.APP` = shell/public news/auth/private investigations/permissions؛ `M3TM.WORLD` = published map and public-source evidence؛ Host-Agent/Docker/Hermes/Codex = private, outbound-only, gated, not browser-accessible. لا Graph ثالث، ولا أدوات OSINT عامة، ولا مسارات/معرّفات عسكرية أو بحرية تشغيلية دقيقة.

## 2. حالة الأدلة عند إنشاء هذا القرار (يجب تحديثها قبل كل قرار دمج)
| المسار | المثبت | القرار |
|---|---|---|
| WORLD #69 | MERGED: صورة الأقمار أوضح، camera clusters مع expand، وتحسين علامات GDELT؛ الفحص البصري للإنتاج وSHA لم يثبتا في هذه المراجعة | Verify deployment, mobile and viewer before DONE |
| WORLD #66/#67 | MERGED: نافذة مصدر GDELT مع تصحيح `memory=0` المضللة إلى unknown عند غياب التخزين المتين | لا تسمّ العينات تاريخ 7 أيام |
| WORLD #68 | OPEN: durable bounded GDELT archive + chronology، test workflow ناجح وVercel status success على PR HEAD `f6086c3`؛ **مراجعة P1 غير محلولة** بشأن موارد APP المشتركة | HOLD merge حتى قرار APP الحاكم |
| WORLD #42 | OPEN، `mergeable=false`، لقطة أقدم لطبقة نشاط أقمار عامة معممة | DIFF مقابل main، استخرج فقط التغييرات غير الموجودة ولا تدمج فرعًا قديمًا |
| APP #349 | OPEN: Graph/Agent/OSINT unified dock؛ في SHA `999d5c8` CI فشل في اختبار واحد من 507 (`aria-hidden` ancestor assertion)؛ تصحيح **الاختبار فقط** على SHA `2dcb968`، checks الجديدة لم تكن قد اكتملت عند التحرير | لا دمج حتى CI أخضر واختبار جلسات |
| APP #338 | OPEN: Hermes/Codex fixed headless adapters | `READY` يتطلب probe+queue-auth+security+actual permitted E2E، لا الاكتفاء بتثبيت CLI |
| APP #360 | OPEN APP Supabase ownership/resource-governance issue؛ توجد public-only WORLD GDELT tables/cron/function في APP-owned project وجرى read-only audit | APP owner decision/coordination prerequisite |

**حاجز المشاهدة:** مشاركة المحادثة `chatgpt.com/share/6ac3f259-68d8-83ed-a4b4-8246a08b99e7` وHTTP production/browser QA لم تكن متاحة من أدوات هذه المراجعة؛ لا يُستنتج منهما نجاح أو فشل نشر. Local Workspace Core `read/exec_command` أعادا "tool not found"؛ لا تفترض clean git worktree.

## 3. لجنتان بمسؤوليات محددة، لا منظومة وكلاء متضخمة
**لجنة التحسين والجودة (QA / Reliability / Design / Data Integrity):**
- تمنع اختلاط `fresh / cached-stale / restricted / unavailable / not-configured` وتحقق source lineage من وقت نشر **المصدر** إلى وقت الإدخال ثم وقت عرض الواجهة، كلٌّ مستقل.
- تختبر شاشات 390×844، 430×932، 768×1024، 1440×900، 1920×1080؛ RTL، حجم الأيقونات/التباين، ضبابية الأقمار، ضغط الكاميرات، hit targets، focus/keyboard/aria.
- تطابق حالة كل طبقة بين toggle وhealth وAPI وGeoJSON والإظهار النهائي؛ عدم جلب بيانات ≠ طبقة مغلقة؛ وعدم وصول الحدث ≠ غياب نشاط.
- توثق false positives للـGDELT/ACLED والازدواج والتصنيف والموقع العام وتفحص الترخيص/المصدر.
- تشغّل Release Gate **مرة عند وجود المرشح**، لا loop CI/deploy يستهلك quota.

**لجنة الهندسة والتطوير (Architecture / Data Platform / Security / UX):**
- APP وWORLD integration adapter و`hello/ready/sync/select` مع origin/version/source validation وfallback 35s، دون نسخ المشروعين بعضهما داخل بعض.
- Public events ledger: durable bounded/idempotent ingestion، archived vs latest فصل، attribution، ingestion watermark، zero-buckets، gaps، cost caps، retry.
- APP واحد لعلاقات الكيانات والأدلة والاختيار الجغرافي مع orchestration auto/manual خادمـي، الأدوار، owner-lock، provider READY الفعلي.
- Security review لكل تغيير RLS/cron/Edge، وعلى وجه الخصوص تحكم APP في موارد Supabase وعدم كشف مفاتيح الخادم أو مضيف/عنوان محلي أو identifiers حساسة للمتصفح.
- تحافظ على identity M3TM وترخيص المصادر؛ راجع نصوص الواجهة والدليل غير المحدث دون إزالة acknowledgements/license القانونية.

## 4. خطة القرارات التنفيذية حسب Gate لا حسب وعود زمنية

### Gate 0 — P0: استقرار، صدق البيانات وسلامة النشر
1. APP #349: اعتمد test fix `2dcb968` فقط إذا اجتاز test/CI/build/visual/role checks على SHA ذاته؛ ثم `npm run ai:handoff` لتوليد سجل APP من البيئة الحقيقية (لا تعدّل AI_HANDOFF يدويًا). اختبر حفظ جلسة الأداة عند تبديل auto/manual وأن القفل/الدور/provider يمنع تشغيلها.
2. WORLD #68: لا دمج حتى يحسم APP #360 مالك الجدولة والquota وقاعدة البيانات والمسؤوليات والحدود، أو يستقل WORLD بمورد خاص خاضع له؛ سجل runbook pause *لهذه الوظيفة فقط*، retention/rollback/monitoring مع منع أي انقطاع لباقي APP. لا تُعد تشغيل migrations المطبقة مسبقًا.
3. WORLD #69: تحقق أن main وproduction health SHA متساويان وأن النقر على cluster يفتح أفراد الكاميرات، وشهادات desktop/mobile، وعدم تأثر الطبقات/المعلومات العامة.
4. Confirm fresh `/api/health?deep=1`, `/api/gdelt-events`, `/api/conflicts`, `/api/flights?summary=1`, `/api/source-coverage`, `/api/gdelt-history` (last only after #68 deployment); failed access => UNKNOWN وليس PASS.
5. APP Auth E2E بحساب مخوّل حقيقي: register→confirm→callback→session→pending/approval→role→dashboard؛ login→session؛ no fake login/bypass.

**Gate-0 EXIT:** required checks green for each final SHA, 0 open critical security/review findings, production SHA match and public/private separation smoke. Any missing authenticated/prod access is BLOCKED, not PASS.

### Gate 1 — P0/P1: موثوقية المصادر ومقارنة WorldMonitor
1. Current ACLED access is **historical-only by account entitlement**؛ اجعله `restricted_recency`, افصل release date عن event date ولا تصنع سجلات 2026، ولا تتجاوز licensing.
2. ارصد ≥672 eligible GDELT 15-minute export windows over 7 complete days **after collector start and publication cutoff**؛ missing/stale/replayed/late/future windows distinct. Inspect real receipt ledger independently of event counts. Sliding denominator must include missing oldest eligible slot.
3. Coverage and news-coded events ليسا تأكيد واقعة. For every public report retain original link, source/archive publishedAt, firstReceiptAt, geo precision and evidence label `أولي / عدة ناشرين / مرجعي / موضع تقريبي`; multi-publisher ≠ independent corroboration.
4. Evaluate CAMEO country/location false positives on a manually reviewed sample, malformed URLs/timestamps, clock skew, repeated titles and geo-centroid errors (including Makkah code ambiguity).
5. Benchmark WorldMonitor on **same MENA extent and same real time windows**: source-origin freshness p50/p95, coverage eligible slots, unique credible reports, verified attribution, duplicate/false positive rate and 2D/3D latency. Do not claim numerical superiority absent seven-day evidence and documented counterpart method.

**Gate-1 EXIT:** repeatable evidence/export ledger, monotonic idempotent collection, real sampling gap flags and honest unknown states; signed comparison table with raw provenance rather than a marketing score.

### Gate 2 — P1: الجاهزية البصرية والعمليات الجغرافية
1. Maintain user-operable public catalog: conflicts, density, civil unrest, frontlines, published reported_routes, app_news, GDELT, alerts, CCTV, maritime general, aviation, satellite, source freshness, borders etc. Retain layers; make default selection predictable under saved URL schema. Toggle ON ≠ Provider READY.
2. Show distinct small but legible conflict/statement/unrest/source markers rather than homogeneous red points. Keep camera clustering at global scales and clickable individuals at city scales; preserve `CameraViewer`.
3. Improve satellite raster contrast by bounded presets without re-coloring alert symbols; evaluate real imagery age/provider zoom constraints. Distinguish sharper rendering from actual higher-resolution imagery.
4. Hide/lock intentionally unsupported Bluetooth-control/markets menus, not functioning live data layers. Remove upstream promotional links from visible M3TM UI while preserving legal license/attribution in repository.
5. Performance profile WebGL map state with real desktop/iPhone Safari viewport, low-power/fallback mode, reuse fetches, cancellable polling, and collision-free Arabic mobile panel.

**Gate-2 EXIT:** screenshots + automated nonoverflow and a11y tests at every target viewport, map click/zoom/keyboard tests, no lost active public layers; measured FPS, UI latency, network/heap baselines published with environment (no invented numbers).

### Gate 3 — P1: البوابة الخاصة والتحقيق والتحكم المحلي
1. APP Entities = case/entity library; converge `RelationsPage` and `RelationsWorkspacePage` into ONE evidence-backed canvas preserving existing data, pan/zoom/drag/multi-select/link-edit/dossier/archiving.
2. One dock, two intentional modes: auto (server orchestrator selects permitted tool) / manual (one owner-unlocked tool). Preserve in-flight sessions across views but never execute hidden or unauthorized requests. Graph↔WORLD selection uses the existing strict bridge.
3. Runtime READY derived from server-attested adapter+health+policy+actual probe; no arbitrary cloud shell or argv. Keep Docker/local-first for heavy tools, outbound-only Host-Agent; device not a public endpoint.
4. Wait for legitimate verified passive target before first full `start-tool→queue→claim→running→completed→result`, cancellation, expired polling and leakage tests. No synthetic target or allowlist mutation.
5. Hermes/Telegram profile collision and agent-browser audit: resolve with actual routing ownership, no arbitrary credential removal or force-install of dangerous skills.

**Gate-3 EXIT:** E2E authenticated test data owned by the user, role/tenant boundary tests, zero leaked host token/IP/internal routes, no unverified READY and no third graph.

## 5. مقاييس نجاح قابلة للتدقيق (Targets, **not current results**)
| KPI | معيار القبول |
|---|---|
| Release traceability | 100% of claims about deployed functionality include exact final commit SHA + CI result + production evidence |
| Public safety | 0 leaked secrets/internal host routes/precise military or naval operational tracks; private tools return fail-closed |
| Source integrity | 100% of displayed evidence samples have traceable source URL and distinct time semantics OR explicit missing status |
| GDELT 7-day coverage | denominator 672 **eligible** windows after warm-up, each observed/missing/late tracked; no silent percentage fallback |
| UI correctness | 0 horizontal overflow or inaccessible essential control in 5 defined viewports, including real WebKit where available |
| Map truthfulness | 0 intentional false READY/live labels; stale map pins and summary stay consistent |
| Comparison | no “better than WorldMonitor” claim before 7d same-region source and performance measurement |
| APP integration | verified 35s fallback, strict origin checks, authenticated roles and preserved auto/manual sessions |

## 6. مخاطر التشغيل واستجابة المجلس
| ID / risk | Severity | Control / stop rule |
|---|---|---|
| R1 Shared APP Supabase quota, service scope, migration drift | Critical | HOLD WORLD #68 merge pending APP #360 owner decision, blast-radius budget and reversible runbook |
| R2 Old branch conflicts (#42) | High | Compare to main; EXTRACT/CLOSE, no blind merge |
| R3 Public-source false incident geolocation | High | Publisher/link/time/provenance, geo-generalize, machine-coded ≠ confirmed |
| R4 APP tool execution bypass | Critical | GATED/owner-lock/role/server-first E2E; no implicit target |
| R5 Vercel/CI quota and partial deployments | High | No repeated previews/no bypass; deploy once for approved final SHA |
| R6 Browser/local tool unavailable | Medium | State UNKNOWN; GitHub read-only evidence only cannot replace production tests |
| R7 Third-party license/brand drift | High | Retain mandatory attribution, no AGPL copy, remove upstream promotion from own visible UI only |

## 7. مسار التسليم وحقوق القرار
- **Owner:** product priorities, APP-owned Supabase resource approval, account entitlements and source licenses.
- **Architecture/security reviewer:** R1–R4 threat model, API contracts, licensing and proof. Reviewers are roles rather than extra autonomous agents by default.
- **Implementation:** minimal scoped patches on approved branch with targeted tests → integration gate → protected PR review → release gate → production smoke. Never edit protected main directly or rewrite worktree; no unrelated feature expansion.
- **Evidence steward:** update the canonical WORLD master checkpoint DONE/BLOCKERS/NEXT/VERIFY only after true deployment and tests; APP AI_HANDOFF is generated by APP command.
- **Immediate order:** (1) APP #349 new CI gate; (2) WORLD #68 APP ownership decision; (3) WORLD #69 deployed map visual and map layers; (4) seven-day archive monitoring; (5) Graph/OSINT/private E2E once authorization permits. No quota bypass, no false acceptance.

**Relevant work:** [WORLD PR #68](https://github.com/TU4714315/m3tm-world/pull/68) · [WORLD PR #69](https://github.com/TU4714315/m3tm-world/pull/69) · [APP PR #349](https://github.com/TU4714315/m3tm-app/pull/349) · [APP PR #338](https://github.com/TU4714315/m3tm-app/pull/338) · [APP governance #360](https://github.com/TU4714315/m3tm-app/issues/360).
