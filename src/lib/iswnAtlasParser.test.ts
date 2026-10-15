import { describe, expect, it } from 'vitest';
import { isMajorIswnBulletin, MAX_KML_BYTES, parseIswnBulletins, parseIswnKml } from './iswnAtlasParser';
import { atlasLayers, calculateAtlasChanges } from './iswnAtlas';

const point = (name = 'Reference', coords = '36.123456,33.56789,0') => `<Placemark><name>${name}</name><description><![CDATA[<img src="https://remote/icon">private markup]]></description><Point><coordinates>${coords}</coordinates></Point></Placemark>`;
const kml = (body: string) => `<kml><Document>${body}</Document></kml>`;
const polygon = (hole = '') => `<Polygon><outerBoundaryIs><LinearRing><coordinates>30,30 31,30 31,31 30,30</coordinates></LinearRing></outerBoundaryIs>${hole}</Polygon>`;

describe('ISWN reference KML parser', () => {
  it('retains separately published areas with the same actor/name', () => {
    const output = parseIswnKml(kml(`<Placemark><name>AnsarAllah in Lahij</name>${polygon()}</Placemark><Placemark><name>AnsarAllah in Lahij</name>${polygon().replaceAll('30,', '29,')}</Placemark>`));
    expect(output.features).toHaveLength(2);
    expect(new Set(output.features.map(feature => feature.properties.id)).size).toBe(2);
  });
  it('retains explicit folder date only, generalizes points, and exposes only allowlisted properties', () => {
    const output = parseIswnKml(kml(`<Folder><name>Regions (Last Update: 2024-06-02)</name><Placemark><name>Area claim</name>${polygon()}</Placemark></Folder><Folder><name>Syria</name>${point()}</Folder>`));
    expect(output.features[0].properties.sourcePublishedAt).toBe('2024-06-02T00:00:00.000Z');
    expect(output.features[1].properties.sourcePublishedAt).toBeNull();
    expect(output.features[1].geometry).toEqual({ type: 'Point', coordinates: [36, 33.5] });
    expect(output.features[1].properties.precision).toBe('regional');
    expect(JSON.stringify(output)).not.toContain('private markup');
    expect(JSON.stringify(output)).not.toContain('https://remote');
    expect(atlasLayers(output.features).map(layer => layer.count)).toEqual([1, 1]);
  });

  it('preserves polygon holes and multiple polygons while omitting exact tracks and network links', () => {
    const hole = '<innerBoundaryIs><LinearRing><coordinates>30.2,30.2 30.4,30.2 30.4,30.4 30.2,30.2</coordinates></LinearRing></innerBoundaryIs>';
    const output = parseIswnKml(kml(`<Placemark><name>Areas</name><MultiGeometry>${polygon(hole)}${polygon()}<LineString><coordinates>35,31 36,32</coordinates></LineString></MultiGeometry></Placemark><NetworkLink><Link><href>https://remote/kml</href></Link></NetworkLink>`));
    expect(output.features).toHaveLength(1);
    const geometry = output.features[0].geometry;
    expect(geometry.type).toBe('MultiPolygon');
    if (geometry.type === 'MultiPolygon') expect(geometry.coordinates.map(area => area.length)).toEqual([2, 1]);
  });

  it('omits Saudi points using original coordinates before generalization', () => {
    const output = parseIswnKml(kml(point('Riyadh', '46.6753,24.7136') + point()));
    expect(output.features).toHaveLength(1);
    expect(output.features[0].properties.name).toBe('Reference');
  });

  it('rejects malformed, non-finite, entity, deep, oversized and empty geometry documents', () => {
    for (const xml of [kml(point('bad', 'NaN,33')), kml(point('bad', '181,20')),
      kml('<Placemark><Polygon><outerBoundaryIs><LinearRing><coordinates>30,30 31,30 31,31</coordinates></LinearRing></outerBoundaryIs></Polygon></Placemark>'),
      '<kml><Document></kml>', '<!DOCTYPE kml [<!ENTITY x SYSTEM "file:///etc/passwd">]>' + kml(point()),
      kml('<Folder>'.repeat(70) + point() + '</Folder>'.repeat(70)), ' '.repeat(MAX_KML_BYTES + 1)]) {
      expect(() => parseIswnKml(xml)).toThrow();
    }
  });

  it('diffs public geometries by identity and content', () => {
    const original = parseIswnKml(kml(point()));
    const edited = structuredClone(original);
    edited.features[0].properties.name = 'Updated claim';
    expect(calculateAtlasChanges(original, edited)).toEqual({ added: 0, removed: 0, changed: 1 });
  });
});

describe('ISWN publisher report trigger', () => {
  const now = Date.parse('2026-10-15T12:00:00Z');
  const report = { id: 'one', title: 'New offensive reported in Syria', url: 'https://english.iswnews.com/1/', publishedAt: '2026-10-15T11:00:00Z' };
  it('requires a concrete headline and a source publication date in the past six hours', () => {
    expect(isMajorIswnBulletin(report, now)).toBe(true);
    expect(isMajorIswnBulletin({ ...report, publishedAt: '2026-10-01T11:00:00Z' }, now)).toBe(false);
    expect(isMajorIswnBulletin({ ...report, publishedAt: '2026-10-16T11:00:00Z' }, now)).toBe(false);
    expect(isMajorIswnBulletin({ ...report, title: 'Military Knowledge: Drone' }, now)).toBe(false);
  });
  it('keeps attributed publisher links and dates, dropping invalid/external items', () => {
    const feed = `<rss><channel><item><title>${report.title}</title><link>${report.url}</link><pubDate>${report.publishedAt}</pubDate></item><item><title>Fake</title><link>https://other.example/</link><pubDate>${report.publishedAt}</pubDate></item><item><title>Undated</title><link>${report.url}</link></item></channel></rss>`;
    expect(parseIswnBulletins(feed)).toEqual([expect.objectContaining({ title: report.title, url: report.url, publishedAt: '2026-10-15T11:00:00.000Z' })]);
  });
  it('rejects credential URLs and non-article paths; strips query and fragment', () => {
    const credentialFixture = new URL('https://english.iswnews.com/1/');
    credentialFixture.username = 'fixture-user';
    credentialFixture.password = 'fixture-password';
    const urls = [credentialFixture.href, 'https://english.iswnews.com:8080/1/',
      'https://english.iswnews.com/wp-admin/', 'https://english.iswnews.com/1/article/?token=secret#hidden'];
    const xml = `<rss><channel>${urls.map(url => `<item><title>Report</title><link>${url}</link><pubDate>${report.publishedAt}</pubDate></item>`).join('')}</channel></rss>`;
    expect(parseIswnBulletins(xml).map(item => item.url)).toEqual(['https://english.iswnews.com/1/article/']);
  });
});
