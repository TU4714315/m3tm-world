import type { AtlasSnapshot } from './iswnAtlas';

export type ReferenceAtlasKind = 'all' | 'reference_point' | 'reference_area' | 'reference_line';

export function referenceAtlasStateLabel(snapshot: Pick<AtlasSnapshot, 'status'> | null | undefined, fetchFailed = false): string {
  if (fetchFailed) return 'تعذر الفحص · لقطة محفوظة إن توفرت';
  if (!snapshot) return 'جارٍ جلب المرجع';
  if (snapshot.status === 'unavailable') return 'المصدر غير متاح';
  return snapshot.status === 'stale' ? 'مرجع قديم / محفوظ' : 'لقطة مرجعية';
}

/** Labels describe the publisher's folders; they never assign an actor or control. */
export function referenceAtlasLayerLabel(name: string): string {
  if (/^Regions\b/i.test(name)) return 'مناطق سياقية · أوكرانيا / فلسطين';
  const labels: Record<string, string> = {
    'Yemen map': 'اليمن', 'Syrian map': 'سوريا',
    'Palestine and Lebanon map': 'فلسطين ولبنان', 'Iraq map': 'العراق',
    'Libya map': 'ليبيا', 'Afghanistan map': 'أفغانستان',
    'Ukraine map': 'أوكرانيا', 'Caucasus region': 'القوقاز',
  };
  return labels[name] ?? name;
}

export function referenceAtlasFeatures(snapshot: AtlasSnapshot | null | undefined, layerId: string, kind: ReferenceAtlasKind) {
  return (snapshot?.features?.features ?? []).filter(feature =>
    (layerId === 'all' || feature.properties.layerId === layerId)
    && (kind === 'all' || feature.properties.kind === kind));
}

export function referenceAtlasDate(value: string | null | undefined): string {
  if (!value || !Number.isFinite(Date.parse(value))) return 'غير مؤرّخ';
  return new Date(value).toISOString().slice(0, 10);
}

/** Published reference dates never assert current territorial control. */
export function referenceAtlasEvidenceLabel(value: string | null | undefined): string {
  const date = referenceAtlasDate(value);
  return date === 'غير مؤرّخ' ? 'مرجع غير مؤرّخ' : `مرجع منشور · ${date}`;
}

export function referenceAtlasTime(value: string | null | undefined): string {
  if (!value || !Number.isFinite(Date.parse(value))) return 'غير متاح';
  return `${new Date(value).toISOString().slice(0, 16).replace('T', ' ')} UTC`;
}

export function referenceAtlasExternalUrl(value: string | null | undefined): string | undefined {
  if (!value) return undefined;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && !url.username && !url.password ? url.href : undefined;
  } catch { return undefined; }
}
