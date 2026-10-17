import { describe, expect, it } from 'vitest';
import { selectDataLayers } from './layerBulkSelection';

const layers = [
  { key: 'flights' }, { key: 'wind' }, { key: 'wind_controls', parent: 'wind' },
  { key: 'military_activity' }, { key: 'day_night' }, { key: 'terrain_3d' },
];

describe('bulk data selection', () => {
  it('selects all eligible data from a partial selection without changing display or child preferences', () => {
    const state = { flights: true, wind: false, wind_controls: false, day_night: false, terrain_3d: true, future_layer: true };
    expect(selectDataLayers(state, layers, true, ['day_night', 'terrain_3d'], () => true))
      .toEqual({ ...state, wind: true, military_activity: true });
    expect(state.wind).toBe(false);
  });
  it('clears only eligible data and never changes a restricted layer', () => {
    const state = { flights: true, wind: true, wind_controls: true, military_activity: true, day_night: true, terrain_3d: false };
    expect(selectDataLayers(state, layers, false, ['day_night', 'terrain_3d'], key => key !== 'military_activity'))
      .toEqual({ ...state, flights: false, wind: false });
  });
  it('respects the supplied catalog allowlist and future presentation controls', () => {
    const state = { flights: false, wind: true, new_presentation: false };
    expect(selectDataLayers(state, [{ key: 'flights' }, { key: 'new_presentation' }], true, ['new_presentation'], () => true))
      .toEqual({ ...state, flights: true });
  });
});
