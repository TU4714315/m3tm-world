import { describe, expect, it } from 'vitest';
import { cartoMapRequestUrl } from './mapTileTransport';

const style = 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json';
const tile = 'https://tiles-a.basemaps.cartocdn.com/vectortiles/carto.streets/v1/4/10/6.mvt';

describe('CARTO tile transport on recovery hosting', () => {
  it('keeps CARTO style and tiles CDN-direct on Render', () => {
    const origin = 'https://m3tm-world-recovery.onrender.com';
    expect(cartoMapRequestUrl(style, 'm3tm-world-recovery.onrender.com', origin)).toBe(style);
    expect(cartoMapRequestUrl(tile, 'm3tm-world-recovery.onrender.com', origin)).toBe(tile);
  });
  it('keeps the intended custom WORLD hostname CDN-direct', () => {
    expect(cartoMapRequestUrl(style, 'world.m3tm.app', 'https://world.m3tm.app')).toBe(style);
  });
  it('preserves Vercel same-origin tile proxy', () => {
    const origin = 'https://m3tm-world.vercel.app';
    expect(cartoMapRequestUrl(style, 'm3tm-world.vercel.app', origin))
      .toBe(`${origin}/api/proxy-tiles?url=${encodeURIComponent(style)}`);
  });
  it('does not rewrite arbitrary or lookalike hosts', () => {
    const origin = 'https://m3tm-world-recovery.onrender.com';
    for (const value of [
      'https://cartocdn.com.evil.example/path',
      'https://server.arcgisonline.com/x',
      '/vendor/maplibre/6.9.0/maplibre-gl-worker.mjs',
    ]) {
      expect(cartoMapRequestUrl(value, 'm3tm-world-recovery.onrender.com', origin)).toBe(value);
    }
  });
});
