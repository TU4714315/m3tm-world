import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

describe('map first-paint network warming', () => {
  it('preloads exactly the MapLibre vector style used by WORLD', () => {
    const layout = readFileSync(join(process.cwd(), 'src/app/layout.tsx'), 'utf8');
    const map = readFileSync(join(process.cwd(), 'src/components/WorldMap.tsx'), 'utf8');
    const style = 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json';
    expect(map).toContain(style);
    expect(layout).toContain(`rel="preload" href="${style}" as="fetch" crossOrigin="anonymous"`);
    expect(layout).toContain('rel="preconnect" href="https://basemaps.cartocdn.com"');
    expect(layout).toContain('rel="preconnect" href="https://tiles.basemaps.cartocdn.com"');
    expect(layout).not.toContain('/api/proxy-tiles');
    // A single exact preload prevents duplicate network downloads.
    expect(layout.split(`rel="preload" href="${style}"`)).toHaveLength(2);
  });
});
