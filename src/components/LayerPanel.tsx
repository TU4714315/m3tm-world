'use client';

import { memo, useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Plane, Satellite, Sun, AlertTriangle, Camera,
  CloudLightning, Ship, Network, Database, Ghost,
  Flame, Tv, Radio, Mountain, Anchor, Megaphone, SlidersHorizontal
} from 'lucide-react';
import StyleStudio from './StyleStudio';
import { publicMilitaryActivityOverview } from '@/lib/publicMilitaryActivityOverview';
import { TERRAIN_MIN_ZOOM, type TerrainStatus } from '@/lib/map-terrain';

interface LayerPanelProps {
  data: any;
  activeLayers: any;
  setActiveLayers: React.Dispatch<React.SetStateAction<any>>;
  isMobile?: boolean;
  theme?: 'core' | 'ghost';
  setTheme?: (theme: 'core' | 'ghost') => void;
  /** Server-side capabilities, e.g. { cloudflare: true }. A missing capability
   *  is presented as provider status only; it does not lock the public toggle. */
  capabilities?: Record<string, boolean>;
  /** Optional public-embed allowlist: only expose non-operational layers. */
  allowedLayerKeys?: readonly string[];
  terrainStatus?: TerrainStatus;
  onTerrainRetry?: () => void;
  onTerrainFocus?: () => void;
  on3DModeSelected?: () => void;
}

interface LayerDef {
  key: string;
  label: string;
  dataKey: string;
  description?: string;
  /** Reads a bucket out of data.category_counts instead of a top-level array. */
  catKey?: string;
  /** Provider capability used only for honest status messaging. */
  requires?: string;
  /** Key of the layer this one modifies. Renders indented beneath it, and reads
   *  as inert while that parent is off — it has nothing to act on. */
  parent?: string;
}

interface LayerGroupDef {
  label: string;
  fullLabel: string;
  icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>;
  layers: LayerDef[];
}

const LAYER_GROUPS: LayerGroupDef[] = [
  {
    label: 'عام',
    fullLabel: 'بيانات M3TM.WORLD العامة',
    icon: Network,
    layers: [
      { key: 'sdk_sea', label: 'الكابلات والسفن', dataKey: 'submarine_cables', description: 'كابلات ثابتة؛ السفن حسب توفر AIS' },
      { key: 'sdk_air', label: 'الرصد الجوي العام', dataKey: 'commercial_flights', description: 'مشاهدات طيران مدنية دورية' },
      { key: 'sdk_naval', label: 'رصد الأحداث', dataKey: 'gdelt', description: 'أحداث عامة محددة الموقع' },
    ],
  },
  {
    label: 'الطيران',
    fullLabel: 'الطيران',
    icon: Plane,
    layers: [
      { key: 'flights', label: 'التجارية', dataKey: 'commercial_flights' },
      { key: 'military_activity', label: 'نشاط جوي عسكري عام', dataKey: 'military_activity', description: 'رصد ADS-B عام مُجمّع؛ عدم الظهور لا يعني عدم وجود طائرة، ولا تُستنتج مواقع غير مرصودة' },
      { key: 'private', label: 'الخاصة', dataKey: 'private_flights' },
      { key: 'jets', label: 'الطائرات الخاصة', dataKey: 'private_jets' },
    ],
  },
  {
    label: 'البحرية',
    fullLabel: 'البحرية',
    icon: Ship,
    layers: [
      { key: 'maritime', label: 'الملاحة البحرية العامة', dataKey: 'maritime_ships,maritime_ports,maritime_chokepoints' },
      { key: 'naval_activity', label: 'نشاط بحري عسكري عام', dataKey: 'naval_activity', description: 'تجميع إقليمي من AIS عام عند توفره؛ لا أسماء سفن أو MMSI أو سرعة/اتجاه أو مسارات دقيقة' },
    ],
  },
  {
    label: 'الفضاء',
    fullLabel: 'تتبع الفضاء',
    icon: Satellite,
    layers: [
      { key: 'satellites', label: 'كل الأقمار الصناعية', dataKey: 'satellites' },
      { key: 'sat_comms', label: 'ستارلينك / اتصالات', dataKey: 'satellites', catKey: 'comms' },
      { key: 'sat_military', label: 'نشاط أقمار عسكرية/حكومية عام', dataKey: 'military_satellite_activity', description: 'تجميع إقليمي واسع من TLE عامة؛ لا أسماء ولا NORAD IDs ولا مسارات فردية دقيقة' },
      { key: 'sat_navigation', label: 'GPS / ملاحة', dataKey: 'satellites', catKey: 'navigation' },
      { key: 'sat_earth', label: 'رصد الأرض', dataKey: 'satellites', catKey: 'earth_obs' },
      { key: 'sat_science', label: 'محطات / تلسكوبات', dataKey: 'satellites', catKey: 'science' },
    ],
  },
  {
    label: 'المراقبة',
    fullLabel: 'المراقبة',
    icon: Camera,
    layers: [
      { key: 'cctv', label: 'كاميرات المراقبة', dataKey: 'cameras' },
      { key: 'cctv_previews', label: 'معاينات حية', dataKey: '', parent: 'cctv' },
      { key: 'live_news', label: 'بث مباشر وأخبار الخريطة المدمجة', dataKey: 'live_feeds', description: 'القنوات العامة والأخبار المتزامنة من M3TM.APP عند التضمين' },
      { key: 'app_news', label: 'أخبار M3TM.APP على الخريطة', dataKey: 'app_news', description: 'عناصر منشورة ذات إحداثيات متاحة، في خلايا إقليمية 0.5°؛ لا يُستنتج موقع حادثة من عنوان الخبر' },
    ],
  },
  {
    label: 'المخاطر',
    fullLabel: 'المخاطر الطبيعية',
    icon: CloudLightning,
    layers: [
      { key: 'earthquakes', label: 'الزلازل', dataKey: 'earthquakes' },
      { key: 'fires', label: 'حرائق نشطة', dataKey: 'fires' },
      { key: 'weather', label: 'طقس شديد', dataKey: 'weather_events' },
    ],
  },
  {
    label: 'التهديدات',
    fullLabel: 'الحروب والأحداث العامة',
    icon: AlertTriangle,
    layers: [
      { key: 'infrastructure', label: 'المنشآت النووية', dataKey: 'infrastructure' },
      { key: 'country_borders', label: 'الحدود الجغرافية المرجعية', dataKey: 'country_boundaries.features', description: 'Natural Earth 1:110m: خطوط عامة ثابتة، وخطوط متنازع عليها متقطعة؛ ليست مرجعًا سياديًا أو حدود نزاع لحظية' },
      { key: 'conflict_zones', label: 'مناطق الحروب والنزاعات', description: 'مناطق سياقية مع أحداث GDELT مبلّغ عنها؛ لا توجد نقاط اصطناعية', dataKey: 'conflict_zones,conflict_live_events' },
      { key: 'conflict_density', label: 'كثافة النزاع الحديثة', description: 'خريطة حرارية من بلاغات GDELT وACLED المجمعة مع وزن للحداثة وقوة التغطية', dataKey: 'conflict_live_events' },
      { key: 'frontlines', label: 'خطوط/مناطق جبهة منشورة', description: 'هندسة منشورة من مصدر عام؛ عرض سياقي غير تشغيلي', dataKey: 'frontlines.features' },
      { key: 'reported_routes', label: 'روابط أحداث منشورة', description: 'رابط جغرافي معمّم بين Actor1Geo وActionGeo في GDELT؛ ليس مسار حركة أو سلاح فعليًا', dataKey: 'reported_routes' },
      { key: 'alert_pins', label: 'تنبيهات ميدانية منشورة', description: 'رموز مميزة حسب النوع: ضربة، مسيّرة، صاروخ، دفاع جوي، قتال بري، حدث بحري أو معدات؛ كلها كما يذكرها الناشر وبإحداثيات منشورة معمّمة 0.5°', dataKey: 'alert_pins' },
      { key: 'global_incidents', label: 'بلاغات وأحداث عالمية', description: 'رمز مختلف للزلزال والفيضان والإعصار والبركان والحريق والجفاف عند توفر نوع الحدث من المصدر', dataKey: 'gdelt' },
      { key: 'gdelt_events', label: 'القصف والاشتباكات والأحداث المبلّغ عنها', description: 'تصنيف CAMEO مع رموز مستقلة للأسلحة الجوية والثقيلة والتفجيرات والاشتباكات والاعتداءات؛ مواقع عامة مُعمّمة وليست تتبعًا عملياتيًا', dataKey: 'gdelt_events' },
      { key: 'civil_unrest', label: 'احتجاجات واضطرابات مُبلّغ عنها', description: 'أحداث CAMEO 14 المنشورة والمحددة الموقع؛ لا تُعامل الاحتجاجات تلقائيًا كعنف', dataKey: 'civil_unrest' },
    ],
  },
  {
    label: 'الشبكة',
    fullLabel: 'بيانات الشبكة',
    icon: Network,
    layers: [
      { key: 'malware', label: 'برمجيات خبيثة حية', dataKey: 'malware_threats' },
      { key: 'cyber_attacks', label: 'تصور تقديري للتهديدات', description: 'روابط استدلالية مشتقة من مؤشرات Feodo، وليست هجمات مرصودة أو إسنادًا موثوقًا لمصدرها', dataKey: 'cyber_attacks' },
    ],
  },
  {
    label: 'شبكة وأحداث',
    fullLabel: 'الشبكة والأحداث',
    icon: Megaphone,
    layers: [
      { key: 'cf_outages', label: 'أحداث واضطرابات الشبكة', description: 'Cloudflare Radar عند تهيئته؛ وإلا أحداث سيبرانية منشورة من GDELT CAMEO 176. لا يُفترض أن كل بلاغ يمثل انقطاعًا شاملاً.', dataKey: 'cf_outages', requires: 'cloudflare' },
      { key: 'cf_attacks', label: 'مؤشرات تهديد شبكي مرصودة', description: 'Cloudflare Layer 3 عند تهيئته؛ وإلا تجميع بلدي لبنية C2 المرصودة من abuse.ch/Feodo. البلد هو موقع البنية المرصودة وليس إسنادًا لهوية المهاجم.', dataKey: 'cf_attack_origins', requires: 'cloudflare' },
    ],
  },
  {
    label: 'العرض',
    fullLabel: 'العرض',
    icon: Sun,
    layers: [
      { key: 'day_night', label: 'دورة الليل / النهار', dataKey: '' },
      { key: 'terrain_3d', label: 'مبانٍ ثلاثية الأبعاد', description: 'تفاصيل المدن · تكبير 14.5+', dataKey: '' },
      { key: 'terrain_elevation', label: 'تضاريس ثلاثية الأبعاد', description: 'جبال · تكبير 10+', dataKey: '' },
      { key: 'terrain_etopo_2022', label: 'NOAA ETOPO 2022 · تضاريس وأعماق', description: 'تظليل ملون من بيانات NOAA الأحدث للعرض العالمي؛ لا يغيّر ارتفاعات الخريطة ثلاثية الأبعاد ولا يصلح للملاحة', dataKey: '' },
    ],
  },
];

/* ── Minimal Toggle Switch ── */
/**
 * Presentational only. The row around it is the button, and a button inside a
 * button is invalid HTML — the browser reparents it, which breaks hydration and
 * silently drops the click handler on the inner control.
 */
function ToggleSwitch({ active }: { active: boolean }) {
  return (
    <span
      role="presentation"
      className="relative flex-shrink-0 block"
      style={{ width: 28, height: 14 }}
    >
      <div
        className="absolute inset-0 rounded-full transition-all duration-300"
        style={{
          background: active ? 'rgba(0,229,255,0.26)' : 'rgba(255,255,255,0.02)',
          border: active ? '1px solid rgba(0,229,255,0.75)' : '1px solid rgba(255,255,255,0.12)',
          boxShadow: active ? '0 0 10px rgba(0,229,255,0.28)' : 'none',
        }}
      />
      <motion.div
        className="absolute top-[2px] rounded-full"
        style={{
          width: 10,
          height: 10,
          background: active ? '#D9FCFF' : 'rgba(255,255,255,0.20)',
          boxShadow: active ? '0 0 7px rgba(0,229,255,0.65)' : 'none',
        }}
        animate={{ left: active ? 16 : 2 }}
        transition={{ type: 'spring', stiffness: 500, damping: 30 }}
      />
    </span>
  );
}

/**
 * The elbow that ties a sub-layer row to the layer above it. Indentation alone
 * reads as a typo at this size; the line is what says "this belongs to that".
 */
function SubLayerStem() {
  return (
    <span
      aria-hidden
      className="pointer-events-none absolute left-[6px] top-0 h-1/2 w-[8px] rounded-bl-[3px] border-b border-l border-white/[0.14]"
    />
  );
}

const CONFLICT_COUNT_LABELS: Record<string, string> = {
  aerial_attack: 'أسلحة جوية', heavy_weapons: 'أسلحة ثقيلة',
  bombing: 'تفجيرات', armed_clash: 'اشتباكات', mass_violence: 'عنف جماعي',
  assault: 'اعتداءات', other: 'أخرى',
};

function statusArabic(value: unknown): string {
  switch (String(value || '')) {
    case 'ok': case 'active': return 'نشط';
    case 'configured': return 'مهيأ';
    case 'connecting': return 'جارٍ الاتصال';
    case 'configured_no_data': return 'مهيأ · لا توجد بيانات حاليًا';
    case 'active_fallback': return 'نشط · مصدر عام بديل';
    case 'not_configured': return 'غير مهيأ';
    case 'unavailable': return 'غير متاح';
    case 'empty': return 'لا بيانات';
    case 'not_used': return 'غير مستخدم';
    case 'partial': return 'جزئي';
    default: return value ? String(value) : 'لم يُفحص';
  }
}

function ConflictEvidenceStatus({ data }: { data: any }) {
  const counts = data?.conflict_category_counts && typeof data.conflict_category_counts === 'object'
    ? data.conflict_category_counts as Record<string, number> : {};
  const entries = Object.entries(counts).filter(([, value]) => Number(value) > 0);
  const gdelt = data?.conflict_source_status?.gdelt?.status;
  const acled = data?.conflict_source_status?.acled?.status;
  const frontlines = data?.frontlines_meta?.status;
  const conflictState = String(data?.conflict_data_state || '');
  const fieldAlertLabels: Record<string, string> = {
    strike: 'ضربات/قصف', drone: 'مسيّرات', missile: 'صواريخ/قذائف',
    air_defence: 'دفاع جوي', ground: 'قتال بري', maritime: 'أحداث بحرية', equipment: 'معدات/أسلحة',
  };
  const fieldCounts = (Array.isArray(data?.alert_pins) ? data.alert_pins : [])
    .reduce((acc: Record<string, number>, item: any) => {
      const key = String(item?.category || '');
      if (key) acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {});
  const fieldEntries = Object.entries(fieldCounts).filter(([, value]) => Number(value) > 0);
  const unrestCount = Array.isArray(data?.civil_unrest) ? data.civil_unrest.length : 0;
  if (!entries.length && !fieldEntries.length && !unrestCount && !gdelt && !acled && !frontlines && !conflictState) return null;
  return (
    <div className="mt-2 rounded-lg border border-white/[0.08] bg-white/[0.025] p-2 text-[9px] font-mono text-white/50">
      {conflictState === 'cached-stale' && <div className="mb-1.5 rounded border border-amber-300/20 bg-amber-300/[0.04] px-1.5 py-1 text-amber-200/80">طبقة النزاع تعرض آخر لقطة مخزنة؛ المصدر الحي متعذر مؤقتًا.</div>}
      <div className="mb-1.5 flex flex-wrap gap-x-2 gap-y-1">
        {gdelt && <span>GDELT: <b className="text-white/70">{statusArabic(gdelt)}</b></span>}
        {acled && <span>ACLED: <b className="text-white/70">{statusArabic(acled)}</b></span>}
        {frontlines && <span>الجبهات: <b className="text-white/70">{statusArabic(frontlines)}</b></span>}
      </div>
      {entries.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {entries.map(([key, value]) => (
            <span key={key} className="rounded border border-white/[0.08] px-1.5 py-0.5">
              {CONFLICT_COUNT_LABELS[key] || key}: {Number(value).toLocaleString('ar-SA')}
            </span>
          ))}
        </div>
      )}
      {fieldEntries.length > 0 && (
        <div className="mt-1.5">
          <div className="mb-1 text-white/45">M3TM.APP · تنبيهات ميدانية منشورة</div>
          <div className="flex flex-wrap gap-1">
            {fieldEntries.map(([key, value]) => (
              <span key={key} className="rounded border border-cyan-300/10 bg-cyan-300/[0.025] px-1.5 py-0.5">
                {fieldAlertLabels[key] || key}: {Number(value).toLocaleString('ar-SA')}
              </span>
            ))}
          </div>
        </div>
      )}
      {unrestCount > 0 && <div className="mt-1.5 text-amber-200/70">احتجاجات/اضطرابات منشورة: {unrestCount.toLocaleString('ar-SA')}</div>}
      {data?.conflict_summary?.timestamp && <div className="mt-1 text-white/30">آخر تحديث طبقة النزاع: {String(data.conflict_summary.timestamp)}</div>}
      <div className="mt-1.5 text-white/30">التصنيف: بلاغات أحداث عامة حسب CAMEO ومصادر منشورة. طبقة M3TM.APP تستخدم إحداثيات الناشر بعد تعميمها 0.5°؛ لا تمثل تتبعًا لوحدة أو سلاح بعينه.</div>
    </div>
  );
}

function MilitaryActivityStatus({ data }: { data: any }) {
  const cells = Array.isArray(data?.military_activity) ? data.military_activity.length : 0;
  const meta = data?.military_activity_meta;
  const source = data?.flight_source_status;
  if (!meta && !source && !cells) return null;
  const adsbFiCount = source?.providers?.adsbfi_mil;
  const adsbFiHealthy = source?.providers?.adsbfi_mil_healthy;
  const adsbLolCount = source?.providers?.adsblol_mil;
  const adsbLolHealthy = source?.providers?.adsblol_mil_healthy;
  const taggedSource = meta?.tagged_feed_provider || source?.providers?.tagged_feed_provider;
  const backupState = meta?.backup_feed_state;
  const openSky = Number(source?.providers?.opensky || 0);
  const openSkyAge = source?.providers?.opensky_age_s;
  const stale = meta?.stale_fallback === true;
  const taggedUnhealthy = meta?.provider_healthy === false;
  const overview = publicMilitaryActivityOverview(data?.military_activity, stale);
  const reportedAt = typeof meta?.observed_at === 'string' && Number.isFinite(Date.parse(meta.observed_at))
    ? meta.observed_at.slice(0, 16).replace('T', ' ') + ' UTC'
    : null;
  const share = (count: number) => overview.total > 0 ? `${(count / overview.total) * 100}%` : '0%';
  return (
    <div className="mt-2 rounded-lg border border-white/[0.08] bg-white/[0.025] p-2 text-[9px] font-mono text-white/45">
      <div className="font-semibold text-white/70">مناطق النشاط الجوي العام: {cells.toLocaleString('ar-SA')} خلايا إقليمية</div>
      <div className="mt-1 text-white/45">توزيع الكثافة عبر مساحات واسعة (كل خلية نحو 6°)، وليس مسارات طائرات.</div>
      {overview.total > 0 && (
        <div className="mt-2" role="group" aria-label="توزيع مستويات نشاط الطيران العام في الخلايا الإقليمية">
          <div className="flex w-full h-2 overflow-hidden rounded bg-white/[0.06]">
            <div style={{ width: share(overview.low) }} className="bg-amber-300/70" />
            <div style={{ width: share(overview.medium) }} className="bg-orange-400/75" />
            <div style={{ width: share(overview.high) }} className="bg-red-400/70" />
          </div>
          <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1 text-white/60">
            <span>محدود: {overview.low.toLocaleString('ar-SA')}</span>
            <span>متوسط: {overview.medium.toLocaleString('ar-SA')}</span>
            <span>مرتفع: {overview.high.toLocaleString('ar-SA')}</span>
          </div>
          {!overview.stale && overview.compared >= 3 ? (
            <div className="mt-1.5 text-white/50">
              تغير كثافة المناطق القابلة للمقارنة فقط: ↑ {overview.increased.toLocaleString('ar-SA')} / ↓ {overview.decreased.toLocaleString('ar-SA')} / مستقر {overview.unchanged.toLocaleString('ar-SA')}
            </div>
          ) : (
            <div className="mt-1.5 text-white/40">
              {overview.stale ? 'تعذرت مقارنة الاتجاهات لأن اللقطة محفوظة أو قديمة.'
                : 'لا توجد عينات إقليمية مقارنة كافية لإثبات اتجاه التغير.'}
            </div>
          )}
        </div>
      )}
      {reportedAt && <div className="mt-1 text-white/45">وقت رصد الخلايا المُعلن: {reportedAt}</div>}
      <div className={stale || taggedUnhealthy ? 'mt-1 text-amber-300/75' : 'mt-1 text-white/35'}>
        البيانات: {stale ? 'آخر لقطة مخزنة · ليست رصدًا حيًا'
          : taggedUnhealthy ? 'المصدر الموسوم عسكريًا متعذر؛ التصنيف الإقليمي العام ليس تأكيدًا عسكريًا'
            : taggedSource === 'adsb.fi' ? 'مجمّع من مزوّد احتياطي مرخّص للاستخدام الحالي'
              : 'مجمّع من ADSB.lol العام، ليس دليلًا على عملية عسكرية'}
        {meta?.cache_backend ? ' · التخزين ' + String(meta.cache_backend) : ''}
      </div>
      {source && (
        <div className="mt-1 flex flex-wrap gap-x-2 gap-y-1 text-white/35">
          <span>المصدر: <b className="text-white/55">{String(source.provider || 'غير محدد')}</b></span>
          <span>ADSB.lol: <b className="text-white/55">{adsbLolHealthy === true ? Number(adsbLolCount).toLocaleString('ar-SA') : 'متعذر / لا رصد'}</b></span>
          <span>ADSB.fi الاحتياطي: <b className="text-white/55">{backupState === 'not_requested' ? 'لم يُستخدم' : adsbFiHealthy === true ? Number(adsbFiCount).toLocaleString('ar-SA') : 'متعذر / لا رصد'}</b></span>
          <span>OpenSky: <b className="text-white/55">{openSky.toLocaleString('ar-SA')}</b></span>
          {typeof openSkyAge === 'number' && Number.isFinite(openSkyAge) && <span>عمر لقطة OpenSky: <b className="text-white/55">{Math.round(openSkyAge / 60)} د</b></span>}
        </div>
      )}
      {source?.timestamp && <div className="mt-1 text-white/30">آخر تحديث: {String(source.timestamp)}</div>}
      <div className="mt-1 text-white/30">
        التصنيف عام وآلي وغير مؤكد عسكريًا؛ غياب الرصد لا يعني غياب طائرة، ولا تُعرض مسارات عسكرية دقيقة.
        {' '}المصدر: <a className="underline" href="https://www.adsb.lol/" target="_blank" rel="noopener noreferrer">ADSB.lol</a>
        {' '}· <a className="underline" href="https://opendatacommons.org/licenses/odbl/1-0/" target="_blank" rel="noopener noreferrer">ODbL 1.0</a>.
      </div>
    </div>
  );
}

function FeedSourceStatus({ data, kind }: { data: any; kind: 'maritime' | 'cloudflare' }) {
  const source = kind === 'maritime'
    ? data?.maritime_source_status?.ais
    : data?.cloudflare_source_status;
  if (!source) return null;
  const provider = String(source.provider || (kind === 'maritime' ? 'AISStream.io' : 'Cloudflare Radar'));
  const updated = source.latest_observed_at || source.timestamp || data?.maritime_timestamp || null;
  const age = Number(source.latest_observation_age_s);
  const navalCells = kind === 'maritime' && Array.isArray(data?.naval_activity) ? data.naval_activity.length : 0;
  return (
    <div className="mt-2 rounded-lg border border-white/[0.08] bg-white/[0.025] p-2 text-[9px] font-mono text-white/45">
      <div className="flex flex-wrap gap-x-2 gap-y-1">
        <span>المصدر: <b className="text-white/60">{provider}</b></span>
        <span>الحالة: <b className="text-white/60">{statusArabic(source.status)}</b></span>
        {Number.isFinite(age) && <span>عمر آخر رصد: <b className="text-white/60">{age < 60 ? `${Math.round(age)} ث` : `${Math.round(age / 60)} د`}</b></span>}
        {kind === 'maritime' && <span>خلايا نشاط بحري عسكري عام: <b className="text-white/60">{navalCells.toLocaleString('ar-SA')}</b></span>}
      </div>
      {updated && <div className="mt-1 text-white/30">آخر تحديث/رصد: {String(updated)}</div>}
      {kind === 'maritime' && <div className="mt-1 text-white/30">AIS حي فقط عند توفر الاعتماد واستمرار عملية الاستقبال؛ النشاط العسكري البحري يُعرض كتجميع إقليمي فقط، ولا توجد أسماء/MMSI/سرعة/اتجاه/مسارات دقيقة.</div>}
      {kind === 'cloudflare' && source.source_mode === 'public-fallback' && (
        <div className="mt-1 text-cyan-200/70">
          Cloudflare Radar غير مهيأ؛ البديل العام يعمل بحسب حالة كل مصدر:
          {' '}GDELT: {statusArabic(source.providers?.gdelt)} · abuse.ch: {statusArabic(source.providers?.abuse_ch)}.
          {' '}بلاغات GDELT أحداث منشورة، ومؤشرات Feodo تمثل بنية C2 مرصودة لا بلد المهاجم.
        </div>
      )}
      {kind === 'cloudflare' && source.source_mode === 'mixed' && (
        <div className="mt-1 text-cyan-200/70">
          Cloudflare Radar يعمل جزئيًا؛ يُستخدم البديل العام فقط للقسم المتعذر.
          {' '}Radar/الأحداث: {statusArabic(source.providers?.cloudflare_outages)} · Radar/التهديدات: {statusArabic(source.providers?.cloudflare_attacks)}
          {source.fallback_sections?.outages === true && <> · GDELT: {statusArabic(source.providers?.gdelt)}</>}
          {source.fallback_sections?.attacks === true && <> · abuse.ch: {statusArabic(source.providers?.abuse_ch)}</>}.
        </div>
      )}
      {kind === 'cloudflare' && source.configured === false && source.fallback_active !== true && (
        <div className="mt-1 text-amber-300/75">غير مهيأ في هذا النشر؛ الطبقة متاحة وغير مقفلة، وستعرض البيانات تلقائيًا عند توفر اعتماد Radar: Read على الخادم.</div>
      )}
    </div>
  );
}

function MilitarySatelliteActivityStatus({ data }: { data: any }) {
  const cells = Array.isArray(data?.military_satellite_activity) ? data.military_satellite_activity.length : 0;
  const summary = data?.military_satellite_summary;
  const meta = data?.military_satellite_meta;
  const source = data?.satellite_source_status;
  if (!summary && !meta && !source && !cells) return null;
  const catalog = Number(summary?.catalog_objects || source?.military_catalog_objects || 0);
  const represented = Number(summary?.represented_objects || 0);
  const withheld = Number(summary?.withheld_sparse_objects || 0);
  return (
    <div className="mt-2 rounded-lg border border-white/[0.08] bg-white/[0.025] p-2 text-[9px] font-mono text-white/45">
      <div className="flex flex-wrap gap-x-2 gap-y-1">
        <span>خلايا عسكرية/حكومية: <b className="text-white/60">{cells.toLocaleString('ar-SA')}</b></span>
        <span>أجسام مصنفة في الكتالوج: <b className="text-white/60">{catalog.toLocaleString('ar-SA')}</b></span>
        {represented > 0 && <span>ممثلة بالتجميع: <b className="text-white/60">{represented.toLocaleString('ar-SA')}</b></span>}
        {withheld > 0 && <span>متفرقة غير معروضة: <b className="text-white/60">{withheld.toLocaleString('ar-SA')}</b></span>}
      </div>
      {source?.provider && <div className="mt-1 text-white/35">المصدر: {String(source.provider)} · الحالة: {statusArabic(source.status)}</div>}
      {source?.timestamp && <div className="mt-1 text-white/30">آخر تحديث: {String(source.timestamp)}</div>}
      <div className="mt-1 text-white/30">التصنيف: نشاط أقمار عسكرية/حكومية عام. المواضع تقدير SGP4 من TLE عامة بعد تجميع 20° وبحد أدنى 3 أجسام؛ لا تُعرض أسماء أو معرفات NORAD أو مسارات فردية.</div>
    </div>
  );
}

function CameraCatalogStatus({ data }: { data: any }) {
  const status = data?.camera_catalog_status;
  const failed = data?.camera_catalog_error === true;
  if (!status && !failed) return null;
  const sources = Array.isArray(status?.sourceNames) ? status.sourceNames.length : 0;
  const pending = Array.isArray(status?.pendingRegions) ? status.pendingRegions.length : 0;
  const cameras = Array.isArray(data?.cameras) ? data.cameras.length : 0;
  return (
    <div className="mt-2 rounded-lg border border-white/[0.08] bg-white/[0.025] p-2 text-[9px] font-mono text-white/45">
      <p>{cameras.toLocaleString('ar-SA')} كاميرا مستلمة من {sources.toLocaleString('ar-SA')} جهات بيانات</p>
      {status?.lastResponseAt && <p className="mt-1 text-white/30">آخر استجابة للفهرس: {String(status.lastResponseAt)}</p>}
      <p className="mt-1 text-white/30">التصنيف: كاميرات طرق/مرور وبثوث عامة منشورة حسب المصدر.</p>
      {pending > 0 && <p className="mt-1 text-amber-300/80">{pending.toLocaleString('ar-SA')} مناطق لم تكتمل بياناتها؛ لا تُعد الكاميرات الغائبة متوقفة بالضرورة.</p>}
      {failed && <p className="mt-1 text-amber-300/80">فشل تحميل دفعة؛ ستُحاول الخدمة إعادة الجلب بحد أقصى.</p>}
      {!pending && !failed && <p className="mt-1 text-white/30">اكتملت الدفعة المطلوبة؛ لا تعني هذه الحالة أن جميع البثوث الفردية تعمل الآن.</p>}
    </div>
  );
}

function LayerPanel({ data, activeLayers, setActiveLayers, isMobile, theme = 'core', setTheme, capabilities = {}, allowedLayerKeys, terrainStatus = 'idle', onTerrainRetry, onTerrainFocus, on3DModeSelected }: LayerPanelProps) {
  const [hoveredGroup, setHoveredGroup] = useState<string | null>(null);
  /**
   * A pinned group stays open when the pointer leaves. Hover-only flyouts are
   * fine to glance at and impossible to work in — reaching for a toggle at the
   * far edge closes the thing you were reaching for.
   */
  const [pinnedGroup, setPinnedGroup] = useState<string | null>(null);
  const [studioOpen, setStudioOpen] = useState(false);

  useEffect(() => {
    if (!pinnedGroup) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setPinnedGroup(null); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [pinnedGroup]);

  const toggle = (key: string) => {
    if ((key === 'terrain_elevation' || key === 'terrain_3d') && !activeLayers[key]) on3DModeSelected?.();
    setActiveLayers((prev: any) => ({ ...prev, [key]: !prev[key] }));
  };
  const terrainDetails = activeLayers.terrain_elevation ? (
    <div className="mt-2 rounded-lg border border-white/10 bg-white/[0.03] p-2.5 text-[10px] text-white/60">
      <p role="status">{terrainStatus === 'idle' ? `التضاريس تبدأ عند تكبير ${TERRAIN_MIN_ZOOM}+ · قرّب الخريطة` : terrainStatus === 'waiting' ? 'تبدأ التضاريس بعد توقف حركة الخريطة' : terrainStatus === 'loading' ? 'جارٍ تحميل التضاريس القريبة…' : terrainStatus === 'error' ? 'تعذر تحميل التضاريس، والخريطة ما زالت قابلة للاستخدام.' : 'التضاريس مفعلة'}</p>
      {terrainStatus === 'idle' && <button type="button" onClick={onTerrainFocus} className="mt-2 min-h-8 rounded border border-white/15 px-2 text-[var(--gold-primary)] hover:bg-white/10">تقريب إلى التضاريس</button>}
      {terrainStatus === 'error' && <button type="button" onClick={onTerrainRetry} className="mt-2 min-h-8 rounded border border-white/15 px-2 text-[var(--gold-primary)] hover:bg-white/10">إعادة المحاولة</button>}
      <p className="mt-2 text-white/35">تفاصيل المناطق القريبة فقط · بلاطات مخزنة مؤقتًا</p>
      <p className="mt-1 text-white/35">المصدر الحالي: AWS Mapzen / Tilezen Terrarium، وليس DEM حديثًا تلقائي التحديث.</p>
      <a className="mt-1 inline-block underline underline-offset-2 text-[var(--gold-primary)]" href="/terrain-sources" target="_blank" rel="noopener noreferrer">اعتمادات المصادر والبدائل الأحدث</a>
    </div>
  ) : null;

  /** Switch a whole group at once. Provider availability never locks the toggle:
   *  an enabled layer with no configured provider remains an honest no-data state. */
  const toggleGroup = (layers: LayerDef[]) => {
    const anyOn = layers.some(l => activeLayers[l.key]);
    if (!anyOn && layers.some(l => l.key === 'terrain_elevation' || l.key === 'terrain_3d')) on3DModeSelected?.();
    setActiveLayers((prev: any) => {
      const next = { ...prev };
      for (const l of layers) next[l.key] = !anyOn;
      return next;
    });
  };

  /* Keep credential-gated layers visible and operable. Missing credentials are
     provider state ("غير مهيأ"), not a locked UI state. */
  const visibleGroups = LAYER_GROUPS.map(g => ({
    ...g,
    layers: g.layers.filter(l => !allowedLayerKeys || allowedLayerKeys.includes(l.key)),
  })).filter(g => g.layers.length > 0);

  const getCount = (dk: string, catKey?: string): number | null => {
    if (!dk) return null;
    if (catKey && data.category_counts) {
      return data.category_counts[catKey] || 0;
    }
    let total = 0;
    let found = false;
    for (const k of dk.split(',')) {
      const value = k.split('.').reduce((current: any, part) => current?.[part], data);
      if (Array.isArray(value)) {
        total += value.length;
        found = true;
      }
    }
    return found ? total : null;
  };

  const getLayerStatus = (layer: LayerDef, isActive: boolean, count: number | null): string => {
    if (!isActive) return 'متوقف';

    if (layer.requires) {
      const capability = capabilities[layer.requires];
      if (capability === false) return 'غير مهيأ';
      if (capability !== true) return 'يفحص';
    }

    if (['flights', 'private', 'jets', 'sdk_air'].includes(layer.key)) {
      if (!data?.flight_source_status) return 'جارٍ التحميل';
      if ((count ?? 0) === 0) return 'لا توجد بيانات';
    }

    if (layer.key === 'naval_activity') {
      const ais = data?.maritime_source_status?.ais;
      if (ais?.configured === false || ais?.status === 'not_configured') return 'غير مهيأ';
      if (ais && (count ?? 0) === 0) return 'لا توجد بيانات';
    }

    if (layer.key === 'cf_outages' || layer.key === 'cf_attacks') {
      const source = data?.cloudflare_source_status;
      const isOutageLayer = layer.key === 'cf_outages';
      const usesFallback = isOutageLayer
        ? source?.fallback_sections?.outages === true
        : source?.fallback_sections?.attacks === true;
      const fallbackState = isOutageLayer ? source?.providers?.gdelt : source?.providers?.abuse_ch;
      const cloudflareState = isOutageLayer ? source?.providers?.cloudflare_outages : source?.providers?.cloudflare_attacks;

      if (usesFallback) {
        if (fallbackState === 'unavailable') return 'غير متاح';
        if (fallbackState === 'empty') return 'لا توجد بيانات';
        return (count ?? 0) > 0 ? 'نشط · مصدر عام' : 'لا توجد بيانات';
      }
      if (cloudflareState === 'unavailable') return 'غير متاح';
      if (source?.configured === false || source?.status === 'not_configured') return 'غير مهيأ';
      if (source && (count ?? 0) === 0) return 'لا توجد بيانات';
    }

    return 'نشط';
  };

  /* ── MOBILE ── */
  if (isMobile) {
    return (
      <div className="flex flex-col gap-5 py-2">
        {visibleGroups.map((group) => (
          <div key={group.label} className="flex flex-col gap-2">
            <div className="text-[10px] font-mono tracking-[0.2em] uppercase text-white/30 border-b border-white/[0.06] pb-1.5">
              {group.fullLabel}
            </div>
            <div className="flex flex-col gap-1">
              {group.layers.map((layer) => {
                const isLayerActive = activeLayers[layer.key];
                const count = getCount(layer.dataKey, layer.catKey);
                const dormant = !!layer.parent && !activeLayers[layer.parent];
                const capabilityUnavailable = !!layer.requires && capabilities[layer.requires] !== true;
                return (
                  <button
                    key={layer.key}
                    onClick={() => toggle(layer.key)}
                    aria-pressed={!!isLayerActive}
                    aria-label={layer.label}
                    
                    className={`relative w-full flex items-center gap-3 py-2 rounded-md text-left hover:bg-white/[0.04] transition-colors ${layer.parent ? 'pl-[22px] pr-1' : 'px-1'} ${dormant ? 'opacity-40' : ''}`}
                  >
                    {layer.parent && <SubLayerStem />}
                    <ToggleSwitch active={!!isLayerActive} />
                    <span className={`text-[11px] font-mono uppercase tracking-wider flex-1 transition-colors ${isLayerActive ? 'text-white/80' : 'text-white/40'}`}>
                      {layer.label}
                      
                    </span>
                    
                    {count !== null && (
                      <span className="text-[10px] font-mono tabular-nums text-white/25">
                        {count.toLocaleString()}
                      </span>
                    )}
                  </button>
                );
              })}
              
              
              
              
              
              
              
            </div>
          </div>
        ))}

        {/* MOBILE STYLE STUDIO */}
        <div className="flex items-center justify-between mt-2 pt-3 border-t border-white/[0.06] px-1">
          <span className="text-[10px] font-mono tracking-[0.2em] text-white/25 uppercase">إعدادات المظهر</span>
          <button
            onClick={() => setStudioOpen(o => !o)}
            aria-pressed={studioOpen}
            className="w-8 h-8 rounded-full flex items-center justify-center transition-all"
            style={{
              background: studioOpen ? 'var(--hover-accent)' : 'transparent',
              boxShadow: studioOpen ? '0 0 12px var(--gold-glow)' : 'none',
            }}
          >
            <SlidersHorizontal className="w-4 h-4" style={{ color: studioOpen ? 'var(--gold-primary)' : 'rgba(255,255,255,0.25)' }} />
          </button>
        </div>
        <AnimatePresence>
          {studioOpen && <StyleStudio isMobile onClose={() => setStudioOpen(false)} />}
        </AnimatePresence>

        {/* MOBILE GHOST TOGGLE */}
        {setTheme && (
          <div className="flex items-center justify-between pt-3 border-t border-white/[0.06] px-1">
            <span className="text-[10px] font-mono tracking-[0.2em] text-white/25 uppercase">الوضع الخافت</span>
            <button
              onClick={() => setTheme(theme === 'core' ? 'ghost' : 'core')}
              className="w-8 h-8 rounded-full flex items-center justify-center transition-all"
              style={{
                background: theme === 'ghost' ? 'rgba(179, 136, 255, 0.15)' : 'transparent',
                boxShadow: theme === 'ghost' ? '0 0 12px rgba(179, 136, 255, 0.3)' : 'none',
              }}
            >
              <Ghost className="w-4 h-4" style={{ color: theme === 'ghost' ? '#B388FF' : 'rgba(255,255,255,0.25)' }} />
            </button>
          </div>
        )}
      </div>
    );
  }

  /* ── DESKTOP ── */
  return (
    <motion.div
      initial={{ x: -60, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      transition={{ type: 'spring', damping: 30, stiffness: 200, delay: 2.8 }}
      className="absolute top-0 left-0 h-full w-[48px] flex flex-col items-center pt-24 pb-6 z-50 pointer-events-auto"
      style={{
        background: 'rgba(0,0,0,0.15)',
        backdropFilter: 'blur(24px) saturate(1.2)',
        WebkitBackdropFilter: 'blur(24px) saturate(1.2)',
      }}
    >
      <div className="flex-1 flex flex-col items-center gap-1">
        {visibleGroups.map((group) => {
          /* Sub-layers modify a parent rather than draw anything of their own,
             so they do not count towards the rail's reading. */
          const counted = group.layers.filter(l => !l.parent);
          const groupActive = counted.some(l => activeLayers[l.key]);
          const isHovered = hoveredGroup === group.label;
          const Icon = group.icon;

          const activeCount = counted.filter(l => activeLayers[l.key]).length;
          const isPinned = pinnedGroup === group.label;
          const isOpen = isHovered || isPinned;

          return (
            <div
              key={group.label}
              className="relative flex items-center justify-center"
              onMouseEnter={() => setHoveredGroup(group.label)}
              onMouseLeave={() => setHoveredGroup(null)}
            >
              {/* A real button, not a div: this is keyboard reachable, focusable
                  and announced. Clicking pins the flyout open so it can be
                  worked in rather than only glanced at. */}
              <button
                onClick={() => setPinnedGroup(isPinned ? null : group.label)}
                aria-expanded={isOpen}
                aria-label={`${group.fullLabel}${activeCount ? ` — ${activeCount} مفعلة` : ''}`}
                title={group.fullLabel}
                className="relative w-10 h-10 flex items-center justify-center cursor-pointer rounded-lg transition-all duration-300 focus:outline-none focus-visible:ring-1 focus-visible:ring-white/40"
                style={{
                  background: isPinned
                    ? 'rgba(255,255,255,0.10)'
                    : isHovered ? 'rgba(255,255,255,0.05)' : 'transparent',
                }}
              >
                <Icon
                  className="transition-all duration-300"
                  style={{
                    width: 16,
                    height: 16,
                    color: groupActive
                      ? 'rgba(255,255,255,0.75)'
                      : isOpen
                        ? 'rgba(255,255,255,0.45)'
                        : 'rgba(255,255,255,0.22)',
                    filter: groupActive ? 'drop-shadow(0 0 4px rgba(255,255,255,0.3))' : 'none',
                  }}
                />

                {/* How many layers in this group are live. Without it the rail
                    gives no reading at all until each icon is hovered in turn. */}
                {activeCount > 0 && (
                  <span
                    className="absolute top-1 right-1 min-w-[13px] h-[13px] px-[3px] rounded-full flex items-center justify-center text-[9px] font-mono tabular-nums leading-none"
                    style={{
                      background: 'rgba(0,229,255,0.9)',
                      color: '#04040A',
                      boxShadow: '0 0 6px rgba(0,229,255,0.5)',
                    }}
                  >
                    {activeCount}
                  </span>
                )}
              </button>

              {/* Flyout (LEFT side) */}
              <AnimatePresence>
                {isOpen && (
                  <motion.div
                    initial={{ opacity: 0, x: -8, filter: 'blur(4px)' }}
                    animate={{ opacity: 1, x: 0, filter: 'blur(0px)' }}
                    exit={{ opacity: 0, x: -4, filter: 'blur(2px)' }}
                    transition={{ duration: 0.18, ease: 'easeOut' }}
                    className={`absolute left-[52px] top-1/2 -translate-y-1/2 rounded-xl p-3 z-[100] pointer-events-auto ${group.label === 'شبكة وأحداث' ? 'w-[340px] max-w-[calc(100vw-72px)]' : 'min-w-[220px]'}`}
                    style={{
                      background: 'rgba(0,0,0,0.6)',
                      backdropFilter: 'blur(40px) saturate(1.5)',
                      WebkitBackdropFilter: 'blur(40px) saturate(1.5)',
                      border: '1px solid rgba(255,255,255,0.06)',
                      boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
                    }}
                  >
                    <div className="flex items-center gap-2 mb-2.5 pb-1.5 border-b border-white/[0.04]">
                      <span className="text-[10px] font-mono tracking-[0.2em] uppercase text-white/35 flex-1">
                        {group.fullLabel}
                      </span>
                      {/* Switching eight satellite layers one at a time is the
                          kind of thing that makes a panel feel unfinished. */}
                      <button
                        onClick={(e) => { e.stopPropagation(); toggleGroup(group.layers); }}
                        className="px-1.5 py-0.5 rounded text-[10px] font-mono tracking-wider text-white/40 hover:text-white hover:bg-white/10 transition-colors"
                      >
                        {activeCount > 0 ? 'لا شيء' : 'الكل'}
                      </button>
                      {isPinned && (
                        <button
                          onClick={(e) => { e.stopPropagation(); setPinnedGroup(null); }}
                          aria-label="إغلاق"
                          className="px-1.5 py-0.5 rounded text-[10px] font-mono text-white/40 hover:text-white hover:bg-white/10 transition-colors"
                        >
                          ✕
                        </button>
                      )}
                    </div>
                    <div className="flex flex-col gap-0.5">
                      {group.layers.map((layer) => {
                        const isLayerActive = activeLayers[layer.key];
                        const count = getCount(layer.dataKey, layer.catKey);
                        const dormant = !!layer.parent && !activeLayers[layer.parent];
                        const capabilityUnavailable = !!layer.requires && capabilities[layer.requires] !== true;

                        return (
                          <button
                            key={layer.key}
                            onClick={() => toggle(layer.key)}
                            aria-pressed={!!isLayerActive}
                            aria-label={layer.label}
                            
                            className={`relative w-full rounded-md hover:bg-white/[0.05] transition-colors text-left focus:outline-none focus-visible:ring-1 focus-visible:ring-white/30 ${group.label === 'شبكة وأحداث' ? 'flex flex-col items-stretch gap-1.5 p-2' : 'flex items-center gap-3 py-1.5'} ${layer.parent ? 'pl-[22px] pr-1' : 'px-1'} ${dormant ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'}`}
                          >
                            {group.label === 'شبكة وأحداث' ? (
                              <>
                                <span className="flex w-full min-w-0 items-center gap-2" dir="rtl">
                                  <ToggleSwitch active={!!isLayerActive} />
                                  <span className={`min-w-0 flex-1 text-right text-[11px] font-medium leading-5 ${isLayerActive ? 'text-white/85' : 'text-white/45'}`}>
                                    {layer.label}
                                  </span>
                                </span>
                                <span className="flex w-full items-center gap-2" dir="rtl">
                                  
                                  {count !== null && <span className="text-[10px] tabular-nums text-white/55">{count.toLocaleString()}</span>}
                                </span>
                                
                              </>
                            ) : (
                              <>
                                {layer.parent && <SubLayerStem />}
                                <ToggleSwitch active={!!isLayerActive} />
                                <span className={`text-[11px] font-mono uppercase tracking-wider flex-1 transition-colors duration-200 ${isLayerActive ? 'text-white/70' : 'text-white/35'}`}>
                                  {layer.label}
                                  
                                </span>
                                
                                {count !== null && (
                                  <span className={`text-[10px] font-mono tabular-nums transition-colors ${isLayerActive ? 'text-white/45' : 'text-white/20'}`}>
                                    {count.toLocaleString()}
                                  </span>
                                )}
                              </>
                            )}
                          </button>
                        );
                      })}
                      
              
              
              
              
              
              
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          );
        })}
      </div>

      {/* Subtle separator */}
      <div className="w-5 h-px bg-white/[0.06] my-2" />

      {/* إعدادات المظهر */}
      <button
        onClick={() => setStudioOpen(o => !o)}
        aria-pressed={studioOpen}
        className="w-10 h-10 flex items-center justify-center rounded-lg transition-all duration-500 cursor-pointer"
        style={{ background: studioOpen ? 'var(--hover-accent)' : 'transparent' }}
        title="إعدادات المظهر"
      >
        <SlidersHorizontal
          className="transition-all duration-500"
          style={{
            width: 15,
            height: 15,
            color: studioOpen ? 'var(--gold-primary)' : 'rgba(255,255,255,0.15)',
            filter: studioOpen ? 'drop-shadow(0 0 6px var(--gold-glow))' : 'none',
          }}
        />
      </button>
      <AnimatePresence>
        {studioOpen && <StyleStudio onClose={() => setStudioOpen(false)} />}
      </AnimatePresence>

      {/* الوضع الخافت Toggle */}
      {setTheme && (
        <button
          onClick={() => setTheme(theme === 'core' ? 'ghost' : 'core')}
          className="w-10 h-10 flex items-center justify-center rounded-lg transition-all duration-500 cursor-pointer"
          style={{
            background: theme === 'ghost' ? 'rgba(179, 136, 255, 0.1)' : 'transparent',
          }}
          title="الوضع الخافت"
        >
          <Ghost
            className="transition-all duration-500"
            style={{
              width: 15,
              height: 15,
              color: theme === 'ghost' ? '#B388FF' : 'rgba(255,255,255,0.15)',
              filter: theme === 'ghost' ? 'drop-shadow(0 0 6px rgba(179, 136, 255, 0.5))' : 'none',
            }}
          />
        </button>
      )}
    </motion.div>
  );
}

export default memo(LayerPanel);
