import { describe, expect, it } from 'vitest';
import { isMajorIswnBulletin, MAX_KML_BYTES, parseIswnBulletins, parseIswnKml } from './iswnAtlasParser';
import { atlasEvidence, atlasLayers, calculateAtlasChanges } from './iswnAtlas';

const point = (name = 'Reference', coords = '36.123456,33.56789,0') => `<Placemark><name>${name}</name><description><![CDATA[<img src="https://remote/icon">private markup]]></description><Point><coordinates>${coords}</coordinates></Point></Placemark>`;
const kml = (body: string) => `<kml><Document>${body}</Document></kml>`;
const polygon = (hole = '') => `<Polygon><outerBoundaryIs><LinearRing><coordinates>30,30 31,30 31,31 30,30</coordinates></LinearRing></outerBoundaryIs>${hole}</Polygon>`;

describe('ISWN reference KML parser', () => {
  it('does not assign mixed-country folder dates to Yemen geometries or nested folders', () => {
    const output = parseIswnKml(kml(`<Folder><name>Regions (Last Update: 2024-06-02 / Ukraine - Palestine map)</name><Placemark><name>AnsarAllah in Lahij</name>${polygon()}</Placemark><Folder><name>Yemen map</name>${point('Aden')}</Folder></Folder>`));
    expect(output.features).toHaveLength(2);
    expect(output.features.every(feature => feature.properties.sourcePublishedAt === null)).toBe(true);
    expect(output.features[0].properties.layerName).toContain('2024-06-02');
    expect(atlasEvidence(output.features, Date.parse('2026-10-16T12:00:00Z'))).toMatchObject({
      evidenceState: 'unknown', currentControl: false, sourcePublishedAt: null, undatedFeatureCount: 2,
    });
  });
  it('retains separately published areas with the same actor/name', () => {
    const output = parseIswnKml(kml(`<Placemark><name>AnsarAllah in Lahij</name>${polygon()}</Placemark><Placemark><name>AnsarAllah in Lahij</name>${polygon().replaceAll('30,', '29,')}</Placemark>`));
    expect(output.features).toHaveLength(2);
    expect(new Set(output.features.map(feature => feature.properties.id)).size).toBe(2);
  });
  it('retains folder labels without inferring feature dates, generalizes points, and allowlists properties', () => {
    const output = parseIswnKml(kml(`<Folder><name>Regions (Last Update: 2024-06-02)</name><Placemark><name>Area claim</name>${polygon()}</Placemark></Folder><Folder><name>Syria</name>${point()}</Folder>`));
    expect(output.features[0].properties.sourcePublishedAt).toBeNull();
    expect(output.features[1].properties.sourcePublishedAt).toBeNull();
    expect(output.features[1].geometry).toEqual({ type: 'Point', coordinates: [36, 33.5] });
    expect(output.features[1].properties.precision).toBe('regional');
    expect(JSON.stringify(output)).not.toContain('private markup');
    expect(JSON.stringify(output)).not.toContain('https://remote');
    expect(atlasLayers(output.features).map(layer => layer.count)).toEqual([1, 1]);
  });

  it('preserves polygon holes, areas and generalized published lines while omitting timed tracks and network links', () => {
    const hole = '<innerBoundaryIs><LinearRing><coordinates>30.2,30.2 30.4,30.2 30.4,30.4 30.2,30.2</coordinates></LinearRing></innerBoundaryIs>';
    const output = parseIswnKml(kml(`<Placemark><name>Areas</name><MultiGeometry>${polygon(hole)}${polygon()}<LineString><coordinates>35,31 36,32</coordinates></LineString></MultiGeometry></Placemark><NetworkLink><Link><href>https://remote/kml</href></Link></NetworkLink>`));
    expect(output.features).toHaveLength(2);
    expect(output.features.find(feature => feature.geometry.type === 'LineString')?.properties.kind).toBe('reference_line');
    const geometry = output.features.find(feature => feature.geometry.type === 'MultiPolygon')!.geometry;
    expect(geometry.type).toBe('MultiPolygon');
    if (geometry.type === 'MultiPolygon') expect(geometry.coordinates.map(area => area.length)).toEqual([2, 1]);
  });

  it('generalizes static published lines, drops collapsed lines and suppresses Saudi crossings before and after rounding', () => {
    const line = (name: string, coords: string) => `<Placemark><name>${name}</name><LineString><coordinates>${coords}</coordinates></LineString></Placemark>`;
    const output = parseIswnKml(kml(point() + line('Published line', '44.1234,13.2345 44.321,13.563')
      + line('Collapsed', '36.01,33.01 36.02,33.02')
      + line('Saudi crossing', '30,24 60,24')
      + line('Original Saudi point', '46.6753,24.7136 55,25')
      + '<Placemark><gx:Track><gx:coord>44 13 0</gx:coord><gx:coord>45 14 0</gx:coord></gx:Track></Placemark>'));
    const lines = output.features.filter(feature => feature.geometry.type === 'LineString');
    expect(lines).toHaveLength(1);
    expect(lines[0].geometry).toEqual({ type: 'LineString', coordinates: [[44, 13.25], [44.25, 13.5]] });
    expect(lines[0].properties.precision).toBe('generalized_line');
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
