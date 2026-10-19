import type { Map } from 'maplibre-gl';
import { COUNTRY_CENTROIDS } from './countryCentroids';

const COUNTRY_SOURCE = 'm3tm-arabic-country-names';
const overrides: Record<string, string> = {
  SA: 'السعودية', YE: 'اليمن', IR: 'إيران', IQ: 'العراق',
  AE: 'الإمارات', OM: 'عُمان', EG: 'مصر', SY: 'سوريا',
  SD: 'السودان', PS: 'فلسطين', TR: 'تركيا',
};

/** A lightweight label-only overlay when terrain/globe raster obscures CARTO labels. */
export function publicArabicCountryLabels() {
  const display = new Intl.DisplayNames(['ar'], { type: 'region', fallback: 'none' });
  return {
    type: 'FeatureCollection' as const,
    features: Object.entries(COUNTRY_CENTROIDS)
      .filter(([code]) => code.length === 2 && display.of(code) !== undefined)
      .map(([code, coordinates]) => ({
        type: 'Feature' as const,
        properties: { code, name: overrides[code] ?? display.of(code) ?? code },
        geometry: { type: 'Point' as const, coordinates },
      })),
  };
}

export function installArabicCountryOverlay(map: Map) {
  if (map.getSource(COUNTRY_SOURCE)) return;
  map.addSource(COUNTRY_SOURCE, { type: 'geojson', data: publicArabicCountryLabels() });
  map.addLayer({
    id: COUNTRY_SOURCE,
    type: 'symbol',
    source: COUNTRY_SOURCE,
    minzoom: 2,
    maxzoom: 8.5,
    layout: {
      'text-field': ['get', 'name'],
      'text-font': ['Noto Sans Regular'],
      'text-size': ['interpolate', ['linear'], ['zoom'], 2, 10, 5, 14, 8, 17],
      'text-max-width': 10,
      'text-allow-overlap': false,
      'text-transform': 'none',
      'symbol-sort-key': 4,
    },
    paint: {
      'text-color': '#fff5dc',
      'text-halo-color': '#081523',
      'text-halo-width': 2,
    },
  });
}
