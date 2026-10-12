# مجموعة أدوات تصميم M3TM V7 — تجهيز آمن

هذا الفرع **تجهيزي** للمشروعين؛ ليس نشرًا. يضيف مهارتي Emil Kowalski المراجعتين إلى `.cursor/skills/`، وسياسة محلية لـ Cursor. لا يضيف حزم JavaScript إلى التطبيق ولا يعدل الواجهات أو مسارات الأخبار أو الخريطة.

## ما هو موجود أصلًا
- APP: shadcn/Radix، Lucide، Framer Motion، React Globe، Three.js؛ إعادة استخدام بدل إعادة تثبيت.
- WORLD: MapLibre GL، Lucide، Framer Motion؛ اختبار `globe` من المحرك نفسه أولًا في PR مستقل.

## Impeccable
الأداة المتخصصة في فحص تصميم الواجهات إصدار **4.5.2**: https://github.com/pbakaus/impeccable
لم ننسخ ثنائيات غير موثقة. بعد التحقق من المصدر والمراجعة:
```powershell
# من جذر المشروع داخل نسخة staging فقط
npx --yes impeccable@4.5.2 install -y --providers=cursor --scope=project --no-hooks
npx --yes impeccable@4.5.2 detect src/
```
لم نفعّل الخطافات لأنها تستطيع تنفيذ برامج قبل/بعد تعديل الملفات؛ يمكن إضافتها بعد تدقيقها محليًا. لا تستخدم `--force` ولا `--scope=global` ولا تشغّل الأمر على جذر production.

## مهارات Emil
- `emil-design-eng`: قرارات الحركة/المكونات والصقل؛ يحمّل عند طلبه داخل Cursor.
- `animation-performance`: فحص إطار الرسم والأداء؛ مناسب للبوابات والخريطة.
- المصدر مثبت عند commit `2d228630ba1446365f614a108cb8252f1feda202` (11 أكتوبر 2026).
- التراخيص محفوظة في `docs/third-party/emil-skills-MIT.txt`.
- أضيف توضيح سياسة M3TM في أعلى الملفين؛ بقية المحتوى من المصدر الرسمي.

## سير مراجعة منخفض التكلفة
1. افحص ملفات APP/WORLD والموارد الحالية قبل كل تثبيت. لا تستدعِ مهارة كاملة ما لم تكن متعلقة بالمهمة.
2. نفّذ تدقيقًا موضعيًا: رأس الموقع، بطاقات الأخبار، خريطة WORLD، التسجيل، ثم RTL.
3. جرّب نموذجًا متجاوبًا ومخرجات Polypane/Playwright قبل أي PR مرشح للدمج.
4. لا تقبل اختبارات snapshot وحدها؛ أرفق دليل لقطات فعلية من 320 و390 و768 و1440 ومصادر بياناتها.
5. للنمط الكروي الحقيقي MapLibre: `map.setProjection({ type: 'globe' })` بعد اختبار دعم الطبقات والتفاعل وعودة `mercator`.

## غير المشمول هنا
Adobe Express وFigma وPolypane هي تطبيقات وخدمات مستقلة موصولة/مثبتة سابقًا؛ ليست تبعيات npm.
Motion Primitives وReact Bits مكتبات *اختيارية لمكون محدد*؛ لم تُضف تبعيات تكرارية، لأن Framer Motion موجود.
البرنامج المثبت محليًا في Windows يحتاج فتح Cursor على الفرع الجديد أو `git fetch` ثم تبديل الفرع؛ التغييرات هنا في GitHub staging.
