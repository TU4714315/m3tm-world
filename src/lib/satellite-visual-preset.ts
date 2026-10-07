/**
 * M3TM.WORLD basemap image grading, performed only by MapLibre on raster tiles.
 * Never CSS-filter the entire canvas: it would also alter alerts, labels,
 * icons, source attribution and even the public-safety credibility colors.
 * These values are within MapLibre's documented raster paint constraints.
 */
export const SATELLITE_VISUAL_PRESETS = {
  original: {
    labelAr: 'أصلي',
    descriptionAr: 'صورة Esri الأصلية بتعديلات خفيفة',
    opacity: 0.96,
    contrast: 0.08,
    saturation: 0.04,
    brightnessMin: 0.03,
    brightnessMax: 1,
  },
  clarity: {
    labelAr: 'واضح',
    descriptionAr: 'صورة أقل تشبعًا وأقصر نطاقًا لتبرز الحدود والأسماء والأحداث فوق القمر الصناعي',
    opacity: 1,
    contrast: 0.18,
    saturation: -0.08,
    brightnessMin: 0.03,
    brightnessMax: 0.90,
  },
  bright: {
    labelAr: 'مضاء',
    descriptionAr: 'تفاصيل أفتح في المناطق الداكنة لسهولة القراءة',
    opacity: 0.99,
    contrast: 0.08,
    saturation: 0.10,
    brightnessMin: 0.18,
    brightnessMax: 1,
  },
} as const;
export type SatelliteVisualPreset = keyof typeof SATELLITE_VISUAL_PRESETS;

type StyleLayerLike = { id?: string; type?: string; source?: string; 'source-layer'?: string };

/** Place imagery below vector labels while leaving later M3TM overlays above it. */
export function satelliteInsertionAnchor(layers: readonly StyleLayerLike[] | undefined): string | undefined {
  return layers?.find(layer => layer.type === 'symbol' && typeof layer['source-layer'] === 'string')?.id;
}

/** Source tiles, labels and attribution remain unchanged. */
export function satelliteRasterPaint(mode: SatelliteVisualPreset) {
  const p = SATELLITE_VISUAL_PRESETS[mode];
  return {
    'raster-opacity': p.opacity,
    'raster-resampling': 'linear' as const,
    'raster-contrast': p.contrast,
    'raster-saturation': p.saturation,
    'raster-brightness-min': p.brightnessMin,
    'raster-brightness-max': p.brightnessMax,
    'raster-fade-duration': 120,
  };
}
