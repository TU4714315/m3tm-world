import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const source = readFileSync(new URL('./page.tsx', import.meta.url), 'utf8');
const optional = [
  'WorldFeed', 'SearchBar', 'DirectionsBar', 'NavigationView',
  'FlightWatchPanel', 'SharePanel', 'ViewPresets', 'LiveAlerts', 'MenaPulse',
];

describe('map startup JS budget: optional panels', () => {
  it.each(optional)('only requests %s when its UI opens', name => {
    expect(source).toContain(`const ${name} = dynamic(() => import('@/components/${name}')`);
    expect(source).not.toMatch(new RegExp(`import ${name} from ['"]@/components/${name}['"]`));
  });

  it('keeps realtime map, verified news ticker, status and permission guard wired on startup', () => {
    expect(source).toContain('const WorldMap = dynamic(() => import');
    expect(source).toContain('<GlobalStatusBar');
    expect(source).toContain('hasMapAccess ? dataRef.current : publicMapClientProjection(dataRef.current)');
    expect(source).toContain('<MapStartupWatchdog');
    expect(source).toContain("import type { RouteResult, LiveLocation }");
  });

  it('does not disable MENA news, conflicts, field alerts or public regional aggregates for speed', () => {
    expect(source).toContain('military_activity: true');
    expect(source).toContain('naval_activity: true');
    expect(source).toContain('gdelt_events: true');
    expect(source).toContain('app_news: true, alert_pins: true, country_borders: true');
  });
});
