import { describe, expect, it } from 'vitest';
import { publicReferenceAtlas } from './publicReferenceAtlas';
import { maskSaudiPublicIndicators } from './publicCountryVisibility';
const annotation = (id: string, layerId: string, layerName: string, coordinates: number[]) => ({
  type: 'Feature', geometry: { type: 'Point', coordinates },
  properties: { id, name: '<b>Reference town</b>', layerId, layerName,
    sourcePublishedAt: null, internalToken: 'private-marker', html: '<script>attack()</script>', sourceUrl: 'https://example.invalid' },
});
const snapshot = {
  version: 1, provider: 'iswn', contentKind: 'reference_annotations', status: 'ok',
  fetchedAt: '2026-10-15T10:00:00Z', sourcePublishedAt: null,
  features: { type: 'FeatureCollection', features: [annotation('ye', 'yemen', 'Yemen map', [44.191, 15.369])] },
  featureCount: 999, layers: [{ id: 'yemen', name: 'Yemen map', count: 999 }],
  changes: { added: 1, removed: 0, changed: 0 },
};
describe('reference atlas public contract', () => {
  it('retains generalized published lines through the browser projection without Saudi crossings or collapsed paths', () => {
    const line = (id: string, coordinates: number[][]) => ({
      ...annotation(id, 'yemen', 'Yemen map', []), geometry: { type: 'LineString', coordinates },
    });
    const result = publicReferenceAtlas({ ...snapshot, features: { type: 'FeatureCollection', features: [
      line('published', [[44.1234, 13.2345], [44.321, 13.563]]),
      line('crossing', [[30, 24], [60, 24]]), line('collapsed', [[44.01, 13.01], [44.02, 13.02]]),
    ] } })!;
    expect(result.featureCount).toBe(1);
    expect(result.features.features[0].geometry).toEqual({ type: 'LineString', coordinates: [[44, 13.25], [44.25, 13.5]] });
    expect(result.features.features[0].properties).toMatchObject({ kind: 'reference_line', precision: 'generalized_line' });
    expect(result.layers[0].count).toBe(1);
  });
  it('keeps retrieval time separate from unknown source date and strips private/HTML/exact point fields', () => {
    const result = publicReferenceAtlas(snapshot)!;
    expect(result.fetchedAt).toBe('2026-10-15T10:00:00.000Z');
    expect(result.sourcePublishedAt).toBeNull();
    expect(result.featureCount).toBe(1);
    expect(result.features.features[0].geometry.coordinates).toEqual([44.25, 15.25]);
    expect(result.layers[0].count).toBe(1);
    expect(JSON.stringify(result)).not.toMatch(/private-marker|<script>|example.invalid|44.191/);
  });
  it('suppresses Saudi layers and enclosing polygons, retaining Yemen and recomputing counts', () => {
    const area = { ...annotation('area', 'regions', 'Regions', []), geometry: { type: 'Polygon', coordinates: [[[30, 10], [65, 10], [65, 36], [30, 36], [30, 10]]] } };
    const atlas = { ...snapshot, layers: [...snapshot.layers, { id: 'saudi', name: 'Saudi map', count: 1 }, { id: 'regions', name: 'Regions', count: 1 }],
      features: { type: 'FeatureCollection', features: [...snapshot.features.features, annotation('sa', 'saudi', 'Saudi map', [0, 0]), area] } };
    const result = maskSaudiPublicIndicators({ reference_atlas: publicReferenceAtlas(atlas)! }).reference_atlas;
    expect(result.featureCount).toBe(1);
    expect(result.layers.map(layer => layer.id)).toEqual(['yemen']);
    expect(result.changes).toBeNull();
    expect(atlas.features.features).toHaveLength(3);
  });
  it('rejects malformed geometry and signed or foreign bulletin URLs', () => {
    const result = publicReferenceAtlas({ ...snapshot,
      features: { type: 'FeatureCollection', features: [{ ...snapshot.features.features[0], geometry: { type: 'Point', coordinates: [200, 0] } }] },
      bulletins: [
        { id: 'bad', title: 'External', url: 'https://attacker.invalid/1/story/', publishedAt: '2026-10-15' },
        { id: 'good', title: 'Publisher report', url: 'https://english.iswnews.com/1/story/?token=never-forward#fragment', publishedAt: '2026-10-15' },
      ],
    })!;
    expect(result.features.features).toHaveLength(0);
    expect(result.bulletins).toEqual([expect.objectContaining({ url: 'https://english.iswnews.com/1/story/' })]);
    expect(result.changes).toBeNull();
  });
  it('suppresses original Saudi geometry before projecting generalized public points', () => {
    const result = publicReferenceAtlas({ ...snapshot,
      features: { type: 'FeatureCollection', features: [annotation('sa', 'region', 'Reference map', [46.6753, 24.7136])] },
    })!;
    expect(result.features.features).toEqual([]);
    expect(result.layers).toEqual([]);
  });
});
