# المشاريع + الدمج 2026

ملف القيادة الرئيسي لمشاريع M3TM التقنية فقط. الأبحاث الأكاديمية والطلبات العامة مستبعدة.

## الملف الأساسي
- المسار: /m3tm-world/docs/M3TM_PROJECTS_INTEGRATION_2026.md
- الغرض: نقطة الاستئناف الموحدة لـ M3TM.APP و M3TM.WORLD والدمج بينهما.
- القاعدة: أي جلسة جديدة تبدأ بقراءة هذا الملف ثم التحقق من Git و CI و Production الفعلي.

## M3TM.WORLD
- المستودع: TU4714315/m3tm-world
- مساحة العمل الحالية: /m3tm-world
- فرع التوثيق النهائي الحالي: docs/final-integration-20260924، مبني مباشرة على origin/main.
- origin/main المؤكد: 180c636b12f3132e1f11755d4fe35be952d85fb7 — Merge pull request #7 from TU4714315/fix/public-live-feeds-20260924.
- النشر: https://m3tm-world.vercel.app
- ملف الحالة: /m3tm-world/M3TM_WORLD_STATE.md
- Checkpoint سابق: /m3tm-world/outputs/recovery/20260917-182538-executive/CHECKPOINT.md
- الحالة: WORLD منشور ويعمل كمحرك 3D الحقيقي لـ M3TM.APP عبر عقد embed hardened. أغلقت PRs #4/#5 الواجهة العامة العربية والجوال والسلامة والـpublic surface، وأغلقت #6/#7 استعادة fallback الطيران المدني العام. النشر الحي الحالي مطابق لـ origin/main أعلاه.

## M3TM.APP
- المستودع: TU4714315/m3tm-app
- النشر العام: https://m3tm.app
- الدور: Shell والهوية والبوابة العامة والخاصة والأخبار والعلاقات والكيانات ونقاط الدخول.
- نسخة العمل الحالية المعتمدة داخل Workspace Core: /m3tm-world/scratch/m3tm-app-live
- Worktree تاريخي معروف: C:\Users\DELL\.codex\worktrees\m3tm-app-finalize-20260919
- نسخة محلية قديمة لا تستخدم كأساس: C:\Users\DELL\Documents\Codex\2026-06-21\new-chat\work\m3tm-app
- origin/main المؤكد: 937b71b9deee813eb775f724a77e34c6d5308153 — Open full M3TM.WORLD from mobile map navigation (#284).
- الدمج الحالي: production live iframe bridge فعلي إلى M3TM.WORLD الحقيقي في وضع 3D، مع 2D fallback محلي. هذا ليس direct in-process Adapter النهائي؛ الـAdapter المباشر دين معماري مستقبلي وليس عطلًا في bridge الحالي.

## المشاريع والخدمات المساندة

### M3TM.OSINT
- طبقة أدوات البحث والتحقق.
- أدوات تاريخية ومحلية تشمل SpiderFoot و GHunt و PhoneInfoga و TruecallerJS و Maigret و Sherlock وأدوات DNS و HTTP والأرشيف والفحص.
- الهدف: Gateway موحد خلف صلاحيات APP/WORLD، وليس تعريض الأدوات مباشرة للعامة.

### M3TM Sentinel
- مراقبة وتنبيه وربط أحداث وكيانات حسب الحالة الفعلية في المستودعات.

### M3TM Observatory 2026
- رصد متعدد اللغات وحزم متابعة حج 1447/2026.

### M3TM Research
- أبحاث وتحليلات تقنية فقط، منفصلة عن الأبحاث الأكاديمية.

### M3TM Core / API
- مستودع تاريخي معروف: TU4714315/m3tm-core.
- خدمات تاريخية: FastAPI باسم M3TM OSINT API v3.0 على المنفذ 7000، وOllama health على 8001.
- هذه المعلومات تاريخية حتى يعاد فحص الخدمة الحالية؛ لا تعتبرها production-ready دون health check جديد.

### Omni-Phantom
- وحدة/مسار مشروع تاريخي ضمن منظومة M3TM للتعامل مع طبقات الحماية والبوابات.
- لا يوجد في ملف القيادة الحالي دليل كاف على مستودع مستقل أو نشر حي؛ تعامل معه كمشروع مسجل يحتاج اكتشافًا قبل التنفيذ.

### Telegram Bot
- بوت تجريبي تاريخي لتنفيذ أوامر OSINT وربط نتائج الأدوات.
- توجد مشكلة تاريخية في تحويل الرسائل إلى مواضيع؛ الحالة الحالية تحتاج فحصًا قبل أي اعتماد.

### Telegram / n8n / Docker
- Telegram bot: قناة تشغيل واختبار تاريخية لأدوات OSINT.
- n8n: طبقة أتمتة وربط.
- Docker: طبقة تشغيل محلية للخدمات والأدوات الخلفية.
- لا تعتبر أي خدمة جاهزة للإنتاج إلا بعد فحص الحاويات والشبكات والـ health الحالي.
- تحقق مباشر 2026-09-22: m3tm-osint-agent-v2 و m3tm-ghunt و m3tm-spiderfoot و m3tm-truecallerjs و m3tm-phoneinfoga و n8n كانت تعمل؛ m3tm-osint-agent-v2 و n8n ومعظم خدمات Supabase المحلية ظهرت healthy.

### Hermes
- الدور المستهدف: وكيل تنفيذي محلي ومنسق، وليس مصدر الحقيقة للمستودعات.
- سجل WORLD يثبت جلسات Hermes تاريخية و profile باسم hermescommander.
- توجد سجلات تاريخية لفشل مزود النموذج بسبب 401 Missing API key، لذا يجب فحص الحالة الحالية قبل الاعتماد عليه.
- عند الاستمرار: يقرأ هذا الملف ثم M3TM_WORLD_STATE.md ثم يتحقق من Git و CI و Production قبل الكتابة.
- تحقق مباشر 2026-09-22: C:\\H\\bin\\hermes.exe موجود، والـGateway يعمل، وHermes أظهر جلسة نشطة واحدة وجدولين مجدولين.
- Telegram مهيأ داخل Hermes، وxAI/Grok OAuth مسجل، بينما xAI API key غير مضبوط.
- Handshake read-only نجح: Hermes قرأ ملف القيادة وM3TM_WORLD_STATE.md وتحقق من Git وأعاد branch/HEAD/dirty state وأول Gate غير مكتمل.
- جولة bounded لاحقة على WorldFeed.tsx وWorldMap.tsx أكدت عدم وجود فساد نصي/JSX مؤكد ولم تعدل أي ملف.

### Grok / Bot
- لا يعتمد وجود بوت Grok أو صلاحياته إلا بعد اكتشاف ملف أو خدمة أو حاوية أو تكوين فعلي.
- ممنوع اختلاق تكامل باسم Grok دون دليل تشغيلي.
- تحقق مباشر 2026-09-22: تطبيق Grok Bot.exe مثبت تحت C:\\Users\\DELL\\AppData\\Local\\Programs\\Grok Bot\\ وله عدة عمليات فعالة وقت الفحص.
- لم يثبت بعد أنه مربوط بمستودعات M3TM أو بملف القيادة؛ الحالة الحالية: RUNNING_APP / INTEGRATION_NEEDS_DISCOVERY.

### قاعدة حالة المشاريع غير المثبتة
- أي مشروع أو خدمة مذكورة تاريخيًا بلا repository/path/process/health مثبت حاليًا تسجل هنا كـ NEEDS_DISCOVERY، ولا تعامل كخدمة تشغيلية جاهزة.

## خريطة الدمج

M3TM.APP
  Public Gateway
    الهوية العامة
    الأخبار
    الأرشيف والبحث
    M3TM.WORLD Viewer

  Private Command Shell
    Auth / permissions
    Relations / Entities
    Evidence / Sources
    Operational tools

  Integration Bus
    entity selection
    geo selection
    evidence linkage
    time / confidence

              |
              v

M3TM.WORLD
  WorldMap / MapLibre
  Events / News
  Flights
  Satellites
  Maritime
  CCTV
  Weather / Fires / Seismic
  Public data layers
  Search / verification adapters

## القرار المعماري
1. M3TM.APP يبقى الـ Shell الرئيسي.
2. M3TM.WORLD يصبح محرك الخرائط والطبقات الجغرافية الحقيقي.
3. لا يتم نسخ WORLD كاملًا داخل APP ككتلة واحدة.
4. الدمج عبر Adapter و Contract واضح مع fallback آمن.
5. الجوال يحصل على WORLD-first surface خفيف؛ الأدوات الثقيلة تبقى في البوابة الخاصة.
6. Relations/Entities تتصل بـ WORLD عبر Selection Bus.

## تسلسل الإصلاحات الكامل

### A — إغلاق WORLD
1. مراجعة WorldFeed.tsx و WorldMap.tsx والتأكد من عدم وجود فساد نصي.
2. تنظيف الهوية المرئية القديمة OSIRIS و ORIS و Intel و Intelligence و OSINT و SIGINT من واجهة المستخدم حيث لا يلزم التوافق.
3. إبقاء أسماء API الداخلية القديمة فقط إذا كانت مطلوبة للتوافق.
4. تنظيف trailing whitespace و CRLF noise بدون تغيير منطقي غير ضروري.
5. TypeScript.
6. Tests.
7. Build.
8. Lint المستهدف والكامل حسب قدرة الذاكرة مع تسجيل الدين القديم بدل إخفائه.
9. Browser QA على 390x844 و 430x932 و 768x1024 و 1440x900 و 1920x1080.
10. Docker و health.
11. Commit ثم Push ثم PR ثم CI ثم Merge ثم Vercel.
12. تحقق حي من m3tm-world.vercel.app و /api/health.

### B — تثبيت APP
1. استعادة أحدث Worktree و branch فعلي والتحقق من HEAD.
2. عدم استخدام النسخة المحلية القديمة كأساس.
3. قراءة آخر Production Health failure قبل أي merge.
4. إصلاح false-positive الخاص بـ Cloudflare/GitHub Pages مع إبقاء failures الحقيقية Fail-Closed.
5. التأكد من public/private isolation.

### C — الدمج الحقيقي APP مع WORLD
1. استبدال الخريطة العامة في APP بمحرك WORLD و adapter الحقيقي.
2. fallback 2D لا يسقط البوابة إذا فشل 3D أو lazy import.
3. بطاقات الأخبار لا تعترض النقر والسحب على الخريطة؛ زر الإجراء فقط يستقبل pointer events.
4. دعم Desktop و Mobile.
5. لا iframe كحل نهائي إذا كان Adapter المباشر متاحًا.
- حالة 2026-09-24: البنود التشغيلية 1-4 مغلقة عبر production live iframe bridge وعقد postMessage محكم؛ البند 5 يبقى تحسينًا معماريًا مستقبليًا نحو direct Adapter، وليس شرطًا لإثبات عمل الدمج الحالي.

### D — الهوية والواجهة
1. توحيد الشعار بين APP و WORLD.
2. استخدام أصل الشعار الحقيقي وعدم اختلاق شعار بديل.
3. تكبير الخطوط العامة وإلغاء أحجام 7 إلى 10px في العناصر المهمة.
4. تحسين الإضاءة والـ contrast بدون neon مبالغ.
5. توحيد icon sizing و grid و alignment.
6. البوابة العامة معلوماتية فقط؛ لا أدوات تشغيل.
7. البوابة الخاصة للأدوات التشغيلية والتحقيق والتحكم.

### E — Relations / Entities
1. توحيد RelationsPage و RelationsWorkspacePage تدريجيًا بدل ازدواجية الشاشات.
2. Graph يعرض نوع الكيان والثقة وعدد الأدلة و first/last seen وحالة العلاقة والأرشفة.
3. high/medium/low confidence لها دلالة بصرية واضحة.
4. العلاقات المؤرشفة dashed.
5. لا يفهم القرب البصري كعلاقة مثبتة دون evidence.
6. ربط Graph بـ WORLD عبر geo/entity selection.

### F — Release Gate النهائي
1. Production config audit.
2. TypeScript.
3. Lint بدون أخطاء جديدة.
4. Unit tests.
5. Build.
6. Public bundle isolation.
7. npm audit بدون High أو Critical.
8. Playwright functional.
9. Visual baselines تحدث فقط للصفحات التي تغيرت عمدًا.
10. git diff --check.
11. PR و Copilot re-review.
12. CI و Deploy.
13. Production Health.
14. فحص حي Desktop و Mobile للموقعين.

## قواعد الجودة
- لا ادعاء تم بدون Git و CI و Production evidence.
- لا تنظيف أو حذف Worktree غير معروف.
- لا reset أو clean أو stash تلقائي على نسخة فيها تغييرات غير محفوظة.
- لا تخفيض عتبات health لإخفاء مشكلة بيانات حقيقية.
- لا تحديث visual baselines عميانيًا.
- لا إدخال secrets في Git أو التقارير.
- لا نقل أدوات التشغيل إلى البوابة العامة.
- لا تخمين وجود Grok أو Hermes provider أو API key.

## Checkpoints
- WORLD recovery: outputs/recovery/20260917-182538-executive/CHECKPOINT.md
- WORLD state: M3TM_WORLD_STATE.md
- APP continuation historical code: M3TM-APP-2026-09-21
- APP continuation file عندما يكون متاحًا: docs/M3TM_CONTINUATION_FLASHCARDS.md
- APP local evidence clone داخل WORLD: scratch/m3tm-app-live/docs/AI_HANDOFF.md؛ مرجع تاريخي وليس تلقائيًا أحدث worktree.
- Hermes integration handoff: outputs/HERMES_PROJECTS_INTEGRATION_2026_HANDOFF.txt
- Hermes read-only handshake: outputs/HERMES_PROJECTS_INTEGRATION_2026_TASK.txt + outputs/hermes-handshake-result.txt
- Hermes first-gate review: outputs/HERMES_WORLD_FIRST_GATE_20260922.txt + outputs/hermes-world-first-gate-result.txt

## روابط الإنتاج
- APP: https://m3tm.app
- WORLD: https://m3tm-world.vercel.app

## آخر تنفيذ مؤكد — 2026-09-24
- WORLD baseline bridge: PR #2، bridge commit 8d77f17، merge commit 23d7d1f7cdbbda86a041dae5534590450aad0bbe.
- WORLD hardening: PR #3، branch commit 237214e5928bb6e6fe08dbf952770fe779b70886، origin/main merge 952f450e008a569c07f39146690817a62b68b6ff.
- WORLD production embed المؤكد: https://m3tm-world.vercel.app/?embed=1&surface=public.
- عقد الرسائل الحي: m3tm:hello / m3tm:ready / m3tm:sync / m3tm:select مع version=1 والتحقق الصارم من event.origin وevent.source ومصدر الرسالة؛ لا wildcard في target origin.
- عزل البيانات: public Gate يزامن public news فقط؛ internal/private sync مغلق افتراضيًا ولا يرسل البيانات الداخلية إلى WORLD العام دون opt-in صريح.
- CSP الحي لـ WORLD: frame-ancestors 'self' https://m3tm.app، ولا يوجد X-Frame-Options blocker. APP وWORLD كلاهما يعيدان HTTP 200.
- Root cause الأصلي في APP كان أن M3tmWorldMap يستخدم IntelGlobe محليًا رغم تسمية WORLD؛ تم استبدال مسار 3D بruntime M3TM.WORLD الحقيقي مع إبقاء Gate1InteractiveMap كـ2D fallback.
- APP PR #278: fix(world): embed live M3TM.WORLD runtime in app. commits الأساسية: 353e527 للـembed، 4652acd لعزل البيانات/hardening، e032a38 لإعادة handshake عند reload. merge/main: 5edecbc058c8845815796111824a1206574bf0b1.
- APP #278: CI required checks PASS، وDeploy M3TM App run 36010727647 SUCCESS.
- Live QA بعد #278 أثبت desktop bridge، لكنه كشف mobile regression حقيقي: iframe عند 390px كان x≈382 وwidth=0 بسبب بقاء desktop grid-template-areas ثنائي الأعمدة داخل media query أحادي العمود.
- APP PR #280 أصلح الجوال: 3798d8b أضاف stretch، ثم d08070cf312a1dc4dee5f28b232a5a56a8279408 أصلح root cause بتعريف mobile grid-template-areas أحادي العمود WORLD-first.
- APP #280 merge/main: 54762d57ef7aac1ad78163630c991ab8a7b8da95. CI run 36015633556 SUCCESS. Deploy M3TM App run 36015633512 SUCCESS؛ pages-build 8m12s وdeploy 38s.
- Final live Desktop QA بعد آخر Pages deployment: viewport 1440x900، iframe x=22.625 / width=1093.78125 / height=610، scrollWidth=1440، mapMode=3D، hello=true، ready=true، syncCount=96، WORLD→APP selectionRoundTrip=changed، ثم simulated iframe error نقل APP إلى 2D وأزال iframe وضبط زر 2D pressed=true.
- Final live Mobile QA بعد آخر Pages deployment: viewport 390x844، iframe x=8 / width=374 / height=398، scrollWidth=390 بلا horizontal overflow، mapMode=3D، hello=true، ready=true، syncCount=96، selectionRoundTrip=changed، و2D fallback PASS. مشكلة width=0 مغلقة حيًا.
- ظهر cold-load timeout واحد بعد إعادة نشر التغذية، ثم إعادة الفحص الفوري نفسها PASS بالكامل على Desktop وMobile؛ لا regression ثابت.
- فصل QA أخطاء الشبكة قبل simulated fallback. الباقي غير حاجب: Cloudflare Insights beacon قد يفشل DNS في بيئة الاختبار، وبعض CCTV/MapLibre tile requests تُلغى؛ لم تمنع الخريطة أو العقد أو fallback.
- Post-deploy Production Health run 36017843534 كشف فشلًا تشغيليًا مستقلًا عن WORLD: successfulSources=39 أقل من hard floor=40؛ DNS/GitHub Pages كانت WARN فقط بسبب Cloudflare proxy.
- لم تُخفّض عتبات الصحة. شُغّل Publish News Feed يدويًا على main: run 36018898268 SUCCESS بما فيه news-build وdeploy. بعدها Production Health run 36019679353 SUCCESS على نفس SHA 54762d57؛ news-freshness أصبح mode=fresh وsuccessfulSources=47 و160/160 timestamps صالحة.
- النتيجة التشغيلية: APP↔WORLD production bridge مغلق ومثبت على Desktop وMobile وCI/Deploy/Health. الدين المعماري المتبقي هو direct in-process Adapter مستقبلًا؛ لا يجوز وصفه بأنه منجز حاليًا.

## الإغلاق النهائي لحزمة M3TM.WORLD + M3TM.APP — 2026-09-24

### WORLD — الحالة النهائية المثبتة
- origin/main النهائي قبل توثيق الإغلاق: `180c636b12f3132e1f11755d4fe35be952d85fb7`.
- تسلسل الإصدار الحالي: `eba9c53` (تعريب/جوال/سلامة السطح العام)، `f84e5e7` (مسار `?surface=public` الكامل)، `8d18bf8` (استعادة fallback الطيران المدني العام).
- PRs الخاصة بهذه الحزمة: #4 merge `04befc2530b6fb98f947c0744cde2cbd3091c4f5`، #5 merge `8baa3d274b4d336df16a62bd0a42d195ee39a123`، #6 merge `d4f0bbc93246d9e6fe65f72ea9eef375ab55c2ef`، #7 merge `180c636b12f3132e1f11755d4fe35be952d85fb7`.
- Vercel check على #6/#7: PASS / Deployment has completed.
- Local release gates على tree مطابق لـ origin/main: `git diff --check` PASS، `npx tsc --noEmit` PASS، style-token tests 30/30 PASS، Next production build PASS و56/56 صفحات ثابتة.
- Production Desktop 1440x900: MapLibre map rect = 1440x900، `scrollWidth=1440`، RTL، ArcGIS imagery + CARTO proxy + flights + satellites + events كلها ظهرت في network، ولا console errors.
- Production Mobile 390x844: map rect = 390x844، `scrollWidth=390` بلا horizontal overflow، RTL، bottom nav background الافتراضي `rgba(4,4,10,0.58)`، والتحكم غيّره حيًا إلى `0.78`.
- الطبقات العامة الافتراضية المثبتة: flights، sat_navigation، sat_earth، sat_science، live_news/news، earthquakes، global_incidents، conflict_zones، gdelt_events؛ military وsat_military خارج السطح العام.
- Production data proof: public commercial flights = 3,509 في فحص API النهائي، `military_flights=0`، `gps_jamming=0`. الأقمار العامة = 11,517 (comms 11,342 / navigation 115 / earth_obs 44 / science 16) ولا فئة military في public response. conflict zones = 15، وطبقة الأحداث العامة اتصلت فعليًا بالشبكة وظهرت أعداد حية في الواجهة.
- Public maritime filter مثبت: لا military ships ولا naval ports في الاستجابة العامة. إذا لم يتوفر AIS في لحظة الفحص قد يكون عدد السفن المدنية صفرًا، وهذا لا يعيد إدخال بيانات عسكرية.
- Arabic news proof الحي: `/api/news` = HTTP 200، `language=ar`، `source=M3TM.APP public feed`، 43 خبرًا في الفحص النهائي، والعينة الأولى عنوان عربي فعلي لا metadata زائفة.
- الواجهة العامة عربية RTL في Settings/Layers/Events/HUD/regions/mobile controls؛ popups والقيم enum الأساسية عُرّبت، مع إبقاء أسماء العلم التقنية مثل NASA/GDELT/Cloudflare كأسماء مصادر.
- التمثيل البصري للطائرات يستخدم silhouette أوضح مع outline/shadow لرفع التباين فوق satellite basemap.
- Public safety: precise military flight tracks وGPS jamming وmilitary/naval maritime وmilitary/unknown satellites غير معروضة في السطح العام، ولا تُرسل بيانات البوابة الداخلية إلى WORLD العام.

### APP — الحالة النهائية المثبتة
- origin/main النهائي: `937b71b9deee813eb775f724a77e34c6d5308153` — PR #284 `Open full M3TM.WORLD from mobile map navigation`.
- PR #284 MERGED. Required CI: Test & Lint PASS (run 36057428129)، build/database/quality PASS (run 36057428061)، capture PASS (run 36057428303)، Production Health PASS (run 36057428060).
- tree الفرع الذي اختُبر محليًا يطابق tree origin/main حرفيًا: `7345b098699f1e6d78db9ba31a6ee683e444510b`.
- Local APP gates: `git diff --check` PASS، typecheck PASS، targeted tests 28/28 PASS، targeted ESLint PASS، Vite production build PASS، Public bundle isolation audit PASS. تحذير jsdom `HTMLMediaElement.prototype.play` غير حاجب والاختبارات انتهت exit 0.
- Historical #280 evidence يبقى صحيحًا: merge `54762d57ef7aac1ad78163630c991ab8a7b8da95`، run 36015633556 SUCCESS، run 36015633512 SUCCESS، ثم Production Health run 36019679353 SUCCESS.
- Live bridge Desktop: iframe source `https://m3tm-world.vercel.app/?embed=1&surface=public`، box ≈ 1093.78x610، `mapMode=3D`، `ready=true`، `hello=true`، syncCount=89، وWORLD→APP `m3tm:select` غيّر الاختيار فعليًا.
- Live bridge Mobile 390x844: iframe box = 374x398، `scrollWidth=390`، `mapMode=3D`، hello/ready/sync/select PASS.
- Forced iframe error على Desktop وMobile: iframe أزيل، `mapMode=2D`، وزر 2D أصبح pressed=true؛ أي أن `Gate1InteractiveMap` fallback ما زال فعليًا ولم يُستبدل بـ IntelGlobe.
- عقد bridge محفوظ: target origin صريح بلا wildcard، فحص `event.origin` و`event.source`، `version===1`، ورسائل `m3tm:hello` / `m3tm:ready` / `m3tm:sync` / `m3tm:select`. مهلة ready ما زالت 35,000ms.
- زر «الخريطة» في شريط APP على 390x844 اختُبر بالنقر الحي: href = `https://m3tm-world.vercel.app/?surface=public`، وبعد الانتقال ظهرت WORLD كاملة map rect = 390x844 وRTL و`scrollWidth=390`.
- Header QA: APP وWORLD يعيدان HTTP 200. WORLD يرسل CSP يتضمن `frame-ancestors 'self' https://m3tm.app` ولا يرسل X-Frame-Options blocker. APP لا يرسل CSP أو X-Frame-Options حاليًا؛ هذا لم يمنع embed ولا يغيّر عقد المصدر الصارم.
- فشل Cloudflare Insights beacon بـDNS ظهر كاعتماد telemetry خارجي فقط. لا coreFailures بين `m3tm.app` و`m3tm-world.vercel.app` في فحص زر الجوال. طلبات MapLibre/CCTV ذات `ERR_ABORTED` مصنفة كإلغاءات طلبات أثناء إعادة التموضع/تغيير العرض، منفصلة عن أخطاء الشبكة الأساسية، ولا توجد bad HTTP responses في WORLD QA.

### Docker / adapters — التصنيف النهائي
- الجرد الفعلي الذي تم التحقق منه في هذه الحزمة: `m3tm-osint-agent-v2`، `m3tm-ghunt`، `m3tm-spiderfoot`، `m3tm-truecallerjs`، `m3tm-phoneinfoga`، `n8n`، إضافة إلى Supabase local containers.
- `m3tm-osint-agent-v2` أعاد health = ok، service = `m3tm-osint-engine`، version = 3.0.0، مع GHunt/SpiderFoot وأدوات عامة متاحة حسب health، لكن OpenAPI لا يعرّف security schemes وRoot/Plan/Run security = null.
- التصنيف: OSINT agent وGHunt وSpiderFoot وTruecallerJS وPhoneInfoga وn8n وSupabase المحلي = Internal/Private. لا يوجد authenticated production broker مثبت يجيز تعريضها في المتصفح العام.
- لا يوجد public browser adapter مكتمل لهذه الحاويات، ولا يجوز كشف localhost أو internal endpoints أو tokens/keys. الخدمات التشغيلية تبقى خلف البوابة الداخلية إلى أن يوجد broker موثّق ومصادق عليه.
- ربط APP↔WORLD الحالي لا يعتمد على Docker المحلي ولا يسرّب بياناته إلى public surface.

> Current APP↔WORLD integration is an operational live iframe bridge, not the final direct in-process adapter.

### قرار الإغلاق
- المتطلبات التشغيلية المطلوبة لهذه الحزمة مغلقة: WORLD الحقيقي في 3D، 2D fallback، strict postMessage contract، العربية وRTL، basemap مرئي، public live layers، mobile transparency، زر الجوال إلى WORLD، الأخبار العربية الحية، public military filtering، PR/CI/deploy، وLive QA للموقعين على Desktop و390x844.
- الدين المعماري المفتوح الوحيد في هذا النطاق هو direct in-process adapter المستقبلي وauthenticated broker لخدمات Docker الداخلية؛ كلاهما موثق كتحسين/تكامل لاحق وليس كادعاء منجز.

## تنفيذ سابق — 2026-09-22
- Hermes: متصل فعليًا بملف القيادة؛ Handshake نجح، وجولة bounded على WorldFeed/WorldMap لم تجد فسادًا مؤكدًا ولم تعدل الكود.
- WORLD TypeScript: PASS.
- WORLD Tests: 625 passed / 16 skipped.
- WORLD Production Build: PASS.
- WORLD diff-check مع `core.whitespace=cr-at-eol`: PASS.
- Full lint: OOM حتى مع 8 GB heap؛ ليس PASS.
- Targeted lint للملفات الأعلى خطورة: 309 findings (267 errors / 42 warnings). تمت مقارنة الملفات الأساسية مع HEAD وكانت الأعداد متطابقة تمامًا: page 100/19، OsintPanel 44/5، WorldMap مقابل OsirisMap 120/18، WorldFeed مقابل IntelFeed 3/0. لا lint regression مثبت في هذه الملفات.
- Local runtime من build الحالي: `/` = HTTP 200 و`/api/health` = HTTP 200 بحالة `operational`; الخادم المؤقت أوقف بعد التحقق.
- Docker: m3tm-osint-agent-v2 وGHunt وSpiderFoot وTruecallerJS وPhoneInfoga وn8n وSupabase local stack كانت تعمل وقت التحقق.
- Grok Bot: تطبيق مستقل يعمل، لكن ربطه بمشاريع M3TM لم يثبت بعد.
- Browser/Responsive Gate لـWORLD: PASS على 390x844 و430x932 و768x1024 و1440x900 و1920x1080 بلا horizontal overflow أو console errors، والخريطة ملأت الـviewport.
- Release commit: 2441e4ebf72ce86d12c20bf126d0b4a949aea54، PR #1 دُمج إلى main، وmerge commit: 433202f94b7f2f54eb4067d8b8ca69c9c52a4c97.
- Vercel للـpreview ولـmerge commit: SUCCESS/Ready. الإنتاج https://m3tm-world.vercel.app و/api/health أعادا HTTP 200 بحالة operational. تحقق الإنتاج Mobile PASS؛ Desktop أظهر الخريطة بعد cold-load أطول (25s) بلا console errors.
- دين تشغيلي غير حاجب: بعض MapLibre tile requests تلغى أثناء إعادة التموضع، بعض CCTV providers timeout/403، وNext.js لا يخزن استجابات flights/CCTV الأكبر من 2 MB في data cache.
- في ذلك التاريخ كان WORLD Gate A مغلقًا وكان Gate B هو التالي. هذه النقطة تاريخية وقد تجاوزها تنفيذ 2026-09-24 أعلاه؛ الحالة الحالية هي إغلاق production bridge وRelease Gate الخاص به.

## تعليمات الاستئناف
1. اقرأ هذا الملف.
2. اقرأ M3TM_WORLD_STATE.md إذا كان العمل على WORLD.
3. في APP اقرأ docs/M3TM_CONTINUATION_FLASHCARDS.md إن وجد.
4. تحقق من git status و branch و HEAD و remote و ahead/behind.
5. تحقق من CI و Production Health والنشر الحي.
6. ابدأ من أول Gate غير مكتمل فقط.
7. حدث هذا الملف قبل التوقف إذا تغيرت نقطة الاستئناف.

## Hermes Handoff
اقرأ أولًا:
1. docs/M3TM_PROJECTS_INTEGRATION_2026.md
2. M3TM_WORLD_STATE.md
ثم تحقق من Git و CI و Production.
لا تعتمد أي حالة تاريخية دون تحقق.
لا تغير provider أو model أو secrets أو billing.
نفذ فقط أول Gate غير مكتمل ثم اكتب handoff قصيرًا بالأدلة.

## مكان الإدارة
- M3TM.WORLD يدار حاليًا من /m3tm-world في Workspace Core.
- M3TM.APP يدار من TU4714315/m3tm-app؛ تحقق من أحدث worktree قبل الكتابة.
- GitHub هو مصدر الحقيقة للفروع و PR و CI.
- Vercel لنشر WORLD.
- GitHub Pages و m3tm.app لنشر APP.
- Docker المحلي للخدمات وأدوات OSINT والأتمتة.

آخر قاعدة: هذا الملف يصف الحقيقة التشغيلية فقط، وليس الوعود أو الصور التخيلية.



## ملحق الإغلاق بعد تحسينات الحرب/المسارات وWebKit — 2026-09-25

### M3TM.WORLD — PR #9
- PR #9 `feat: restore public conflict routes and safe military activity` دُمج إلى `main`؛ feature SHA: `ac2fbaf07128f183116d13ed9968ac4e7501464f`، merge SHA: `349cdb602ef796fd61033b1e1e6ec9154ee87c28`.
- Vercel status على merge SHA: `success` / `Deployment has completed`.
- السطح العام يشغّل افتراضيًا: مناطق الحروب والنزاعات، مناطق/خطوط الجبهة المنشورة، مسارات الأحداث الموثقة، GDELT Material Conflict، والنشاط الجوي العسكري العام المجمّع.
- `military_activity` عام وغير تشغيلي: خلايا تقريبية 6 درجات، حد أدنى مجموعتان، بلا identifiers وبلا exact tracks. يبقى `military_flights=[]` و`gps_jamming=[]` في العقد العام.
- Production QA جديد على 390x844 أثبت: map=390x844، RTL، `scrollWidth=390`، والطبقات `military_activity/conflict_zones/frontlines/reported_routes/gdelt_events/global_incidents` موجودة ومفعلة.
- Production data proof في آخر فحص: 2,805 رحلة تجارية، 27 خلية نشاط عسكري عام، 15 منطقة نزاع، 11 حدث نزاع حي، 125 feature جبهة منشورة، 124 حدث Material Conflict، 11,517 قمرًا عامًا، و46 خبرًا عربيًا فعليًا.
- لا توجد bad HTTP responses أو console errors في QA؛ الطلبات الملغاة من MapLibre/CCTV بقيت `ERR_ABORTED` غير حاجبة ومفصولة عن core failures.

### M3TM.APP — PR #285
- PR #285 `fix(world): restore public routes and glass mobile card` دُمج إلى `main`؛ head SHA: `27954ca35caf65dd7a9f99fb4a100229d1aea17e`، merge SHA: `69fce370997b4742b9475ae5281058ead6b5790c`.
- Required runs على head: CI `36086305092` SUCCESS، Build & Deploy to Production `36086305093` SUCCESS، Visual Preview `36086305094` SUCCESS، Production Health `36086305116` SUCCESS.
- بطاقة `موقع الخبر المنشور` أصبحت glass فعلية عبر `--g-map-card-alpha` بقيمة افتراضية `.28`، مع `backdrop-filter` ودعم `-webkit-backdrop-filter` وتحكم جوال مستقل لشفافية البطاقة.
- fallback 2D لا يخفي المسارات الموثقة الأخرى: يعرض المسار المختار بوضوح وما يصل إلى 48 مسارًا موثقًا سياقيًا بخفوت.
- Safari/WebKit hardening أضاف sync burst موثوقًا بعد `m3tm:ready` عند الإرسال الفوري ثم 180ms و700ms، من دون تغيير origin/source/version checks أو مهلة fallback ذات 35 ثانية.
- Live Chromium QA بعد الدمج: Desktop و390x844 كلاهما `mapMode=3D` و`hello/ready/sync/select` PASS؛ mobile iframe = 374x398 و`scrollWidth=390`. Forced iframe error أعاد 2D fallback وأزال iframe.
- Live WebKit/iPhone probe على 390x844 بعد الدمج: iframe source = `https://m3tm-world.vercel.app/?embed=1&surface=public`، parent استقبل `m3tm:ready`، child استقبل `m3tm:hello` وأربع رسائل `m3tm:sync` موثوقة (91 خبرًا وقت الفحص)، وبقي `mapMode=3D` مع `scrollWidth=390`.
- فشل سكربت WebKit الأقدم `No m3tm:sync observed inside WORLD` كان race داخل QA: كان يقرأ child messages فور التقاط `ready` قبل منح React/رسائل retry فرصة للوصول. الـprobe التفاعلي المؤخر أثبت وصول sync فعليًا؛ لا يُعامل ذلك الفشل القديم كفشل إنتاج.

### قرار الإغلاق المحدث
- شكوى الشفافية والمسارات وثراء طبقات الحرب أغلقت فعليًا عبر PR #285 وPR #9.
- السطح العام يعرض نشاطًا عسكريًا عامًا منشورًا/مجمّعًا فقط، ولا يعرض مسارات عسكرية تشغيلية دقيقة أو معرفات أو GPS jamming؛ أي تفصيل تشغيلي أدق يبقى خلف سياق داخلي/gated وليس ضمن public WORLD.
- آخر مصدر حقيقة للتنفيذ: WORLD `main=349cdb602ef796fd61033b1e1e6ec9154ee87c28` وAPP `main=69fce370997b4742b9475ae5281058ead6b5790c` قبل PR التوثيق هذا.
