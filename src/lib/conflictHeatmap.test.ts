import { describe, expect, it } from 'vitest';
import { conflictHeatmapWeight, conflictHeatmapOpacity } from './conflictHeatmap';

describe('MapLibre conflict heatmap style contract', () => {
  it('only uses camera expressions for heatmap-opacity', () => {
    const opacity = JSON.stringify(conflictHeatmapOpacity);
    expect(opacity).toContain('"zoom"');
    expect(opacity).not.toContain('"get"');
    expect(opacity).not.toContain('cached-stale');
  });
  it('keeps dated or cached-report attenuation in feature-supported heatmap-weight', () => {
    const weight = JSON.stringify(conflictHeatmapWeight);
    expect(weight).toContain('"reportingStrength"');
    expect(weight).toContain('"recencyWeight"');
    expect(weight).toContain('"dataState"');
    expect(weight).toContain('cached-stale');
    expect(weight).toContain('0.25');
  });
});
