import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const page = readFileSync(new URL('./page.tsx', import.meta.url), 'utf8');

describe('camera viewer in M3TM.APP public embed', () => {
  it('opens on a selected camera even when WORLD runs inside the APP iframe', () => {
    expect(page).toContain("if (entity?.type === 'cctv') setActiveCamera(entity)");
    expect(page).toContain('camera={activeCamera}');
    expect(page).not.toContain('camera={embedMode ? null : activeCamera}');
    expect(page).toContain('onClose={() => setActiveCamera(null)}');
  });
  it('keeps the independently authorized camera catalog and lazy viewer', () => {
    expect(page).toContain("dynamic(() => import('@/components/CameraViewer'))");
    expect(page).toContain("if (!activeLayers.cctv) return;");
  });
});
