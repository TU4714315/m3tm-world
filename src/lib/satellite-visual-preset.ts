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
    labelAr: 'رصد',
    descriptionAr: 'صورة أوضح في المناطق الداكنة مع الحفاظ على تضاريس الأرض وألوان الإشارات',
    opacity: 0.98,
    contrast: 0.12,
    saturation: 0.08,
    brightnessMin: 0.10,
    brightnessMax: 1,
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
