import { describe, expect, it } from 'vitest';
import { cartoMapRequestUrl } from './mapTileTransport';

const style = 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json';
const tile = 'https://tiles-a.basemaps.cartocdn.com/vectortiles/carto.streets/v1/4/10/6.mvt';

describe('CARTO tile transport for recovery hosting', () => {
  it('keeps CARTO style and tile CDN-direct on Render to avoid CPU-heavy per-tile proxies', () => {
    const origin = 'https://m3tm-world-recovery.onrender.com';
    expect(cartoMapRequestUrl(style, 'm3tm-world-recovery.onrender.com', origin)).toBe(style);
    expect(cartoMapRequestUrl(tile, 'm3tm-world-recovery.onrender.com', origin)).toBe(tile);
  });
  it('keeps the future reviewed short WORLD hostname CDN-direct too', () => {
    const origin = 'https://world.m3tm.app';
    expect(cartoMapRequestUrl(style, 'world.m3tm.app', origin)).toBe(style);
    expect(cartoMapRequestUrl(tile, 'world.m3tm.app', origin)).toBe(tile);
  });
  it('preserves the current Vercel same-origin tile proxy outside Render', () => {
    const origin = 'https://m3tm-world.vercel.app';
    expect(cartoMapRequestUrl(style, 'm3tm-world.vercel.app', origin))
      .toBe(`${origin}/api/proxy-tiles?url=${encodeURIComponent(style)}`);
  });
  it('does not rewrite non-CARTO assets or malicious lookalikes', () => {
    const origin = 'https://m3tm-world-recovery.onrender.com';
    const other = 'https://cartocdn.com.evil.example/path';
    expect(cartoMapRequestUrl(other, 'm3tm-world-recovery.onrender.com', origin)).toBe(other);
    expect(cartoMapRequestUrl('/vendor/maplibre/6.9.0/maplibre-gl-worker.mjs', 'm3tm-world-recovery.onrender.com', origin))
      .toBe('/vendor/maplibre/6.9.0/maplibre-gl-worker.mjs');
    expect(cartoMapRequestUrl('https://server.arcgisonline.com/x', 'm3tm-world-recovery.onrender.com', origin))
      .toBe('https://server.arcgisonline.com/x');
  });
});
