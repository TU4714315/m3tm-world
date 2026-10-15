import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const panel = readFileSync(new URL('./LayerPanel.tsx', import.meta.url), 'utf8');

describe('WORLD independent public layer controls', () => {
  it('keeps the generic public group separate from aircraft controls', () => {
    const general = panel.split("label: 'عام',")[1]?.split("label: 'الطيران',")[0];
    const aircraft = panel.split("label: 'الطيران',")[1]?.split("label: 'البحرية',")[0];
    expect(general).toBeTruthy();
    expect(general).not.toContain("key: 'sdk_air'");
    expect(aircraft).toContain("key: 'sdk_air'");
    expect(aircraft).toContain("key: 'flights'");
  });

  it('does not let a disabled child layer become active without its parent', () => {
    expect(panel).toContain('if (layer?.parent && !activeLayers[layer.parent]) return;');
    expect(panel).toContain('if (layer?.parent && !prev[layer.parent]) return prev;');
    expect(panel.match(/(?:^|\s)disabled=\{dormant\}/g)).toHaveLength(2);
    expect(panel.match(/aria-disabled=\{dormant \|\| locked\}/g)).toHaveLength(2);
  });

  it('turns child display toggles off when disabling the parent', () => {
    expect(panel).toContain('if (child.parent === key) next[child.key] = false;');
  });

  it('never uses layer toggles to navigate to an airplane tool or another route', () => {
    const method = panel.split('const toggle = (key: string) => {')[1]?.split('const terrainDetails =')[0];
    expect(method).toBeTruthy();
    expect(method).not.toMatch(/router\.|window\.location|pushState|setMobilePanel|setActiveCamera/);
  });
});
