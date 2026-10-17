'use client';

import { memo, useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Plane, Satellite, Sun, AlertTriangle, Camera,
  CloudLightning, Ship, Network, Database, Ghost,
  Flame, Tv, Radio, Mountain, Anchor, Megaphone, SlidersHorizontal, LockKeyhole, Shield, Route, Layers3
} from 'lucide-react';
import StyleStudio from './StyleStudio';
import { TERRAIN_MIN_ZOOM, type TerrainStatus } from '@/lib/map-terrain';
import { layerRequiresInvitation } from '@/lib/mapAccessPolicy';
import { selectDataLayers } from '@/lib/layerBulkSelection';

interface LayerPanelProps {
  data: any;
  activeLayers: any;
  setActiveLayers: React.Dispatch<React.SetStateAction<any>>;
  isMobile?: boolean;
  theme?: 'core' | 'ghost';
  setTheme?: (theme: 'core' | 'ghost') => void;
  /** Optional public-embed allowlist: only expose non-operational layers. */
  allowedLayerKeys?: readonly string[];
  terrainStatus?: TerrainStatus;
  onTerrainRetry?: () => void;
  onTerrainFocus?: () => void;
  on3DModeSelected?: () => void;
  hasMapAccess?: boolean;
  onRequestAccess?: () => void;
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

const LAYER_CATALOG: LayerGroupDef[] = [
  {
    label: 'عام',
    fullLabel: 'بيانات M3TM.WORLD العامة',
    icon: Network,
    layers: [
      { key: 'sdk_sea', label: 'الكابلات والسفن', dataKey: 'submarine_cables', description: 'الكابلات والملاحة البحرية' },
      { key: 'sdk_naval', label: 'رصد الأحداث', dataKey: 'gdelt', description: 'أحداث عامة محددة الموقع' },
    ],
  },
  {
    label: 'الطيران',
    fullLabel: 'الطيران',
    icon: Plane,
    layers: [
      { key: 'sdk_air', label: 'الطيران المدني الإضافي', dataKey: 'commercial_flights', description: 'مشاهدات طيران مدنية دورية؛ يفعّل العرض الجوي فقط' },
      { key: 'flights', label: 'التجارية', dataKey: 'commercial_flights' },
      { key: 'military_activity', label: 'نشاط جوي عسكري عام', dataKey: 'military_activity', description: 'نشاط إقليمي مجمّع؛ لا يحدد مواقع طائرات منفردة' },
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
      { key: 'naval_activity', label: 'نشاط بحري عسكري عام', dataKey: 'naval_activity', description: 'نشاط إقليمي مجمّع؛ لا يحدد مسارات سفن منفردة' },
    ],
  },
  {
    label: 'الفضاء',
    fullLabel: 'تتبع الفضاء',
    icon: Satellite,
    layers: [
      { key: 'satellites', label: 'كل الأقمار الصناعية', dataKey: 'satellites' },
      { key: 'sat_comms', label: 'أقمار الاتصالات', dataKey: 'satellites', catKey: 'comms' },
      { key: 'sat_military', label: 'نشاط أقمار عسكرية/حكومية عام', dataKey: 'military_satellite_activity', description: 'نشاط إقليمي مجمّع؛ لا يحدد مسارات أقمار منفردة' },
      { key: 'sat_navigation', label: 'أقمار الملاحة', dataKey: 'satellites', catKey: 'navigation' },
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
      { key: 'app_news', label: 'أخبار الخريطة', dataKey: 'app_news', description: 'عناصر منشورة ذات إحداثيات متاحة، في خلايا إقليمية 0.5°؛ لا يُستنتج موقع حادثة من عنوان الخبر' },
    ],
  },
  {
    label: 'المخاطر',
    fullLabel: 'المخاطر الطبيعية',
    icon: CloudLightning,
    layers: [
      { key: 'fires', label: 'حرائق نشطة', dataKey: 'fires' },
      { key: 'wind', label: 'الرياح', dataKey: '' },
      { key: 'wind_controls', label: 'وقت الرياح', dataKey: '', parent: 'wind' },
      { key: 'rain', label: 'الأمطار', dataKey: '' },
      { key: 'rain_controls', label: 'وقت الأمطار', dataKey: '', parent: 'rain' },
      { key: 'weather', label: 'طقس شديد', dataKey: 'weather_events' },
    ],
  },
  {
    label: 'التهديدات',
    fullLabel: 'الحروب والأحداث العامة',
    icon: AlertTriangle,
    layers: [
      { key: 'infrastructure', label: 'المنشآت النووية', dataKey: 'infrastructure' },
      { key: 'country_borders', label: 'الحدود', dataKey: 'country_boundaries.features', description: 'حدود عامة؛ المتنازع عليها متقطعة' },
      { key: 'conflict_zones', label: 'مناطق الحروب والنزاعات', description: 'مناطق النزاع والأحداث المنشورة', dataKey: 'conflict_zones,conflict_live_events' },
      { key: 'conflict_density', label: 'كثافة النزاع الحديثة', description: 'كثافة التقارير الحديثة', dataKey: 'conflict_live_events' },
      { key: 'frontlines', label: 'خطوط/مناطق جبهة منشورة', description: 'هندسة منشورة من مصدر عام؛ عرض سياقي غير تشغيلي', dataKey: 'frontlines.features' },
      { key: 'reference_atlas', label: 'مناطق النفوذ والمعالم', description: 'مناطق النفوذ المنشورة والمعالم المصنفة', dataKey: 'reference_atlas.features.features' },
      { key: 'reported_routes', label: 'روابط أحداث منشورة', description: 'روابط بين الأحداث؛ ليست مسارات حركة فعلية', dataKey: 'reported_routes' },
      { key: 'alert_pins', label: 'تنبيهات ميدانية منشورة', description: 'رموز مميزة حسب النوع: ضربة، مسيّرة، صاروخ، دفاع جوي، قتال بري، حدث بحري أو معدات؛ كلها كما يذكرها الناشر وبإحداثيات منشورة معمّمة 0.5°', dataKey: 'alert_pins' },
      { key: 'global_incidents', label: 'بلاغات وأحداث عالمية', description: 'رمز مختلف للزلزال والفيضان والإعصار والبركان والحريق والجفاف عند توفر نوع الحدث من المصدر', dataKey: 'gdelt' },
      { key: 'gdelt_events', label: 'القصف والاشتباكات والأحداث المبلّغ عنها', description: 'أحداث مصنفة ومواقع إقليمية عامة', dataKey: 'gdelt_events' },
      { key: 'civil_unrest', label: 'احتجاجات واضطرابات مُبلّغ عنها', description: 'احتجاجات واضطرابات منشورة', dataKey: 'civil_unrest' },
    ],
  },
  {
    label: 'الشبكة',
    fullLabel: 'بيانات الشبكة',
    icon: Network,
    layers: [
      { key: 'malware', label: 'برمجيات خبيثة حية', dataKey: 'malware_threats' },
      { key: 'cyber_attacks', label: 'رصد بنية التهديدات الشبكية', description: 'مؤشرات تهديد مجمّعة؛ لا تحدد هوية المهاجم', dataKey: 'cf_attack_origins' },
    ],
  },
  {
    label: 'شبكة وأحداث',
    fullLabel: 'الشبكة والأحداث',
    icon: Megaphone,
    layers: [
      { key: 'cf_outages', label: 'أحداث واضطرابات الشبكة', description: 'اضطرابات شبكة منشورة؛ لا تثبت انقطاعًا شاملاً', dataKey: 'cf_outages', requires: 'cloudflare' },
      { key: 'cf_attacks', label: 'مؤشرات تهديد شبكي مرصودة', description: 'بنية تهديد مرصودة؛ لا تحدد هوية المهاجم', dataKey: 'cf_attack_origins', requires: 'cloudflare' },
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
      { key: 'terrain_etopo_2022', label: 'تضاريس وأعماق', description: 'تظليل التضاريس والأعماق؛ غير مخصص للملاحة', dataKey: '' },
    ],
  },
];

// Group the existing capabilities without changing their keys, data, or access policy.
const definitions = LAYER_CATALOG.flatMap(group => group.layers);
const selectLayers = (...keys: string[]) => keys.map(key => {
  const layer = definitions.find(item => item.key === key);
  if (!layer) throw new Error(`Unknown map layer: ${key}`);
  return layer;
});
const militaryKeys = ['military_activity', 'naval_activity', 'sat_military'];
const frontKeys = ['country_borders', 'conflict_zones', 'conflict_density', 'frontlines', 'reference_atlas', 'reported_routes'];
const airKeys = ['sdk_air', 'flights', 'private', 'jets'];
const seaSpaceKeys = ['sdk_sea', 'maritime', 'satellites', 'sat_comms', 'sat_navigation', 'sat_earth', 'sat_science'];
const displayKeys = LAYER_CATALOG.find(group => group.label === 'العرض')!.layers.map(layer => layer.key);
const assigned = new Set([...militaryKeys, ...frontKeys, ...airKeys, ...seaSpaceKeys, ...displayKeys]);
const LAYER_GROUPS: LayerGroupDef[] = [
  { label: 'العسكري', fullLabel: 'العسكري', icon: Shield, layers: selectLayers(...militaryKeys) },
  { label: 'خطوط وجبهات', fullLabel: 'خطوط وجبهات', icon: Route, layers: selectLayers(...frontKeys) },
  { label: 'الطيران', fullLabel: 'الطيران', icon: Plane, layers: selectLayers(...airKeys) },
  { label: 'البحر والفضاء', fullLabel: 'البحر والفضاء', icon: Satellite, layers: selectLayers(...seaSpaceKeys) },
  { label: 'الأحداث', fullLabel: 'الأحداث', icon: Megaphone, layers: definitions.filter(layer => !assigned.has(layer.key)) },
  { label: 'العرض', fullLabel: 'العرض', icon: Sun, layers: selectLayers(...displayKeys) },
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

function LayerPanel({ data, activeLayers, setActiveLayers, isMobile, theme = 'core', setTheme, allowedLayerKeys, terrainStatus = 'idle', onTerrainRetry, onTerrainFocus, on3DModeSelected, hasMapAccess = false, onRequestAccess }: LayerPanelProps) {
  const [hoveredGroup, setHoveredGroup] = useState<string | null>(null);
  /**
   * A pinned group stays open when the pointer leaves. Hover-only flyouts are
   * fine to glance at and impossible to work in — reaching for a toggle at the
   * far edge closes the thing you were reaching for.
   */
  const [pinnedGroup, setPinnedGroup] = useState<string | null>(null);
  const [studioOpen, setStudioOpen] = useState(false);
  const [mobileGroup, setMobileGroup] = useState('الكل');
  const [mobileSearch, setMobileSearch] = useState('');

  useEffect(() => {
    if (!pinnedGroup) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setPinnedGroup(null); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [pinnedGroup]);

  const toggle = (key: string) => {
    if (!hasMapAccess && layerRequiresInvitation(key)) { onRequestAccess?.(); return; }
    // Sub-layers cannot become active independently of their parent, even
    // during rapid clicks while React is applying queued state updates.
    const definitions = LAYER_GROUPS.flatMap(group => group.layers);
    const layer = definitions.find(item => item.key === key);
    if (layer?.parent && !activeLayers[layer.parent]) return;
    if ((key === 'terrain_elevation' || key === 'terrain_3d') && !activeLayers[key]) on3DModeSelected?.();
    setActiveLayers((prev: any) => {
      if (layer?.parent && !prev[layer.parent]) return prev;
      const next = { ...prev, [key]: !prev[key] };
      // Turning off a parent also turns off its dependent display switches.
      if (!next[key]) {
        for (const child of definitions) {
          if (child.parent === key) next[child.key] = false;
        }
      }
      return next;
    });
  };
  const terrainDetails = activeLayers.terrain_elevation ? (
    <div className="mt-2 rounded-lg border border-white/10 bg-white/[0.03] p-2.5 text-[10px] text-white/60">
      <p role="status">{terrainStatus === 'idle' ? `التضاريس تبدأ عند تكبير ${TERRAIN_MIN_ZOOM}+ · قرّب الخريطة` : terrainStatus === 'waiting' ? 'تبدأ التضاريس بعد توقف حركة الخريطة' : terrainStatus === 'loading' ? 'جارٍ تحميل التضاريس القريبة…' : terrainStatus === 'error' ? 'تعذر تحميل التضاريس، والخريطة ما زالت قابلة للاستخدام.' : 'التضاريس مفعلة'}</p>
      {terrainStatus === 'idle' && <button type="button" onClick={onTerrainFocus} className="mt-2 min-h-8 rounded border border-white/15 px-2 text-[var(--gold-primary)] hover:bg-white/10">تقريب إلى التضاريس</button>}
      {terrainStatus === 'error' && <button type="button" onClick={onTerrainRetry} className="mt-2 min-h-8 rounded border border-white/15 px-2 text-[var(--gold-primary)] hover:bg-white/10">إعادة المحاولة</button>}
    </div>
  ) : null;

  const selectGroup = (layers: LayerDef[], enabled: boolean) => {
    const canSelect = (key: string) => hasMapAccess || !layerRequiresInvitation(key);
    if (!layers.some(layer => !layer.parent && !displayKeys.includes(layer.key) && canSelect(layer.key))) {
      onRequestAccess?.(); return;
    }
    setActiveLayers((prev: Record<string, unknown>) => selectDataLayers(prev, layers, enabled, displayKeys, canSelect));
  };

  /* Keep credential-gated layers visible and operable. Missing credentials are
     provider state ("غير مهيأ"), not a locked UI state. */
  const availableGroups = LAYER_GROUPS.map(g => ({
    ...g,
    layers: g.layers.filter(l => !allowedLayerKeys || allowedLayerKeys.includes(l.key)),
  })).filter(g => g.layers.length > 0);
  const normalizedSearch = mobileSearch.trim().toLocaleLowerCase('ar');
  const desktopGroups = [...availableGroups, { label: 'الكل', fullLabel: 'الكل', icon: Layers3, layers: availableGroups.flatMap(group => group.layers) }];
  const visibleGroups = !isMobile ? desktopGroups : availableGroups
    .filter(group => mobileGroup === 'الكل' || group.label === mobileGroup)
    .map(group => ({
      ...group,
      layers: group.layers.filter(layer =>
        !normalizedSearch
        || (group.fullLabel + ' ' + layer.label + ' ' + layer.key)
          .toLocaleLowerCase('ar').includes(normalizedSearch)),
    }))
    .filter(group => group.layers.length > 0);

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

  // An enabled switch is not evidence of observations. Expose the distinction
  // only for layers whose event arrays are present in the public payload.
  const observedKeys = new Set(['alert_pins', 'app_news', 'military_activity',
    'naval_activity', 'gdelt_events', 'civil_unrest', 'conflict_zones']);
  const layerObservationState = (key: string, count: number | null): string | null => {
    if (!observedKeys.has(key)) return null;
    if (!activeLayers[key]) return 'متوقفة';
    const failure = data?.layer_errors?.[key] ?? data?.source_errors?.[key];
    if (failure) return 'تعذر جلب المصدر';
    if (count === null) return 'البيانات غير متاحة';
    return count === 0 ? 'لا أحداث مؤهلة' : `${count.toLocaleString('ar-SA')} عنصر منشور`;
  };

  /* ── MOBILE ── */
  if (isMobile) {
    return (
      <div className="flex flex-col gap-4 py-2" dir="rtl">
        <div className="rounded-xl border border-white/20 bg-white/[0.04] p-2.5">
          <label htmlFor="world-layer-search" className="mb-2 block text-[11px] font-semibold text-white/85">
            جميع الطبقات · {availableGroups.reduce((total, group) => total + group.layers.length, 0)} خيارًا
          </label>
          <input id="world-layer-search" type="search" value={mobileSearch}
            onChange={event => setMobileSearch(event.target.value)}
            placeholder="ابحث عن طبقة..."
            className="mb-2 w-full rounded-lg border border-white/20 bg-transparent px-3 py-2 text-xs text-white outline-none placeholder:text-white/45 focus:border-cyan-300/60"
          />
          <div role="group" aria-label="تصفية مجموعات الطبقات"
            className="flex max-h-[116px] flex-wrap content-start gap-1.5 overflow-y-auto">
            {['الكل', ...availableGroups.map(group => group.label)].map(label => (
              <button type="button" key={label} onClick={() => setMobileGroup(label)}
                aria-pressed={mobileGroup === label}
                className={`rounded-lg border px-2 py-1.5 text-[10px] transition-colors ${mobileGroup === label
                  ? 'border-cyan-300/60 bg-cyan-300/15 text-cyan-100'
                  : 'border-white/20 bg-transparent text-white/70'}`}>
                {label}
              </button>
            ))}
          </div>
        </div>
        {visibleGroups.length === 0 && <p role="status" className="rounded-lg border border-white/10 p-3 text-center text-xs text-white/65">لا توجد طبقات مطابقة؛ غيّر عبارة البحث أو المجموعة.</p>}
        {visibleGroups.map((group) => (
          <div key={group.label} className="flex flex-col gap-2">
            <div className="text-[10px] font-mono tracking-[0.2em] uppercase text-white/30 border-b border-white/[0.06] pb-1.5">
              {group.fullLabel}
            </div>
            <div className="flex flex-col gap-1">
              {group.layers.map((layer) => {
                const locked = !hasMapAccess && layerRequiresInvitation(layer.key);
                const isLayerActive = !locked && activeLayers[layer.key];
                const count = locked ? null : getCount(layer.dataKey, layer.catKey);
                const observationState = locked ? null : layerObservationState(layer.key, count);
                const dormant = !locked && !!layer.parent && !activeLayers[layer.parent];
                return (
                  <button
                    key={layer.key}
                    type="button"
                    onClick={() => toggle(layer.key)}
                    disabled={dormant}
                    aria-disabled={dormant || locked}
                    aria-pressed={!!isLayerActive}
                    aria-label={locked ? `${layer.label} · كود الدعوة` : layer.label}
                    
                    className={`relative w-full flex items-center gap-3 py-2 rounded-md text-right hover:bg-white/[0.04] transition-colors ${layer.parent ? 'pl-[22px] pr-1' : 'px-1'} ${dormant ? 'opacity-40' : ''}`}
                  >
                    {layer.parent && <SubLayerStem />}
                    <ToggleSwitch active={!!isLayerActive} />
                    {locked && <LockKeyhole aria-hidden="true" className="h-3.5 w-3.5 shrink-0 text-cyan-100/70" />}
                    <span className={`text-[11px] font-mono uppercase tracking-wider flex-1 transition-colors ${isLayerActive ? 'text-white/80' : 'text-white/40'}`}>
                      {layer.label}
                      {locked && <span className="ms-2 text-[9px] text-cyan-100/60">كود الدعوة</span>}
                      
                    </span>
                    
                    {observationState ? (
                      <span role="status" className="text-[10px] text-white/55">{observationState}</span>
                    ) : count !== null && (
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

        {/* Legal attribution appears separately from layer counts on all surfaces. */}
        {activeLayers.military_activity && (
          <div className="px-1 text-[10px] text-white/45" aria-label="إسناد بيانات الطيران">
            <a href="https://www.adsb.lol/" target="_blank" rel="noopener noreferrer">ADSB.lol</a>
            {' · '}
            <a href="https://opendatacommons.org/licenses/odbl/1-0/" target="_blank" rel="noopener noreferrer">ODbL</a>
          </div>
        )}

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
          const counted = group.layers.filter(l => !l.parent && (hasMapAccess || !layerRequiresInvitation(l.key)));
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
                      ? '#C9E5E8'
                      : isOpen
                        ? 'rgba(255,255,255,0.45)'
                        : 'rgba(255,255,255,0.65)',
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
                    className={`absolute left-[52px] top-1/2 -translate-y-1/2 rounded-xl p-3 z-[100] pointer-events-auto w-[300px] max-w-[calc(100vw-72px)] max-h-[min(70dvh,580px)] overflow-y-auto`}
                    style={{
                      background: 'rgba(10,23,35,0.42)',
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
                      {group.layers.some(layer => !layer.parent && !displayKeys.includes(layer.key)) && (
                        <div className="flex items-center gap-1">
                          <button type="button"
                            onClick={(e) => { e.stopPropagation(); selectGroup(group.layers, true); }}
                            aria-label={`تفعيل كل بيانات ${group.fullLabel}`}
                            className="min-h-8 px-2 rounded text-[10px] text-white/65 hover:text-white hover:bg-white/10 transition-colors">
                            الكل
                          </button>
                          <button type="button"
                            onClick={(e) => { e.stopPropagation(); selectGroup(group.layers, false); }}
                            aria-label={`إلغاء بيانات ${group.fullLabel}`}
                            className="min-h-8 px-2 rounded text-[10px] text-white/65 hover:text-white hover:bg-white/10 transition-colors">
                            إلغاء
                          </button>
                        </div>
                      )}
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
                        const locked = !hasMapAccess && layerRequiresInvitation(layer.key);
                        const isLayerActive = !locked && activeLayers[layer.key];
                        const count = locked ? null : getCount(layer.dataKey, layer.catKey);
                        const observationState = locked ? null : layerObservationState(layer.key, count);
                        const dormant = !locked && !!layer.parent && !activeLayers[layer.parent];

                        return (
                          <button
                            key={layer.key}
                            type="button"
                            onClick={() => toggle(layer.key)}
                            disabled={dormant}
                            aria-disabled={dormant || locked}
                            aria-pressed={!!isLayerActive}
                            aria-label={locked ? `${layer.label} · كود الدعوة` : layer.label}
                            
                            className={`relative w-full rounded-md hover:bg-white/[0.05] transition-colors text-left focus:outline-none focus-visible:ring-1 focus-visible:ring-white/30 ${group.label === 'شبكة وأحداث' ? 'flex flex-col items-stretch gap-1.5 p-2' : 'flex items-center gap-3 py-1.5'} ${layer.parent ? 'pl-[22px] pr-1' : 'px-1'} ${dormant ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'}`}
                          >
                            {group.label === 'شبكة وأحداث' ? (
                              <>
                                <span className="flex w-full min-w-0 items-center gap-2" dir="rtl">
                                  <ToggleSwitch active={!!isLayerActive} />
                                  {locked && <LockKeyhole aria-hidden="true" className="h-3.5 w-3.5 shrink-0 text-cyan-100/70" />}
                                  <span className={`min-w-0 flex-1 text-right text-[11px] font-medium leading-5 ${isLayerActive ? 'text-white/85' : 'text-white/45'}`}>
                                    {layer.label}
                                    {locked && <span className="ms-2 text-[9px] text-cyan-100/60">كود الدعوة</span>}
                                  </span>
                                </span>
                                <span className="flex w-full items-center gap-2" dir="rtl">
                                  
                                  {observationState ? <span role="status" className="text-[10px] text-white/55">{observationState}</span>
                                    : count !== null && <span className="text-[10px] tabular-nums text-white/55">{count.toLocaleString()}</span>}
                                </span>
                                
                              </>
                            ) : (
                              <>
                                {layer.parent && <SubLayerStem />}
                                <ToggleSwitch active={!!isLayerActive} />
                                {locked && <LockKeyhole aria-hidden="true" className="h-3.5 w-3.5 shrink-0 text-cyan-100/70" />}
                                <span className={`text-[11px] font-mono uppercase tracking-wider flex-1 transition-colors duration-200 ${isLayerActive ? 'text-white/70' : 'text-white/35'}`}>
                                  {layer.label}
                                  {locked && <span className="ms-2 text-[9px] text-cyan-100/60">كود الدعوة</span>}
                                  
                                </span>
                                
                                {observationState ? <span role="status" className="text-[10px] text-white/55">{observationState}</span> :
                                count !== null && (
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

      {/* License attribution is legally required; outside operational count rows. */}
      {activeLayers.military_activity && (
        <div className="w-10 text-[8px] leading-snug text-white/45" aria-label="إسناد بيانات الطيران">
          <a href="https://www.adsb.lol/" target="_blank" rel="noopener noreferrer" title="ADSB.lol">ADSB.lol</a>
          {' · '}
          <a href="https://opendatacommons.org/licenses/odbl/1-0/" target="_blank" rel="noopener noreferrer" title="Open Database License">ODbL</a>
        </div>
      )}
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
