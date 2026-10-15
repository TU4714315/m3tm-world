import { describe, expect, it } from 'vitest';
import type { AtlasFeature, AtlasSnapshot } from './iswnAtlas';
import { referenceAtlasDate, referenceAtlasExternalUrl, referenceAtlasFeatures, referenceAtlasLayerLabel, referenceAtlasStateLabel, referenceAtlasTime } from './referenceAtlasView';

const feature = (id: string, layerId: string, kind: 'reference_point' | 'reference_area'): AtlasFeature => ({
  type: 'Feature',
  geometry: kind === 'reference_point' ? { type: 'Point', coordinates: [47, 15] }
    : { type: 'Polygon', coordinates: [[[30, 48], [31, 48], [31, 49], [30, 48]]] },
  properties: { id, layerId, kind, name: id, layerName: layerId, sourcePublishedAt: null,
    sourceUrl: 'https://english.iswnews.com/', attribution: 'ISWN', precision: kind === 'reference_point' ? 'regional' : 'published_area' },
});
const snapshot: AtlasSnapshot = {
  version: 1, provider: 'iswn', status: 'stale', contentKind: 'reference_annotations',
  sourceUrl: 'https://english.iswnews.com/', publisherUrl: 'https://english.iswnews.com/',
  sourcePublishedAt: '2024-06-02T00:00:00.000Z', fetchedAt: '2026-10-15T00:00:00.000Z', checkedAt: null, nextRefreshAt: null,
  featureCount: 3, features: { type: 'FeatureCollection', features: [feature('point-a', 'Yemen map', 'reference_point'), feature('point-b', 'Ukraine map', 'reference_point'), feature('area', 'Regions', 'reference_area')] },
  layers: [], changes: { added: 1, removed: 0, changed: 0 }, refreshReason: 'initial', cacheBackend: 'memory', bulletins: [], error: null,
};

describe('reference atlas presentation contract', () => {
  it('combines folder and geometry filters without relabeling reference annotations as events', () => {
    expect(referenceAtlasFeatures(snapshot, 'Yemen map', 'reference_point').map(f => f.properties.id)).toEqual(['point-a']);
    expect(referenceAtlasFeatures(snapshot, 'Yemen map', 'reference_area')).toEqual([]);
    expect(referenceAtlasFeatures(snapshot, 'all', 'reference_area').map(f => f.properties.id)).toEqual(['area']);
    expect(referenceAtlasFeatures(snapshot, 'missing', 'all')).toEqual([]);
    expect(referenceAtlasFeatures(null, 'all', 'all')).toEqual([]);
  });
  it('retains stale reference geometry and source metadata without mutating the snapshot', () => {
    const before = JSON.stringify(snapshot);
    const result = referenceAtlasFeatures(snapshot, 'all', 'all');
    expect(result).toHaveLength(3);
    expect(result[0]).toBe(snapshot.features.features[0]);
    expect(JSON.stringify(snapshot)).toBe(before);
  });
  it('keeps unknown source dates unknown and separate from fetch timestamps', () => {
    expect(referenceAtlasDate(null)).toBe('غير مؤرّخ');
    expect(referenceAtlasDate('not-a-date')).toBe('غير مؤرّخ');
    expect(referenceAtlasDate(snapshot.sourcePublishedAt)).toBe('2024-06-02');
    expect(referenceAtlasTime(snapshot.fetchedAt)).toBe('2026-10-15 00:00 UTC');
    expect(referenceAtlasTime(null)).toBe('غير متاح');
  });
  it('distinguishes loading, unavailable, stale, and failed checks without live language', () => {
    expect(referenceAtlasStateLabel(null)).toBe('جارٍ جلب المرجع');
    expect(referenceAtlasStateLabel({ status: 'unavailable' })).toBe('المصدر غير متاح');
    expect(referenceAtlasStateLabel(snapshot)).toBe('مرجع قديم / محفوظ');
    expect(referenceAtlasStateLabel({ status: 'ok' })).toBe('لقطة مرجعية');
    expect(referenceAtlasStateLabel(snapshot, true)).toContain('تعذر الفحص');
  });
  it('uses geographic folder labels without inferring sides or control', () => {
    expect(referenceAtlasLayerLabel('Yemen map')).toBe('اليمن');
    expect(referenceAtlasLayerLabel('Regions (Last Update: 2024-06-02 / Ukraine - Palestine map)')).toBe('مناطق سياقية · أوكرانيا / فلسطين');
    expect(referenceAtlasLayerLabel('New source folder')).toBe('New source folder');
  });
  it('does not turn unsafe or credential-bearing strings into external links', () => {
    expect(referenceAtlasExternalUrl('javascript:alert(1)')).toBeUndefined();
    expect(referenceAtlasExternalUrl('https://user:secret@example.com/')).toBeUndefined();
    expect(referenceAtlasExternalUrl('not a url')).toBeUndefined();
    expect(referenceAtlasExternalUrl('https://english.iswnews.com/')).toBe('https://english.iswnews.com/');
  });
});
