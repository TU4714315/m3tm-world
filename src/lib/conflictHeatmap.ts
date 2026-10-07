/**
 * MapLibre heatmap-opacity supports zoom/camera expressions, NOT feature data.
 * Apply per-report age attenuation in heatmap-weight, which is data-driven.
 */
export const conflictHeatmapWeight = [
  '*',
  ['interpolate', ['linear'], ['coalesce', ['get', 'reportingStrength'], 20], 0, 0.1, 40, 0.45, 70, 0.75, 100, 1],
  ['coalesce', ['get', 'recencyWeight'], 0.45],
  ['case', ['==', ['get', 'dataState'], 'cached-stale'], 0.25, 1],
] as const;

export const conflictHeatmapOpacity = [
  'interpolate', ['linear'], ['zoom'], 0, 0.55, 6, 0.42, 8, 0.18,
] as const;
