import { describe, expect, it } from 'vitest';
import { SAT_MAX_ZOOM, satelliteLayerVisibleAtZoom } from './satellite-layer';

describe('satellite city-zoom visibility guard', () => {
  it('draws/picks satellites at or below the world-view ceiling', () => {
    expect(SAT_MAX_ZOOM).toBe(7);
    expect(satelliteLayerVisibleAtZoom(0)).toBe(true);
    expect(satelliteLayerVisibleAtZoom(7)).toBe(true);
  });

  it('temporarily hides them above the ceiling without implying their GPU buffer is empty', () => {
    expect(satelliteLayerVisibleAtZoom(7.01)).toBe(false);
    expect(satelliteLayerVisibleAtZoom(15)).toBe(false);
  });

  it('fails open on a non-finite zoom instead of permanently blanking the layer', () => {
    expect(satelliteLayerVisibleAtZoom(Number.NaN)).toBe(true);
  });
});
