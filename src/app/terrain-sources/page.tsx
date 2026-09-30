import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'مصادر الخريطة والتضاريس | M3TM.WORLD',
  description: 'نَسَب مصادر الخرائط والارتفاعات المستخدمة، مع تمييز مجموعات البيانات الحديثة غير المدمجة.',
};

const contributors = [
  ['القطب الشمالي', 'ArcticDEM: DEMs created from DigitalGlobe, Inc. imagery; funded under NSF awards 1043681, 1559691 and 1542736.'],
  ['أستراليا', '© Commonwealth of Australia (Geoscience Australia) 2017.'],
  ['النمسا', '© offene Daten Österreichs – Digitales Geländemodell (DGM) Österreich.'],
  ['كندا', 'Contains information licensed under the Open Government Licence – Canada.'],
  ['أوروبا', 'Produced using Copernicus data and information funded by the European Union – EU-DEM layers.'],
  ['الارتفاعات البحرية في التجميع الأصلي', 'Global ETOPO1 terrain data: U.S. National Oceanic and Atmospheric Administration.'],
  ['المكسيك', 'Source: INEGI, Continental relief, 2016.'],
  ['نيوزيلندا', 'Copyright 2011 Crown copyright (c) Land Information New Zealand and the New Zealand Government. All rights reserved.'],
  ['النرويج', '© Kartverket.'],
  ['المملكة المتحدة', '© Environment Agency copyright and/or database right 2015. All rights reserved.'],
  ['الولايات المتحدة والمناطق العالمية', '3DEP, GMTED2010 and SRTM terrain data courtesy of the U.S. Geological Survey.'],
] as const;

const modernCandidates = [
  {
    name: 'NOAA ETOPO 2022 — ملفات الارتفاعات الرقمية',
    role: 'ترقية محتملة للارتفاعات ثلاثية الأبعاد والأعماق الرقمية، منفصلة عن طبقة التظليل الملون المتاحة الآن',
    restriction: 'يتوفر الآن تظليل ETOPO 2022 من خادم NOAA/ArcGIS كطبقة بصرية مستقلة، لكن ملفات GeoTIFF/NetCDF الرقمية غير مدمجة بمحرك ارتفاعات Mapzen الحالي؛ تحتاج تجهيز DEM ومراجعة المرجع الرأسي والأداء.',
    url: 'https://www.ncei.noaa.gov/products/etopo-global-relief-model',
  },
  {
    name: 'USGS 3DEP S1M (1 m)',
    role: 'تفاصيل ارتفاعات أمريكية محلية عالية الدقة حينما تتوفر التغطية',
    restriction: 'تغطية الولايات المتحدة تُنشر تدريجيًا منذ 2025. يتطلب إعادة تبليط إقليمية ومراجعة مرجع الارتفاع والكلفة والأداء. غير مستخدم حاليًا.',
    url: 'https://www.usgs.gov/3d-elevation-program/about-3dep-products-services',
  },
  {
    name: 'Copernicus DEM GLO-90 / GLO-30',
    role: 'نموذج عالمي أحدث يمكن اختباره بعد توفير مسار تنزيل وتحويل مرخص',
    restriction: 'منذ أغسطس 2026، خدمة عرض GLO-30 مقيدة بفئات وصول مؤهلة وتسجيل CCM؛ الطلبات الافتراضية تستعمل GLO-90. لا يُفعّل أي منهما دون التحقق من الأهلية والرخصة ومسار الخدمة.',
    url: 'https://dataspace.copernicus.eu/news/2026-8-25-copernicus-dem-30m-view-service-update',
  },
] as const;

export default function TerrainSourcesPage() {
  return (
    <main dir="rtl" className="min-h-screen bg-[#090c13] px-4 py-8 text-slate-100 sm:px-7">
      <div className="mx-auto max-w-4xl space-y-7">
        <header className="rounded-2xl border border-amber-300/20 bg-white/[0.04] p-5">
          <p className="text-xs tracking-wide text-amber-300">M3TM.WORLD · مصدر البيانات ونَسَبها</p>
          <h1 className="mt-2 text-2xl font-bold">التضاريس: المصدر المستخدم والبدائل الأحدث</h1>
          <p className="mt-3 text-sm leading-7 text-slate-300">
            هذا السجل يميز المصدر الذي تُحمّل منه الخريطة حاليًا عن مجموعات بيانات بديلة لا تُحمّل منها.
            أُضيفت طبقة عرض NOAA ETOPO 2022 الاختيارية، بينما لم يُستبدل نموذج الارتفاعات الثلاثي الأبعاد بالملفات الرقمية الأحدث.
          </p>
          <a href="/" className="mt-3 inline-block text-sm text-amber-300 underline underline-offset-4">العودة إلى الخريطة</a>
        </header>
        <section className="rounded-2xl border border-emerald-300/20 bg-white/[0.03] p-5">
          <h2 className="text-lg font-semibold text-emerald-300">المستخدم فعليًا: AWS / Mapzen–Tilezen Terrain Tiles</h2>
          <p className="mt-2 text-sm leading-7 text-slate-300">
            عند تفعيل التضاريس ثلاثية الأبعاد وتكبير الخريطة إلى مستوى 10 أو أكثر، تحمّل الخريطة
            بلاطات Terrarium بحجم 256 بكسل من حاوية AWS العامة elevation-tiles-prod،
            بمصدر MapLibre DEM واحد وطلبين متزامنين كحد أقصى.
            هذه بلاطات مركّبة من مصادر متعددة حسب المنطقة، وليست نموذج NASA أو Copernicus منفردًا
            ولا رصدًا لحظيًا لتغير سطح الأرض.
          </p>
          <p className="mt-2 text-xs text-slate-400">
            تحديثات تجميعات Joerd الأساسية موثقة في 2016 و2017؛ ولا يَعِد المستودع بتحديث شامل منتظم.
            آخر تحقق مباشر من وصول بلاطة Terrarium: 30 سبتمبر 2026. المحتوى المتغير لكل بلاطة يعتمد على المنطقة.
          </p>
          <nav className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-sm text-amber-300">
            <a href="https://registry.opendata.aws/terrain-tiles/" target="_blank" rel="noopener noreferrer" className="underline">AWS Open Data والسجل المرجعي</a>
            <a href="https://github.com/tilezen/joerd/blob/master/docs/attribution.md" target="_blank" rel="noopener noreferrer" className="underline">النص الأصلي للاعتمادات والشروط</a>
            <a href="https://github.com/tilezen/joerd/blob/master/docs/data-sources.md" target="_blank" rel="noopener noreferrer" className="underline">مجموعات البيانات الأصلية حسب المنطقة</a>
          </nav>
          <p className="mt-3 text-xs text-slate-400">
            مرجع الوصول: Terrain Tiles, accessed 2026-09-30 from the Registry of Open Data on AWS.
            راجع شروط كل مساهم عند إعادة التوزيع، ولا تفترض أن ترخيص شيفرة Joerd هو ترخيص البيانات كلها.
          </p>
        </section>
        <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
          <h2 className="text-lg font-semibold">اعتمادات مجموعات التضاريس الأصلية</h2>
          <p className="mt-2 text-sm text-slate-400">هذه اعتمادات مجموعات يمكن أن يضمها التجميع العام؛ لا تشترك كلها بالضرورة في كل بلاطة.</p>
          <dl className="mt-4 divide-y divide-white/10">
            {contributors.map(([region, credit]) => (
              <div key={region} className="py-3">
                <dt className="text-sm font-medium text-amber-200">{region}</dt>
                <dd dir="auto" className="mt-1 break-words text-xs leading-6 text-slate-300">{credit}</dd>
              </div>
            ))}
          </dl>
          <p className="mt-2 text-xs text-slate-400">
            بيانات ETOPO1 مكوّن من التجميع الحالي؛ وجود ETOPO 2022 لاحقًا لا يغيّر مصدر البلاطات الحالية.
          </p>
        </section>
        <section className="rounded-2xl border border-emerald-300/20 bg-white/[0.03] p-5">
          <h2 className="text-lg font-semibold text-emerald-300">طبقة أحدث متاحة الآن: NOAA ETOPO 2022 Relief</h2>
          <p className="mt-2 text-sm leading-7 text-slate-300">
            تظهر طبقة «NOAA ETOPO 2022 · تضاريس وأعماق» عند تشغيلها من لوحة الطبقات
            في عرض العالم منخفض/متوسط التكبير، مع اعتماد NOAA داخل الخريطة.
            خدمة ArcGIS العامة تعيد بلاطات JPEG فعلية بحجم 256 بكسل.
            هذا تظليل طبوغرافي ملون مرسوم مسبقًا، وليس بديلًا عن
            بيانات Mapzen الرقمية المستخدمة لرفع الجبال في وضع 3D؛ ولا يصلح للملاحة.
            تُوقف الطبقة تلقائيًا عند التكبير العالي وتعود خلفيتك المختارة (الأقمار الصناعية أو الوضع الداكن)، ثم يظهر تظليل NOAA مجددًا عند الابتعاد دون تغيير مفتاح الطبقة.
          </p>
          <a href="https://tiles.arcgis.com/tiles/C8EMgrsFcRFL6LrL/arcgis/rest/services/ETOPO_hillshade/MapServer"
             target="_blank" rel="noopener noreferrer"
             className="mt-2 inline-block text-xs text-amber-300 underline">خدمة البلاطات الرسمية وتوصيفها</a>
        </section>
        <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
          <h2 className="text-lg font-semibold">ترقيات ملفات الارتفاعات الرقمية — غير مُفعّلة بعد</h2>
          <div className="mt-3 space-y-3">
            {modernCandidates.map(candidate => (
              <article key={candidate.name} className="rounded-xl border border-white/10 p-3">
                <h3 className="text-sm font-semibold">{candidate.name}</h3>
                <p className="mt-1 text-sm text-slate-300">{candidate.role}</p>
                <p className="mt-2 text-xs leading-6 text-amber-200/85">{candidate.restriction}</p>
                <a href={candidate.url} target="_blank" rel="noopener noreferrer" className="mt-2 inline-block text-xs text-amber-300 underline">
                  الوثيقة الرسمية وشروط الوصول
                </a>
              </article>
            ))}
          </div>
          <p className="mt-4 text-xs leading-6 text-slate-400">
            أي ترقية لاحقة تتطلب التحقق من التغطية والإتاحة والرخصة، توحيد مرجع الارتفاع،
            تجهيز بلاطات متوافقة مع Terrarium أو Terrain RGB، اختبار الأداء على iPhone،
            مقارنة الارتفاعات ميدانيًا بمصدر مستقل، ثم نشرها فقط بعد نجاح فحوص الإنتاج.
          </p>
        </section>
      </div>
    </main>
  );
}
